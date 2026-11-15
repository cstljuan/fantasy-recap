// The stadium crowd for both sports, on top of the broadcast sound in js/audio.js (Noah's),
// asked by Peyton:
//   - background noise at all times: while the game view is open the crowd bed is kept going
//     between plays, through half time and after the final, not only at each snap;
//   - a score (touchdown, field goal, goal) gets a loud cheer and hard clapping;
//   - an incomplete pass or a penalty (football), a foul, a penalty given away or an offside
//     (soccer) gets boos.
// It only calls FF_AUDIO.play with sound names js/audio.js already has, so mute, volume, captions
// and the voice ducking stay Noah's. FF_AUDIO.claim keeps it from booing on top of js/audio.js.
// Loaded by js/app.js: into the app for football, into the soccer frame for soccer.
(function () {
  'use strict';
  var soccer = !window.FF_GAME && !!window.SC_GAME;
  var G = window.FF_GAME || window.SC_GAME;
  if (!G || typeof G.on !== 'function' || window.FR_STADIUM_SOUND) return;

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

  // Background: the bed fades out by itself after 40 quiet seconds and stops at half time and at
  // the final; asking for it every 10 seconds, and again after those breaks, keeps it going.
  function keepCrowd() { if (open()) play('crowd_murmur'); }
  setInterval(keepCrowd, 10000);

  function cheer(loud) {
    // js/audio.js already roars (and claps later); this adds a cheer and claps right away.
    if (loud) play('crowd_roar');
    later('crowd_cheer', 300);
    later('crowd_clap', 900);
    later('crowd_clap', 2600);
  }
  function boo() { if (claim('boo', 1.5)) later('crowd_boo', 250); }

  G.on(function (type, d) {
    if (type === 'start') { later('crowd_murmur', 3500); return; }
    if (type === 'half' || type === 'final') { later('crowd_murmur', 2500); return; }
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

  // ---------------------------------------------------------------- chatter
  // People talking in the stands, under js/audio.js's bed: many voices made in code, each one a
  // voiced buzz through two vowel formants that change every syllable, in phrases with pauses,
  // placed left and right, a little far away (a short room echo), with a low rumble under them.
  // Its level follows js/audio.js: muted, hidden page and ducked under the announcer.
  var CHATTER = 0.55;   // the talking's own level, before the master and crowd volumes
  var VOWELS = [[800, 1200], [500, 1900], [320, 2300], [520, 900], [340, 800], [650, 1650], [450, 1450]];
  var ac = null, bus = null, talkers = [], schedTimer = 0;
  function mixLevel() {
    var a = A(), m = a && a.mix ? a.mix() : null;
    if (!open() || document.hidden || !m || m.muted || m.hidden) return 0;
    var crowd = typeof m.crowd === 'number' ? m.crowd : 1, master = typeof m.target === 'number' ? m.target : 0.5;
    return CHATTER * crowd * Math.min(1, master * 2) * (m.ducked ? 0.45 : 1);
  }
  function impulse(secs) {
    var n = Math.floor(ac.sampleRate * secs), b = ac.createBuffer(2, n, ac.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
    return b;
  }
  function startChatter() {
    if (ac) { if (ac.state === 'suspended') { try { ac.resume(); } catch (err) { /* needs a tap */ } } return; }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (err) { return; }
    bus = ac.createGain(); bus.gain.value = 0;
    var tone = ac.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
    var room = ac.createConvolver(); room.buffer = impulse(1.4);
    var wet = ac.createGain(); wet.gain.value = 0.45;
    bus.connect(tone); tone.connect(ac.destination); tone.connect(room); room.connect(wet); wet.connect(ac.destination);
    // The low rumble of a full stand.
    var nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), nd = nb.getChannelData(0);
    for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    var rum = ac.createBufferSource(); rum.buffer = nb; rum.loop = true;
    var rlp = ac.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 380;
    var rg = ac.createGain(); rg.gain.value = 0.22;
    rum.connect(rlp); rlp.connect(rg); rg.connect(bus); rum.start();
    // The talkers: men and women, near and far, left and right.
    for (var k = 0; k < 16; k++) {
      var o = ac.createOscillator(); o.type = 'sawtooth';
      var f0 = k % 2 ? 95 + Math.random() * 50 : 170 + Math.random() * 70;
      o.frequency.value = f0;
      var f1 = ac.createBiquadFilter(); f1.type = 'bandpass'; f1.Q.value = 6;
      var f2 = ac.createBiquadFilter(); f2.type = 'bandpass'; f2.Q.value = 8;
      var g1 = ac.createGain(), g2 = ac.createGain(); g2.gain.value = 0.5;
      var amp = ac.createGain(); amp.gain.value = 0;
      var pan = ac.createStereoPanner ? ac.createStereoPanner() : null;
      var near = 0.35 + Math.random() * 0.65;
      o.connect(f1); o.connect(f2); f1.connect(g1); f2.connect(g2); g1.connect(amp); g2.connect(amp);
      var outN = amp;
      if (pan) { pan.pan.value = Math.random() * 1.8 - 0.9; amp.connect(pan); outN = pan; }
      var lvl = ac.createGain(); lvl.gain.value = near * 0.9;
      outN.connect(lvl); lvl.connect(bus);
      o.start();
      talkers.push({ o: o, f1: f1, f2: f2, amp: amp, f0: f0, next: ac.currentTime + Math.random() * 2 });
    }
    schedTimer = setInterval(schedule, 120);
  }
  // Each talker says phrases of 3 to 10 syllables, falling a little in pitch, then pauses.
  function schedule() {
    if (!ac) return;
    var t = ac.currentTime, ahead = t + 0.5;
    talkers.forEach(function (p) {
      if (p.next < t) p.next = t + 0.05;
      while (p.next < ahead) {
        if (!p.left) { p.left = 3 + Math.floor(Math.random() * 8); p.pitch = 1 + Math.random() * 0.15; }
        var dur = 0.1 + Math.random() * 0.2, v = VOWELS[Math.floor(Math.random() * VOWELS.length)], s = p.next;
        p.pitch *= 0.97 + Math.random() * 0.04;
        p.o.frequency.setTargetAtTime(p.f0 * p.pitch * (0.92 + Math.random() * 0.16), s, 0.03);
        p.f1.frequency.setTargetAtTime(v[0] * (0.9 + Math.random() * 0.2), s, 0.02);
        p.f2.frequency.setTargetAtTime(v[1] * (0.9 + Math.random() * 0.2), s, 0.02);
        p.amp.gain.setTargetAtTime(0.5 + Math.random() * 0.5, s, 0.015);
        p.amp.gain.setTargetAtTime(0, s + dur * 0.8, 0.025);
        p.left -= 1;
        p.next = s + dur + (p.left ? 0.02 + Math.random() * 0.06 : 0.3 + Math.random() * 1.4);
      }
    });
  }
  setInterval(function () {
    // The view opens just after the game's start event, so the talking starts from here.
    if (open() && (!ac || ac.state === 'suspended')) startChatter();
    if (ac && bus) bus.gain.setTargetAtTime(mixLevel(), ac.currentTime, 0.25);
  }, 200);
  function wake() { if (open()) startChatter(); }
  G.on(function (type) { if (type === 'start' || type === 'snap') wake(); });
  window.addEventListener('pointerdown', wake, true);
  window.addEventListener('keydown', wake, true);

  window.FR_STADIUM_SOUND = {
    get sounds() { return played.slice(); },
    get chatter() { return ac ? { state: ac.state, talkers: talkers.length, level: bus ? +bus.gain.value.toFixed(3) : 0, target: +mixLevel().toFixed(3) } : null; }
  };
})();
