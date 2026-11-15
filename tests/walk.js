#!/usr/bin/env node
'use strict';
// C28: walks the football and the soccer app start to finish in headless Chromium, at phone
// width (375) and laptop width (1280), and prints one line per step, OK or FAIL.
//   node tests/walk.js            both widths
//   node tests/walk.js 375        one width
// Steps, per width:
//   football: opt in, scores hidden on every screen while it plays (a fantasy number is anything
//   like 12.5), the jump bar (next play, and the slider to the middle of the game, with the
//   catch-up line), the reveal and the recap, Spanish (the labels change, nothing overflows),
//   back to English, the sport switch to soccer and back;
//   soccer (inside the app's frame, as a viewer sees it): opt in, scores hidden while it plays,
//   the match to full time, the recap.
// At every screen: no page error, no console error, and nothing wider than the window.
// Needs Playwright (require('playwright')) and a Chromium it can start; set CHROME to use another
// browser binary. Exit 0 when every step passed, 1 on a failure, 2 when no browser can start.
// Screenshots of each step go to $WALK_SHOTS when it is set (a folder).
var fs = require('fs');
var path = require('path');
var http = require('http');

var ROOT = path.join(__dirname, '..');
var SHOTS = process.env.WALK_SHOTS || '';
var failures = 0;
function line(ok, what, why) { if (!ok) failures += 1; console.log((ok ? 'OK   ' : 'FAIL ') + what + (ok || !why ? '' : ': ' + why)); }

var playwright;
try { playwright = require('playwright'); } catch (e) { console.log('SKIP the browser walk: Playwright is not installed'); process.exit(2); }

