// First run and install. Loaded by js/app.js.
//   - A three-card walkthrough the first time the app opens, skippable, remembered
//     in localStorage under fr.seen. ?intro=0 skips it (for demos and tests).
//   - An "Add to Home Screen" hint for iPhone and iPad Safari, dismissible, remembered
//     under fr.a2hs.
//   - The app icon, drawn in code: FR_INSTALL.iconDataURL(size, maskable) returns a PNG
//     data address. The PNG files in js/screens/icons/ were saved from it.
(function () {
  'use strict';

  var SEEN_KEY = 'fr.seen', A2HS_KEY = 'fr.a2hs';
  function get(k) { try { return window.localStorage.getItem(k); } catch (err) { return null; } }
  function set(k, v) { try { window.localStorage.setItem(k, v); } catch (err) { /* storage may be off */ } }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  // ------------------------------------------------------------- the icon
  // An 8-bit player on a strip of field, under the amber lamp from the header.
  // Maskable icons keep everything inside the middle 80 percent.
  function drawIcon(size, maskable) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var g = c.getContext('2d'), u = size / 32;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#0b0d0e'; g.fillRect(0, 0, size, size);
    var inset = maskable ? 3.2 : 0;               // 10 percent of 32 on each side
    var box = 32 - 2 * inset;
    function px(x, y, w, h, col) { g.fillStyle = col; g.fillRect(Math.round((inset + x * box / 32) * u), Math.round((inset + y * box / 32) * u), Math.ceil(w * box / 32 * u), Math.ceil(h * box / 32 * u)); }
    // Field strip with yard lines.
    px(0, 19, 32, 9, '#17451f');
    for (var x = 2; x < 32; x += 6) px(x, 19, 1, 9, 'rgba(255,255,255,0.35)');
    // The lamp.
    px(4, 4, 5, 5, '#ffc21a');
    // A player from the game, scaled up with hard pixels.
    var spr = null;
    try {
      var S = window.FF_SPRITES, T = window.FF_DATA && window.FF_DATA.TEAMS;
      if (S && T) spr = S.get(0, T[0].colors, 'f', 'stand', 0);
    } catch (err) { spr = null; }
    if (spr) {
      var h = box * 0.62, w = h * spr.width / spr.height;
      g.drawImage(spr, Math.round((inset + (box - w) / 2) * u), Math.round((inset + box * 0.3) * u), Math.round(w * u), Math.round(h * u));
    } else {
      px(14, 9, 6, 6, '#c8f04a'); px(13, 15, 8, 7, '#7a4fd8'); px(14, 22, 2, 4, '#f3f1ea'); px(18, 22, 2, 4, '#f3f1ea');
    }
    return c;
  }
  function iconDataURL(size, maskable) { return drawIcon(size || 512, !!maskable).toDataURL('image/png'); }

  // Until the boss adds the icon links to index.html, put an apple-touch-icon in the
  // page so Add to Home Screen on iPhone uses this icon.
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    try {
      var link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      link.href = 'js/screens/icons/apple-touch-icon.png';
      document.head.appendChild(link);
    } catch (err) { /* optional */ }
  }

  // --------------------------------------------------------- walkthrough
  var CARDS = [
    { h: 'Your week, as a game', p: 'At the end of the week your fantasy roster plays your opponent\'s, in a small 8-bit football game.' },
    { h: 'Opt in to hide your score', p: 'On the matchup screen, choose Opt in. Your points and stat lines stay hidden until the final whistle.' },
    { h: 'Watch, then the reveal', p: 'Tap Watch the game. Speed it up or close it, it waits for you. At the final, the recap shows who won.' }
  ];
  var overlay = null, at = 0, lastFocus = null;

  function card() {
    var c = CARDS[at];
    var dots = CARDS.map(function (x, i) { return '<i' + (i === at ? ' class="on"' : '') + '></i>'; }).join('');
    return '<div class="walk-card" role="dialog" aria-modal="true" aria-labelledby="walkTitle">' +
      '<div class="walk-top"><span class="eyebrow">' + (at + 1) + ' of ' + CARDS.length + '</span>' +
        '<button type="button" class="walk-skip" data-walk="skip">Skip</button></div>' +
      '<h2 id="walkTitle" class="walk-h">' + esc(c.h) + '</h2>' +
      '<p class="walk-p">' + esc(c.p) + '</p>' +
      '<div class="walk-dots" aria-hidden="true">' + dots + '</div>' +
      '<div class="walk-btns">' +
        (at > 0 ? '<button type="button" class="cta ghost" data-walk="back">Back</button>' : '') +
        '<button type="button" class="cta" data-walk="next">' + (at === CARDS.length - 1 ? 'Start' : 'Next') + '</button>' +
      '</div></div>';
  }
  function draw() {
    overlay.innerHTML = card();
    var b = overlay.querySelector('[data-walk="next"]');
    if (b) b.focus();
  }
  function close() {
    set(SEEN_KEY, '1');
    if (overlay) { overlay.remove(); overlay = null; }
    var app = document.getElementById('app');
    if (app) app.inert = false;
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (err) { /* gone */ } }
    maybeHint();
  }
  function openWalk() {
    at = 0;
    lastFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'walk';
    document.body.appendChild(overlay);
    var app = document.getElementById('app');
    if (app) app.inert = true;
    overlay.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-walk]') : null;
      if (!b) return;
      var a = b.getAttribute('data-walk');
      if (a === 'skip') close();
      else if (a === 'back') { at = Math.max(0, at - 1); draw(); }
      else if (a === 'next') { if (at === CARDS.length - 1) close(); else { at += 1; draw(); } }
    });
    overlay.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape') { ev.preventDefault(); close(); return; }
      if (ev.key !== 'Tab') return;
      // Keep the keyboard inside the card.
      var f = overlay.querySelectorAll('button');
      if (!f.length) return;
      if (ev.shiftKey && document.activeElement === f[0]) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && document.activeElement === f[f.length - 1]) { ev.preventDefault(); f[0].focus(); }
    });
    draw();
  }

  // ------------------------------------------------- add to home screen
  function isIosSafari() {
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    return ios && !otherBrowser && /Safari/.test(ua);
  }
  function standalone() {
    return navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  var hint = null;
  function maybeHint(force) {
    if (hint || overlay) return;
    if (!force && (get(A2HS_KEY) || standalone() || !isIosSafari())) return;
    hint = document.createElement('div');
    hint.className = 'a2hs';
    hint.setAttribute('role', 'note');
    hint.innerHTML = '<p><b>Put it on your Home Screen.</b> Tap the Share button <svg class="a2hs-share" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M8 1v9M4.5 4.5 8 1l3.5 3.5M3 7v8h10V7" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>, then Add to Home Screen.</p>' +
      '<button type="button" data-a2hs="close" aria-label="Dismiss">Got it</button>';
    hint.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('[data-a2hs]')) { set(A2HS_KEY, '1'); hint.remove(); hint = null; }
    });
    document.body.appendChild(hint);
  }

  // -------------------------------------------------------------- start
  var skipIntro = /[?&](intro=0|demo=1)(&|$)/.test(location.search);
  if (!get(SEEN_KEY) && !skipIntro && location.hash !== '#game') openWalk();
  else maybeHint();

  window.FR_INSTALL = {
    iconDataURL: iconDataURL,
    showWalkthrough: openWalk,
    showHint: function () { maybeHint(true); },
    get open() { return !!overlay; }
  };
})();
