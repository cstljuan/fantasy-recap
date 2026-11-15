// A stadium full of fans around the field, and a louder crowd (B34, asked by Ricky).
// Its own layer: js/main.js and js/audio.js do not change. Driven only by FF_GAME events.
//   Look:   pixel fans drawn in code, in the stands beside the field (the sideline strips on a
//           phone, the space left and right of the field on a wider screen), Goblins on the
//           left, Pythons on the right, some neutral fans, signs and flags.
//   Moves:  per side, from what happened on the field (never from fantasy points): a ripple on
//           every snap, jumping on big gains, eruption and slump on touchdowns, cheers and
//           groans on kicks, turnovers, sacks and fourth-down stops, boos and pointing on
//           penalties, a stadium wave in quiet stretches and on big stops, sitting at halftime,
//           and at the final the winner celebrates while the loser's stands empty a little.
//   Sound:  Web Audio made in code, its own level: claps, cheers, boos, DE-FENSE chants,
//           stomp-stomp-clap, a drum line, an air horn, a rising ohhh, an organ charge.
//           Silent when FF_AUDIO is muted or the page is hidden, dips while the announcer
//           speaks, quiet above 2x like the voice. Each sound is captioned through
//           FF_ANNOUNCER.notify.
//   Calm:   with reduced motion the fans show emotion as a pose only.
// Loaded by js/app.js.
(function () {
  'use strict';
  var G = window.FF_GAME, D = window.FF_DATA;
  var view = document.getElementById('gameView'), game = document.getElementById('game');
  if (!G || !D || !view || !game) return;
  // Off (Noah's call): the football stadium is now the soccer stadium exactly, whose crowd is the
  // pixel stands drawn into the field (js/sprites.js) and whose sound is js/audio.js. Delete this
  // line to bring the animated fans and their sounds back.
  if (!window.FR_CROWD_ON) return;
  // The field canvas's own geometry, from js/sprites.js: the fans stand outside the advertising boards.
  var ST = window.FF_STADIUM || { W: 390, MX: (390 - 53.3 * 6.6) / 2, RUN: 0, BOARD: 0 };
  var TEAMS = D.TEAMS, W = ST.W, MX = ST.MX - ST.RUN - ST.BOARD;

  // ------------------------------------------------------------------ canvas
  var cv = document.createElement('canvas');
  cv.className = 'crowd-layer';
  cv.setAttribute('aria-hidden', 'true');
  view.appendChild(cv);
  var g = cv.getContext('2d');
  var P = 2, vw = 0, vh = 0, seats = [[], []], skip = null, layoutKey = '';

  function calm() {
    return !!(G.calm || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches));
  }
  function hexToRgb(h) { var m = /^#?([0-9a-f]{6})$/i.exec(h || ''); var n = m ? parseInt(m[1], 16) : 0x888888; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function shade(h, f) { var c = hexToRgb(h); return 'rgb(' + c.map(function (v) { return Math.max(0, Math.min(255, Math.round(v * f))); }).join(',') + ')'; }
  var SKIN = ['#f1c9a5', '#d9a77c', '#a8714a', '#7a4b2c', '#e8b98f'];
  var NEUTRAL = ['#c9c9c9', '#8a8f94', '#2f3a44', '#b33a3a', '#e0d27a', '#ffffff'];
  // A small pseudo random number from a seed, so the stands look the same every frame.
  function rnd(n) { var x = Math.sin(n * 12.9898) * 43758.5453; return x - Math.floor(x); }

  function layout() {
    var r = game.getBoundingClientRect();
    vw = view.clientWidth; vh = view.clientHeight;
    var key = [vw, vh, Math.round(r.left), Math.round(r.width), Math.round(r.top), Math.round(r.height)].join(',');
    if (key === layoutKey) return;
    layoutKey = key;
    P = vw >= 760 ? 3 : 2;
    cv.width = Math.ceil(vw / P); cv.height = Math.ceil(vh / P);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
    var s = r.width / W, fieldL = r.left + MX * s, fieldR = r.right - MX * s, depth = vw >= 760 ? 240 : 999;
    // The canvas's broadcast graphics stay uncovered: the score bug with the down and distance
    // under it (top left) and the sample tag (top right), both in the top 46 canvas units.
    skip = { x0: r.left, x1: r.right, y0: r.top, y1: r.top + 46 * s };
    var CW = 4, CH = 7;   // a seat, in crowd pixels
    seats = [[], []];
    [[Math.max(0, fieldL - depth), fieldL, 0], [fieldR, Math.min(vw, fieldR + depth), 1]].forEach(function (side) {
      var x0 = Math.ceil(side[0] / P), x1 = Math.floor(side[1] / P), t = side[2], rows = Math.floor(cv.height / CH);
      var cols = Math.floor((x1 - x0) / CW);
      for (var row = 0; row < rows; row++) for (var col = 0; col < cols; col++) {
        var x = x0 + col * CW + (row % 2 ? 1 : 0), y = row * CH + 1;
        if (x + 3 > x1) continue;
        var px = x * P, py = y * P;
        if (px < skip.x1 && px + CW * P > skip.x0 && py < skip.y1 && py + CH * P > skip.y0) continue;
        var id = t * 100000 + row * 1000 + col, k = rnd(id);
        // Nearer the field = lower column index for the right side, higher for the left.
        var near = t === 0 ? cols - 1 - col : col;
        seats[t].push({
          x: x, y: y, row: row, near: near, id: id,
          shirt: k < 0.78 ? (rnd(id + 1) < 0.5 ? TEAMS[t].colors.jersey : TEAMS[t].colors.helmet) : NEUTRAL[Math.floor(rnd(id + 2) * NEUTRAL.length)],
          skin: SKIN[Math.floor(rnd(id + 3) * SKIN.length)],
          sign: k > 0.965, flag: k > 0.94 && k <= 0.965, leaves: rnd(id + 4) < 0.3, walker: rnd(id + 5) < 0.08
        });
      }
    });
  }

  // ------------------------------------------------------------------- moods
  var mood = [{ name: 'idle', t0: 0, until: 0 }, { name: 'idle', t0: 0, until: 0 }], wave = null, final = -1, half = false, flash = [0, 0];
  function now() { return performance.now() / 1000; }
  function setMood(t, name, secs) { mood[t] = { name: name, t0: now(), until: secs ? now() + secs : Infinity }; }
  function startWave() { if (!calm()) wave = { t0: now(), dur: 4 }; sound('whoo'); }

  function pose(seat, t, tm) {
    var m = mood[t], name = tm > m.until ? (final >= 0 ? (final === t ? 'win' : 'lose') : half ? 'sit' : 'idle') : m.name;
    var still = calm(), el = tm - m.t0, ph = seat.id % 7, out = { dy: 0, arms: 'down', head: 0, hide: false, dx: 0 };
    if (name === 'idle') { if (!still) out.dy = Math.sin(tm * 1.6 + ph) > 0.85 ? -1 : 0; }
    else if (name === 'ripple') { if (!still) out.dy = Math.abs(el * 14 - seat.row % 14) < 1.2 ? -1 : 0; }
    else if (name === 'jump' || name === 'erupt' || name === 'win') {
      out.arms = 'up';
      if (!still) out.dy = -Math.round(Math.abs(Math.sin(tm * (name === 'win' ? 7 : 10) + ph)) * (name === 'win' ? 1 : 2));
    } else if (name === 'cheer') { out.arms = 'up'; if (!still) out.dy = Math.sin(tm * 8 + ph) > 0.4 ? -1 : 0; }
    else if (name === 'slump') { out.head = 1; out.arms = 'head'; }
    else if (name === 'groan') { out.head = 1; out.arms = seat.id % 2 ? 'head' : 'fist'; if (!still && out.arms === 'fist') out.dy = Math.sin(tm * 18 + ph) > 0 ? -1 : 0; }
    else if (name === 'boo') { out.arms = 'out'; }
    else if (name === 'sit') { out.head = 1; if (seat.walker && !still) { out.dx = Math.round(((tm * 3 + ph) % 12) - 6); out.head = 0; } }
    else if (name === 'lose') { out.head = 1; out.arms = seat.id % 3 ? 'down' : 'head'; out.hide = seat.leaves; }
    if (wave && !still) {
      var w = (tm - wave.t0) / wave.dur, pos = t === 0 ? 1 - w : w, rel = seat.y / cv.height;
      if (Math.abs(rel - pos) < 0.06) { out.dy = -2; out.arms = 'up'; }
    }
    out.name = name;
    return out;
  }

  // -------------------------------------------------------------------- draw
  var last = 0, frames = 0, fpsT0 = 0, fps = 0, running = false;
  function draw(tm) {
    g.clearRect(0, 0, cv.width, cv.height);
    for (var t = 0; t < 2; t++) {
      var list = seats[t];
      // The stands themselves: stepped concrete under the seats.
      g.fillStyle = 'rgba(18,22,25,0.92)';
      list.forEach(function (s) { g.fillRect(s.x - 1, s.y - 1, 5, 7); });
      for (var i = 0; i < list.length; i++) {
        var s = list[i], p = pose(s, t, tm);
        if (p.hide) continue;
        var x = s.x + p.dx, y = s.y + 1 + p.dy;
        g.fillStyle = s.skin; g.fillRect(x + 1, y + p.head, 2, 2);                     // head
        g.fillStyle = s.shirt; g.fillRect(x + 1, y + 2, 2, 3);                          // body
        g.fillStyle = s.skin;                                                            // arms
        if (p.arms === 'up') { g.fillRect(x, y - 1, 1, 2); g.fillRect(x + 3, y - 1, 1, 2); }
        else if (p.arms === 'head') { g.fillRect(x, y + p.head, 1, 1); g.fillRect(x + 3, y + p.head, 1, 1); }
        else if (p.arms === 'fist') { g.fillRect(x + 3, y - 1, 1, 2); g.fillRect(x, y + 3, 1, 2); }
        else if (p.arms === 'out') { if (t === 0) g.fillRect(x + 3, y + 2, 2, 1); else g.fillRect(x - 1, y + 2, 2, 1); g.fillRect(t === 0 ? x : x + 3, y + 3, 1, 2); }
        else { g.fillRect(x, y + 3, 1, 2); g.fillRect(x + 3, y + 3, 1, 2); }
        if (s.sign && (p.name === 'erupt' || p.name === 'win' || p.name === 'cheer' || p.name === 'jump' || p.name === 'idle' || p.name === 'ripple')) {
          g.fillStyle = '#f3f1ea'; g.fillRect(x - 1, y - 4, 6, 3);
          g.fillStyle = TEAMS[t].colors.jersey; g.fillRect(x, y - 3, 4, 1);
        }
        if (s.flag) {
          g.fillStyle = '#d0d0d0'; g.fillRect(x + 3, y - 4, 1, 6);
          var flap = (p.name === 'erupt' || p.name === 'win') && !calm() ? (Math.sin(tm * 12 + s.id) > 0 ? 1 : 0) : 0;
          g.fillStyle = TEAMS[t].colors.jersey; g.fillRect(x + 4, y - 4 + flap, 3, 2);
        }
      }
      // A flash of the team color over a side that just scored.
      if (flash[t] > tm && !calm()) {
        var a = 0.18 * (0.5 + 0.5 * Math.sin(tm * 14));
        var c = hexToRgb(TEAMS[t].colors.jersey);
        g.fillStyle = 'rgba(' + c.join(',') + ',' + a.toFixed(3) + ')';
        if (list.length) {
          var minX = list[0].x, maxX = list[0].x;
          list.forEach(function (s) { if (s.x < minX) minX = s.x; if (s.x > maxX) maxX = s.x; });
          g.fillRect(minX - 1, 0, maxX - minX + 6, cv.height);
        }
      }
    }
    if (wave && now() > wave.t0 + wave.dur) wave = null;
  }
  function loop(ts) {
    running = false;
    if (!G.active || document.hidden || view.hidden) return;   // the layer stops when the game view is closed
    running = true;
    requestAnimationFrame(loop);
    frames++;
    if (ts - fpsT0 >= 1000) { fps = frames * 1000 / (ts - fpsT0); frames = 0; fpsT0 = ts; }
    if (ts - last < 33) return;   // about 30 frames a second is plenty for pixel fans
    last = ts;
    layout();
    draw(ts / 1000);
  }
  function wake() { if (!running && G.active && !view.hidden) { running = true; fpsT0 = performance.now(); frames = 0; requestAnimationFrame(loop); } }
  setInterval(wake, 300);
  window.addEventListener('resize', function () { layoutKey = ''; });

  // ------------------------------------------------------------------- sound
  var ac = null, out = null, noise = null, LEVEL = 0.9, played = [];
  function audioReady() {
    if (!ac) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ac = new AC(); } catch (err) { return false; }
      out = ac.createGain(); out.gain.value = 0; out.connect(ac.destination);
      noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      var d = noise.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') { try { ac.resume(); } catch (err) { /* needs a tap */ } }
    return true;
  }
  // The crowd's own level, following Noah's mix: muted, hidden, ducked under the voice.
  function level() {
    var A = window.FF_AUDIO, m = A && A.mix ? A.mix() : null;
    if ((A && A.muted && A.muted()) || document.hidden || (m && m.hidden)) return 0;
    return LEVEL * (m && m.ducked ? 0.35 : 1);
  }
  setInterval(function () { if (out) out.gain.setTargetAtTime(level(), ac.currentTime, 0.08); }, 150);
  function env(node, t, a, peak, hold, rel) {
    node.gain.setValueAtTime(0.0001, t);
    node.gain.exponentialRampToValueAtTime(peak, t + a);
    node.gain.setValueAtTime(peak, t + a + hold);
    node.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }
  function noiseHit(t, freq, q, dur, peak, type) {
    var src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    var f = ac.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    var gn = ac.createGain(); env(gn, t, 0.004, peak, 0, dur);
    src.connect(f); f.connect(gn); gn.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }
  function voices(t, n, f0, f1, dur, peak, formant, slide) {
    var gn = ac.createGain(); env(gn, t, 0.18, peak, dur * 0.4, dur * 0.6);
    var lp = ac.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = formant; lp.Q.value = 0.9;
    lp.connect(gn); gn.connect(out);
    for (var i = 0; i < n; i++) {
      var o = ac.createOscillator(); o.type = 'sawtooth';
      var fr = f0 + (f1 - f0) * Math.random();
      o.frequency.setValueAtTime(fr, t);
      if (slide) o.frequency.linearRampToValueAtTime(fr * slide, t + dur);
      var og = ac.createGain(); og.gain.value = 1 / n;
      o.connect(og); og.connect(lp);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  function tone(t, freq, dur, peak, type) {
    var o = ac.createOscillator(); o.type = type || 'square'; o.frequency.value = freq;
    var gn = ac.createGain(); env(gn, t, 0.01, peak, dur * 0.6, dur * 0.4);
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    o.connect(lp); lp.connect(gn); gn.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function thump(t, peak) {
    var o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    var gn = ac.createGain(); env(gn, t, 0.005, peak, 0, 0.18);
    o.connect(gn); gn.connect(out); o.start(t); o.stop(t + 0.25);
  }
  var SOUNDS = {
    claps: { caption: '[crowd claps]', play: function (t) { for (var i = 0; i < 26; i++) noiseHit(t + Math.random() * 1.4, 1400 + Math.random() * 900, 1.2, 0.04, 0.35); } },
    cheer: { caption: '[crowd cheers]', play: function (t) { noiseHit(t, 1000, 0.6, 2.4, 0.5); voices(t, 10, 260, 420, 2.2, 0.35, 900, 1.15); } },
    big_cheer: { caption: '[the stadium erupts]', play: function (t) { noiseHit(t, 900, 0.5, 3.4, 0.7); voices(t, 14, 240, 460, 3.0, 0.5, 950, 1.2); SOUNDS.claps.play(t + 0.8); } },
    boos: { caption: '[boos]', play: function (t) { voices(t, 10, 95, 140, 1.7, 0.6, 420, 0.92); } },
    groan: { caption: '[crowd groans]', play: function (t) { voices(t, 10, 170, 230, 1.4, 0.45, 600, 0.7); } },
    ohhh: { caption: '[crowd: ohhh]', play: function (t) { voices(t, 12, 170, 230, 1.5, 0.45, 650, 1.6); } },
    defense: { caption: '[crowd chants DE-FENSE]', play: function (t) {
      for (var k = 0; k < 3; k++) {
        var b = t + k * 0.85;
        voices(b, 10, 190, 215, 0.22, 0.55, 700); thump(b, 0.6);
        voices(b + 0.3, 10, 150, 170, 0.32, 0.55, 600); noiseHit(b + 0.55, 5200, 2, 0.08, 0.25, 'highpass'); thump(b + 0.3, 0.6);
      }
    } },
    stomp_clap: { caption: '[stomp stomp clap]', play: function (t) {
      for (var k = 0; k < 4; k++) { var b = t + k * 0.9; thump(b, 0.8); thump(b + 0.25, 0.8); for (var i = 0; i < 14; i++) noiseHit(b + 0.5 + Math.random() * 0.04, 1600 + Math.random() * 600, 1.2, 0.05, 0.3); }
    } },
    drums: { caption: '[drum line]', play: function (t) {
      var pat = [0, 0.15, 0.3, 0.6, 0.75, 0.9, 1.05, 1.2, 1.5, 1.65, 1.8, 2.1];
      pat.forEach(function (d, i) { noiseHit(t + d, 2400, 0.8, 0.09, i % 4 === 3 ? 0.6 : 0.4, 'highpass'); if (i % 3 === 0) thump(t + d, 0.5); });
    } },
    air_horn: { caption: '[air horn]', play: function (t) { [233, 294, 349].forEach(function (f) { tone(t, f, 0.9, 0.18, 'sawtooth'); tone(t + 1.1, f, 0.6, 0.15, 'sawtooth'); }); } },
    lets_go: { caption: "[crowd chants LET'S GO]", play: function (t) {
      for (var k = 0; k < 3; k++) {
        var b = t + k * 1.1;
        voices(b, 10, 200, 230, 0.2, 0.5, 750); voices(b + 0.25, 10, 240, 270, 0.3, 0.5, 800);
        for (var c = 0; c < 3; c++) for (var i = 0; i < 10; i++) noiseHit(b + 0.6 + c * 0.16 + Math.random() * 0.03, 1700 + Math.random() * 500, 1.2, 0.04, 0.25);
      }
    } },
    murmur: { caption: '[the crowd rises, anticipating]', play: function (t) { noiseHit(t, 500, 0.5, 2.0, 0.35); voices(t, 10, 140, 200, 2.0, 0.3, 500, 1.35); } },
    whoo: { caption: '[whoooo, the wave goes around]', play: function (t) { voices(t, 14, 300, 420, 2.6, 0.35, 1100, 1.25); } },
    organ: { caption: '[organ plays a charge]', play: function (t) {
      // The old bugle call, in the public domain.
      [[392, 0], [523, 0.16], [659, 0.32], [784, 0.48], [659, 0.8], [784, 0.96]].forEach(function (n, i) { tone(t + n[1], n[0], i === 5 ? 0.6 : 0.14, 0.2, 'square'); tone(t + n[1], n[0] * 2, i === 5 ? 0.6 : 0.14, 0.06, 'sine'); });
    } }
  };
  var lastSound = {};
  function sound(name) {
    var s = SOUNDS[name], speed = window.__ff ? window.__ff.speed : 1;
    if (!s || !G.active || speed > 2) return;   // quiet above 2x speed, like the voice
    var t0 = now();
    if (lastSound[name] && t0 - lastSound[name] < 1.2) return;
    lastSound[name] = t0;
    played.push(name);
    var A = window.FF_ANNOUNCER;
    if (A && typeof A.notify === 'function') { try { A.notify(s.caption, 'sound'); } catch (err) { /* captions are optional */ } }
    if (level() <= 0 || !audioReady()) return;
    try { s.play(ac.currentTime + 0.02); } catch (err) { /* sound is optional */ }
  }

  // -------------------------------------------------------- what the fans see
  var quiet = 0, plays = 0, log = [], drive = [0, 0];
  function home() { var a = window.__app; return a && a.me >= 0 ? a.me : 0; }
  function react(t, name, secs) { setMood(t, name, secs); log.push({ play: plays, side: t, mood: name }); }
  G.on(function (type, d) {
    if (type === 'reset') { setMood(0, 'idle'); setMood(1, 'idle'); final = -1; half = false; wave = null; quiet = 0; plays = 0; log = []; flash = [0, 0]; drive = [0, 0]; return; }
    if (type === 'start') { if (G.active) sound('drums'); return; }
    if (type === 'half') { half = true; setMood(0, 'sit', 0); setMood(1, 'sit', 0); log.push({ play: plays, side: -1, mood: 'sit' }); return; }
    if (type === 'final') {
      var sc = d && d.score ? d.score : [0, 0];
      final = sc[0] === sc[1] ? -2 : sc[0] > sc[1] ? 0 : 1;
      if (final >= 0) { react(final, 'win', 0); setMood(1 - final, 'lose', 0); log.push({ play: plays, side: 1 - final, mood: 'lose' }); sound('big_cheer'); }
      return;
    }
    var res = d && d.res;
    if (!res || !res.e || !res.pre) return;
    var e = res.e, off = res.pre.poss, def = 1 - off;
    if (type === 'snap') {
      half = false;
      if (mood[0].name === 'idle' || now() > mood[0].until) setMood(0, 'ripple', 0.9);
      if (mood[1].name === 'idle' || now() > mood[1].until) setMood(1, 'ripple', 0.9);
      if (res.pre.down === 3 && (off === 0 || off === 1) && e.t !== 'kickoff' && e.t !== 'xp') { react(def, 'cheer', 1.2); sound('defense'); }
      // Close to the goal line, or going for it on fourth down: the whole stadium leans in.
      else if ((res.pre.ytg !== undefined && res.pre.ytg <= 10 && e.t !== 'xp' && e.t !== 'kickoff') || (res.pre.down === 4 && e.t !== 'punt' && e.t !== 'fg')) sound('murmur');
      return;
    }
    if (type !== 'result' || off !== 0 && off !== 1) return;
    plays += 1;
    var big = false;
    if (res.td) { react(off, 'erupt', 3); setMood(def, 'slump', 3); log.push({ play: plays, side: def, mood: 'slump' }); flash[off] = now() + 3; sound('big_cheer'); sound('air_horn'); big = true; }
    else if (e.t === 'fg') { var w2 = e.good ? off : def; react(w2, 'cheer', 2); setMood(1 - w2, 'groan', 2); log.push({ play: plays, side: 1 - w2, mood: 'groan' }); sound(e.good ? 'cheer' : 'groan'); if (e.good) sound('air_horn'); big = true; }
    else if (e.t === 'int' || e.t === 'fumble') { react(def, 'cheer', 2.2); setMood(off, 'groan', 2.2); log.push({ play: plays, side: off, mood: 'groan' }); sound(off === home() ? 'boos' : 'cheer'); startWave(); big = true; }
    else if (res.downs) { react(def, 'cheer', 2); setMood(off, 'groan', 2); log.push({ play: plays, side: off, mood: 'groan' }); sound('cheer'); startWave(); big = true; }
    else if (e.t === 'sack') { react(def, 'cheer', 1.6); setMood(off, 'groan', 1.6); log.push({ play: plays, side: off, mood: 'groan' }); sound('claps'); big = true; }
    else if (e.t === 'pen' && res.pen) { var on = res.pen.on; react(on, 'boo', 1.8); sound('boos'); big = true; }
    else if (e.t === 'xp' && e.good) { react(off, 'cheer', 1.2); sound('claps'); }
    else if ((e.t === 'run' || e.t === 'pass') && (e.yds || 0) >= 15) { react(off, 'jump', 1.6); if (e.t === 'pass' && e.yds >= 20) sound('ohhh'); else sound('claps'); big = true; }
    else if ((e.t === 'run' || e.t === 'pass') && res.first) { react(off, 'cheer', 1); drive[off] = (drive[off] || 0) + 1; sound(drive[off] >= 3 ? 'lets_go' : 'claps'); if (drive[off] >= 3) drive[off] = 0; }
    else if (e.t === 'inc' && (e.yds || 0) === 0 && rnd(plays) < 0.35) { react(def, 'cheer', 0.8); sound('ohhh'); }
    // Quiet stretches: a wave, and now and then the organ or stomp-stomp-clap.
    quiet = big ? 0 : quiet + 1;
    if (quiet >= 8) { quiet = 0; startWave(); sound(plays % 2 ? 'organ' : 'stomp_clap'); }
  });

  // For tests and the boss's checks.
  window.FR_CROWD = {
    get fps() { return fps; }, get running() { return running; }, get seats() { return [seats[0].length, seats[1].length]; },
    get moods() { return [mood[0].name, mood[1].name]; }, get log() { return log.slice(); }, get sounds() { return played.slice(); },
    sides: function () { return seats.map(function (list) { if (!list.length) return null; var xs = list.map(function (s) { return s.x * P; }); return [Math.min.apply(null, xs), Math.max.apply(null, xs) + 4 * P]; }); },
    names: function () { return Object.keys(SOUNDS).map(function (k) { return k + ' ' + SOUNDS[k].caption; }); }
  };
})();
