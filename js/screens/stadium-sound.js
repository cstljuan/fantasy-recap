// The stadium crowd for both sports, on top of the broadcast sound in js/audio.js (Noah's),
// asked by Peyton:
//   - background: Peyton's crowd recording (js/screens/sounds/stadium-crowd.mp3) plays at a
//     medium level for the whole game, from the kickoff to the final, while the game view is open;
//   - a score (touchdown, field goal, goal) gets a loud cheer and hard clapping;
//   - an incomplete pass or a penalty (football), a foul, a penalty given away or an offside
//     (soccer) gets boos.
// The cheers and boos only call FF_AUDIO.play with sound names js/audio.js already has, and the
// recording follows js/audio.js's mute, volume, hidden page and ducking under the announcer.
// FF_AUDIO.claim keeps it from booing on top of js/audio.js.
// Loaded by js/app.js: into the app for football, into the soccer frame for soccer.
(function () {
  'use strict';
  var soccer = !window.FF_GAME && !!window.SC_GAME;
  var G = window.FF_GAME || window.SC_GAME;
  if (!G || typeof G.on !== 'function' || window.FR_STADIUM_SOUND) return;
  // The recording sits next to this file, whichever page loaded it.
  var HERE = (document.currentScript && document.currentScript.src) || location.href;

  function A() { var a = window.FF_AUDIO; return a && typeof a.play === 'function' ? a : null; }
  function open() { return G.active !== false && G.mode !== 'ready' && !G.seeking; }
  var played = [];
  function play(name) {
    var a = A();
    if (!a || !open()) return;
    played.push(name);
    try { a.play(name); } catch (err) { /* sound is optional */ }
  }
  function later(name, ms) { setTimeout(function () { play(name); }, ms); }
  // True when this module may play a sound of that kind now; js/audio.js then skips its own.
  function claim(kind, secs) { var a = A(); return !a || typeof a.claim !== 'function' || a.claim(kind, secs); }

  function cheer(loud) {
    // js/audio.js already roars (and claps later); this adds a cheer and claps right away.
    if (loud) play('crowd_roar');
    later('crowd_cheer', 300);
    later('crowd_clap', 900);
    later('crowd_clap', 2600);
  }
  function boo() { if (claim('boo', 1.5)) later('crowd_boo', 250); }

  G.on(function (type, d) {
    // 'start' comes inside the tap on Watch: the one moment a phone lets audio begin. The view
    // opens right after it, so the recording is queued a moment later (Noah: from the kickoff).
    if (type === 'start') { unlock(); setTimeout(function () { wake(); schedule(); if (ac && bus) bus.gain.setTargetAtTime(level(), ac.currentTime, 0.03); }, 0); }
    if (type === 'snap') wake();
    if (type !== 'result' || !d || !d.res || G.seeking) return;
    var res = d.res, e = res.e || {};
    if (soccer) {
      if (res.goal && !res.disallowed) cheer(false);
      else if (!res.card && (res.kind === 'foul' || res.kind === 'offside')) boo();
      return;
    }
    if (res.td) cheer(false);
    else if (e.t === 'fg' && e.good) cheer(true);
    else if (e.t === 'inc' || e.t === 'pen') boo();
  });

  // ------------------------------------------------------------- the recording
  // The clip is 15 seconds that fade in and out at its ends, so only its steady middle is used,
  // in copies that overlap and crossfade, which keeps the crowd at one level with no gap.
  var LEVEL = 0.28;                   // medium (2 dB under the first 0.35, Peyton's ask), before js/audio.js's master and crowd volumes
  var FROM = 2.5, TO = 9.5, FADE = 2;   // seconds of the clip; this keeps the loop within about 2 dB
  var ac = null, bus = null, buf = null, loading = false, nextAt = 0, timer = 0;
  function level() {
    var a = A(), m = a && a.mix ? a.mix() : null;
    if (!open() || document.hidden || (m && (m.muted || m.hidden))) return 0;
    var crowd = m && typeof m.crowd === 'number' ? m.crowd : 1, master = m && typeof m.target === 'number' ? m.target : 0.5;
    return LEVEL * crowd * Math.min(1, master * 2) * (m && m.ducked ? 0.6 : 1);
  }
  // The context and the recording are made as soon as this file loads, so the crowd can start
  // the moment the game does instead of after a download and a fade.
  function unlock() {
    make();
    if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (err) { /* needs a tap */ } }
  }
  function make() {
    if (!ac) {
      var AC0 = window.AudioContext || window.webkitAudioContext;
      if (!AC0) return;
      try { ac = new AC0(); } catch (err) { return; }
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
    }
    load();
  }
  function load() {
    if (buf || loading || !ac) return;
    loading = true;
    fetch(new URL('sounds/stadium-crowd.mp3', HERE).href).then(function (r) { if (!r.ok) throw new Error('crowd ' + r.status); return r.arrayBuffer(); })
      .then(function (data) { return new Promise(function (ok, no) { ac.decodeAudioData(data, ok, no); }); })
      .then(function (b) { buf = b; schedule(); })
      .catch(function () { loading = false; /* the game plays without the recording */ });
  }
  function wake() {
    if (!open()) return;
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (err) { return; }
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (err) { /* needs a tap */ } }
    if (!buf && !loading) {
      loading = true;
      fetch(new URL('sounds/stadium-crowd.mp3', HERE).href).then(function (r) { if (!r.ok) throw new Error('crowd ' + r.status); return r.arrayBuffer(); })
        .then(function (data) { return new Promise(function (ok, no) { ac.decodeAudioData(data, ok, no); }); })
        .then(function (b) { buf = b; schedule(); })
        .catch(function () { loading = false; /* the game plays without the recording */ });
    }
  }
  // One copy of the steady middle, faded in and out; the next one starts before this one ends.
  var playing = false;   // a copy is sounding now: the next one crossfades; the first one comes in fast
  function copyAt(t) {
    var len = Math.min(TO, buf.duration) - FROM, src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + (playing ? FADE : 0.15));
    playing = true;
    g.gain.setValueAtTime(1, t + len - FADE);
    g.gain.linearRampToValueAtTime(0.0001, t + len);
    src.connect(g); g.connect(bus);
    src.start(t, FROM, len);
    return t + len - FADE;
  }
  function schedule() {
    clearTimeout(timer);
    if (!buf || !ac) return;
    // Copies are only queued while the game view is open, so a closed game goes quiet.
    if (open()) {
      var now = ac.currentTime;
      if (nextAt < now) { nextAt = now + 0.02; playing = false; }
      while (nextAt < now + 2) nextAt = copyAt(nextAt);
    }
    timer = setTimeout(schedule, 500);
  }
  setInterval(function () {
    // The view opens just after the game's start event, so the recording also starts from here.
    if (open() && (!ac || ac.state === 'suspended' || (!buf && !loading))) wake();
    if (ac && bus) bus.gain.setTargetAtTime(level(), ac.currentTime, 0.3);
  }, 200);

  make();   // a suspended context and the decoded recording, ready before the first tap

  window.FR_STADIUM_SOUND = {
    get sounds() { return played.slice(); },
    get recording() { return { loaded: !!buf, state: ac ? ac.state : 'none', level: bus ? +bus.gain.value.toFixed(3) : 0, target: +level().toFixed(3) }; }
  };
})();
