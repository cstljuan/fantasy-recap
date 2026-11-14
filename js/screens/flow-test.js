#!/usr/bin/env node
'use strict';
// A browser test of the whole reveal flow, with one command and no new dependency:
//   node js/screens/flow-test.js
// It serves the repository itself, starts the Chrome or Chromium that tools/smoke.sh would
// find (or the one in $CHROME), and drives it over the DevTools protocol with Node's own
// WebSocket. For each game file (the app's current game and ?game=sample) it:
//   1. opts in, and checks that no fantasy point shows anywhere: the screens, the point
//      floaters on the canvas, every announcer line and caption (halftime included), and that
//      the share buttons are absent;
//   2. watches to the final at high speed and checks that the reveal shows the right winner and
//      both teams' points, worked out here in Node from the game file with js/rules.js;
//   3. does the same without opting in, where the points do show while the game plays.
// Prints one line per step, OK or FAIL, and exits 1 when anything failed.
var fs = require('fs');
var path = require('path');
var http = require('http');
var os = require('os');
var vm = require('vm');
var cp = require('child_process');

var ROOT = path.join(__dirname, '..', '..');
var failures = 0;
function line(ok, what, why) { if (!ok) failures += 1; console.log((ok ? 'OK   ' : 'FAIL ') + what + (ok || !why ? '' : ': ' + why)); }

// ---------------------------------------------------------- expected results
// The fantasy points each team ends with, from the game file and js/rules.js alone.
function expected(which) {
  var Rules = require(path.join(ROOT, 'js', 'rules.js'));
  var teams, game;
  if (which === 'sample') {
    var box = { window: {} };
    box.globalThis = box.window;
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'js', 'data.js'), 'utf8'), box);
    var D = box.window.FF_DATA || box.FF_DATA;
    teams = D.TEAMS; game = D.SAMPLE_GAME;
  } else {
    var src = fs.readFileSync(path.join(ROOT, 'data', 'games', 'current.js'), 'utf8');
    var w = {};
    vm.runInNewContext(src, { window: w });
    teams = w.FF_GAME_FILE.teams; game = w.FF_GAME_FILE.game;
  }
  var state = Rules.create(teams), pts = [0, 0];
  Rules.flatten(game, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(state); return; }
    if (st.kind !== 'play') return;
    (Rules.apply(state, st.e, st.team).fp || []).forEach(function (f) { pts[f.team] += f.pts; });
  });
  function r(x) { return (Math.round(x * 10) / 10).toFixed(1); }
  var winner = pts[0] === pts[1] ? null : teams[pts[0] > pts[1] ? 0 : 1].full;
  return { totals: [r(pts[0]), r(pts[1])], winner: winner, field: state.score.slice() };
}

// ------------------------------------------------------------- the browser
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

