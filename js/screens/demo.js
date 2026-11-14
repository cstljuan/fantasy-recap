// Demo mode: ?demo=1 plays the two-minute demo in pitch/DEMO-SCRIPT.md by itself, so the
// video can be recorded in one take. It only drives what the app already has: the screens,
// the opt-in card, the game with FF_GAME.seek, the controls, a why card and the recap.
// Any real tap, click or key stops it. Loaded by js/app.js only when ?demo=1 is in the address.
(function () {
  'use strict';
  var G = window.FF_GAME, A = window.__app;
  if (!G || !A) return;

  var t0 = Date.now(), stopped = false, timers = [];
  var tag = document.createElement('div');
  tag.className = 'demo-tag';
  tag.setAttribute('role', 'status');
  tag.textContent = 'Demo';
  document.body.appendChild(tag);
  document.body.classList.add('demo-on');

  function stop(why) {
    if (stopped) return;
    stopped = true;
    timers.forEach(clearTimeout);
    tag.textContent = 'Demo stopped';
    setTimeout(function () { tag.remove(); document.body.classList.remove('demo-on'); }, 1500);
    if (G.hold) G.hold(false);
    window.__demo.stoppedBy = why || '';
  }
  // Only a person stops it: events the demo makes itself are not trusted.
  ['pointerdown', 'keydown'].forEach(function (type) {
    window.addEventListener(type, function (ev) { if (ev.isTrusted) stop(type); }, true);
  });

  function el(sel) { return document.querySelector(sel); }
  function go(hash) { if (location.hash !== '#' + hash) location.hash = hash; }
  function press(sel) { var b = el(sel); if (b && !b.disabled) { b.click(); return true; } return false; }
  function tapField() {
    var c = document.getElementById('game');
    if (c) c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }
  function key(name) { window.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true })); }
  function setSpeed(v) { if (window.__ff) window.__ff.speed = v; }
  // Wait until `at` seconds into the demo, or until test() is true, whichever the step asks.
  function at(sec) {
    return new Promise(function (res) { timers.push(setTimeout(res, Math.max(0, t0 + sec * 1000 - Date.now()))); });
  }
  function until(test, maxSec) {
    return new Promise(function (res) {
      var end = Date.now() + maxSec * 1000;
      (function loop() { if (stopped || test() || Date.now() > end) res(); else timers.push(setTimeout(loop, 100)); })();
    });
  }
  var steps = [];
  function step(name) { steps.push({ name: name, at: Math.round((Date.now() - t0) / 100) / 10 }); }

  async function run() {
    // 0:00 The problem: the League screen.
    go('league'); step('league');
    // 0:15 Open our matchup and opt in.
    await at(15); if (stopped) return;
    go('matchup'); step('matchup');
    await at(20); if (stopped) return;
    if (!press('[data-act=optin][data-v=in]') && A.setOptin) A.setOptin('in');
    step('opt in');
    // 0:27 Lineups, every point hidden.
    await at(27); if (stopped) return;
    go('lineups'); step('lineups');
    // 0:33 The game at 2x from Allen to Chase, through the touchdown pass to Chase.
    await at(33); if (stopped) return;
    go('matchup');
    await until(function () { return A.tab === 'matchup'; }, 2);
    press('#s-matchup [data-act=watch]');
    await until(function () { return A.inGame; }, 3);
    setSpeed(2);
    if (G.seek) G.seek(13);
    step('game, play 13 at 2x');
    await until(function () { return A.model.done >= 14; }, 18);
    step('touchdown');
    // 0:52 Show the speed and announcer controls, then close: the game waits.
    await at(52); if (stopped) return;
    tapField(); step('controls');
    await at(55); if (stopped) return;
    key('Escape'); step('closed, paused');
    // 0:58 The reveal: back in at 4x near the end, to the final whistle, then the recap.
    await at(58); if (stopped) return;
    press('#s-matchup [data-act=watch]');
    await until(function () { return A.inGame; }, 3);
    setSpeed(4);
    if (G.seek) G.seek(82);
    step('game, play 82 at 4x');
    await until(function () { return G.mode === 'final'; }, 14);
    await at(Math.max(67, (Date.now() - t0) / 1000 + 2)); if (stopped) return;
    tapField(); step('recap');
    // 1:15 How it works: the plays, with the play caller's odds on the Pythons' first play.
    await at(75); if (stopped) return;
    go('plays');
    await until(function () { return !!el('#s-plays .why[data-n="2"]'); }, 2);
    var card = el('#s-plays .why[data-n="2"]');
    if (card) { card.open = true; card.scrollIntoView({ block: 'center' }); }
    step('why card');
    // 1:40 What is next: back to the League screen.
    await at(100); if (stopped) return;
    window.scrollTo(0, 0);
    go('league'); step('league again');
    await at(120);
    if (!stopped) { tag.textContent = 'Demo done'; window.__demo.done = true; }
  }

  window.__demo = { steps: steps, done: false, stoppedBy: '', stop: function () { stop('api'); } };
  run();
})();
