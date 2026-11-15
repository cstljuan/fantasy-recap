// Sound effects made with the Web Audio API. No audio files.
// Browsers only allow sound after a tap, so init() is called from the first tap.
//
// The mix (C13): master -> speakers, with two buses under it, effects and crowd. The crowd
// bus goes through a ducker that dips it while the announcer is speaking.
//   FF_AUDIO.setVolume(kind, 0 to 1)   kind is 'master', 'crowd' or 'effects'
//   FF_AUDIO.volume(kind)              the current level
//   FF_AUDIO.mute(true or false)       FF_AUDIO.muted() reads it
//   FF_AUDIO.mix()                     the levels in force now (after mute, hiding, ducking)
//   FF_AUDIO.duck(true or false)       dip the crowd by hand, for example under a recorded clip.
//                                      Browser speech is noticed by itself.
// Levels and mute are kept in localStorage under 'fr.audio'. Everything goes silent while
// the page is hidden and comes back when it is shown again.
//
// Sound captions (C17), for people who cannot hear the sound:
//   FF_AUDIO.captionFor(name)   the caption for a sound, like '[crowd roars]', or '' for the small
//                               sounds of every play (pass, catch, tackle, kick, short whistle).
// play(name) sends the caption to the announcer's onLine listeners with kind 'sound'
// (FF_ANNOUNCER.notify, or SC_ANNOUNCER.notify on the soccer page), also while muted.
// The crowd murmur is captioned once when it starts, not at every snap.
//
// Crowd (all made in code, no audio files):
//   crowd_murmur  starts or keeps the stadium bed under the game (near voices, the rumble of the
//                 stand, a far end that sings and swells). Call it at each snap. It fades out by
//                 itself about 40 seconds after the last crowd call.
//   crowd_swell   the crowd rises, for a gain of 15 yards or more
//   crowd_roar    a full roar, for a touchdown
//   crowd_groan   a falling groan, for a turnover
//   crowd_stop    fades the murmur out now (halftime, final, pause)
//   whistle       the referee's pea whistle, one short blast (also: pass, catch, tackle, kick, td,
//                 fg, miss, turnover sound like a broadcast microphone, no arcade beeps)
//   whistle_long  a short and a long blast, for half time
//   whistle_full  two short and a long blast, for full time
//   crowd_cheer   a cheer that does not restart the bed, for the final
//   jingle_kickoff  a short brass and drum fanfare, about 3 seconds, before the kickoff
//   jingle_final    a fuller theme that ends on a held chord, about 4 seconds, at full time
//   crowd_clap   rhythmic clapping        crowd_chant  "De-fense!" three times with claps
//   crowd_boo    a low boo                crowd_ooh    a rising and falling "ooh" for a near miss
//   crowd_aww    a falling "aww"          crowd_stomp  stomping before a kickoff
//   crowd_drum   a drum build on 4th down air_horn     a stadium horn after a touchdown
// After init() these play by themselves from FF_GAME's events (react): a chant on 3rd down,
// drums on 4th down, stomps at kickoffs, the horn and clapping after touchdowns, claps for good
// kicks and sacks, aww for missed kicks, ooh for incompletions on 3rd and 4th down, boos for
// flags and turnovers. Each has a cooldown so the crowd never piles up; nothing plays while
// the game view is closed or during FF_GAME.seek.
// Big plays build on each other: every swell and roar makes the murmur a little
// louder for a while, and that excitement fades again over about 30 seconds.
// crowdFor(res) returns the crowd sound name for a play result, or ''.
//
// One broadcast sound for both sports (C29): the soccer page loads this file too and gets
// window.SC_SOUND.play(name) (kick, head, block, post, goal, whistle) with the same bed, whistle,
// crowd, levels, mute and captions; its crowd reacts to SC_GAME's events (reactSoccer).
// FF_AUDIO.claim(kind, secs) lets another module (js/screens/crowd.js) skip a crowd sound of a
// kind that already played in the last secs, so two crowds never chant or cheer over each other.
(function (root) {
  'use strict';

  var ac = null, master = null, fxBus = null, crowdBus = null, ducker = null;
  var DEFAULTS = { master: 0.5, crowd: 1, effects: 1, muted: false };
  var DUCK_LEVEL = 0.3;
  var settings = loadSettings(), ducked = false, handDuck = false, duckTimer = 0;

  function loadSettings() {
    var s = { master: DEFAULTS.master, crowd: DEFAULTS.crowd, effects: DEFAULTS.effects, muted: DEFAULTS.muted };
    try {
      var raw = root.localStorage && root.localStorage.getItem('fr.audio');
      var v = raw ? JSON.parse(raw) : null;
      if (v) {
        ['master', 'crowd', 'effects'].forEach(function (k) { if (typeof v[k] === 'number' && v[k] >= 0 && v[k] <= 1) s[k] = v[k]; });
        s.muted = v.muted === true;
      }
    } catch (err) { /* storage can be blocked; defaults are fine */ }
    return s;
  }
  function saveSettings() {
    try { if (root.localStorage) root.localStorage.setItem('fr.audio', JSON.stringify(settings)); } catch (err) { /* optional */ }
  }
  function hidden() { return !!(root.document && root.document.hidden); }
  // Set a gain smoothly so a change never clicks.
  function level(node, v) {
    if (!node || !ac) return;
    try { node.gain.cancelScheduledValues(ac.currentTime); node.gain.setTargetAtTime(v, ac.currentTime, 0.05); }
    catch (err) { node.gain.value = v; }
  }
  function applyMix() {
    if (!ac) return;
    level(master, settings.muted || hidden() ? 0 : settings.master);
    level(fxBus, settings.effects);
    level(crowdBus, settings.crowd);
    level(ducker, ducked || handDuck ? DUCK_LEVEL : 1);
  }
  // Watch the browser's speech so the crowd dips under the announcer.
  function watchSpeech() {
    clearInterval(duckTimer);
    duckTimer = setInterval(function () {
      var sp = !!(root.speechSynthesis && root.speechSynthesis.speaking);
      if (sp !== ducked) { ducked = sp; applyMix(); }
    }, 150);
  }
  var played = {};

  function init(ctx) {
    if (ctx) { ac = null; bed = null; jingleUntil = 0; }   // a given context (for tests) replaces the old one
    // 'interrupted' is an iPhone state (another sound took the speaker for a moment): it needs resume() as well.
    if (ac) { if (ac.state !== 'running' && ac.state !== 'closed') { try { ac.resume(); } catch (err) { /* needs a tap */ } } return; }
    var AC = ctx ? null : root.AudioContext || root.webkitAudioContext;
    if (!AC && !ctx) return;
    try {
      ac = ctx || new AC();
      master = ac.createGain();
      master.gain.value = settings.muted || hidden() ? 0 : settings.master;
      master.connect(ac.destination);
      fxBus = ac.createGain(); fxBus.gain.value = settings.effects; fxBus.connect(master);
      ducker = ac.createGain(); ducker.gain.value = 1; ducker.connect(master);
      crowdBus = ac.createGain(); crowdBus.gain.value = settings.crowd; crowdBus.connect(ducker);
      if (!ctx && ac.state !== 'running') ac.resume();
      if (!ctx) { watchSpeech(); hook(); }
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
    o.connect(g); g.connect(fxBus);
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
    src.connect(f); f.connect(g); g.connect(fxBus);
    src.start(t0); src.stop(t0 + dur + 0.03);
  }

  function notes(list, t0, step, type, vol) {
    list.forEach(function (f, i) { tone(type, f, f, t0 + i * step, step * 1.6, vol); });
  }

  // A referee's pea whistle (C29, the same on the football field and the soccer pitch): a high
  // tone that the pea inside makes flutter about 30 times a second, with some breath on top.
  function refWhistle(t, dur, vol) {
    var o = ac.createOscillator(), g = ac.createGain(), trill = ac.createOscillator(), tg = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(2850, t);
    o.frequency.linearRampToValueAtTime(3050, t + 0.04);
    trill.frequency.value = 31; tg.gain.value = 160;
    trill.connect(tg); tg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + Math.max(0.03, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(fxBus);
    o.start(t); trill.start(t); o.stop(t + dur + 0.03); trill.stop(t + dur + 0.03);
    noise(t, dur, vol * 0.35, 3000);
  }

  // A crowd that jolts at once (the moment a ball crosses the line or changes hands): a short,
  // loud band of voices that the slower roar or groan from crowdFor then carries on.
  function burst(t, vol, f0, f1, dur) {
    var src = ac.createBufferSource(); src.buffer = noiseBuffer(dur + 0.1);
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.9;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(crowdBus);
    src.start(t); src.stop(t + dur + 0.05);
  }

  // The small sounds of play, as a broadcast microphone hears them: no arcade beeps (C29).
  var SOUNDS = {
    pass: function (t) { noise(t, 0.06, 0.5, 600, 'lowpass'); noise(t + 0.02, 0.24, 0.12, 1400); },
    'catch': function (t) { noise(t, 0.07, 0.3, 700, 'lowpass'); tone('sine', 170, 90, t, 0.07, 0.18); },
    tackle: function (t) { noise(t, 0.16, 0.4, 320, 'lowpass'); tone('sine', 110, 50, t, 0.16, 0.4); },
    kick: function (t) { tone('sine', 170, 45, t, 0.24, 0.7); noise(t, 0.05, 0.2, 900); },
    td: function (t) { burst(t, 0.42, 600, 1300, 1.2); voices(t + 0.05, 10, 1.0, 0.02, 450, 900, true); },
    fg: function (t) { burst(t, 0.3, 550, 1100, 1.0); },
    miss: function (t) { burst(t, 0.22, 700, 380, 0.7); },
    whistle: function (t) { refWhistle(t, 0.38, 0.18); },
    turnover: function (t) { burst(t, 0.3, 450, 950, 0.9); },
    // Soccer (SC_SOUND.play from soccer/js/plays.js)
    head: function (t) { tone('sine', 220, 90, t, 0.12, 0.35); noise(t, 0.04, 0.12, 800); },
    block: function (t) { noise(t, 0.14, 0.4, 300, 'lowpass'); tone('sine', 120, 55, t, 0.14, 0.35); },
    post: function (t) { tone('sine', 1180, 1170, t, 0.7, 0.12); tone('sine', 1770, 1760, t, 0.45, 0.06); tone('sine', 160, 60, t, 0.12, 0.3); },
    goal: function (t) { SOUNDS.td(t); }
  };


  // ---- Crowd ----
  var bed = null;          // the running murmur: { src, gain, lfo }
  var hype = 0;            // 0 to 1, raised by big plays, fades over time
  var hypeAt = 0;          // ac time when hype was last set
  var BED_BASE = 0.11, BED_MAX = 0.24, BED_IDLE = 40, HYPE_FADE = 30;   // louder crowd (Noah); a stadium never drops out mid game (C29)

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

  // The stadium bed (C29, the soccer broadcast sound on both fields): near voices talking, the
  // low rumble of a full stand, and a far end that sings and swells on its own every ten seconds
  // or so. The three layers add up to at most 1 before the bed's own level.
  function startBed(t) {
    var src = ac.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
    var lo = ac.createBiquadFilter(); lo.type = 'bandpass'; lo.frequency.value = 420; lo.Q.value = 0.6;
    var hi = ac.createBiquadFilter(); hi.type = 'lowpass'; hi.frequency.value = 1400;
    var g = ac.createGain(); g.gain.setValueAtTime(0.0001, t);
    // A slow wobble in loudness so it sounds like people talking, not a fan.
    var lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.35; lg.gain.value = 0.15;
    var wob = ac.createGain(); wob.gain.value = 0.45;   // near voices: 0.3 to 0.6
    lfo.connect(lg); lg.connect(wob.gain);
    src.connect(lo); lo.connect(hi); hi.connect(wob); wob.connect(g);
    // The rumble of the stand: the same noise, low and steady.
    var rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 220;
    var rg = ac.createGain(); rg.gain.value = 0.2;
    src.connect(rf); rf.connect(rg); rg.connect(g);
    // The far end singing: a narrow band that rises and falls slowly.
    var far = ac.createBiquadFilter(); far.type = 'bandpass'; far.frequency.value = 640; far.Q.value = 3;
    var flfo = ac.createOscillator(), flg = ac.createGain(), fw = ac.createGain();
    flfo.frequency.value = 0.09; flg.gain.value = 0.1; fw.gain.value = 0.1;   // 0 to 0.2
    flfo.connect(flg); flg.connect(fw.gain);
    src.connect(far); far.connect(fw); fw.connect(g);
    g.connect(crowdBus);
    src.start(t); lfo.start(t); flfo.start(t);
    bed = { src: src, gain: g, lfo: lfo, flfo: flfo };
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
    try { b.src.stop(t + 1.6); b.lfo.stop(t + 1.6); b.flfo.stop(t + 1.6); } catch (err) { /* already stopped */ }
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
    src.connect(f); f.connect(g); g.connect(crowdBus);
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
      o.connect(lp); lp.connect(g); g.connect(crowdBus);
      o.start(st); vib.start(st); o.stop(st + d + 0.05); vib.stop(st + d + 0.05);
    }
  }

  function recordedCrowd() {
    var R = root.FR_STADIUM_SOUND;
    try { return !!(R && R.recording && R.recording.loaded); } catch (err) { return false; }
  }
  function crowdCall(t) { if (!bed && !recordedCrowd()) startBed(t); }

  // After a reaction, settle the murmur back to its (now higher) level.
  function settle(t, after) {
    setBed(t, bedLevel(t) * 0.6, 0.3);
    bed.gain.gain.linearRampToValueAtTime(bedLevel(t), t + after);
    bed.gain.gain.setValueAtTime(bedLevel(t), t + after + BED_IDLE);
    bed.gain.gain.linearRampToValueAtTime(0.0001, t + after + BED_IDLE + 3);
  }

  var CROWD = {
    // Peyton's recorded stadium crowd (js/screens/stadium-sound.js) is the background when it has
    // loaded; then this synthesized bed stays off and the reactions play over the recording.
    crowd_murmur: function (t) { if (recordedCrowd()) { if (bed) stopBed(t); return; } crowdCall(t); murmur(t); },
    crowd_swell: function (t) {
      crowdCall(t);
      var h = hypeNow(t);
      wave(t, 2.2, 0.26 + 0.12 * h, 500, 1100, 0.7);
      voices(t + 0.3, 6 + Math.round(4 * h), 1.4, 0.02, 380, 700, true);
      addHype(t, 0.25);
      settle(t, 2.2);
    },
    crowd_roar: function (t) {
      crowdCall(t);
      var h = hypeNow(t);
      wave(t, 3.6, 0.45 + 0.12 * h, 700, 1500, 0.25);
      wave(t + 0.1, 3.4, 0.28, 300, 600, 0.3);
      voices(t + 0.15, 14 + Math.round(6 * h), 2.4, 0.022, 420, 900, true);
      addHype(t, 0.5);
      settle(t, 3.6);
    },
    crowd_groan: function (t) {
      crowdCall(t);
      wave(t, 1.8, 0.26, 650, 240, 0.25);
      voices(t + 0.05, 10, 1.6, 0.02, 200, 360, false);
      hype = hypeNow(t) * 0.5; hypeAt = t;   // a turnover takes some air out of the place
      settle(t, 1.8);
    },
    crowd_stop: function (t) { stopBed(t); },
    whistle_long: function (t) { refWhistle(t, 0.3, 0.18); refWhistle(t + 0.45, 1.0, 0.18); },
    // Full time on both fields: two short blasts and a long one.
    whistle_full: function (t) { refWhistle(t, 0.28, 0.18); refWhistle(t + 0.4, 0.28, 0.18); refWhistle(t + 0.8, 1.2, 0.18); },
    // A cheer that does not start the bed again: for the final, after crowd_stop.
    crowd_cheer: function (t) {
      wave(t, 3.0, 0.4, 700, 1300, 0.3);
      voices(t + 0.1, 14, 2.2, 0.02, 420, 900, true);
    }
  };
  Object.keys(CROWD).forEach(function (k) { SOUNDS[k] = CROWD[k]; });

  // ---- Jingles ----
  // A brass-like note: two slightly detuned sawtooth waves through a filter that opens
  // on the attack, the way a horn gets brighter as it is blown.
  function brass(f, t, dur, vol) {
    var g = ac.createGain(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.linearRampToValueAtTime(f * 6, t + 0.06);
    lp.frequency.exponentialRampToValueAtTime(f * 3, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.setValueAtTime(vol * 0.85, t + Math.max(0.04, dur - 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [-6, 6].forEach(function (cents) {
      var o = ac.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = cents;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    });
    lp.connect(g); g.connect(fxBus);
  }
  function drum(t, vol) { tone('sine', 140, 45, t, 0.22, vol); noise(t, 0.08, vol * 0.3, 1500); }
  function snare(t, vol) { noise(t, 0.14, vol, 2500); tone('triangle', 220, 160, t, 0.08, vol * 0.4); }
  function cymbal(t, dur, vol) { noise(t, dur, vol, 7000, 'highpass'); }
  // Note names to frequencies, so the tunes below read like music.
  var N = { G3: 196, A3: 220, B3: 246.9, C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784 };
  function chord(names, t, dur, vol) { names.forEach(function (n) { brass(N[n], t, dur, vol / names.length * 1.6); }); }

  SOUNDS.jingle_kickoff = function (t) {
    var b = 0.16;   // one eighth note
    // Pickup, rising call, then a big chord with a drum roll into it.
    [['G3', 0], ['C4', 1], ['E4', 2], ['G4', 3], ['E4', 5], ['G4', 6]].forEach(function (x) { brass(N[x[0]], t + x[1] * b, b * 1.2, 0.14); });
    for (var i = 0; i < 6; i++) snare(t + (8 + i * 0.5) * b, 0.06 + i * 0.015);
    chord(['C4', 'E4', 'G4', 'C5'], t + 11 * b, 1.1, 0.2);
    drum(t + 11 * b, 0.5); cymbal(t + 11 * b, 1.2, 0.08);
    drum(t + 15 * b, 0.4); chord(['C4', 'G4', 'C5', 'E5'], t + 15 * b, 1.0, 0.2);
  };

  SOUNDS.jingle_final = function (t) {
    var b = 0.2;
    // A march figure, then IV, V and a long tonic chord with the crowd-style cymbal.
    [['C4', 0], ['E4', 1], ['G4', 2], ['C5', 3], ['B4', 4], ['G4', 5], ['A4', 6], ['B4', 7]].forEach(function (x, i) {
      brass(N[x[0]], t + x[1] * b, b * 1.1, 0.13);
      if (i % 2 === 0) drum(t + x[1] * b, 0.3); else snare(t + x[1] * b, 0.05);
    });
    chord(['F4', 'A4', 'C5'], t + 8 * b, b * 2, 0.18); drum(t + 8 * b, 0.4);
    chord(['G4', 'B4', 'D5'], t + 10 * b, b * 2, 0.18); drum(t + 10 * b, 0.4);
    for (var i = 0; i < 4; i++) snare(t + (11 + i * 0.25) * b, 0.05 + i * 0.02);
    chord(['C4', 'E4', 'G4', 'C5', 'E5'], t + 12 * b, 1.6, 0.24);
    drum(t + 12 * b, 0.6); cymbal(t + 12 * b, 1.8, 0.1);
  };

  // ---- More of a real stadium (Noah): claps, a chant, boos, ooh, aww, stomps, drums, air horn ----
  // A section of the crowd as voices: detuned sawtooth tones through a vowel-like filter,
  // gliding from f0 to f0 * glide.
  function chorus(t, n, dur, vol, lo, hi, glide, vowel, mid) {
    for (var i = 0; i < n; i++) {
      var st = t + Math.random() * 0.12, d = dur * (0.8 + Math.random() * 0.3);
      var f0 = lo + Math.random() * (hi - lo);
      var o = ac.createOscillator(), g = ac.createGain(), bp = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f0, st);
      if (mid) o.frequency.linearRampToValueAtTime(f0 * mid, st + d * 0.4);
      o.frequency.linearRampToValueAtTime(f0 * glide, st + d);
      bp.type = 'bandpass'; bp.frequency.value = vowel; bp.Q.value = 1.5;
      lp.type = 'lowpass'; lp.frequency.value = vowel * 2.5;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(vol, st + Math.min(0.12, d * 0.2));
      g.gain.setValueAtTime(vol, st + d * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, st + d);
      o.connect(bp); bp.connect(lp); lp.connect(g); g.connect(crowdBus);
      o.start(st); o.stop(st + d + 0.05);
    }
  }
  // Many hands clapping on a beat: short bright bursts, each person a little early or late.
  function claps(t, beats, every, vol) {
    for (var b = 0; b < beats; b++) {
      for (var p = 0; p < 7; p++) {
        var at = Math.max(t, t + b * every + (Math.random() - 0.5) * 0.05), n = Math.max(1, Math.floor(ac.sampleRate * 0.05));
        var buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
        var src = ac.createBufferSource(); src.buffer = buf;
        var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100 + Math.random() * 1500; f.Q.value = 1.2;
        var g = ac.createGain(); g.gain.value = vol;
        src.connect(f); f.connect(g); g.connect(crowdBus);
        src.start(at); src.stop(at + 0.06);
      }
    }
  }
  function stomp(t, vol) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(85, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.2);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(crowdBus); o.start(t); o.stop(t + 0.3);
    var src = ac.createBufferSource(); src.buffer = noiseBuffer(0.12);
    var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260;
    var g2 = ac.createGain(); g2.gain.setValueAtTime(vol * 0.6, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(f); f.connect(g2); g2.connect(crowdBus); src.start(t); src.stop(t + 0.13);
  }

  var MORE = {
    crowd_clap: function (t) { claps(t, 8, 0.32, 0.2); },
    // "De-fense!": a low syllable, a higher one, two claps; three times.
    crowd_chant: function (t) {
      for (var r = 0; r < 3; r++) {
        var at = t + r * 1.3;
        chorus(at, 12, 0.32, 0.045, 150, 175, 0.97, 650);
        chorus(at + 0.38, 12, 0.45, 0.05, 185, 215, 0.92, 750);
        claps(at + 0.82, 2, 0.24, 0.18);
      }
    },
    crowd_boo: function (t) { chorus(t, 16, 2.3, 0.04, 120, 190, 0.9, 420); wave(t, 2.2, 0.12, 300, 240, 0.4); },
    crowd_ooh: function (t) { chorus(t, 14, 1.4, 0.045, 200, 280, 0.8, 600, 1.3); },
    crowd_aww: function (t) { chorus(t, 14, 1.3, 0.045, 260, 340, 0.6, 700); wave(t, 1.2, 0.1, 600, 300, 0.2); },
    crowd_stomp: function (t) { [0, 0.4, 1.2, 1.6, 2.4, 2.8].forEach(function (d) { stomp(t + d, 0.45); }); },
    crowd_drum: function (t) {
      for (var i = 0; i < 8; i++) { var at = t + i * 0.25; drum(at, i % 4 === 0 ? 0.55 : 0.32); }
      cymbal(t + 2, 0.6, 0.06);
    },
    air_horn: function (t) {
      [233, 294, 349].forEach(function (f) {
        var o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t); o.frequency.setValueAtTime(f, t + 1.0); o.frequency.linearRampToValueAtTime(f * 0.94, t + 1.25);
        lp.type = 'lowpass'; lp.frequency.value = 2400;
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.04);
        g.gain.setValueAtTime(0.09, t + 1.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
        o.connect(lp); lp.connect(g); g.connect(fxBus); o.start(t); o.stop(t + 1.35);
      });
    }
  };
  Object.keys(MORE).forEach(function (k) { SOUNDS[k] = MORE[k]; });

  // The stadium reacts to the game by itself: init() hooks into FF_GAME's events, and into
  // SC_GAME's on the soccer page. Nothing plays while the game view is closed or while the game
  // is seeking (running skipped plays at once).
  // claim(kind, secs): one crowd at a time. Any module that plays a crowd sound of a kind
  // ('chant', 'cheer', 'boo', 'clap', 'groan', 'ooh', 'aww', 'drum', 'stomp', 'horn') asks first;
  // false means the same kind already played in the last secs (default 4), so skip yours.
  var lastAt = {}, hooked = {}, claimed = {};
  function nowSecs() { return ac ? ac.currentTime : Date.now() / 1000; }
  function claim(kind, secs) {
    var now = nowSecs(), gap = secs == null ? 4 : +secs;
    if (claimed[kind] != null && now - claimed[kind] < gap) return false;
    claimed[kind] = now;
    return true;
  }
  var KIND = { crowd_chant: 'chant', crowd_clap: 'clap', crowd_boo: 'boo', crowd_ooh: 'ooh', crowd_aww: 'aww', crowd_drum: 'drum',
               crowd_stomp: 'stomp', air_horn: 'horn', crowd_cheer: 'cheer', crowd_roar: 'cheer', crowd_groan: 'groan' };
  function game() { return root.FF_GAME || root.SC_GAME || null; }
  function after(name, delay, gap) {
    if (!ac) return;
    var now = ac.currentTime;
    if (gap && lastAt[name] != null && now - lastAt[name] < gap) return;
    if (KIND[name] && !claim(KIND[name], Math.max(4, delay || 0))) return;
    lastAt[name] = now;
    if (!delay) { play(name); return; }
    setTimeout(function () { var G = game(); if (!G || G.active !== false) play(name); }, delay * 1000);
  }
  // Peyton's stadium crowd (js/screens/crowd.js, window.FR_CROWD) plays its own chants, cheers,
  // boos and horns on the football field. When it is there, this file keeps to the referee's
  // whistles and the stadium bed, so the two crowds never double up.
  function otherCrowd() {
    var C = root.FR_CROWD;
    try { return !!(C && typeof C.names === 'function' && C.names().length); } catch (err) { return false; }
  }
  function react(type, d) {
    var G = root.FF_GAME;
    if (!G || G.seeking || (G.active === false && type !== 'start')) return;
    var res = d && d.res, e = res && res.e || {};
    // The stadium is there from the moment the game starts, not from the first snap after it.
    if (type === 'start') { after('crowd_murmur', 0.05, 0); return; }
    if (type === 'half') { after('whistle_long', 0, 0); if (!otherCrowd()) after('crowd_clap', 1.6, 0); return; }
    if (type === 'final') { after('whistle_full', 0, 0); if (!otherCrowd()) { after('crowd_cheer', 2.1, 0); after('crowd_clap', 3.0, 0); } return; }
    if (otherCrowd()) return;
    if (type === 'snap' && res) {
      if (e.t === 'kickoff') after('crowd_stomp', 0, 30);
      else if (res.pre && res.pre.down === 3) after('crowd_chant', 0.2, 25);
      else if (res.pre && res.pre.down === 4 && e.t !== 'punt' && e.t !== 'fg') after('crowd_drum', 0, 20);
    } else if (type === 'result' && res) {
      if (res.td) { after('air_horn', 0.3, 5); after('crowd_clap', 2.2, 10); }
      else if (e.t === 'fg' || e.t === 'xp') after(e.good ? 'crowd_clap' : 'crowd_aww', 0.4, 6);
      else if (e.t === 'pen') after('crowd_boo', 0.2, 15);
      else if (e.t === 'sack') after('crowd_clap', 0.6, 12);
      else if (e.t === 'inc' && res.pre && res.pre.down >= 3) after('crowd_ooh', 0.1, 12);
      else if (e.t === 'int' || e.t === 'fumble') after('crowd_boo', 1.6, 15);
    }
  }
  // Soccer, with the same broadcast sound as football (C29): the bed under every event, the
  // whistle at half and full time, a roar for a goal, ooh for a save, aww for a miss, boos for a card.
  function reactSoccer(type, d) {
    var G = root.SC_GAME;
    // 'start' comes just before the app opens the match view, so it is let through; the delayed
    // whistle still checks that the view is open when it blows.
    if (!G || G.seeking || (G.active === false && type !== 'start')) return;
    var res = d && d.res;
    // The match is set at its kickoff before the first tap, so the opening whistle comes with 'start'.
    if (type === 'start') { after('crowd_murmur', 0.05, 0); after('whistle', 0.4, 3); }
    else if (type === 'snap' && res) {
      play('crowd_murmur');
      if (res.kind === 'kickoff') after('whistle', 0.6, 3);   // football's kickoff whistles in js/plays.js
      if (res.kind === 'pen') after('crowd_swell', 0.2, 10);
    } else if (type === 'result' && res) {
      if (res.goal && !res.disallowed) { play('crowd_roar'); after('crowd_clap', 2.6, 10); }
      else if (res.goal && res.disallowed) after('crowd_groan', 0.2, 6);
      else if (res.kind === 'shot' || res.kind === 'pen') after(res.saver || (res.e && res.e.out === 'blocked') ? 'crowd_ooh' : 'crowd_aww', 0.1, 8);
      if (res.card) after('crowd_boo', 0.3, 12);
    } else if (type === 'half') { play('crowd_stop'); after('whistle_long', 0, 0); after('crowd_clap', 1.6, 0); }
    else if (type === 'final') { play('crowd_stop'); after('whistle_full', 0, 0); after('crowd_cheer', 2.1, 0); after('crowd_clap', 3.0, 0); }
  }
  function hook() {
    var F = root.FF_GAME, S = root.SC_GAME;
    if (!hooked.ff && F && typeof F.on === 'function') {
      hooked.ff = true;
      F.on(function (type, d) { try { react(type, d); } catch (err) { /* sound is optional */ } });
    }
    if (!hooked.sc && S && typeof S.on === 'function' && !F) {
      hooked.sc = true;
      S.on(function (type, d) { try { reactSoccer(type, d); } catch (err) { /* sound is optional */ } });
    }
  }

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

  var CAPTIONS = {
    crowd_murmur: '[crowd murmurs]',
    crowd_swell: '[crowd rises]',
    crowd_roar: '[crowd roars]',
    crowd_groan: '[crowd groans]',
    whistle_long: '[half-time whistle]',
    whistle_full: '[full-time whistle]',
    crowd_cheer: '[crowd cheers]',
    post: '[ball clangs off the post]',
    jingle_kickoff: '[kickoff theme plays]',
    jingle_final: '[full-time theme plays]',
    crowd_clap: '[crowd claps]', crowd_chant: '[crowd chants: De-fense!]', crowd_boo: '[crowd boos]',
    crowd_ooh: '[crowd: ooh!]', crowd_aww: '[crowd: aww]', crowd_stomp: '[crowd stomps]', crowd_drum: '[drums]', air_horn: '[air horn]',
    miss: '[crowd gasps]'
  };
  var murmurCaptioned = false;
  function captionFor(name) { return Object.prototype.hasOwnProperty.call(CAPTIONS, name) ? CAPTIONS[name] : ''; }
  function sendCaption(name) {
    if (name === 'crowd_stop') { murmurCaptioned = false; return; }
    var text = captionFor(name);
    if (!text) return;
    if (name === 'crowd_murmur') { if (murmurCaptioned) return; murmurCaptioned = true; }
    [root.FF_ANNOUNCER, root.SC_ANNOUNCER].forEach(function (A) {
      if (A && typeof A.notify === 'function') { try { A.notify(text, 'sound'); } catch (err) { /* captions are optional */ } }
    });
  }

  var jingleUntil = 0;
  var JINGLE_SECS = { jingle_kickoff: 3.5, jingle_final: 4.2 };

  function play(name) {
    sendCaption(name);   // captions come even when muted: they are for people who cannot hear
    played[name] = (played[name] || 0) + 1;
    if (!ac || !SOUNDS[name]) return;
    var t = ac.currentTime + 0.01;
    // Muted or hidden: start nothing, but still let crowd_stop end a murmur that is running.
    if ((settings.muted || hidden()) && name !== 'crowd_stop') {
      if (name === 'crowd_murmur' && bed) stopBed(t);
      return;
    }
    // One jingle at a time: a jingle asked for while another plays is skipped.
    if (JINGLE_SECS[name]) {
      if (t < jingleUntil) return;
      jingleUntil = t + JINGLE_SECS[name];
    }
    try { SOUNDS[name](t); } catch (err) { /* sound is optional */ }
  }

  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('visibilitychange', applyMix);
  }

  function setVolume(kind, v) {
    if (!(kind in DEFAULTS) || kind === 'muted') return;
    v = Math.max(0, Math.min(1, +v || 0));
    settings[kind] = v; saveSettings(); applyMix();
    return v;
  }

  root.FF_AUDIO = {
    init: init, play: play, played: played, crowdFor: crowdFor, captionFor: captionFor, react: react, reactSoccer: reactSoccer, claim: claim,
    setVolume: setVolume,
    volume: function (kind) { return kind in DEFAULTS && kind !== 'muted' ? settings[kind] : undefined; },
    mute: function (on) { settings.muted = !!on; saveSettings(); applyMix(); return settings.muted; },
    muted: function () { return settings.muted; },
    duck: function (on) { handDuck = !!on; applyMix(); return handDuck; },
    // What is playing now: the levels after mute, hiding and ducking.
    mix: function () {
      return { master: master ? +master.gain.value.toFixed(3) : null, target: settings.muted || hidden() ? 0 : settings.master,
        crowd: settings.crowd, effects: settings.effects, muted: settings.muted, hidden: hidden(), ducked: ducked || handDuck };
    },
    names: function () { return Object.keys(SOUNDS); },
    state: function () { return ac ? ac.state : 'none'; }
  };

  // The soccer page (soccer/js/main.js calls SC_SOUND.play(name)) uses the same sounds, levels,
  // mute and captions. Its first tap starts the sound, since soccer has no FF_GAME.start to do it.
  root.SC_SOUND = { play: play };
  if (root.document && root.document.addEventListener && root.addEventListener) {
    var firstTap = function () {
      if (root.FF_GAME || !root.SC_GAME) return;
      init(); hook();
    };
    root.addEventListener('pointerdown', firstTap, true);
    root.addEventListener('keydown', firstTap, true);
  }
})(typeof window !== 'undefined' ? window : globalThis);