// --------------------------------------------------------------- the flow
async function flow(cdp, base, which, optIn, want) {
  var label = (which === 'sample' ? 'sample game' : 'current game') + (optIn ? ', opted in' : ', not opted in');
  var t = await cdp.send('Target.createTarget', { url: 'about:blank' });
  var s = (await cdp.send('Target.attachToTarget', { targetId: t.targetId, flatten: true })).sessionId;
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: true }, s);
  async function run(fn, arg) {
    var r = await cdp.send('Runtime.evaluate', { expression: '(' + fn.toString() + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')', awaitPromise: true, returnByValue: true }, s);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
    return r.result.value;
  }
  async function until(fn, ms) {
    var end = Date.now() + ms;
    while (Date.now() < end) { if (await run(fn)) return true; await new Promise(function (r) { setTimeout(r, 200); }); }
    return false;
  }
  var url = base + '/?intro=0&voice=0&speed=40' + (which === 'sample' ? '&game=sample' : '') + '#matchup';
  await cdp.send('Page.navigate', { url: url }, s);
  var ready = await until(function () { return document.readyState === 'complete' && !!window.__app && !!window.FF_GAME; }, 15000);
  line(ready, label + ': the app loads');
  if (!ready) return;
  // Start clean: no saved choice, then make the choice on the opt-in card.
  await run(function () { ['fr.optin', 'fr.me', 'fr.learn', 'fr.lang', 'fr.seen'].forEach(function (k) { localStorage.removeItem(k); }); localStorage.setItem('fr.seen', '1'); location.reload(); });
  await until(function () { return document.readyState === 'complete' && !!window.__app && !!document.querySelector('[data-act=optin]'); }, 15000);
  await run(function (v) {
    window.__ft = { lines: [] };
    if (window.FF_ANNOUNCER && window.FF_ANNOUNCER.onLine) window.FF_ANNOUNCER.onLine(function (text) { window.__ft.lines.push(String(text || '')); });
    document.querySelector('[data-act=optin][data-v=' + v + ']').click();
  }, optIn ? 'in' : 'out');
  line(await run(function () { return window.__app.optin; }) === (optIn ? 'in' : 'out'), label + ': the opt-in choice is made');

  // While the game plays: points hidden (opted in) or shown (not opted in), on every screen.
  async function scan() {
    var found = [];
    var tabs = ['matchup', 'lineups', 'plays', 'recap', 'week'];
    for (var i = 0; i < tabs.length; i++) {
      await run(function (t) { location.hash = t; }, tabs[i]);
      await new Promise(function (r) { setTimeout(r, 250); });
      found = found.concat(await run(function (t) {
        var sel = '.screen:not([hidden]) .window .num, .screen:not([hidden]) .lineup-head .num, .screen:not([hidden]) .row .pts, .screen:not([hidden]) .play-fp b, .screen:not([hidden]) .top-foot .num, .screen:not([hidden]) .hero-score .num';
        return Array.prototype.map.call(document.querySelectorAll(sel), function (e) { return t + ' ' + e.textContent.trim(); })
          .filter(function (x) { return /\d/.test(x.split(' ').slice(1).join(' ')); });
      }, tabs[i]));
    }
    return found;
  }
  await run(function () { window.FF_GAME.start(); location.hash = 'game'; });
  var midway = await until(function () { return window.__app.model.done >= 40; }, 60000);
  line(midway, label + ': the game plays');
  await run(function () { location.hash = 'matchup'; });
  await new Promise(function (r) { setTimeout(r, 300); });
  var shown = await scan();
  var extras = await run(function () { return { share: !!document.querySelector('[data-act=share], [data-act=share-top]'), floaters: window.FF_GAME.floaters, masked: window.__app.masked }; });
  if (optIn) {
    line(shown.length === 0, label + ': no fantasy point on any screen while it plays', shown.slice(0, 3).join(', '));
    line(extras.floaters === false, label + ': point floaters on the canvas are off', 'floaters ' + extras.floaters);
    line(!extras.share, label + ': no share button before the final');
  } else {
    line(shown.length > 0, label + ': fantasy points show while it plays');
    line(extras.floaters === true, label + ': point floaters on the canvas are on', 'floaters ' + extras.floaters);
  }

  // Watch to the final, then the reveal.
  await run(function () { location.hash = 'matchup'; });
  await new Promise(function (r) { setTimeout(r, 200); });
  await run(function () { var b = document.querySelector('#s-matchup [data-act=watch]'); if (b) b.click(); else location.hash = 'game'; });
  var done = await until(function () { return window.FF_GAME.mode === 'final'; }, 120000);
  line(done, label + ': the game reaches the final');
  if (!done) { await cdp.send('Target.closeTarget', { targetId: t.targetId }); return; }
  var lines = await run(function () { return window.__ft.lines; });
  if (optIn) {
    var leaks = lines.filter(function (x, i) { return i < lines.length - 2 && /fantasy|\d+\.\d+ (fantasy )?points?/i.test(x); });
    line(leaks.length === 0, label + ': no announcer line or caption names fantasy points before the final (' + lines.length + ' lines, halftime included)', leaks.slice(0, 2).join(' | '));
  }
  await run(function () { if (window.FF_GAME.ontap) window.FF_GAME.ontap('final'); });
  await until(function () { return window.__app.tab === 'recap' && !!document.querySelector('.hero-name'); }, 10000);
  var reveal = await run(function () {
    return { hero: (document.querySelector('.hero-name') || {}).textContent || '', totals: window.__app.totals(),
      shown: Array.prototype.map.call(document.querySelectorAll('.hero-score .num'), function (e) { return e.textContent.trim(); }),
      masked: window.__app.masked, share: !!document.querySelector('[data-act=share-top]') };
  });
  var heroOk = want.winner ? reveal.hero.indexOf(want.winner) === 0 : /tie/i.test(reveal.hero);
  line(heroOk, label + ': the reveal names the winner (' + (want.winner || 'a tie') + ')', 'shows "' + reveal.hero + '"');
  var pts = reveal.shown.slice().sort().join(' ') === want.totals.slice().sort().join(' ') && reveal.totals.join(' ') === want.totals.join(' ');
  line(pts, label + ': the reveal shows both teams\' points (' + want.totals.join(' to ') + ')', 'shows ' + reveal.shown.join(' and ') + ', app totals ' + reveal.totals.join(' and '));
  line(!reveal.masked && reveal.share, label + ': after the final nothing is hidden and sharing is offered');
  await cdp.send('Target.closeTarget', { targetId: t.targetId });
}

(async function main() {
  var bin = findChrome();
  if (!bin) { console.log('FAIL no Chrome or Chromium found (set CHROME to its path)'); process.exit(2); }
  var srv = await serve(), chrome = null, cdp = null;
  try {
    chrome = await startChrome(bin);
    var ver = await (await fetch('http://127.0.0.1:' + chrome.port + '/json/version')).json();
    cdp = await connect(ver.webSocketDebuggerUrl);
    var base = 'http://127.0.0.1:' + srv.address().port;
    console.log('Reveal flow test, ' + path.basename(bin) + ', app at ' + base);
    var games = ['current', 'sample'];
    for (var g = 0; g < games.length; g++) {
      var want = expected(games[g]);
      console.log('-- ' + games[g] + ' game: expected ' + (want.winner || 'a tie') + ', ' + want.totals.join(' to ') + ' fantasy points, ' + want.field.join(' to ') + ' on the field');
      await flow(cdp, base, games[g], true, want);
      await flow(cdp, base, games[g], false, want);
    }
  } catch (e) {
    line(false, 'the test ran to the end', e.message);
  } finally {
    if (cdp) cdp.close();
    if (chrome) { chrome.proc.kill('SIGKILL'); try { fs.rmSync(chrome.dir, { recursive: true, force: true }); } catch (e) { /* left in tmp */ } }
    srv.close();
  }
  console.log(failures ? failures + ' failed' : 'OK, every step passed');
  process.exit(failures ? 1 : 0);
})();
