// Soccer viewer: feeds the sample events through the rules engine one at a
// time, asks the play library for a matching scripted move and draws it.
// Same pattern as js/main.js for football, so the app can drive both.
(function () {
  'use strict';

  var D = window.SC_DATA, Rules = window.SC_RULES, Plays = window.SC_PLAYS, Spr = window.SC_SPRITES;
  var Font = window.SC_FONT, Stadium = window.SC_STADIUM, Fantasy = window.SC_FANTASY;
  var TEAMS = D.TEAMS;
  var LEN = Plays.LEN, WID = Plays.WID;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Optional URL switches, same as football:
  //   ?speed=2  play faster   ?seed=7  repeat the same play choices   ?voice=0  no announcer
  var q = new URLSearchParams(location.search);
  var SPEED = clamp(parseFloat(q.get('speed')) || 1, 0.25, 40);
  var SEED = q.has('seed') ? (parseInt(q.get('seed'), 10) >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  var VOICE = q.get('voice') !== '0';
  // Same switches as football: point floaters on or off, and ?bg=1 to keep running while the view is closed.
  var FLOATERS = true, BACKGROUND = q.get('bg') === '1';
  var rng = mulberry32(SEED);

  // Logical canvas size. The width is fixed, the height follows the phone.
  var W = 390, H = 844, SCALE = 1;
  var S = 8;                              // pixels per meter, the same across and along the pitch
  var stadium = Stadium.build(TEAMS, S, Font), M = stadium.M;
  // Palette: near-black panels, warm white text, one amber signal color (same as css/app.css).
  var INK = '#0b0d0e', PANEL = '#121516', RULE = '#2b3033', TEXT = '#f3f1ea', DIM = '#8e9597', AMBER = '#ffc21a', FLAG = '#ffd21a';

  var canvas = document.getElementById('scGame');
  var g = canvas.getContext('2d');

  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight, css;
    if (vh / vw >= 1.35) { H = clamp(Math.round(W * vh / vw), 560, 960); css = vw / W; }
    else { H = 844; css = Math.min(vh / H, vw / W); }
    canvas.style.width = Math.round(W * css) + 'px';
    canvas.style.height = Math.round(H * css) + 'px';
    SCALE = Math.min(4, css * (window.devicePixelRatio || 1));
    canvas.width = Math.round(W * SCALE);
    canvas.height = Math.round(H * SCALE);
  }
  window.addEventListener('resize', resize);
  resize();

  // ------------------------------------------------------------ actors

  var all = [];
  function makeTeam(ti) {
    var T = TEAMS[ti], s = {}, list = [];
    Rules.SLOTS.forEach(function (slot, i) {
      var n = all.length, own = T.fantasy.indexOf(slot) >= 0;
      var a = {
        team: ti, role: slot, keeper: slot === 'GK', tone: (n * 7) % 3, hair: (n * 5) % Spr.HAIRS, phase: n * 0.37,
        jx: ((n * 37) % 7) / 2 - 1.5, jy: ((n * 53) % 7) / 2 - 1.5,
        x: WID / 2, y: LEN / 2, path: null, state: '', view: 'f', moving: false, num: [1, 3, 4, 5, 2, 8, 6, 10, 11, 9, 7][i],
        // Every player has a name; it shows when the player is in a fantasy lineup or has the ball.
        label: T.roster[slot] ? { name: Rules.lastName(T.roster[slot]) } : null, fantasy: own
      };
      s[slot] = a; list.push(a); all.push(a);
    });
    return { s: s, list: list };
  }
  var teams = [makeTeam(0), makeTeam(1)];
  // The referee: teal shirt, black shorts. Not in a team, so team is -1.
  var REF_KIT = { shirt: '#19b8b0', trim: '#0b0d0e', shorts: '#0b0d0e', socks: '#0b0d0e' };
  var ref = { team: -1, role: 'REF', keeper: false, tone: 1, hair: 0, phase: 0.9, jx: 0, jy: 0, x: WID / 2 + 11, y: LEN / 2,
              path: null, state: '', view: 'f', moving: false, label: null };
  var movers = all.concat([ref]);

  // ------------------------------------------------------------- state

  var steps = Rules.flatten(D.SAMPLE_GAME, TEAMS);
  var state, si, play, pt, mode, clock = 0, interUntil = 0, camX = 0, camY = 0, camSet = false;
  var ball = { x: WID / 2, y: LEN / 2, holder: null }, spot = null, teleport = true;
  var disp = { score: [0, 0], min: 0, half: 1, banner: null, ticker: null, flash: -9, scoreAt: [-9, -9], floaters: [], fpts: [0, 0], cutAt: -9 };
  var replay = null;     // { t, end, rate, i } while a goal is replayed
  var log = [], errors = [];
  var active = false, listeners = [];
  // seek(): while it runs the skipped events there is no sound, voice, floater, banner or flash.
  // hold(): stops the clock with the view open. results: every event of the match so far.
  var seeking = false, HOLD = false, results = [];

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn(type, data || {}); }
      catch (err) { errors.push(String(err && err.stack || err)); console.error(err); }
    });
  }

  var fx = {
    sound: function (name) {
      if (seeking) return;
      if (name === 'goal') disp.flash = clock;
      if (active && window.SC_SOUND) { try { window.SC_SOUND.play(name); } catch (err) { /* optional */ } }
    },
    // c is a call from the rules: { text, sub, style, team, color }
    banner: function (c, secs) { if (!seeking) disp.banner = { c: c, t0: clock, until: clock + secs }; },
    result: function (res, p) {
      for (var i = 0; i < 2; i++) if (res.post.score[i] !== disp.score[i]) disp.scoreAt[i] = clock;
      disp.score = res.post.score.slice();
      disp.ticker = { min: res.min, team: res.team, text: res.text.replace(/^\d+' /, '').toUpperCase(), t0: clock };
      if (!seeking) floatPoints(res.fp);
      res.fp.forEach(function (f) { disp.fpts[f.team] += f.pts; });
      results.push(res);
      if (!seeking) say(announce(res) || res.say);
      emit('result', { res: res, play: p.name, step: si });
    }
  };

  // The line for a result from the soccer announcer (js/announcer/soccer/) when it is loaded, or ''.
  function announce(res) {
    var A = window.SC_ANNOUNCER;
    if (!A || !A.line) return '';
    try { return A.line(res, { teams: TEAMS, score: res.post ? res.post.score : disp.score.slice(), style: A.style }) || ''; }
    catch (err) { return ''; }
  }

  // A longer piece from the soccer announcer (intro, halftime, wrap), same ctx as football, or ''.
  function piece(kind, score) {
    var A = window.SC_ANNOUNCER;
    if (!A || !A[kind]) return '';
    try { return A[kind]({ teams: TEAMS, score: score, leaders: [], hidden: !!(window.__app && window.__app.masked) }) || ''; }
    catch (err) { return ''; }
  }

  function say(text) {
    if (!text || seeking || !active || !VOICE || SPEED > 2 || !('speechSynthesis' in window)) return;
    // Through the announcer: its queue, its British voice, and the ElevenLabs clips when loaded.
    if (window.SC_ANNOUNCER && window.SC_ANNOUNCER.speak) { window.SC_ANNOUNCER.speak(text); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15;
      window.speechSynthesis.speak(u);
    } catch (err) { /* the announcer is optional */ }
  }

  // Fantasy points rise from the player who earned them: "+4 GOAL".
  function floatPoints(fp) {
    if (!FLOATERS) return;
    fp.forEach(function (f, i) {
      var a = teams[f.team].s[f.role];
      if (a) disp.floaters.push({ a: a, text: (f.pts > 0 ? '+' : '') + f.pts + ' ' + String(f.why || '').toUpperCase(), good: f.pts > 0, t0: clock + i * 0.35 });
    });
  }

  function spokenScore() { return TEAMS[0].name + ' ' + disp.score[0] + ', ' + TEAMS[1].name + ' ' + disp.score[1] + '.'; }

  // An empty play that just holds everyone where they are (half time, final).
  function stillPlay() {
    movers.forEach(function (a) { a.path = [{ t: 0, x: a.x, y: a.y }]; });
    return { name: 'still', actors: all, ball: [{ t: 0, kind: 'rest', x: ball.x, y: ball.y }], ball0: { x: ball.x, y: ball.y },
             holder0: null, cues: [], marks: [], cards: [], dur: 1e9, tEnd: 0 };
  }

  function startStep() {
    var st = steps[si];
    if (st.kind === 'half') {
      Rules.startHalf(state);
      disp.half = 2; disp.min = 45;
      play = stillPlay(); pt = 0;
      mode = 'inter'; interUntil = clock + 3.4;
      disp.banner = null;
      say(piece('halftime', disp.score.slice()) || announce({ kind: 'half', post: { score: disp.score.slice() } }) || 'Half time. ' + spokenScore());
      teleport = true; ball = { x: WID / 2, y: LEN / 2, holder: null };
      log.push({ step: si, text: 'HALF TIME', score: disp.score.slice() });
      emit('half', { score: disp.score.slice() });
      return;
    }
    if (st.kind === 'final') {
      play = stillPlay(); pt = 0;
      mode = 'final'; disp.banner = null; disp.min = 90;
      say(piece('wrap', state.score.slice()) || announce({ kind: 'final', post: { score: state.score.slice() } }) || 'Full time. ' + spokenScore());
      log.push({ step: si, text: 'FULL TIME', score: state.score.slice() });
      // Clean sheets are only known at full time. They arrive as one last result, same shape as any other.
      var ft = Fantasy.fullTime(state.score);
      if (ft.length) {
        floatPoints(ft);
        ft.forEach(function (f) { disp.fpts[f.team] += f.pts; });
        emit('result', { res: { e: { t: 'ft', min: 90 }, kind: 'ft', team: -1, min: 90, text: "90' Full time", calls: [], fp: ft,
                                pre: { poss: -1, score: state.score.slice() }, post: { poss: -1, score: state.score.slice() } },
                         play: 'full time', step: si });
      }
      emit('final', { score: state.score.slice(), fp: ft });
      return;
    }
    var res = Rules.apply(state, st.e, st.team);
    var p = Plays.build(st.e, res, {
      rng: rng, fx: fx, att: st.team, half: state.half, teams: teams, all: all,
      ball: ball, holder: ball.holder, spot: spot, teleport: teleport && st.e.t === 'kickoff', ref: ref
    });
    if (st.e.t === 'kickoff') teleport = false;
    play = p; pt = 0; mode = 'play';
    if (p.cut || p.ctx.teleport) disp.cutAt = clock;   // set pieces and kickoffs open with a camera cut
    if (p.goalAt !== undefined) p.rec = [];
    disp.min = st.e.min; disp.half = state.half;
    log.push({ step: si, play: p.name, text: res.text, score: res.post.score.slice() });
    emit('snap', { res: res, play: p.name, step: si });
  }

  // After a goal, replay its last seconds slowly before the restart.
  function endStep() {
    if (play.goalAt !== undefined && !play.replayed && play.rec && play.rec.length) {
      play.replayed = true;
      replay = { t: Math.max(0, play.goalAt - 2.8), end: play.goalAt + 0.8, rate: 0.4, i: 0 };
      pt = replay.t; mode = 'replay';
      return;
    }
    finishStep();
  }

  function finishStep() { settleStep(); si++; startStep(); }
  // Everyone and the ball where the current step left them.
  function settleStep() {
    replay = null;
    movers.forEach(function (a) { var p = Plays.posAt(a, play.dur); a.x = p.x; a.y = p.y; });
    var b = Plays.ballAt(play, play.dur);
    ball = { x: b.x, y: b.y, holder: b.holder || null };
    spot = play.spot || null;
  }

  function reset() {
    state = Rules.create(TEAMS);
    si = 0; clock = 0; camSet = false; teleport = true; spot = null;
    ball = { x: WID / 2, y: LEN / 2, holder: null };
    disp.score = [0, 0]; disp.min = 0; disp.half = 1; disp.banner = null; disp.ticker = null; disp.flash = -9; disp.scoreAt = [-9, -9]; disp.floaters = []; disp.fpts = [0, 0]; disp.cutAt = -9; replay = null;
    log.length = 0; results.length = 0;
    if (window.SC_ANNOUNCER && window.SC_ANNOUNCER.reset) window.SC_ANNOUNCER.reset();
    emit('reset');
    startStep();
  }

  // ------------------------------------------------------------ update

  function update(dt) {
    if (mode === 'play') {
      clock += dt; pt += dt;
      var cues = play.cues;
      for (var i = 0; i < cues.length; i++) {
        if (!cues[i].done && cues[i].t <= pt) { cues[i].done = true; cues[i].fn(); }
      }
      if (play.rec) play.rec.push({ t: pt, s: movers.map(function (a) { return a.state; }), d: movers.map(function (a) { return a.diveDir; }) });
      if (pt >= play.dur) endStep();
    } else if (mode === 'replay') {
      clock += dt;
      var before = pt;
      pt = Math.min(replay.end, pt + dt * replay.rate);
      if (before < play.goalAt && pt >= play.goalAt) disp.flash = clock;
      // Actor states (dive, celebrate) come from what was recorded live.
      var rec = play.rec;
      while (replay.i < rec.length - 1 && rec[replay.i + 1].t <= pt) replay.i++;
      var snap = rec[replay.i];
      movers.forEach(function (a, k) { a.state = snap.s[k]; a.diveDir = snap.d[k]; });
      if (pt >= replay.end) { movers.forEach(function (a, k) { a.state = rec[rec.length - 1].s[k]; }); finishStep(); return; }
    } else if (mode === 'inter') {
      clock += dt;
      if (clock >= interUntil) { si++; startStep(); }
    } else if (mode === 'final') {
      clock += dt;
    }
    for (var j = 0; j < movers.length; j++) {
      var a = movers[j], p = Plays.posAt(a, pt);
      a.x = p.x; a.y = p.y;
      a.moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.6;
      if (a.moving) { if (Math.abs(p.vy) > 0.5) a.view = p.vy > 0 ? 'f' : 'b'; }
    }
  }

  // The camera follows the ball on both axes and never shows past the stands.
  function updateCamera(realDt) {
    var b = Plays.ballAt(play, pt);
    // After a goal the camera stays with the scorer, not the ball in the net.
    if (mode === 'play' && play.focus && pt >= play.focus.t) { var fp = Plays.posAt(play.focus.a, pt); b = { x: fp.x, y: fp.y }; }
    var tx = clamp(wx(b.x) - W / 2, 0, stadium.W - W);
    var ty = stadium.H > H ? clamp(wy(b.y) - H * 0.52, 0, stadium.H - H) : (stadium.H - H) / 2;
    if (!camSet) { camX = tx; camY = ty; camSet = true; return; }
    var k = 1 - Math.exp(-realDt * 3.5 * Math.max(1, SPEED));
    camX += (tx - camX) * k; camY += (ty - camY) * k;
  }

  // -------------------------------------------------------------- draw

  function wx(x) { return (x + M) * S; }
  function wy(y) { return (y + M) * S; }
  var ox = 0, oy = 0;   // camera offset for this frame, whole pixels, shake included
  function sx(x) { return Math.round(wx(x)) - ox; }
  function sy(y) { return Math.round(wy(y)) - oy; }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function text(str, x, y, o) { return Font.draw(g, str, x, y, o); }
  // The screens' Spanish (js/screens/i18n.js) for the fixed labels drawn on the canvas.
  function tr(str) { var I = window.FR_I18N; try { return I && I.tr ? I.tr(str) : str; } catch (err) { return str; } }

  // Carrier ring under the feet: a pixel ellipse, built once.
  var RING = (function () {
    var pts = [], seen = {};
    for (var t = 0; t < Math.PI * 2; t += 0.05) {
      var x = Math.round(Math.cos(t) * 5) * 2, y = Math.round(Math.sin(t) * 2) * 2, k = x + ',' + y;
      if (!seen[k]) { seen[k] = 1; pts.push([x, y]); }
    }
    return pts;
  })();

  function drawGoalHit() {
    if (play.netHit === undefined || pt < play.netHit || pt > play.netHit + 1.2) return;
    var b = Plays.ballAt(play, pt), end = b.y > LEN / 2 ? LEN : 0, s = end ? 1 : -1;
    var x0 = sx(WID / 2 - 3.66), x1 = sx(WID / 2 + 3.66), yl = sy(end), yb = sy(end + s * 2.2);
    var top = Math.min(yl, yb), h = Math.abs(yb - yl), a = 1 - (pt - play.netHit) / 1.2;
    g.fillStyle = 'rgba(255,255,255,' + (0.35 * a).toFixed(3) + ')';
    for (var x = x0; x <= x1; x += 4) {
      var bulge = Math.round(Math.sin((x - x0) / (x1 - x0) * Math.PI) * 3 * a) * s;
      g.fillRect(x, top + bulge, 2, h);
    }
  }

  // Vanishing spray for free kicks: dashes where the wall stands and a ring at the ball.
  function drawSpray(m) {
    var fade = clamp(1 - (pt - m.until) / 1.2, 0, 1);
    if (fade <= 0) return;
    g.fillStyle = 'rgba(250,250,245,' + (0.8 * fade).toFixed(3) + ')';
    if (m.line) {
      var x0 = sx(m.line[0].x), y0 = sy(m.line[0].y), x1 = sx(m.line[1].x), y1 = sy(m.line[1].y);
      var n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (var i = 0; i <= n; i += 2) g.fillRect(Math.round(x0 + (x1 - x0) * i / n) - 1, Math.round(y0 + (y1 - y0) * i / n) - 1, 2, 2);
    }
    var cx = sx(m.spot.x), cy = sy(m.spot.y);
    for (var k = 0; k < 12; k++) { var t = k / 12 * Math.PI * 2; g.fillRect(cx + Math.round(Math.cos(t) * 5) - 1, cy + Math.round(Math.sin(t) * 5) - 1, 2, 2); }
  }

  function drawMarks() {
    play.marks.forEach(function (m) {
      if (m.kind === 'spray') { drawSpray(m); return; }
      if (m.kind !== 'offside' || pt < m.t) return;
      var y = sy(m.y);
      g.fillStyle = 'rgba(255,210,26,0.8)';
      for (var x = sx(0); x < sx(WID); x += 8) g.fillRect(x, y - 1, 4, 2);
      // The assistant referee on the touchline, flag up.
      var fx0 = sx(m.x) + (m.x > 0 ? 6 : -14);
      g.fillStyle = '#111'; g.fillRect(fx0 + 2, y - 4, 6, 8);
      g.fillStyle = '#d8d8d0'; g.fillRect(fx0 + 4, y - 22, 2, 18);
      g.fillStyle = FLAG; g.fillRect(fx0 + 6, y - 22, 8, 6);
      g.fillStyle = '#e5322b'; g.fillRect(fx0 + 6, y - 22, 4, 3); g.fillRect(fx0 + 10, y - 19, 4, 3);
    });
  }

  function drawPlayer(a, isCarrier) {
    var px = sx(a.x), py = sy(a.y);
    if (py < -40 || py > H + 40 || px < -20 || px > W + 20) return;
    var colors = a.team >= 0 ? TEAMS[a.team].colors : REF_KIT;
    var still = a.state === 'down' || a.state === 'dive';
    var frame = a.moving && !still ? (Math.floor(clock * 10 + a.phase) % 2 ? 'a' : 'b') : 'stand';
    var pose = a.state === 'celebrate' || a.state === 'cheer' || a.state === 'card' ? 'up' : undefined;
    var img = Spr.get(a.team >= 0 ? a.team : 9, colors, a.keeper, a.view, frame, a.tone, a.hair, pose);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(px - 6, py, 12, 2); g.fillRect(px - 4, py + 2, 8, 2);
    if (isCarrier && Math.floor(clock * 4) % 2 === 0) {
      g.fillStyle = AMBER;
      for (var i = 0; i < RING.length; i++) g.fillRect(px + RING[i][0] - 1, py + 1 + RING[i][1], 2, 2);
    }
    if (still) {
      g.save(); g.translate(px, py - 5); g.rotate((a.state === 'dive' ? (a.diveDir || 1) : 1) * Math.PI / 2);
      g.drawImage(img, -8, -11, 16, 22);
      g.restore();
    } else {
      var hop = a.state === 'celebrate' ? Math.round(Math.abs(Math.sin(clock * 9)) * 3) * 2 : 0;
      g.drawImage(img, px - 8, py - 20 - hop, 16, 22);
    }
  }

  // One plate per owned player: a team-colored edge and the surname.

  // Names: as many as fit. Labels are placed in order of priority (whoever has the ball, then the
  // players in the two fantasy lineups, then everyone else) and a label that would overlap one
  // already placed is left out for this frame.
  function labelOrder(list, holder) {
    function rank(a) { return a === holder ? 0 : a.fantasy ? 1 : 2; }
    return list.slice().sort(function (p, r) { return rank(p) - rank(r) || p.y - r.y; });
  }
  function fits(taken, x, y, w, h) {
    for (var i = 0; i < taken.length; i++) {
      var t = taken[i];
      if (x < t.x + t.w + 2 && x + w + 2 > t.x && y < t.y + t.h + 1 && y + h + 1 > t.y) return false;
    }
    taken.push({ x: x, y: y, w: w, h: h });
    return true;
  }
  function drawLabel(a, isCarrier, hasBall, taken) {
    var L = a.label, px = sx(a.x), py = sy(a.y);
    if (py < -40 || py > H + 40 || px < -60 || px > W + 60) return;
    var top = py - 24;
    play.cards.forEach(function (c) {
      if (c.a !== a || pt < c.t0) return;
      g.fillStyle = INK; g.fillRect(px + 6, top - 4, 10, 14);
      g.fillStyle = c.color; g.fillRect(px + 8, top - 2, 6, 10);
    });
    var name = L ? L.name.toUpperCase() : '', w = L ? Font.width(name, 1) + 9 : 0, x = Math.round(px - w / 2), y = py + 5;
    if (L && fits(taken, x, y, w, 11)) {
      g.fillStyle = isCarrier ? AMBER : 'rgba(11,13,14,0.86)';
      g.fillRect(x, y, w, 11);
      g.fillStyle = isCarrier ? INK : TEAMS[a.team].colors.trim;
      g.fillRect(x, y, 2, 11);
      text(name, x + 5, y + 2, { color: isCarrier ? INK : TEXT });
    }
    if (isCarrier) {
      var bob = Math.round(Math.sin(clock * 7)) * 2, ty = top - 10 + bob;
      g.fillStyle = AMBER;
      g.fillRect(px - 4, ty, 8, 2); g.fillRect(px - 2, ty + 2, 4, 2);
    }
  }

  function drawBall(b) {
    var x = sx(b.x), y = sy(b.y);
    // A short trail when the ball is really moving.
    if (!b.holder) {
      for (var k = 2; k >= 1; k--) {
        var p = Plays.ballAt(play, Math.max(0, pt - k * 0.035));
        var tx = sx(p.x), ty = sy(p.y) - Math.round(p.z * S * 0.5);
        if (Math.abs(tx - x) + Math.abs(ty - y) < 6) continue;
        g.fillStyle = 'rgba(255,255,255,' + (k === 1 ? 0.35 : 0.15) + ')';
        g.fillRect(tx - 2, ty - 2, 4, 4);
      }
    }
    var lift = Math.round(b.z * S * 0.5), s = b.z > 2.5 ? 4 : 3;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x - 2, y, 4, 2);
    y -= lift;
    g.fillStyle = '#0e0e10';
    g.fillRect(x - s, y - s + 1, 2 * s, 2 * s - 2); g.fillRect(x - s + 1, y - s, 2 * s - 2, 2 * s);
    g.fillStyle = '#f4f4ee';
    g.fillRect(x - s + 1, y - s + 2, 2 * s - 2, 2 * s - 4); g.fillRect(x - s + 2, y - s + 1, 2 * s - 4, 2 * s - 2);
    g.fillStyle = '#1a1a1a';
    g.fillRect(x - 1, y - 1, 2, 2);
  }

  // Replay: letterbox bars, a REPLAY tag and the goal's minute.
  function drawReplay() {
    var bar = 56;
    g.fillStyle = INK; g.fillRect(0, 0, W, bar); g.fillRect(0, H - bar, W, bar);
    g.fillStyle = AMBER; g.fillRect(0, H - bar, W, 2);
    var y = H - bar + 16;
    if (Math.floor(clock * 2) % 2 === 0) { g.fillStyle = '#e5322b'; g.fillRect(16, y + 3, 8, 8); }
    text('REPLAY', 32, y, { unit: 2, color: TEXT, track: 1 });
    var gl = state.goals[state.goals.length - 1];
    if (gl) text(Rules.lastName(TEAMS[gl.team].roster[gl.by]) + ' ' + gl.min + "'", W - 16, y, { unit: 2, color: AMBER, align: 'right' });
    text('SLOW MOTION', 32, y + 20, { color: DIM, track: 1 });
  }

  function drawFloaters() {
    disp.floaters = disp.floaters.filter(function (f) { return clock - f.t0 < 2.0; });
    disp.floaters.forEach(function (f) {
      var age = clock - f.t0;
      if (age < 0 || !FLOATERS) return;
      var x = sx(f.a.x), y = sy(f.a.y) - 44 - Math.round(age * 9) * 2;
      g.globalAlpha = clamp((2.0 - age) / 0.5, 0, 1);
      text(f.text, x, y, { unit: 2, color: f.good ? '#8dff6e' : '#ff6a5c', align: 'center', shadow: INK });
      g.globalAlpha = 1;
    });
  }

  function chip(team, x, y, size) {
    var c = TEAMS[team].colors;
    g.fillStyle = RULE; g.fillRect(x - 1, y - 1, size + 2, size + 2);
    g.fillStyle = c.shirt; g.fillRect(x, y, size, size);
    g.fillStyle = c.trim; g.fillRect(x, y, size, 2); g.fillRect(x + size / 2 - 1, y + 2, 2, size - 2);
  }

  // Broadcast score bug: clock, home, score, score, away.
  function drawScoreBug() {
    var x = 8, y = 8, h = 22;
    var minute = mode === 'final' ? tr('FT') : mode === 'inter' ? tr('HT') : disp.min + "'";
    var cw = Math.max(34, Font.width(minute, 2) + 12);
    g.fillStyle = AMBER; g.fillRect(x, y, cw, h);
    text(minute, x + cw / 2, y + 4, { unit: 2, color: INK, align: 'center' });
    x += cw;
    var codes = [TEAMS[0].id, TEAMS[1].id], codeW = Math.max(Font.width(codes[0], 2), Font.width(codes[1], 2));
    var bw = 4 + 8 + codeW + 8 + 20 + 2 + 20 + 8 + codeW + 8 + 4;
    g.fillStyle = PANEL; g.fillRect(x, y, bw, h);
    g.fillStyle = TEAMS[0].colors.trim; g.fillRect(x, y, 4, h);
    g.fillStyle = TEAMS[1].colors.trim; g.fillRect(x + bw - 4, y, 4, h);
    text(codes[0], x + 12, y + 4, { unit: 2, color: TEXT });
    text(codes[1], x + bw - 12, y + 4, { unit: 2, color: TEXT, align: 'right' });
    var sx0 = x + 12 + codeW + 8;
    for (var i = 0; i < 2; i++) {
      var bx = sx0 + i * 22, hot = clock - disp.scoreAt[i] < 2.4 && Math.floor((clock - disp.scoreAt[i]) * 6) % 2 === 0;
      g.fillStyle = hot ? AMBER : '#1e2225'; g.fillRect(bx, y, 20, h);
      text(String(disp.score[i]), bx + 10, y + 4, { unit: 2, color: hot ? INK : TEXT, align: 'center' });
    }
    var label = tr(mode === 'final' ? 'FULL TIME' : mode === 'inter' ? 'HALF TIME' : (disp.half === 1 ? '1ST' : '2ND') + ' HALF');
    var lw = Font.width(label, 1, 1) + 10;
    g.fillStyle = PANEL; g.fillRect(8, y + h, lw, 13);
    text(label, 13, y + h + 3, { color: DIM, track: 1 });
    var l1 = tr('SAMPLE MATCH'), l2 = tr('MADE-UP STATS'), mw = Math.max(Font.width(l1, 1, 1), Font.width(l2, 1, 1)) + 10;
    g.fillStyle = PANEL; g.fillRect(W - 8 - mw, 8, mw, 22);
    text(l1, W - 13, 11, { color: DIM, align: 'right', track: 1 });
    text(l2, W - 13, 20, { color: DIM, align: 'right', track: 1 });
  }

  // Banners wipe in from the left and out to the right.
  function drawBanner() {
    var B = disp.banner;
    if (!B || clock >= B.until) return;
    var c = B.c, team = c.team >= 0 ? c.team : 0, tc = TEAMS[team].colors;
    var pin = ease((clock - B.t0) / 0.16), pout = ease((clock - (B.until - 0.16)) / 0.16);
    var y = 52, big = c.style === 'goal', unit = big ? 6 : 3;
    var th = 7 * unit, h = th + (c.sub ? 14 : 0) + (big ? 24 : 16);
    g.save();
    g.beginPath(); g.rect(Math.round(W * pout), y, Math.round(W * (pin - pout)), h); g.clip();
    var slide = Math.round((1 - pin) * -24);
    if (big) {
      g.fillStyle = tc.shirt; g.fillRect(0, y, W, h);
      g.fillStyle = tc.trim; g.fillRect(0, y, W, 2); g.fillRect(0, y + h - 2, W, 2);
      // Hazard stripes along the edges.
      for (var sx1 = (Math.floor(clock * 40) % 16) - 16; sx1 < W; sx1 += 16) { g.fillRect(sx1, y + 4, 8, 2); g.fillRect(sx1 + 8, y + h - 6, 8, 2); }
      var flick = clock - B.t0 < 0.6 && Math.floor((clock - B.t0) * 10) % 2 === 1;
      text(tr(c.text), W / 2 + slide, y + 12, { unit: unit, color: flick ? '#ffffff' : tc.trim, align: 'center', track: 1 });
      if (c.sub) text(tr(c.sub), W / 2, y + 12 + th + 6, { color: tc.trim, align: 'center', track: 1 });
    } else {
      g.fillStyle = PANEL; g.fillRect(0, y, W, h);
      var edge = c.style === 'flag' ? FLAG : c.style === 'score' ? AMBER : tc.trim;
      g.fillStyle = edge; g.fillRect(0, y, W, 2);
      var lx = 16;
      if (c.style === 'flag') { g.fillStyle = FLAG; g.fillRect(0, y + 2, 6, h - 2); lx = 18; }
      else if (c.style === 'card') {
        g.fillStyle = INK; g.fillRect(14, y + 8, 14, 20);
        g.fillStyle = c.color || FLAG; g.fillRect(16, y + 10, 10, 16); lx = 38;
      } else { g.fillStyle = edge; g.fillRect(0, y + 2, 4, h - 2); }
      text(tr(c.text), lx + slide, y + 9, { unit: unit, color: c.style === 'flag' ? FLAG : TEXT, track: 1 });
      if (c.sub) text(tr(c.sub), lx, y + 9 + th + 5, { color: DIM, track: 1 });
    }
    g.restore();
  }

  // Lower third: what just happened, with the minute.
  function drawTicker() {
    var T = disp.ticker;
    if (!T || mode === 'final' || mode === 'inter') return;
    var h = 22, y = H - h - 10 + Math.round((1 - ease((clock - T.t0) / 0.2)) * (h + 12));
    var mw = Math.max(34, Font.width(T.min + "'", 2) + 12), x = 8, w = W - 16;
    g.fillStyle = AMBER; g.fillRect(x, y, mw, h);
    text(T.min + "'", x + mw / 2, y + 4, { unit: 2, color: INK, align: 'center' });
    g.fillStyle = PANEL; g.fillRect(x + mw, y, w - mw, h);
    g.fillStyle = TEAMS[T.team >= 0 ? T.team : 0].colors.trim; g.fillRect(x + mw, y, 3, h);
    var room = w - mw - 18, unit = Font.width(T.text, 2) <= room ? 2 : 1;
    var str = T.text;
    while (Font.width(str, unit) > room && str.length > 4) str = str.slice(0, -2);
    if (str !== T.text) str = str.replace(/\s*\S?$/, '') + '..';
    text(str, x + mw + 10, y + (unit === 2 ? 4 : 8), { unit: unit, color: TEXT });
  }

  function scorers(team) {
    return state.goals.filter(function (gl) { return gl.team === team; }).map(function (gl) {
      return Rules.lastName(TEAMS[team].roster[gl.by]).toUpperCase() + ' ' + gl.min + "'" + (gl.how === 'pen' ? ' (P)' : '');
    }).join('  ');
  }

  // Half time and full time: a full board over the pitch, left aligned.
  function drawBoard(title, foot) {
    g.fillStyle = 'rgba(8,9,10,0.86)'; g.fillRect(0, 0, W, H);
    var x = 24, y = Math.round(H / 2 - 110);
    text(title, x, y, { unit: 4, color: AMBER, track: 1 });
    y += 40;
    g.fillStyle = AMBER; g.fillRect(x, y, W - 2 * x, 2);
    y += 18;
    for (var i = 0; i < 2; i++) {
      chip(i, x, y + 3, 14);
      text(TEAMS[i].name, x + 24, y + 3, { unit: 2, color: TEXT, track: 1 });
      text(String(disp.score[i]), W - x, y - 4, { unit: 4, color: TEXT, align: 'right' });
      var sc = scorers(i);
      text(sc || tr('NO GOALS'), x + 24, y + 24, { color: sc ? DIM : RULE, track: 1 });
      if (mode === 'final' && FLOATERS) text(disp.fpts[i] + ' ' + tr('FANTASY PTS'), W - x, y + 36, { color: AMBER, align: 'right', track: 1 });
      y += 52;
    }
    g.fillStyle = RULE; g.fillRect(x, y, W - 2 * x, 2);
    y += 16;
    if (foot && Math.floor(clock * 2) % 2 === 0) text(foot, x, y, { unit: 2, color: TEXT, track: 1 });
    text(tr('SAMPLE MATCH. MADE-UP STATS FOR THE DEMO.'), x, y + (foot ? 26 : 0), { color: DIM });
  }

  function draw() {
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.imageSmoothingEnabled = false;
    var shake = clock - disp.flash < 0.45 ? Math.round((1 - (clock - disp.flash) / 0.45) * 2) * (Math.floor(clock * 60) % 2 ? 2 : -2) : 0;
    ox = Math.round(camX) + shake; oy = Math.round(camY);
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    g.drawImage(stadium.canvas, -ox, -oy);
    drawGoalHit();
    drawMarks();
    var b = Plays.ballAt(play, pt);
    var carrier = b.holder && b.hl ? b.holder : null;
    var list = movers.slice().sort(function (p, r) { return p.y - r.y; });
    var i;
    for (i = 0; i < list.length; i++) drawPlayer(list[i], list[i] === carrier);
    var taken = [], order = labelOrder(list, b.holder);
    for (i = 0; i < order.length; i++) drawLabel(order[i], order[i] === carrier, order[i] === b.holder, taken);
    drawBall(b);
    if (mode !== 'replay') drawFloaters();
    if (clock - disp.flash < 0.22) { g.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - (clock - disp.flash) / 0.22)).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    if (mode === 'replay') drawReplay();
    drawScoreBug();
    if (mode !== 'replay') { drawBanner(); drawTicker(); }
    // A camera cut into set pieces and kickoffs: a quick drop to black.
    if (clock - disp.cutAt < 0.3) { g.fillStyle = 'rgba(8,9,10,' + (1 - (clock - disp.cutAt) / 0.3).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    if (mode === 'inter') drawBoard(tr('HALF TIME'), '');
    if (mode === 'final') drawBoard(tr('FULL TIME'), tr('TAP FOR THE RECAP'));
  }

  // -------------------------------------------------------------- loop

  var lastNow = 0;
  function frame(now) {
    var real = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    try {
      // Like football, the match only advances while its view is open, unless setBackground(true).
      update(mode === 'ready' || HOLD || (!active && !BACKGROUND) ? 0 : real * SPEED);
      if (active) { updateCamera(real); draw(); }
    } catch (err) {
      errors.push(String(err && err.stack || err));
      console.error(err);
      return;
    }
    requestAnimationFrame(frame);
  }

  // What the app shell uses to drive the game. Same members as window.FF_GAME.
  var api = {
    ontap: null,
    on: function (fn) { listeners.push(fn); },
    start: function () {
      if (mode !== 'ready') return;
      mode = 'play';
      say(piece('intro', [0, 0]));
      emit('start');
    },
    restart: function () {
      reset();
      say(piece('intro', [0, 0]));
      emit('start');
    },
    setActive: function (on) {
      active = !!on;
      if (active) { camSet = false; resize(); }
      else if (window.SC_ANNOUNCER && window.SC_ANNOUNCER.hush) window.SC_ANNOUNCER.hush();
      else if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (err) { /* optional */ } }
    },
    get mode() { return mode; },
    get active() { return active; },
    setFloaters: function (on) { FLOATERS = !!on; if (!FLOATERS) disp.floaters = []; },
    setBackground: function (on) { BACKGROUND = !!on; },
    get floaters() { return FLOATERS; },
    get background() { return BACKGROUND; },
    get plays() { return steps.filter(function (st) { return st.kind === 'play'; }).length; },
    // Same meaning as FF_GAME (docs/CONTRACT.md section 2). seek(index): jump to event index
    // (from 1). The skipped events run at once, listeners still called, with no sound, voice,
    // floater, banner or flash; then the announcer says one catch-up line. Works before the
    // match has started (it starts it) and after full time (it plays that event again).
    seek: function (index) {
      var target = -1, n = 0;
      for (var k = 0; k < steps.length; k++) {
        if (steps[k].kind === 'play' && ++n === index) { target = k; break; }
      }
      if (target < 0 || index !== Math.floor(index)) return false;
      seeking = true;
      try {
        reset();
        emit('start');   // like restart(): listeners see the match as running again
        while (si < target) {
          if (mode === 'play') {
            var cues = play.cues;
            for (var c = 0; c < cues.length; c++) { if (!cues[c].done) { cues[c].done = true; cues[c].fn(); } }
          }
          settleStep();
          si++;
          if (si < target) startStep(); else break;
        }
      } finally { seeking = false; }
      disp.banner = null; disp.floaters = []; disp.flash = -9; camSet = false; replay = null;
      var A = window.SC_ANNOUNCER;
      if (A && typeof A.catchUp === 'function' && results.length) {
        try {
          say(A.catchUp(results.slice(), { teams: TEAMS, score: disp.score.slice(), style: A.style, leaders: [], hidden: !!(window.__app && window.__app.masked) }) || '');
        } catch (err) { /* optional */ }
      }
      if (si === target && steps[si]) startStep();
      return true;
    },
    // hold(true) stops the clock with the view open; hold(false) lets it run again.
    hold: function (on) { HOLD = !!on; },
    get held() { return HOLD; },
    get seeking() { return seeking; }
  };
  window.SC_GAME = api;

  canvas.addEventListener('pointerdown', function (ev) { ev.preventDefault(); if (api.ontap) api.ontap(mode); });
  window.addEventListener('error', function (ev) { errors.push(String(ev.message)); });

  // Small read-only hook so a headless browser can check the run.
  window.__sc = {
    seed: SEED, log: log, errors: errors,
    get mode() { return mode; },
    get speed() { return SPEED; },
    set speed(v) { SPEED = clamp(Number(v) || 1, 0.25, 40); },
    get score() { return disp.score.slice(); },
    get minute() { return disp.min; },
    get step() { return si; },
    get clock() { return clock; },
    get steps() { return steps.length; },
    // Step the game by hand for headless checks, in 1/30 second slices of game time.
    tick: function (secs) {
      for (var n = Math.round(secs * 30); n > 0 && mode !== 'final'; n--) update(1 / 30);
      if (active) { camSet = false; updateCamera(0); draw(); }
      return { step: si, mode: mode };
    }
  };

  reset();
  mode = 'ready';
  requestAnimationFrame(function (now) { lastNow = now; requestAnimationFrame(frame); });
})();
