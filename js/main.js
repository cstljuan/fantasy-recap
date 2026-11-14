// Viewer: feeds the sample events through the rules engine one at a time,
// asks the play library for a matching scripted play and draws it.
(function () {
  'use strict';

  var D = window.FF_DATA, Rules = window.FF_RULES, Plays = window.FF_PLAYS;
  var Spr = window.FF_SPRITES, Snd = window.FF_AUDIO;
  var TEAMS = D.TEAMS;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Optional URL switches, for testing and demos. No visible controls.
  //   ?speed=2  play faster   ?seed=7  repeat the same play choices   ?voice=0  no announcer
  var q = new URLSearchParams(location.search);
  var SPEED = clamp(parseFloat(q.get('speed')) || 1, 0.25, 40);
  var SEED = q.has('seed') ? (parseInt(q.get('seed'), 10) >>> 0) : ((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
  var VOICE = q.get('voice') !== '0';
  var rng = mulberry32(SEED);

  // Logical canvas size. The width is fixed, the height follows the phone.
  var W = 390, H = 844, SCALE = 1;
  var FIELD_W = 53.3, CX = Plays.CX;
  var PXX = 6.6, PXY = 12, PAD = 40;
  var MX = (W - FIELD_W * PXX) / 2;
  var FONT = '"Courier New", ui-monospace, Menlo, Consolas, monospace';

  var canvas = document.getElementById('game');
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

  var OROLES = ['C', 'LG', 'RG', 'LT', 'RT', 'TE', 'QB', 'RB', 'WR1', 'WR2', 'WR3'];
  var DROLES = ['DL1', 'DL2', 'DL3', 'DL4', 'LB1', 'LB2', 'LB3', 'CB1', 'CB2', 'S1', 'S2'];
  var all = [];

  function initials(name) {
    return name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }

  function makeActor(team, role, label) {
    var a = { team: team, role: role, label: label, tone: all.length % 3, phase: all.length * 0.37,
              x: 0, y: 0, onField: false, path: null, state: '', tag: false, view: 'f', idle: 'f', moving: false };
    all.push(a);
    return a;
  }

  function makeTeam(ti) {
    var T = TEAMS[ti], O = {}, Df = {};
    function named(role) {
      var n = T.roster[role];
      return n ? { initials: initials(n), name: Rules.lastName(n), color: T.colors.tile } : null;
    }
    OROLES.forEach(function (r) { O[r] = makeActor(ti, r, named(r)); });
    // The defense is one fantasy slot (D/ST), so its playmaker carries the unit label.
    var unit = { initials: 'D', name: T.name + ' D', color: T.colors.tile };
    DROLES.forEach(function (r) { Df[r] = makeActor(ti, r, unit); });
    O.K = makeActor(ti, 'K', named('K'));
    O.P = makeActor(ti, 'P', null);
    return { O: O, D: Df };
  }
  var teams = [makeTeam(0), makeTeam(1)];

  // Team 0 defends the top goal line and attacks down the screen.
  function absY(team, own) { return team === 0 ? own : 100 - own; }
  function dirOf(team) { return team === 0 ? 1 : -1; }

  // ------------------------------------------------------------- state

  var steps = Rules.flatten(D.SAMPLE_GAME, TEAMS);
  var state, si, play, pt, mode, clock = 0, interUntil = 0, cam = 0, camSet = false;
  var disp = { score: [0, 0], poss: -1, banner: null, lines: null, floaters: [] };
  var log = [], errors = [];
  var active = false;   // true while the game view is on screen
  var listeners = [];   // the app shell listens here for plays as they happen

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn(type, data || {}); }
      catch (err) { errors.push(String(err && err.stack || err)); console.error(err); }
    });
  }

  var fx = {
    sound: function (name) { if (active) Snd.play(name); },
    banner: function (text, sub, secs, color) {
      disp.banner = { text: text, sub: sub || '', until: clock + secs, color: color || '#ffffff' };
    },
    result: function (res, p) {
      disp.score = res.post.score.slice();
      if (FLOATERS) res.fp.forEach(function (f, i) {
        var a = f.role === 'DST' ? (p.playmaker || teams[f.team].D.LB2) : teams[f.team].O[f.role];
        if (!a || !a.onField) return;
        disp.floaters.push({ x: a.x, y: a.y, text: (f.pts > 0 ? '+' : '') + f.pts.toFixed(1), t0: clock + i * 0.25, good: f.pts > 0 });
      });
      results.push(res);
      say(announce(res, res.post.score) || res.say || '');
      var crowd = Snd.crowdFor ? Snd.crowdFor(res) : '';
      if (crowd) fx.sound(crowd);
      emit('result', { res: res, play: p.name, step: si });
    }
  };

  // The fantasy point numbers that float up from a player. The app turns them off
  // while a manager has opted in to hidden scores.
  var FLOATERS = true;
  // The game stops while its view is closed, so nobody misses a play. setBackground(true)
  // lets it keep running behind the app screens.
  var BACKGROUND = q.get('bg') === '1';

  // Every finished play of this game so far, for the announcer's longer pieces.
  var results = [];
  // The intro, the halftime report and the wrap, from js/announcer/ when it has them.
  function piece(name, score) {
    var ann = window.FF_ANNOUNCER;
    if (!ann || typeof ann[name] !== 'function') return '';
    try { return ann[name]({ teams: TEAMS, score: score || [0, 0], style: ann.style, leaders: [], plays: results.slice() }) || ''; }
    catch (err) { return ''; }
  }

  // The line for a finished play, from js/announcer/ when it is loaded.
  function announce(res, score) {
    var ann = window.FF_ANNOUNCER;
    if (!ann || !ann.line) return '';
    try { return ann.line(res, { teams: TEAMS, score: score, style: ann.style }) || ''; }
    catch (err) { return ''; }
  }

  function say(text) {
    if (!text || !active || !VOICE || SPEED > 2 || !('speechSynthesis' in window)) return;
    if (window.FF_ANNOUNCER && window.FF_ANNOUNCER.speak) { window.FF_ANNOUNCER.speak(text); return; }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15;
      window.speechSynthesis.speak(u);
    } catch (err) { /* the announcer is optional */ }
  }

  function scoreText() {
    return TEAMS[0].id + ' ' + disp.score[0] + '   ' + TEAMS[1].id + ' ' + disp.score[1];
  }
  function spokenScore() {
    return TEAMS[0].name + ' ' + disp.score[0] + ', ' + TEAMS[1].name + ' ' + disp.score[1] + '.';
  }

  function ctxFor(st, res) {
    if (st.e.t === 'kickoff') {
      var kt = res.kickTeam, rt = st.team;
      return {
        rng: rng, fx: fx, los: absY(kt, 35), dir: dirOf(kt), ytg: 65,
        O: teams[kt].D, D: teams[rt].O, K: teams[kt].O.K,
        kickers: DROLES.slice(0, 10).map(function (r) { return teams[kt].D[r]; }),
        returner: teams[rt].O.WR3,
        blockers: ['C', 'LG', 'RG', 'LT', 'RT', 'TE', 'RB', 'WR1', 'WR2', 'QB'].map(function (r) { return teams[rt].O[r]; })
      };
    }
    var off = res.pre.poss;
    return { rng: rng, fx: fx, los: absY(off, res.pre.ballOn), dir: dirOf(off), ytg: res.pre.ytg, O: teams[off].O, D: teams[1 - off].D };
  }

  function startStep() {
    var st = steps[si];
    if (st.kind === 'half') {
      Rules.startHalf(state);
      mode = 'inter'; interUntil = clock + 3.2; disp.lines = null;
      fx.banner('HALFTIME', scoreText(), 3);
      fx.sound('crowd_stop');
      say(piece('halftime', disp.score.slice()) || announce({ kind: 'half' }, disp.score.slice()) || 'Halftime. ' + spokenScore());
      log.push({ step: si, text: 'HALFTIME', score: disp.score.slice() });
      emit('half', { score: disp.score.slice() });
      return;
    }
    if (st.kind === 'final') {
      mode = 'final'; disp.lines = null; disp.banner = null;
      fx.sound('crowd_stop');
      fx.sound('jingle_final');
      say(piece('wrap', state.score.slice()) || announce({ kind: 'final' }, state.score.slice()) || 'That is the final. ' + spokenScore());
      log.push({ step: si, text: 'FINAL', score: state.score.slice() });
      emit('final', { score: state.score.slice() });
      return;
    }
    var res = Rules.apply(state, st.e, st.team);
    var p = Plays.build(st.e, res, ctxFor(st, res));
    all.forEach(function (a) { a.onField = false; });
    p.actors.forEach(function (a) { a.onField = true; });
    p.offs.forEach(function (a) { a.idle = p.dir > 0 ? 'f' : 'b'; });
    p.defs.forEach(function (a) { a.idle = p.dir > 0 ? 'b' : 'f'; });
    play = p; pt = 0; mode = 'play';
    disp.poss = st.e.t === 'kickoff' ? -1 : res.pre.poss;
    if (st.e.t === 'kickoff') disp.lines = null;
    else {
      var off = res.pre.poss, togo = res.pre.ballOn + res.pre.toGo;
      disp.lines = {
        los: absY(off, res.pre.ballOn),
        fd: st.e.t !== 'xp' && togo < 100 ? absY(off, togo) : null,
        down: st.e.t === 'xp' ? 0 : res.pre.down
      };
    }
    log.push({ step: si, play: p.name, text: res.text, score: res.post.score.slice() });
    fx.sound('crowd_murmur');
    emit('snap', { res: res, play: p.name, step: si });
  }

  function reset() {
    state = Rules.create(TEAMS);
    si = 0; clock = 0; camSet = false;
    disp.score = [0, 0]; disp.poss = -1; disp.banner = null; disp.lines = null; disp.floaters = [];
    log.length = 0; results.length = 0;
    all.forEach(function (a) { a.onField = false; });
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
      if (pt >= play.dur) { si++; startStep(); }
    } else if (mode === 'inter') {
      clock += dt;
      if (clock >= interUntil) { si++; startStep(); }
    } else if (mode === 'final') {
      clock += dt;
    }
    for (var j = 0; j < play.actors.length; j++) {
      var a = play.actors[j], p = Plays.posAt(a, pt);
      a.x = p.x; a.y = p.y;
      a.moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.6;
      if (a.moving) { if (Math.abs(p.vy) > 0.8) a.view = p.vy > 0 ? 'f' : 'b'; }
      else a.view = a.idle;
    }
  }

  function updateCamera(realDt) {
    var b = Plays.ballAt(play, pt);
    var target = (b.y + 10) * PXY + PAD - H * (play.dir > 0 ? 0.42 : 0.58);
    target = clamp(target, 0, Math.max(0, 120 * PXY + 2 * PAD - H));
    if (!camSet) { cam = target; camSet = true; }
    else cam += (target - cam) * (1 - Math.exp(-realDt * 5 * Math.max(1, SPEED)));
  }

  // -------------------------------------------------------------- draw

  function sx(x) { return MX + x * PXX; }
  function sy(y) { return (y + 10) * PXY + PAD - cam; }

  function drawField() {
    var fw = FIELD_W * PXX, yd, y;
    g.fillStyle = '#143d1c';
    g.fillRect(0, 0, W, H);
    for (yd = -10; yd < 110; yd += 5) {
      var y0 = sy(yd), y1 = sy(yd + 5);
      if (y1 < 0 || y0 > H) continue;
      g.fillStyle = yd < 0 ? TEAMS[0].colors.zone : yd >= 100 ? TEAMS[1].colors.zone : ((yd / 5) % 2 === 0 ? '#2f8f3e' : '#2a8337');
      g.fillRect(sx(0), y0, fw, y1 - y0 + 0.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (yd = 0; yd <= 100; yd += 5) {
      y = sy(yd);
      if (y < -4 || y > H + 4) continue;
      if (yd % 100 === 0) g.fillRect(sx(0), y - 1.5, fw, 3); else g.fillRect(sx(0), y - 0.5, fw, 1);
    }
    for (yd = 1; yd < 100; yd++) {
      if (yd % 5 === 0) continue;
      y = sy(yd);
      if (y < -2 || y > H + 2) continue;
      g.fillRect(sx(0) + 2, y - 0.5, 5, 1); g.fillRect(sx(FIELD_W) - 7, y - 0.5, 5, 1);
      g.fillRect(sx(CX - 6) - 2, y - 0.5, 4, 1); g.fillRect(sx(CX + 6) - 2, y - 0.5, 4, 1);
    }
    g.strokeStyle = '#ffffff'; g.lineWidth = 2;
    g.strokeRect(sx(0), sy(-10), fw, 120 * PXY);
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.5)';
    g.font = 'bold 13px ' + FONT;
    for (yd = 10; yd <= 90; yd += 10) {
      y = sy(yd);
      if (y < -10 || y > H + 10) continue;
      var n = String(50 - Math.abs(50 - yd));
      g.fillText(n, sx(CX - 18), y - 3); g.fillText(n, sx(CX + 18), y - 3);
    }
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = 'bold 26px ' + FONT;
    g.fillText(TEAMS[0].name.toUpperCase(), W / 2, sy(-5) + 9);
    g.fillText(TEAMS[1].name.toUpperCase(), W / 2, sy(105) + 9);
    // Goalposts on the end lines, seen from above.
    g.fillStyle = '#ffd91a';
    [-10, 110].forEach(function (ey) {
      var yy = sy(ey);
      g.fillRect(sx(CX - 3.1), yy - 1.5, 6.2 * PXX, 3);
      g.fillRect(sx(CX - 3.1) - 2, yy - 4, 4, 8);
      g.fillRect(sx(CX + 3.1) - 2, yy - 4, 4, 8);
    });
  }

  function drawLines() {
    var L = disp.lines;
    if (!L) return;
    var fw = FIELD_W * PXX, y = sy(L.los);
    g.fillStyle = 'rgba(70,150,255,0.95)';
    g.fillRect(sx(0), y - 1, fw, 2);
    if (L.fd !== null) {
      var fy = sy(L.fd);
      g.fillStyle = 'rgba(255,226,0,0.95)';
      g.fillRect(sx(0), fy - 1, fw, 2);
      g.fillRect(W - MX + 3, fy - 5, 4, 10);
    }
    if (L.down) {
      // Sideline down marker, like the one the chain crew holds.
      g.fillStyle = '#ff7a1a'; g.fillRect(2, y - 8, 15, 16);
      g.fillStyle = '#111'; g.font = 'bold 12px ' + FONT; g.textAlign = 'center';
      g.fillText(String(L.down), 9.5, y + 4.5);
    }
  }

  function drawFlags() {
    for (var i = 0; i < play.flags.length; i++) {
      var f = play.flags[i];
      if (f.t > pt) continue;
      var x = Math.round(sx(f.x)), y = Math.round(sy(f.y));
      g.fillStyle = '#3a2d00'; g.fillRect(x - 4, y - 4, 8, 8);
      g.fillStyle = '#ffd400'; g.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  function drawPlayer(a, isCarrier) {
    var px = Math.round(sx(a.x)), py = Math.round(sy(a.y));
    if (py < -40 || py > H + 40) return;
    var colors = TEAMS[a.team].colors;
    var frame = a.moving && a.state !== 'down' ? (Math.floor(clock * 9 + a.phase) % 2 ? 'a' : 'b') : 'stand';
    var img = Spr.get(a.team, colors, a.view, frame, a.tone);
    g.fillStyle = 'rgba(0,0,0,0.28)';
    g.fillRect(px - 7, py, 14, 3);
    if (isCarrier) {
      var pulse = 0.5 + 0.5 * Math.sin(clock * 10);
      g.strokeStyle = 'rgba(255,230,0,' + (0.65 + 0.35 * pulse) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(px, py + 1, 12 + pulse * 2, 6 + pulse, 0, 0, Math.PI * 2); g.stroke();
    }
    if (a.state === 'down') {
      g.save(); g.translate(px, py - 4); g.rotate(Math.PI / 2);
      g.drawImage(img, -8, -11, 16, 22);
      g.restore();
    } else {
      var hop = a.state === 'celebrate' ? Math.abs(Math.sin(clock * 9)) * 7 : 0;
      g.drawImage(img, px - 8, py - 20 - hop, 16, 22);
    }
  }

  function drawLabel(a, isCarrier) {
    var L = a.label;
    var px = Math.round(sx(a.x)), py = Math.round(sy(a.y));
    if (py < -40 || py > H + 40) return;
    var top = py - 22;
    if (L && a.tag) {
      var tx = px - 7, ty = top - 15;
      g.fillStyle = L.color; g.fillRect(tx, ty, 14, 14);
      g.strokeStyle = isCarrier ? '#ffe600' : '#ffffff'; g.lineWidth = 1;
      g.strokeRect(tx + 0.5, ty + 0.5, 13, 13);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff'; g.font = 'bold 8px ' + FONT;
      g.fillText(L.initials, px, ty + 10);
      g.font = 'bold 9px ' + FONT;
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(L.name, px, py + 11);
      g.fillStyle = isCarrier ? '#ffe600' : '#ffffff';
      g.fillText(L.name, px, py + 11);
      top = ty;
    }
    if (isCarrier) {
      var bob = Math.sin(clock * 8) * 2;
      g.fillStyle = '#ffe600';
      g.beginPath();
      g.moveTo(px - 5, top - 9 + bob); g.lineTo(px + 5, top - 9 + bob); g.lineTo(px, top - 3 + bob);
      g.closePath(); g.fill();
    }
  }

  function drawBall(b) {
    var x, y, s = 1;
    if (b.holder) {
      var down = b.holder.state === 'down';
      x = sx(b.holder.x) + (down ? 7 : 6); y = sy(b.holder.y) - (down ? 2 : 9);
    } else {
      x = sx(b.x); y = sy(b.y);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(Math.round(x) - 3, Math.round(y) - 1, 6, 3);
      y -= b.z + 3; s = 1 + b.z / 70;
    }
    x = Math.round(x); y = Math.round(y);
    g.fillStyle = '#7a3d12';
    g.fillRect(x - 2 * s, y - 3 * s, 4 * s, 6 * s);
    g.fillRect(x - 1 * s, y - 4 * s, 2 * s, 8 * s);
    g.fillStyle = '#ffffff';
    g.fillRect(x - 0.5 * s, y - 2 * s, 1 * s, 4 * s);
  }

  function drawFloaters() {
    g.textAlign = 'center';
    g.font = 'bold 11px ' + FONT;
    disp.floaters = disp.floaters.filter(function (f) { return clock - f.t0 < 1.7; });
    disp.floaters.forEach(function (f) {
      var age = clock - f.t0;
      if (age < 0) return;
      var x = sx(f.x), y = sy(f.y) - 46 - age * 16;
      g.globalAlpha = clamp(1.7 - age, 0, 1);
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.85)'; g.strokeText(f.text, x, y);
      g.fillStyle = f.good ? '#8dff6e' : '#ff7b6e'; g.fillText(f.text, x, y);
      g.globalAlpha = 1;
    });
  }

  function drawScore() {
    var x = 8, y = 8, w = 98, h = 51;
    g.fillStyle = 'rgba(8,14,10,0.82)'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    for (var i = 0; i < 2; i++) {
      var ry = y + 5 + i * 16, c = TEAMS[i].colors;
      g.fillStyle = c.jersey; g.fillRect(x + 5, ry, 12, 12);
      g.fillStyle = c.helmet; g.fillRect(x + 8, ry + 3, 6, 6);
      g.fillStyle = '#ffffff'; g.font = 'bold 14px ' + FONT;
      g.textAlign = 'left'; g.fillText(TEAMS[i].id, x + 22, ry + 11);
      g.textAlign = 'right'; g.fillText(String(disp.score[i]), x + w - 14, ry + 11);
      if (disp.poss === i) { g.fillStyle = '#ffe600'; g.fillRect(x + w - 10, ry + 4, 5, 5); }
    }
    g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 7px ' + FONT;
    g.fillText('SAMPLE GAME, MOCK DATA', x + 5, y + h - 4);
  }

  function drawBanner() {
    var b = disp.banner;
    if (!b || clock >= b.until) return;
    var fs = 16;
    g.font = 'bold ' + fs + 'px ' + FONT;
    var tw = g.measureText(b.text).width;
    if (tw > W - 44) { fs = Math.floor(fs * (W - 44) / tw); g.font = 'bold ' + fs + 'px ' + FONT; tw = g.measureText(b.text).width; }
    var sw = 0;
    if (b.sub) { g.font = 'bold 9px ' + FONT; sw = g.measureText(b.sub).width; }
    var bw = Math.max(tw, sw) + 24, bh = b.sub ? 46 : 30, bx = Math.round((W - bw) / 2), by = 72;
    g.fillStyle = 'rgba(8,14,10,0.9)'; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = b.color; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.textAlign = 'center';
    g.fillStyle = b.color; g.font = 'bold ' + fs + 'px ' + FONT;
    g.fillText(b.text, W / 2, by + 20);
    if (b.sub) { g.fillStyle = '#ffffff'; g.font = 'bold 9px ' + FONT; g.fillText(b.sub, W / 2, by + 36); }
  }

  function drawFinal() {
    var bw = 250, bh = 168, bx = (W - bw) / 2, by = Math.round(H / 2 - bh / 2);
    g.fillStyle = 'rgba(8,14,10,0.92)'; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.textAlign = 'center';
    g.fillStyle = '#ffe600'; g.font = 'bold 24px ' + FONT; g.fillText('FINAL', W / 2, by + 36);
    g.font = 'bold 18px ' + FONT;
    for (var i = 0; i < 2; i++) {
      g.fillStyle = '#ffffff';
      g.textAlign = 'left'; g.fillText(TEAMS[i].name.toUpperCase(), bx + 34, by + 72 + i * 28);
      g.textAlign = 'right'; g.fillText(String(disp.score[i]), bx + bw - 34, by + 72 + i * 28);
    }
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = 'bold 10px ' + FONT;
    g.fillText('Sample game. Mock data.', W / 2, by + 128);
    g.fillText('Tap for the recap', W / 2, by + 148);
  }

  function draw() {
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.imageSmoothingEnabled = false;
    g.lineJoin = 'round';
    drawField();
    drawLines();
    drawFlags();
    var b = Plays.ballAt(play, pt);
    var carrier = b.holder && b.hl ? b.holder : null;
    var list = play.actors.slice().sort(function (p, r) { return p.y - r.y; });
    var i;
    for (i = 0; i < list.length; i++) drawPlayer(list[i], list[i] === carrier);
    for (i = 0; i < list.length; i++) drawLabel(list[i], list[i] === carrier);
    drawBall(b);
    drawFloaters();
    drawScore();
    drawBanner();
    if (mode === 'final') drawFinal();
  }

  // -------------------------------------------------------------- loop

  var lastNow = 0;
  function frame(now) {
    var real = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    try {
      update(mode === 'ready' || (!active && !BACKGROUND) ? 0 : real * SPEED);
      // The game is only drawn when visible, and only advances then unless setBackground(true).
      if (active) { updateCamera(real); draw(); }
    } catch (err) {
      errors.push(String(err && err.stack || err));
      console.error(err);
      return;
    }
    requestAnimationFrame(frame);
  }

  // What the app shell uses to drive the game.
  var api = {
    ontap: null,
    on: function (fn) { listeners.push(fn); },
    start: function () {
      Snd.init();
      if (mode !== 'ready') return;
      mode = 'play';
      fx.sound('jingle_kickoff');
      emit('start');
      say(piece('intro') || 'Kickoff. ' + TEAMS[0].name + ' against ' + TEAMS[1].name + '.');
    },
    restart: function () {
      if (window.FF_ANNOUNCER && window.FF_ANNOUNCER.hush) { try { window.FF_ANNOUNCER.hush(); } catch (err) { /* optional */ } }
      Snd.init();
      reset();
      emit('start');
    },
    setActive: function (on) {
      active = !!on;
      if (active) { camSet = false; resize(); }
      else {
        if (window.FF_ANNOUNCER && window.FF_ANNOUNCER.hush) { try { window.FF_ANNOUNCER.hush(); } catch (err) { /* optional */ } }
        if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (err) { /* optional */ } }
      }
    },
    setFloaters: function (on) { FLOATERS = !!on; if (!FLOATERS) disp.floaters = []; },
    setBackground: function (on) { BACKGROUND = !!on; },
    get floaters() { return FLOATERS; },
    get background() { return BACKGROUND; },
    get mode() { return mode; },
    get active() { return active; },
    get plays() { return steps.filter(function (st) { return st.kind === 'play'; }).length; }
  };
  window.FF_GAME = api;

  canvas.addEventListener('pointerdown', function (ev) { ev.preventDefault(); if (api.ontap) api.ontap(mode); });
  window.addEventListener('error', function (ev) { errors.push(String(ev.message)); });

  // Small read-only hook so a headless browser can check the run.
  window.__ff = {
    seed: SEED, log: log, errors: errors, sounds: Snd.played,
    get mode() { return mode; },
    get speed() { return SPEED; },
    set speed(v) { SPEED = clamp(Number(v) || 1, 0.25, 40); },
    get score() { return disp.score.slice(); },
    get step() { return si; },
    get clock() { return clock; },
    get steps() { return steps.length; },
    get audio() { return Snd.state(); }
  };

  reset();
  mode = 'ready';
  requestAnimationFrame(function (now) { lastNow = now; requestAnimationFrame(frame); });
})();
