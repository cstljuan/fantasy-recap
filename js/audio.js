// Sound effects made with the Web Audio API. No audio files.
// Browsers only allow sound after a tap, so init() is called from the first tap.
//
// Crowd (all made in code, no audio files):
//   crowd_murmur  starts or keeps a low murmur under the game. Call it at each snap.
//                 It fades out by itself about 15 seconds after the last crowd call.
//   crowd_swell   the crowd rises, for a gain of 15 yards or more
//   crowd_roar    a full roar, for a touchdown
//   crowd_groan   a falling groan, for a turnover
//   crowd_stop    fades the murmur out now (halftime, final, pause)
//   whistle_long  one long blast, for halftime and the final
// Big plays build on each other: every swell and roar makes the murmur a little
// louder for a while, and that excitement fades again over about 30 seconds.
// crowdFor(res) returns the crowd sound name for a play result, or ''.
(function (root) {
  'use strict';

  var ac = null, master = null;
  var played = {};

  function init(ctx) {
    if (ctx) { ac = null; bed = null; }   // a given context (for tests) replaces the old one
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    var AC = ctx ? null : root.AudioContext || root.webkitAudioContext;
    if (!AC && !ctx) return;
    try {
      ac = ctx || new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      if (!ctx && ac.state === 'suspended') ac.resume();
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


  // ---- Crowd ----
  var bed = null;          // the running murmur: { src, gain, lfo }
  var hype = 0;            // 0 to 1, raised by big plays, fades over time
  var hypeAt = 0;          // ac time when hype was last set
  var BED_BASE = 0.05, BED_MAX = 0.14, BED_IDLE = 15, HYPE_FADE = 30;

  function noiseBuffer(secs) {
    var n = Math.floor(ac.sampleRate * secs), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    // Pinkish noise: softer highs than plain white noise, closer to many voices.
    var b0 = 0, b1 = 0, b2 = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056;
      d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2;
    }
    return buf;
  }

  function hypeNow(t) {
    var h = hype * Math.max(0, 1 - (t - hypeAt) / HYPE_FADE);
    return h;
  }
  function addHype(t, amount) { hype = Math.min(1, hypeNow(t) + amount); hypeAt = t; }

  function bedLevel(t) { return BED_BASE + (BED_MAX - BED_BASE) * hypeNow(t); }

  function startBed(t) {
    var src = ac.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
    var lo = ac.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 420; lo.Q.value = 0.6;
    var hi = ac.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 1400;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    // A slow wobble in loudness so it sounds like people talking, not a fan.
    var lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.35; lg.gain.value = 0.25;
    var wob = ac.createGain(); wob.gain.value = 1;
    lfo.connect(lg); lg.connect(wob.gain);
    src.connect(lo); lo.connect(hi); hi.connect(wob); wob.connect(g); g.connect(master);
    src.start(t); lfo.start(t);
    bed = { src: src, gain: g, lfo: lfo };
  }

  function setBed(t, level, secs) {
    var g = bed.gain.gain;
    if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
    g.linearRampToValueAtTime(Math.max(0.0001, level), t + secs);
  }

  function murmur(t) {
    if (!bed) startBed(t);
    setBed(t, bedLevel(t), 1.2);
    // Fade out by itself if nothing calls the crowd again for a while.
    bed.gain.gain.setValueAtTime(bedLevel(t), t + BED_IDLE);
    bed.gain.gain.linearRampToValueAtTime(0.0001, t + BED_IDLE + 3);
  }

  function stopBed(t) {
    if (!bed) return;
    setBed(t, 0.0001, 1.5);
    var b = bed; bed = null;
    try { b.src.stop(t + 1.6); b.lfo.stop(t + 1.6); } catch (err) { /* already stopped */ }
  }

  // A swept band of noise: the body of a crowd reaction.
  function wave(t, dur, vol, f0, f1, attack) {
    var src = ac.createBufferSource(); src.buffer = noiseBuffer(dur + 0.1);
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.setValueAtTime(vol, t + Math.max(attack, dur * 0.55));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // Single voices in the crowd: short sliding tones with a little vibrato.
  function voices(t, count, dur, vol, lowHz, highHz, up) {
    for (var i = 0; i < count; i++) {
      var st = t + Math.random() * dur * 0.4, d = dur * (0.4 + Math.random() * 0.5);
      var f0 = lowHz + Math.random() * (highHz - lowHz), f1 = up ? f0 * 1.35 : f0 * 0.7;
      var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      var vib = ac.createOscillator(), vg = ac.createGain();
      o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 1800;
      o.frequency.setValueAtTime(f0, st);
      o.frequency.exponentialRampToValueAtTime(f1, st + d);
      vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = f0 * 0.02;
      vib.connect(vg); vg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(vol, st + d * 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, st + d);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(st); vib.start(st); o.stop(st + d + 0.05); vib.stop(st + d + 0.05);
    }
  }

  function crowdCall(t) { if (!bed) startBed(t); }

  // After a reaction, settle the murmur back to its (now higher) level.
  function settle(t, after) {
    setBed(t, bedLevel(t) * 0.6, 0.3);
    bed.gain.gain.linearRampToValueAtTime(bedLevel(t), t + after);
    bed.gain.gain.setValueAtTime(bedLevel(t), t + after + BED_IDLE);
    bed.gain.gain.linearRampToValueAtTime(0.0001, t + after + BED_IDLE + 3);
  }

  var CROWD = {
    crowd_murmur: function (t) { crowdCall(t); murmur(t); },
    crowd_swell: function (t) {
      crowdCall(t);
      var h = hypeNow(t);
      wave(t, 2.2, 0.16 + 0.1 * h, 500, 1100, 0.7);
      voices(t + 0.3, 5 + Math.round(4 * h), 1.4, 0.012, 380, 700, true);
      addHype(t, 0.25);
      settle(t, 2.2);
    },
    crowd_roar: function (t) {
      crowdCall(t);
      var h = hypeNow(t);
      wave(t, 3.6, 0.3 + 0.1 * h, 700, 1500, 0.25);
      wave(t + 0.1, 3.4, 0.18, 300, 600, 0.3);
      voices(t + 0.15, 12 + Math.round(6 * h), 2.4, 0.014, 420, 900, true);
      addHype(t, 0.5);
      settle(t, 3.6);
    },
    crowd_groan: function (t) {
      crowdCall(t);
      wave(t, 1.8, 0.16, 650, 240, 0.25);
      voices(t + 0.05, 8, 1.6, 0.012, 200, 360, false);
      hype = hypeNow(t) * 0.5; hypeAt = t;   // a turnover takes some air out of the place
      settle(t, 1.8);
    },
    crowd_stop: function (t) { stopBed(t); },
    whistle_long: function (t) {
      tone('square', 2400, 2400, t, 1.1, 0.1);
      tone('square', 2560, 2560, t, 1.1, 0.05);
    }
  };
  Object.keys(CROWD).forEach(function (k) { SOUNDS[k] = CROWD[k]; });

  // Which crowd sound fits a play result from js/rules.js ('' for none).
  function crowdFor(res) {
    if (!res) return '';
    var e = res.e || {};
    if (res.td) return 'crowd_roar';
    if (e.t === 'int' || e.t === 'fumble' || res.downs) return 'crowd_groan';
    if ((e.t === 'run' || e.t === 'pass') && e.yds >= 15) return 'crowd_swell';
    if (e.t === 'fg' && e.good) return 'crowd_swell';
    return '';
  }

  function play(name) {
    played[name] = (played[name] || 0) + 1;
    if (!ac || !SOUNDS[name]) return;
    try { SOUNDS[name](ac.currentTime + 0.01); } catch (err) { /* sound is optional */ }
  }

  root.FF_AUDIO = {
    init: init, play: play, played: played, crowdFor: crowdFor,
    names: function () { return Object.keys(SOUNDS); },
    state: function () { return ac ? ac.state : 'none'; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