// The repository as a static site on a free port.
var TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise(function (ok) {
    var srv = http.createServer(function (req, res) {
      var p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      var f = path.join(ROOT, path.normalize(p));
      if (f.indexOf(ROOT) !== 0 || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', function () { ok(srv); });
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
async function until(fn, ms, step) {
  var end = Date.now() + ms;
  while (Date.now() < end) { try { if (await fn()) return true; } catch (e) { /* not yet */ } await sleep(step || 200); }
  return false;
}

// Visible text that looks like a fantasy number (one decimal), in a document or a frame.
async function pointsShown(where) {
  return where.evaluate(function () {
    var out = [];
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      var n = walker.currentNode, el = n.parentElement, t = n.textContent.trim();
      if (!t || !el || !/\b\d+\.\d\b/.test(t)) continue;
      if (el.closest('[hidden], script, style, .note')) continue;
      var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue;
      out.push(t.slice(0, 60));
    }
    return out;
  });
}
async function overflow(where, label) {
  var o = await where.evaluate(function () { return { sw: document.documentElement.scrollWidth, w: window.innerWidth }; });
  line(o.sw <= o.w + 1, label + ': nothing wider than the window', 'page is ' + o.sw + ' px in a ' + o.w + ' px window');
}
async function shot(page, name) { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } }

async function walk(browser, base, width) {
  var height = width < 600 ? 812 : 800, L = width + ' wide';
  var ctx = await browser.newContext({ viewport: { width: width, height: height } });
  var page = await ctx.newPage(), errors = [];
  page.on('pageerror', function (e) { errors.push('page error: ' + e.message); });
  page.on('console', function (m) { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  function errs(label) {
    var e = errors.filter(function (x) { return !/favicon|ERR_FILE_NOT_FOUND|404/.test(x); });
    line(e.length === 0, label + ': no page or console errors', e.slice(0, 2).join(' | '));
    errors.length = 0;
  }

  // ------------------------------------------------------------ football
  await page.goto(base + '/?intro=0&voice=0#matchup');
  await page.evaluate(function () { ['fr.optin', 'fr.me', 'fr.learn', 'fr.lang', 'fr.sport'].forEach(function (k) { localStorage.removeItem(k); }); localStorage.setItem('fr.seen', '1'); });
  await page.reload();
  var loaded = await until(function () { return page.evaluate(function () { return !!window.__app && !!window.FF_GAME && !!document.querySelector('[data-act=optin]'); }); }, 15000);
  line(loaded, L + ', football: the app loads with the opt-in card');
  if (!loaded) { errs(L + ', football load'); await ctx.close(); return; }
  await overflow(page, L + ', football matchup');
  await shot(page, width + '-football-matchup');

  await page.evaluate(function () {
    window.__walk = { lines: [] };
    window.FF_ANNOUNCER.onLine(function (t, k) { window.__walk.lines.push({ t: String(t), k: k }); });
    document.querySelector('[data-act=optin][data-v=in]').click();
  });
  line(await page.evaluate(function () { return window.__app.optin === 'in' && window.__app.masked; }), L + ', football: opting in hides the scores');

  await page.evaluate(function () { window.FF_GAME.start(); location.hash = 'game'; window.__ff.speed = 40; });
  var playing = await until(function () { return page.evaluate(function () { return window.__app.model.done >= 20; }); }, 60000);
  line(playing, L + ', football: the game plays');
  await shot(page, width + '-football-game');

  // The jump bar, in the game view: a tap on the game shows the controls (js/app.js .jump).
  await page.evaluate(function () { window.__ff.speed = 1; });
  await page.click('#game');
  var bar = await until(function () { return page.evaluate(function () { var b = document.querySelector('.jump'); return !!b && !b.hidden && b.getBoundingClientRect().height > 0; }); }, 3000);
  line(bar, L + ', football: the jump bar shows in the game view');
  if (bar) {
    var before = await page.evaluate(function () { return window.__app.model.done; });
    await page.click('.jump [data-jump=next]');
    var moved = await until(function () { return page.evaluate(function (b) { return window.__app.model.done !== b; }, before); }, 5000);
    line(moved, L + ', football: Next play jumps');
    var plays = await page.evaluate(function () { return window.FF_GAME.plays; }), mid = Math.round(plays / 2);
    await page.evaluate(function () { window.__walk.lines = []; });
    // As a finger does: the slider has focus while it moves, then lets go.
    await page.click('#game');
    await page.locator('.jump input[type=range]').fill(String(mid));
    var jumped = await until(function () { return page.evaluate(function (n) { return Math.abs(window.__app.model.done - n) <= 2; }, mid); }, 5000);
    line(jumped, L + ', football: the slider jumps to play ' + mid + ' of ' + plays, 'now at ' + (await page.evaluate(function () { return window.__app.model.done; })));
    var cu = await page.evaluate(function () { return window.__walk.lines.filter(function (x) { return x.k === 'catch_up'; }).map(function (x) { return x.t; }); });
    line(cu.length >= 1 && cu.every(function (t) { return !/\d+\.\d|fantasy/i.test(t); }), L + ', football: one catch-up line after the jump, no fantasy points in it while hidden', JSON.stringify(cu));
    await shot(page, width + '-football-jump');
  }
  await page.evaluate(function () { location.hash = 'matchup'; });
  await sleep(300);
  var tabs = ['matchup', 'lineups', 'plays', 'recap'], leak = [];
  for (var i = 0; i < tabs.length; i++) {
    await page.evaluate(function (t) { location.hash = t; }, tabs[i]);
    await sleep(250);
    leak = leak.concat((await pointsShown(page)).map(function (x) { return tabs[i] + ': ' + x; }));
    await overflow(page, L + ', football ' + tabs[i] + ' while it plays');
  }
  line(leak.length === 0, L + ', football: no fantasy number on any screen while hidden', leak.slice(0, 3).join(' | '));
  errs(L + ', football while it plays');

  // To the final, the reveal and the recap.
  await page.evaluate(function () { location.hash = 'game'; window.__ff.speed = 40; });
  var final = await until(function () { return page.evaluate(function () { return window.FF_GAME.mode === 'final'; }); }, 120000, 400);
  line(final, L + ', football: the game reaches the final');
  await page.evaluate(function () { if (window.FF_GAME.ontap) window.FF_GAME.ontap('final'); });
  var reveal = await until(function () { return page.evaluate(function () { return window.__app.tab === 'recap' && !!document.querySelector('.hero-name'); }); }, 10000);
  line(reveal, L + ', football: tapping the final opens the reveal');
  var rv = await page.evaluate(function () {
    var s = document.querySelector('#s-recap') || document.body;
    return { hero: (document.querySelector('.hero-name') || {}).textContent || '', masked: window.__app.masked, text: s.innerText.length,
      nums: Array.prototype.map.call(document.querySelectorAll('.hero-score .num'), function (e) { return e.textContent.trim(); }) };
  });
  line(!rv.masked && rv.nums.length === 2 && rv.nums.every(function (n) { return /^\d+\.\d$/.test(n); }), L + ', football: the reveal shows both teams\' points (' + rv.nums.join(' to ') + ') with the winner (' + rv.hero.trim().slice(0, 40) + ')');
  line(rv.text > 200, L + ', football: the recap has content (' + rv.text + ' characters)');
  await overflow(page, L + ', football recap');
  await shot(page, width + '-football-recap');
  errs(L + ', football final and recap');

  // Spanish.
  var tabText = function () { return page.evaluate(function () { return Array.prototype.map.call(document.querySelectorAll('#tabs a, #tabs button'), function (e) { return e.textContent.trim(); }).join(' | '); }); };
  var en = await tabText();
  var esBtn = await page.$('[data-lang=es]');
  line(!!esBtn, L + ': the language switch is there');
  if (esBtn) {
    await esBtn.click();
    await sleep(400);
    var es = await tabText();
    line(es !== en && /Partido|Resumen|Jugadas/.test(es), L + ': Spanish changes the labels', 'tabs "' + en + '" became "' + es + '"');
    for (var j = 0; j < tabs.length; j++) {
      await page.evaluate(function (t) { location.hash = t; }, tabs[j]);
      await sleep(250);
      await overflow(page, L + ', Spanish ' + tabs[j]);
    }
    await shot(page, width + '-spanish-recap');
    await page.click('[data-lang=en]');
    await sleep(300);
    line((await tabText()) === en, L + ': back to English');
  }
  errs(L + ', Spanish');

  // ------------------------------------------------------------ soccer
  var sw = await page.$('[data-sport=soccer]');
  line(!!sw, L + ': the sport switch is there');
  if (!sw) { await ctx.close(); return; }
  await page.evaluate(function () { location.hash = 'matchup'; });
  await sleep(200);
  await sw.click();
  var inFrame = await until(function () { return page.evaluate(function () { var f = document.querySelector('#soccerView iframe'); return !!f && !document.getElementById('soccerView').hidden && !!(f.contentWindow && f.contentWindow.SC_GAME && f.contentWindow.__app); }); }, 15000);
  line(inFrame, L + ', soccer: the sport switch opens the soccer app');
  line(await page.evaluate(function () { return document.documentElement.getAttribute('data-sport') === 'soccer' && window.FF_GAME.active === false; }), L + ', soccer: football is paused behind it');
  if (inFrame) {
    var frameEl = await page.$('#soccerView iframe'), fr = await frameEl.contentFrame();
    await fr.evaluate(function () {
      window.__walk = { lines: [] };
      window.SC_ANNOUNCER.onLine(function (t, k) { window.__walk.lines.push({ t: String(t), k: k }); });
      var o = document.querySelector('[data-act=optin][data-v=in]'); if (o) o.click();
    });
    line(await fr.evaluate(function () { return window.__app.optin === 'in' && window.__app.masked; }), L + ', soccer: opting in hides the scores');
    await overflow(fr, L + ', soccer matchup');
    await shot(page, width + '-soccer-matchup');
    var watch = await fr.$('text=Watch the match');
    if (watch) await watch.click(); else await fr.evaluate(function () { window.SC_GAME.start(); location.hash = 'game'; });
    await fr.evaluate(function () { window.__sc.speed = 40; });
    var sPlay = await until(function () { return fr.evaluate(function () { return window.__sc.minute >= 30; }); }, 60000);
    line(sPlay, L + ', soccer: the match plays');
    await shot(page, width + '-soccer-game');
    var sLeak = [], sTabs = ['matchup', 'lineups', 'plays', 'recap'];
    for (var k = 0; k < sTabs.length; k++) {
      await fr.evaluate(function (t) { location.hash = t; }, sTabs[k]);
      await sleep(250);
      sLeak = sLeak.concat((await pointsShown(fr)).map(function (x) { return sTabs[k] + ': ' + x; }));
      await overflow(fr, L + ', soccer ' + sTabs[k] + ' while it plays');
    }
    line(sLeak.length === 0, L + ', soccer: no fantasy number on any screen while hidden', sLeak.slice(0, 3).join(' | '));
    var said = await fr.evaluate(function () { return window.__walk.lines.filter(function (x) { return x.k !== 'sound'; }).map(function (x) { return x.t; }); });
    var sLeakVoice = said.filter(function (t) { return /fantasy|\d+\.\d/i.test(t); });
    line(said.length > 5 && sLeakVoice.length === 0, L + ', soccer: the announcer speaks (' + said.length + ' lines) with no fantasy points while hidden', sLeakVoice.slice(0, 2).join(' | '));
    await fr.evaluate(function () { location.hash = 'game'; window.__sc.speed = 40; });
    var sFinal = await until(function () { return fr.evaluate(function () { return window.SC_GAME.mode === 'final'; }); }, 120000, 400);
    line(sFinal, L + ', soccer: the match reaches full time');
    await fr.evaluate(function () { if (window.SC_GAME.ontap) window.SC_GAME.ontap('final'); });
    var sRecap = await until(function () { return fr.evaluate(function () { return window.__app.tab === 'recap'; }); }, 10000);
    var sr = await fr.evaluate(function () { return { masked: window.__app.masked, text: (document.querySelector('.screen:not([hidden])') || document.body).innerText.length, nums: Array.prototype.map.call(document.querySelectorAll('.hero-score .num'), function (e) { return e.textContent.trim(); }) }; });
    line(sRecap && !sr.masked && sr.text > 150, L + ', soccer: full time opens the recap with the scores shown (' + sr.nums.join(' to ') + ')');
    await overflow(fr, L + ', soccer recap');
    await shot(page, width + '-soccer-recap');
    errs(L + ', soccer');
    // And back.
    await page.click('[data-sport=football]').catch(function () { /* the switch may live inside the frame */ });
    var back = await until(function () { return page.evaluate(function () { return document.documentElement.getAttribute('data-sport') === 'football' && document.getElementById('soccerView').hidden; }); }, 5000);
    line(back, L + ': the sport switch goes back to football');
    line(await fr.evaluate(function () { return window.SC_GAME.active === false; }), L + ': soccer is paused behind football');
  }
  errs(L + ', end');
  await ctx.close();
}

(async function main() {
  var widths = process.argv.slice(2).map(Number).filter(Boolean);
  if (!widths.length) widths = [375, 1280];
  var srv = await serve(), browser = null;
  try {
    var opts = process.env.CHROME ? { executablePath: process.env.CHROME } : {};
    try { browser = await playwright.chromium.launch(opts); }
    catch (e) { console.log('SKIP the browser walk: no Chromium could start (' + e.message.split('\n')[0] + ')'); process.exit(2); }
    var base = 'http://127.0.0.1:' + srv.address().port;
    console.log('Browser walk, football and soccer, at ' + widths.join(' and ') + ' wide, app at ' + base);
    for (var i = 0; i < widths.length; i++) await walk(browser, base, widths[i]);
  } catch (e) {
    line(false, 'the walk ran to the end', e.message);
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  console.log(failures ? failures + ' failed' : 'OK, every step passed');
  process.exit(failures ? 1 : 0);
})();
