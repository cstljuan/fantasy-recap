// Sound effects made with the Web Audio API. No audio files.
// Browsers only allow sound after a tap, so init() is called from the first tap.
(function (root) {
  'use strict';

  var ac = null, master = null;
  var played = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      if (ac.state === 'suspended') ac.resume();
    } catch (err) { ac = null; }
  }

  function tone(type, f0, f1, t0, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.03);
  }

  function noise(t0, dur, vol, freq, kind) {
    var n = Math.max(1, Math.floor(ac.sampleRate * dur));
    var buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    var src = ac.createBufferSource(); src.buffer = buf;
    var f = ac.createBiquadFilter(); f.type = kind || 'bandpass'; f.frequency.value = freq;
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.05, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  function notes(list, t0, step, type, vol) {
    list.forEach(function (f, i) { tone(type, f, f, t0 + i * step, step * 1.6, vol); });
  }

  var SOUNDS = {
    pass: function (t) { tone('square', 320, 980, t, 0.2, 0.16); noise(t, 0.2, 0.08, 1800); },
    'catch': function (t) { tone('square', 740, 740, t, 0.07, 0.14); },
    tackle: function (t) { noise(t, 0.16, 0.4, 320, 'lowpass'); tone('sine', 110, 50, t, 0.16, 0.4); },
    kick: function (t) { tone('sine', 170, 45, t, 0.24, 0.7); noise(t, 0.05, 0.2, 900); },
    td: function (t) { notes([523, 659, 784, 1047, 784, 1047, 1319], t, 0.11, 'square', 0.16); noise(t, 1.6, 0.14, 1200); },
    fg: function (t) { notes([784, 1047, 1319], t, 0.13, 'square', 0.16); noise(t + 0.1, 0.9, 0.1, 1200); },
    miss: function (t) { tone('sawtooth', 300, 110, t, 0.5, 0.16); },
    whistle: function (t) { tone('square', 2350, 2350, t, 0.12, 0.1); tone('square', 2500, 2500, t + 0.1, 0.3, 0.1); },
    turnover: function (t) { tone('square', 620, 240, t, 0.3, 0.16); tone('square', 520, 180, t + 0.18, 0.35, 0.14); }
  };

  function play(name) {
    played[name] = (played[name] || 0) + 1;
    if (!ac || !SOUNDS[name]) return;
    try { SOUNDS[name](ac.currentTime + 0.01); } catch (err) { /* sound is optional */ }
  }

  root.FF_AUDIO = { init: init, play: play, played: played, state: function () { return ac ? ac.state : 'none'; } };
})(window);
