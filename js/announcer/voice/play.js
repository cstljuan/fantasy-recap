// Plays the recorded ElevenLabs line when there is one, and the browser voice when not.
// Load it after the announcer (js/announcer/index.js, and js/announcer/soccer/index.js on the
// soccer page) and after assets/voice/<sport>/index.js, the index written by render.js:
//   <script src="assets/voice/football/index.js"></script>
//   <script src="js/announcer/voice/play.js"></script>
// It wraps FF_ANNOUNCER.speak and SC_ANNOUNCER.speak, so nothing else has to change:
//   - a line with a recording plays that file, with the crowd ducked under it (FF_AUDIO.duck);
//   - a line without one goes to the browser voice exactly as before;
//   - one line at a time: a newer line waits for the current one and replaces any older
//     waiting line, so the voice never falls behind the game;
//   - silent when muted (FF_AUDIO.muted()), when the page is hidden, when the game view is
//     closed, or above speed 2. hush() stops a recording too.
// FF_ANNOUNCER.voiceClips() tells how many recorded lines the page has.
(function (root) {
  'use strict';
  if (typeof document === 'undefined') return;

  // The repository root, worked out from where this script was loaded.
  var me = document.currentScript && document.currentScript.src || '';
  var base = me.replace(/js\/announcer\/voice\/play\.js(\?.*)?$/, '');

  function index(sport) { return (root.FF_VOICE_INDEX || {})[sport] || null; }
  // The list of recordings (assets/voice/<sport>/index.js) can be an old copy from the browser's
  // cache, which knows only the lines recorded before: newer lines then went to the robot voice
  // (Noah: the real soccer match, catch-up lines after a jump). So the current list is fetched past
  // the cache as soon as the page loads, and every line it adds is used from then on. The audio
  // files themselves are named by their content, so a cached file is always the right one.
  function refresh(sport) {
    if (typeof fetch !== 'function') return;
    try {
      fetch(base + 'assets/voice/' + sport + '/index.json', { cache: 'no-cache' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (fresh) {
          if (!fresh || !fresh.lines) return;
          var all = root.FF_VOICE_INDEX = root.FF_VOICE_INDEX || {};
          var cur = all[sport] = all[sport] || { dir: 'assets/voice/' + sport + '/', lines: {} };
          if (!cur.lines) cur.lines = {};
          Object.keys(fresh.lines).forEach(function (t) { cur.lines[t] = fresh.lines[t]; });
        })
        .catch(function () { /* the list from the script tag still works */ });
    } catch (err) { /* optional */ }
  }
  // One player for every line. A phone lets a page start sound only from inside a tap, and an iPhone
  // asks for that tap again for every new player, so a new Audio() per line played the first line and
  // refused most of the rest (they fell to the robot voice, which a phone keeps silent too). A player that
  // has started once from a tap may be given a new file and started again without one. js/phone.js
  // sends 'fr-unlock' on every tap; the first one that finds the player idle starts it on silence.
  var SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  var shared = null, primed = false;
  var stats = root.FR_VOICE = root.FR_VOICE || { primed: false, played: 0, refused: 0, robot: 0 };
  function player() {
    if (!shared) { shared = new Audio(); shared.preload = 'auto'; shared.setAttribute('playsinline', ''); }
    return shared;
  }
  var busy = function () { return false; };
  if (root.addEventListener) root.addEventListener('fr-unlock', function () {
    if (primed || busy()) return;
    var el;
    try { el = player(); } catch (err) { return; }
    el.onended = null; el.onerror = null;
    try {
      el.src = SILENCE;
      var p = el.play();
      primed = true; stats.primed = true;
      if (p && p.catch) p.catch(function () { primed = false; stats.primed = false; });
    } catch (err) { /* the next tap tries again */ }
  });
  function audioApi() { return root.FF_AUDIO || null; }
  function duck(on) { var a = audioApi(); if (a && a.duck) { try { a.duck(on); } catch (err) { /* optional */ } } }

  function wrap(A, sport, speedKey, gameKey) {
    if (!A || A.__voiceWrapped) return;
    A.__voiceWrapped = true;
    var browserSpeak = A.speak, browserHush = A.hush;
    var current = null, waiting = null;
    busy = function () { return !!current; };

    function clipFor(text) {
      var x = index(sport), f = x && x.lines && x.lines[text];
      if (!f) return '';
      var dir = x.dir || ('assets/voice/' + sport + '/');
      return (/^([a-z]+:|\/)/.test(dir) ? dir : base + dir) + f;
    }
    function quiet() {
      var sp = root[speedKey], g = root[gameKey], a = audioApi();
      if (sp && +sp.speed > 2) return true;
      if (g && g.active === false) return true;
      if (document.hidden) return true;
      return !!(a && a.muted && a.muted());
    }
    function volume() {
      var a = audioApi(), m = a && a.volume ? a.volume('master') : 0.5;
      return Math.max(0, Math.min(1, (typeof m === 'number' ? m : 0.5) * 2));
    }
    function next() {
      current = null;
      if (waiting && !quiet()) { var w = waiting; waiting = null; play(w); }
      else { waiting = null; duck(false); }
    }
    function play(item) {
      var el;
      try { el = player(); el.src = item.url; } catch (err) { stats.robot++; browserSpeak.call(A, item.text); return; }
      el.volume = volume();
      var mine = item;
      current = { el: el, item: item };
      duck(true);
      el.onended = function () { if (current && current.item === mine) next(); };
      el.onerror = function () { if (!current || current.item !== mine) return; current = null; stats.robot++; browserSpeak.call(A, item.text); next(); };
      var p = el.play();
      // Autoplay refused (no tap yet): say it with the browser voice instead. A line that was only cut
      // short by the next one (the shared player was given a new file) is not a refusal.
      if (p && p.then) p.then(function () { stats.played++; }, function (err) {
        if (!current || current.item !== mine) return;
        if (err && err.name === 'AbortError') return;
        current = null; stats.refused++; stats.robot++; browserSpeak.call(A, item.text); next();
      });
    }

    A.speak = function (text) {
      if (!text) return;
      var url = clipFor(String(text));
      if (!url) return browserSpeak.call(A, text);
      if (quiet()) { A.hush(); return; }
      var item = { text: String(text), url: url };
      if (current) waiting = item; else play(item);
    };
    A.hush = function () {
      waiting = null;
      if (current) { var was = current.el; current = null; try { was.onended = null; was.onerror = null; was.pause(); } catch (err) { /* already stopped */ } }
      duck(false);
      if (browserHush) return browserHush.apply(A, arguments);
    };
    A.voiceClips = function () { var x = index(sport); return x && x.lines ? Object.keys(x.lines).length : 0; };
  }

  wrap(root.FF_ANNOUNCER, 'football', '__ff', 'FF_GAME');
  wrap(root.SC_ANNOUNCER, 'soccer', '__sc', 'SC_GAME');
  if (root.FF_ANNOUNCER) refresh('football');
  if (root.SC_ANNOUNCER) refresh('soccer');
})(typeof window !== 'undefined' ? window : globalThis);
