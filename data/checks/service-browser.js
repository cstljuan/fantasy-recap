#!/usr/bin/env node
'use strict';
// The app against the service, in a real browser: start the service on the database in DATABASE_URL, open the app with
// ?api=<service>, and check that what the page reads and writes arrives.
//   DATABASE_URL=<connection string> node data/checks/service-browser.js
// Checks, in Chrome at phone width (found as tools/smoke.sh finds it, or $CHROME):
//   1. the page calls GET /health and GET /league and gets 200 (the league home is drawn from the service),
//   2. tapping Opt in sends POST /games/week11-football/optin, the page says "Saved to the league", and the row is in the
//      optins table (the row is removed again unless it was there before),
//   3. from the page's own address (so CORS is part of the proof) momentum, trend and Scout answer with the shapes the
//      screens need: momentum buckets with an engine, a trend with weeks and a summary, a scouting report with claims
//      that each cite plays. The app does not call these three yet (task B39); this proves the answers can reach it.
// Without DATABASE_URL it prints SKIPPED and exits 0; without Chrome it exits 2 (data/checks/all.js counts that as skipped).
// It saves the week 11 game's plays under their real id if they are not there yet (a repeat adds nothing).
var fs = require('fs');
var path = require('path');
var http = require('http');
var os = require('os');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var failures = 0;
function line(ok, what, why) { if (!ok) failures += 1; console.log((ok ? 'OK   ' : 'FAIL ') + what + (ok || !why ? '' : ': ' + why)); }

var index = require(path.join(ROOT, 'server', 'index.js'));
index.loadEnv(path.join(ROOT, '.env'));
if (!process.env.DATABASE_URL) { console.log('SKIPPED: DATABASE_URL is not set, so the app was not tried against a real service.'); process.exit(0); }

function findChrome() {
  var list = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  ['google-chrome', 'chromium', 'chromium-browser'].forEach(function (n) {
    try { list.push(cp.execSync('command -v ' + n, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()); } catch (e) { /* not there */ }
  });
  [path.join(os.homedir(), '.cache', 'ms-playwright'), '/opt/pw-browsers'].forEach(function (dir) {
    try {
      fs.readdirSync(dir).filter(function (d) { return /^chromium-\d+$/.test(d); }).sort().reverse().forEach(function (d) {
        ['chrome-linux64', 'chrome-linux'].forEach(function (sub) { list.push(path.join(dir, d, sub, 'chrome')); });
      });
    } catch (e) { /* no such folder */ }
  });
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    try { if (c && fs.statSync(c).isFile()) return c; } catch (e) { /* next */ }
  }
  return null;
}

