// Phone fixes that both sports share. Loaded by index.html and soccer/index.html after the sound scripts.
//
// 1. Sound. A phone lets a page make sound only from inside a real tap, and an iPhone counts the end of a
//    touch (touchend, click), not its start (pointerdown, touchstart). So on every tap, click or key:
//      - FF_AUDIO.init() makes or resumes the sound engine (js/audio.js);
//      - the event 'fr-unlock' is sent on window, for the stadium crowd (js/screens/stadium-sound.js) and the
//        recorded announcer (js/announcer/voice/play.js), which each wake their own player;
//      - the browser's voice is woken once, for lines that have no recording;
//      - on an iPhone or iPad a silent loop keeps playing, so the ringer switch does not mute the crowd
//        (Web Audio follows that switch unless media is playing);
//      - the same is done in every frame of this page (soccer is shown in a frame).
//    It keeps doing this on later taps, because a context can go back to sleep.
// 2. Ghost taps. A tap on the field shows the controls, and the click of that same tap then landed on
//    whatever control appeared under the finger: Close quit the game, a speed button changed the speed.
//    A click that follows a tap which began on the field is now dropped unless it is on the field itself.
//
// ?debug=sound shows a small line with the state of each part, for checking on a phone.
(function (root) {
  'use strict';
  var doc = root.document;
  if (!doc || !root.addEventListener) return;

  // 0.05 seconds of silence, 8 kHz mono WAV.
  var SILENCE = 'data:audio/wav;base64,UklGRrQBAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YZABAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  var ua = (root.navigator && root.navigator.userAgent) || '';
  var IOS = /iP(hone|ad|od)/.test(ua) || (root.navigator && root.navigator.platform === 'MacIntel' && root.navigator.maxTouchPoints > 1);

  var taps = 0, speechWoken = false, keep = null, keepState = 'off';

  function wakeSpeech() {
    if (speechWoken || !root.speechSynthesis || !root.SpeechSynthesisUtterance) return;
    speechWoken = true;
    try {
      if (root.speechSynthesis.speaking || root.speechSynthesis.pending) return;   // already talking: it is awake
      var u = new root.SpeechSynthesisUtterance(' ');
      u.volume = 0;
      root.speechSynthesis.speak(u);
    } catch (err) { /* the browser voice is optional */ }
  }
  function keepAwake() {
    if (!IOS || keep || typeof root.Audio !== 'function') return;
    try {
      keep = new root.Audio(SILENCE);
      keep.loop = true;
      keep.setAttribute('playsinline', '');
      var p = keep.play();
      keepState = 'on';
      if (p && p.catch) p.catch(function () { keepState = 'refused'; keep = null; });
    } catch (err) { keep = null; keepState = 'refused'; }
  }
  doc.addEventListener('visibilitychange', function () {
    if (!keep) return;
    try { if (doc.hidden) keep.pause(); else { var p = keep.play(); if (p && p.catch) p.catch(function () { /* the next tap starts it again */ }); } } catch (err) { /* optional */ }
  });

  // The media players start first and the sound engine after them: on an iPhone a media player that starts
  // takes the speaker for a moment and leaves a running engine 'interrupted'.
  function wake() {
    try { root.dispatchEvent(new root.Event('fr-unlock')); } catch (err) { /* old browser */ }
    var A = root.FF_AUDIO;
    if (A && typeof A.init === 'function') { try { A.init(); } catch (err) { /* sound is optional */ } }
  }
  var again = 0;
  function unlock() {
    taps++;
    keepAwake();
    wake();
    wakeSpeech();
    // Once more shortly after the tap, for an engine the tap left 'interrupted'.
    clearTimeout(again);
    again = setTimeout(function () { wake(); again = setTimeout(wake, 900); }, 250);
    var frames = doc.getElementsByTagName('iframe');
    for (var i = 0; i < frames.length; i++) {
      try { var w = frames[i].contentWindow; if (w && w !== root && typeof w.FR_PHONE_UNLOCK === 'function') w.FR_PHONE_UNLOCK(); } catch (err) { /* another site's frame */ }
    }
    if (dbg) paint();
  }
  ['touchend', 'pointerup', 'mouseup', 'click', 'keydown'].forEach(function (t) { root.addEventListener(t, unlock, true); });
  root.FR_PHONE_UNLOCK = unlock;

  // ---------------------------------------------------------------- ghost taps
  var downOnField = 0;
  root.addEventListener('pointerdown', function (ev) {
    var t = ev.target;
    downOnField = t && t.tagName === 'CANVAS' && ev.pointerType !== 'mouse' ? Date.now() : 0;
  }, true);
  root.addEventListener('click', function (ev) {
    var t = ev.target;
    if (!downOnField || Date.now() - downOnField > 700) return;
    downOnField = 0;
    if (!t || t.tagName === 'CANVAS') return;
    var stage = t.closest ? t.closest('.stage') : null;
    if (!stage) return;
    ev.preventDefault();
    ev.stopPropagation();
  }, true);

  // ---------------------------------------------------------------- ?debug=sound
  var dbg = null;
  function state() {
    var A = root.FF_AUDIO, S = root.FR_STADIUM_SOUND, V = root.FR_VOICE || {};
    var rec = null;
    try { rec = S && S.recording; } catch (err) { rec = null; }
    return {
      taps: taps, engine: A && A.state ? A.state() : 'none', crowd: rec ? rec.state : 'none',
      voice: V.primed ? 'ready' : 'waiting', played: V.played || 0, refused: V.refused || 0, robot: V.robot || 0,
      keep: keepState, ios: !!IOS
    };
  }
  root.FR_PHONE = { state: state };
  function paint() {
    var s = state();
    dbg.textContent = 'taps ' + s.taps + ' | engine ' + s.engine + ' | crowd ' + s.crowd + ' | voice ' + s.voice + ' played ' + s.played + ' refused ' + s.refused + ' robot ' + s.robot + ' | keep ' + s.keep;
  }
  if (/[?&]debug=sound/.test(root.location.search) || (function () { try { return /[?&]debug=sound/.test(root.parent.location.search); } catch (err) { return false; } })()) {
    var make = function () {
      dbg = doc.createElement('div');
      dbg.setAttribute('style', 'position:fixed;left:0;right:0;' + (root.parent !== root ? 'top:0;' : 'bottom:0;') + 'z-index:99999;background:#000;color:#ffc21a;font:11px/1.3 monospace;padding:3px 6px;pointer-events:none;opacity:.9');
      doc.body.appendChild(dbg);
      paint();
      setInterval(paint, 500);
    };
    if (doc.body) make(); else doc.addEventListener('DOMContentLoaded', make);
  }
})(typeof window !== 'undefined' ? window : this);