var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
function serve() {
  return new Promise(function (res) {
    var srv = http.createServer(function (req, out) {
      var p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      var f = path.join(ROOT, p);
      if (f.indexOf(ROOT) !== 0) { out.writeHead(403); out.end(); return; }
      fs.readFile(f, function (err, data) {
        if (err) { out.writeHead(404); out.end(); return; }
        out.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
        out.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', function () { res(srv); });
  });
}

function startChrome(bin) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fr-flow-'));
  var proc = cp.spawn(bin, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', '--user-data-dir=' + dir, '--window-size=375,812', '--autoplay-policy=no-user-gesture-required', 'about:blank'],
    { stdio: 'ignore' });
  return new Promise(function (res, rej) {
    var tries = 0;
    (function look() {
      try {
        var port = fs.readFileSync(path.join(dir, 'DevToolsActivePort'), 'utf8').split('\n')[0];
        if (port) return res({ proc: proc, port: port, dir: dir });
      } catch (e) { /* not yet */ }
      if (++tries > 100) return rej(new Error('Chrome did not start'));
      setTimeout(look, 100);
    })();
  });
}

// A minimal DevTools protocol client over Node's WebSocket.
function connect(url) {
  return new Promise(function (res, rej) {
    var ws = new WebSocket(url), id = 0, waiting = {};
    ws.onopen = function () {
      res({
        send: function (method, params, sessionId) {
          return new Promise(function (ok, bad) {
            var n = ++id;
            waiting[n] = { ok: ok, bad: bad };
            var msg = { id: n, method: method, params: params || {} };
            if (sessionId) msg.sessionId = sessionId;
            ws.send(JSON.stringify(msg));
          });
        },
        close: function () { ws.close(); }
      });
    };
    ws.onmessage = function (ev) {
      var m = JSON.parse(ev.data);
      if (m.id && waiting[m.id]) {
        var w = waiting[m.id]; delete waiting[m.id];
        if (m.error) w.bad(new Error(m.error.message)); else w.ok(m.result);
      }
    };
    ws.onerror = function () { rej(new Error('could not reach Chrome')); };
  });
}


function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function main() {
  var bin = findChrome();
  if (!bin) { console.log('SKIPPED: no Chrome or Chromium found (set CHROME to its path)'); process.exit(2); }
  var Pool = require(path.join(ROOT, 'server', 'node_modules', 'pg')).Pool;
  var pool = new Pool(index.poolConfig(process.env.DATABASE_URL, process.env.DATABASE_CA_FILE));
  var GAME = 'week11-football', hadOptin = false, svc = null, site = null, chrome = null, cdp = null;
  try {
    var t = (await pool.query("SELECT to_regclass('plays') AS p, to_regclass('optins') AS o")).rows[0];
    if (!t.p || !t.o) throw new Error('the tables are missing. Run: sh db/migrate.sh');
    hadOptin = (await pool.query('SELECT 1 FROM optins WHERE game_id = $1 AND manager = $2', [GAME, 'GOB'])).rows.length > 0;
    svc = index.createServer(pool);
    await new Promise(function (res) { svc.listen(0, '127.0.0.1', res); });
    var api = 'http://127.0.0.1:' + svc.address().port;
    // the game the page plays must be in the database, as the page opts in to it
    await require(path.join(ROOT, 'server', 'push-game.js')).pushGame(path.join(ROOT, 'data', 'games', GAME + '.json'), api, GAME);
    site = await serve();
    var base = 'http://127.0.0.1:' + site.address().port;
    chrome = await startChrome(bin);
    var ver = await (await fetch('http://127.0.0.1:' + chrome.port + '/json/version')).json();
    cdp = await connect(ver.webSocketDebuggerUrl);
    var tg = await cdp.send('Target.createTarget', { url: 'about:blank' });
    var s = (await cdp.send('Target.attachToTarget', { targetId: tg.targetId, flatten: true })).sessionId;
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, s);
    async function run(fn, arg) {
      var r = await cdp.send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')', awaitPromise: true, returnByValue: true }, s);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
      return r.result.value;
    }
    async function until(fn, ms) { var end = Date.now() + ms; while (Date.now() < end) { if (await run(fn)) return true; await sleep(200); } return false; }
    // record every fetch the page makes (url, method, status) from the first script on
    await cdp.send('Page.enable', {}, s);
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: "(function(){window.__net=[];var f=window.fetch;window.fetch=function(u,o){var m=(o&&o.method)||'GET';return f.apply(this,arguments).then(function(r){window.__net.push([String(u),m,r.status]);return r;},function(e){window.__net.push([String(u),m,0]);throw e;});};})();" }, s);
    await cdp.send('Page.navigate', { url: base + '/?intro=0&voice=0&api=' + encodeURIComponent(api) + '#matchup' }, s);
    await until(function () { return document.readyState === 'complete' && !!window.__app; }, 15000);
    await run(function () { ['fr.optin', 'fr.me', 'fr.learn', 'fr.lang'].forEach(function (k) { localStorage.removeItem(k); }); localStorage.setItem('fr.seen', '1'); location.reload(); });
    var ready = await until(function () { return document.readyState === 'complete' && !!window.__app && !!document.querySelector('[data-act=optin]'); }, 15000);
    line(ready, 'the app opens with ?api= and shows the opt-in card');
    if (!ready) throw new Error('the app did not load');
    function net(re, method) { return run(function (a) { return window.__net.filter(function (n) { return new RegExp(a[0]).test(n[0]) && n[1] === a[1]; }).map(function (n) { return n[2]; }); }, [re.source, method || 'GET']); }
    var got = false;
    for (var i = 0; i < 40 && !got; i++) { var h = await net(/\/health$/), l = await net(/\/league$/); got = h.indexOf(200) >= 0 && l.indexOf(200) >= 0; if (!got) await sleep(250); }
    line(got, 'the page called GET /health and GET /league and both answered 200');
    await run(function () { location.hash = 'league'; });
    await sleep(500);
    var home = await run(function () { return document.querySelector('#s-league') ? document.querySelector('#s-league').innerText : ''; });
    var svcLeague = await (await fetch(api + '/league')).json();
    var names = svcLeague.standings.map(function (r) { return r.full; });
    line(names.length >= 2 && names.every(function (n) { return home.indexOf(n) >= 0; }), 'the league home on screen lists every team of the service\'s standings (' + names.length + ')', home.slice(0, 160).replace(/\s+/g, ' '));
    await run(function () { location.hash = 'matchup'; });
    await sleep(300);

    await run(function () { document.querySelector('[data-act=optin][data-v=in]').click(); });
    var posted = false;
    for (i = 0; i < 40 && !posted; i++) { posted = (await net(new RegExp('/games/' + GAME + '/optin$'), 'POST')).indexOf(201) >= 0; if (!posted) await sleep(250); }
    line(posted, 'Opt in sent POST /games/' + GAME + '/optin and the service answered 201');
    var saved = await until(function () { return /Saved to the league/.test(document.body.innerText); }, 8000);
    line(saved, 'the page says it was saved to the league');
    var row = (await pool.query('SELECT manager FROM optins WHERE game_id = $1 AND manager = $2', [GAME, 'GOB'])).rows;
    line(row.length === 1, 'the opt-in is a row in the optins table');

    var shapes = await run(async function (a) {
      var out = {};
      async function get(p) { var r = await fetch(a + p); return { status: r.status, body: await r.json() }; }
      out.momentum = await get('/games/week11-football/momentum?bucket=120');
      out.trend = await get('/players/Josh%20Allen/trend');
      out.scout = await get('/scout/GOB.QB');
      return out;
    }, api);
    var m = shapes.momentum;
    line(m.status === 200 && m.body.source === 'database' && m.body.buckets.length > 10 && !!m.body.engine && m.body.buckets.every(function (b) { return b.fp && b.score && b.fpTotal && b.scoreTotal; }),
      'momentum reaches the page: ' + (m.body.buckets ? m.body.buckets.length : 0) + ' buckets, engine ' + m.body.engine + ', source ' + m.body.source);
    var tr = shapes.trend;
    line(tr.status === 200 && tr.body.player === 'Josh Allen' && tr.body.weeks.length >= 1 && tr.body.weeks.every(function (w) { return typeof w.week === 'number' && typeof w.points === 'number'; }) && !!tr.body.summary && 'direction' in tr.body.summary && 'hotStreak' in tr.body.summary,
      'trend reaches the page: ' + (tr.body.weeks ? tr.body.weeks.length : 0) + ' weeks, source ' + tr.body.source + ', direction ' + (tr.body.summary && tr.body.summary.direction));
    var sc = shapes.scout;
    line(sc.status === 200 && sc.body.report && sc.body.report.claims.length > 0 && sc.body.report.claims.every(function (c) { return c.evidence.length > 0 && c.evidence.every(function (e) { return /^https?:/.test(e.game || ''); }); }),
      'Scout reaches the page: ' + (sc.body.report ? sc.body.report.claims.length : 0) + ' claims, each with plays and a game address; refreshed ' + sc.body.refreshed);
    var errs = await run(function () { return window.__net.filter(function (n) { return n[2] === 0 || n[2] >= 500; }).map(function (n) { return n.join(' '); }); });
    line(errs.length === 0, 'no request from the page failed or answered 5xx', errs.join(', '));
  } catch (e) {
    line(false, 'the check ran to the end', e && e.message ? e.message : String(e));
  } finally {
    try { if (!hadOptin) await pool.query('DELETE FROM optins WHERE game_id = $1 AND manager = $2', [GAME, 'GOB']); } catch (e) { /* left */ }
    if (cdp) cdp.close();
    if (chrome) { chrome.proc.kill('SIGKILL'); try { fs.rmSync(chrome.dir, { recursive: true, force: true }); } catch (e) { /* left in tmp */ } }
    if (site) site.close();
    if (svc) svc.close();
    await pool.end();
  }
  console.log(failures ? failures + ' failed' : 'OK');
  process.exit(failures ? 1 : 0);
})();
