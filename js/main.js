// Viewer: feeds the sample events through the rules engine one at a time,
// asks the play library for a matching scripted play and draws it.
(function () {
  'use strict';

  var D = window.FF_DATA, Rules = window.FF_RULES, Plays = window.FF_PLAYS;
  var Spr = window.FF_SPRITES, Snd = window.FF_AUDIO, Font = window.FF_FONT, ST = window.FF_STADIUM;
  var TEAMS = D.TEAMS;


  // What the game is, for the score box tag and the final note, from the game file's `source`
  // (docs/CONTRACT.md section 1). ?game=sample always plays the built-in sample.
  function sourceTag() {
    var f = window.FF_GAME_FILE, src = /[?&]game=sample\b/.test(location.search) ? 'sample' : (f && f.source) || 'sample';
    if (src === 'real-plays') {
      var wk = /week (\d+)/i.exec((f && f.source_note) || '');
      return ['REAL PLAYS', wk ? 'WEEK ' + wk[1] + ', 2026' : 'REAL STATS', (f && f.source_note ? f.source_note + '.' : 'Real plays.') + ' Real names, real stats.'];
    }
    if (src === 'jev') return ['PLAYS BY JEV', 'MADE-UP STATS', 'Jev chose the plays. Real names, made-up stats.'];
    return ['SAMPLE GAME', 'MADE-UP STATS', 'Sample game. Real names, made-up stats.'];
  }

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
  // The field and the stands come from js/sprites.js (FF_STADIUM): the soccer stadium with a
  // football field in it, one scale both ways, and a camera that follows the ball on both axes.
  var W = ST.W, H = 844, SCALE = 1;
  var FIELD_W = ST.FIELD_W, CX = Plays.CX;
  var stadium = ST.build(TEAMS, CX, Font);
  // Palette shared with the soccer view and css/app.css: near-black panels, warm white text, one amber signal.
  var INK = '#0b0d0e', PANEL = '#121516', RULE = '#2b3033', TEXT = '#f3f1ea', DIM = '#8e9597', AMBER = '#ffc21a', FLAG = '#ffd21a';

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
  var state, si, play, pt, mode, clock = 0, interUntil = 0, camX = 0, camY = 0, camSet = false;
  var disp = { score: [0, 0], poss: -1, banner: null, lines: null, floaters: [], ticker: null, scoreAt: [-9, -9], dd: '', flash: -9 };
  var log = [], errors = [];
  var active = false;   // true while the game view is on screen
  var seeking = false;  // true while seek() runs the skipped plays: no sound, no voice, no floaters, no banners
  var listeners = [];   // the app shell listens here for plays as they happen

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn(type, data || {}); }
      catch (err) { errors.push(String(err && err.stack || err)); console.error(err); }
    });
  }

  var fx = {
    sound: function (name) { if (name === 'td' && !seeking) disp.flash = clock; if (active && !seeking) Snd.play(name); },
    banner: function (text, sub, secs, color) {
      if (seeking) return;
      disp.banner = { text: text, sub: sub || '', t0: clock, until: clock + secs, color: color || '' };
    },
    result: function (res, p) {
      for (var t = 0; t < 2; t++) if (res.post.score[t] !== disp.score[t] && !seeking) disp.scoreAt[t] = clock;
      disp.score = res.post.score.slice();
      if (!seeking && res.text) disp.ticker = { team: res.pre && res.pre.poss >= 0 ? res.pre.poss : -1, text: res.text, t0: clock };
      if (FLOATERS && !seeking) res.fp.forEach(function (f, i) {
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
  // hold(true) stops the clock while the view stays open and the voice keeps going (the app's rule cards).
  var HOLD = false;
  // With "reduce motion" on in the system settings the camera jumps instead of gliding and the point
  // floaters appear in place without rising or fading. The players still move: that is the game.
  var CALM = false;
  try {
    var calmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    CALM = calmQuery.matches;
    var calmChange = function (ev) { CALM = !!ev.matches; };
    if (calmQuery.addEventListener) calmQuery.addEventListener('change', calmChange);
    else if (calmQuery.addListener) calmQuery.addListener(calmChange);
  } catch (err) { /* no matchMedia: full motion */ }
  if (q.get('calm') === '1') CALM = true;

  // Words drawn on the field go through the app's language table when it is loaded (js/screens/, FR_I18N).
  // The whole string is passed, for example 'TOUCHDOWN GOBLINS!'; unknown text comes back unchanged.
  function tr(text) {
    var i = window.FR_I18N;
    try { return i && typeof i.tr === 'function' ? String(i.tr(text)) : text; } catch (err) { return text; }
  }

  // The profiles (season tendencies and recent form) for the announcer's tendency and hot or cold remarks.
  // Missing when the page is opened straight from a file: the announcer then says nothing about them.
  var PROFILES = {};
  TEAMS.forEach(function (T) {
    try {
      fetch('data/profiles/' + encodeURIComponent(T.id) + '.json').then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) { if (d && d.players) PROFILES[T.id] = d; }).catch(function () { /* optional */ });
    } catch (err) { /* optional */ }
  });

  // Every finished play of this game so far, for the announcer's longer pieces.
  var results = [];
  // The intro, the halftime report and the wrap, from js/announcer/ when it has them.
  function piece(name, score) {
    var ann = window.FF_ANNOUNCER;
    if (seeking || !ann || typeof ann[name] !== 'function') return '';
    try { return ann[name]({ teams: TEAMS, score: score || [0, 0], style: ann.style, leaders: [], plays: results.slice(), profiles: PROFILES, hidden: !!(window.__app && window.__app.masked) }) || ''; }
    catch (err) { return ''; }
  }

  // The line for a finished play, from js/announcer/ when it is loaded.
  function announce(res, score) {
    var ann = window.FF_ANNOUNCER;
    if (seeking || !ann || !ann.line) return '';
    try { return ann.line(res, { teams: TEAMS, score: score, style: ann.style, profiles: PROFILES }) || ''; }
    catch (err) { return ''; }
  }

  function say(text) {
    if (seeking || !text || !active || !VOICE || SPEED > 2 || !('speechSynthesis' in window)) return;
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
    disp.dd = downText(st.e.t, res.pre);
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

  // The line under the score bug: down and distance and where the ball is, like a broadcast.
  function ord(n) { return n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : n + 'TH'; }
  function downText(kind, pre) {
    if (kind === 'kickoff') return 'KICKOFF';
    if (kind === 'xp') return 'EXTRA POINT';
    if (!pre || !pre.down) return '';
    var on = pre.ballOn, spot = on === 50 ? '50' : (on < 50 ? TEAMS[pre.poss].id + ' ' + on : TEAMS[1 - pre.poss].id + ' ' + (100 - on));
    var togo = on + pre.toGo >= 100 ? 'GOAL' : String(pre.toGo);
    return ord(pre.down) + ' & ' + togo + '   ' + spot;
  }

  function reset() {
    state = Rules.create(TEAMS);
    si = 0; clock = 0; camSet = false;
    disp.score = [0, 0]; disp.poss = -1; disp.banner = null; disp.lines = null; disp.floaters = [];
    disp.ticker = null; disp.scoreAt = [-9, -9]; disp.dd = ''; disp.flash = -9;
    log.length = 0; results.length = 0;
    if (window.FF_ANNOUNCER && window.FF_ANNOUNCER.reset) { try { window.FF_ANNOUNCER.reset(); } catch (err) { /* optional */ } }
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

  // The camera follows the ball on both axes and never shows past the stands (as soccer's does).
  function updateCamera(realDt) {
    var b = Plays.ballAt(play, pt);
    var tx = clamp(ST.wx(b.x) - W / 2, 0, stadium.W - W);
    var ty = stadium.H > H ? clamp(ST.wy(b.y) - H * 0.52, 0, stadium.H - H) : (stadium.H - H) / 2;
    if (!camSet || CALM) { camX = tx; camY = ty; camSet = true; return; }
    var k = 1 - Math.exp(-realDt * 3.5 * Math.max(1, SPEED));
    camX += (tx - camX) * k; camY += (ty - camY) * k;
  }

  // -------------------------------------------------------------- draw

  var ox = 0, oy = 0;   // camera offset for this frame, whole pixels, shake included
  function sx(x) { return Math.round(ST.wx(x)) - ox; }
  function sy(y) { return Math.round(ST.wy(y)) - oy; }
  function ease(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function text(str, x, y, o) { return Font.draw(g, str, x, y, o); }

  // Carrier ring under the feet: a pixel ellipse, built once (the same as soccer's).
  var RING = (function () {
    var pts = [], seen = {};
    for (var t = 0; t < Math.PI * 2; t += 0.05) {
      var x = Math.round(Math.cos(t) * 5) * 2, y = Math.round(Math.sin(t) * 2) * 2, k = x + ',' + y;
      if (!seen[k]) { seen[k] = 1; pts.push([x, y]); }
    }
    return pts;
  })();

  function drawField() {
    g.fillStyle = INK; g.fillRect(0, 0, W, H);
    g.drawImage(stadium.canvas, -ox, -oy);
  }

  function drawLines() {
    var L = disp.lines;
    if (!L) return;
    var x0 = sx(0), fw = sx(FIELD_W) - x0, y = sy(L.los);
    // Line of scrimmage in blue, line to gain in yellow, both 2 pixels like the painted lines.
    g.fillStyle = 'rgba(70,150,255,0.95)';
    g.fillRect(x0, y - 1, fw, 2);
    if (L.fd !== null) {
      var fy = sy(L.fd);
      g.fillStyle = 'rgba(255,226,0,0.95)';
      g.fillRect(x0, fy - 1, fw, 2);
      // The chain crew's stick on the far sideline.
      g.fillStyle = INK; g.fillRect(x0 + fw + 5, fy - 7, 4, 14);
      g.fillStyle = '#ff7a1a'; g.fillRect(x0 + fw + 6, fy - 6, 2, 12);
    }
    if (L.down) {
      // Sideline down marker, like the one the chain crew holds.
      var mx = x0 - 13;
      g.fillStyle = INK; g.fillRect(mx - 1, y - 9, 14, 18);
      g.fillStyle = '#ff7a1a'; g.fillRect(mx, y - 8, 12, 16);
      text(String(L.down), mx + 6, y - 7, { unit: 2, color: INK, align: 'center' });
    }
  }

  function drawFlags() {
    for (var i = 0; i < play.flags.length; i++) {
      var f = play.flags[i];
      if (f.t > pt) continue;
      var x = sx(f.x), y = sy(f.y);
      g.fillStyle = '#3a2d00'; g.fillRect(x - 4, y - 4, 8, 8);
      g.fillStyle = FLAG; g.fillRect(x - 3, y - 3, 6, 6);
    }
  }

  function drawPlayer(a, isCarrier) {
    var px = sx(a.x), py = sy(a.y);
    if (py < -40 || py > H + 40) return;
    var colors = TEAMS[a.team].colors;
    var frame = a.moving && a.state !== 'down' ? (Math.floor(clock * 9 + a.phase) % 2 ? 'a' : 'b') : 'stand';
    var img = Spr.get(a.team, colors, a.view, frame, a.tone, a.state === 'celebrate' ? 'up' : undefined);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(px - 6, py, 12, 2); g.fillRect(px - 4, py + 2, 8, 2);
    if (isCarrier && Math.floor(clock * 4) % 2 === 0) {
      g.fillStyle = AMBER;
      for (var i = 0; i < RING.length; i++) g.fillRect(px + RING[i][0] - 1, py + 1 + RING[i][1], 2, 2);
    }
    if (a.state === 'down') {
      g.save(); g.translate(px, py - 4); g.rotate(Math.PI / 2);
      g.drawImage(img, -8, -11, 16, 22);
      g.restore();
    } else {
      var hop = a.state === 'celebrate' ? Math.round(Math.abs(Math.sin(clock * 9)) * 3) * 2 : 0;
      g.drawImage(img, px - 8, py - 20 - hop, 16, 22);
    }
  }

  // One plate per fantasy player: a team-colored edge and the surname, as in the soccer view.
  function drawLabel(a, isCarrier) {
    var L = a.label;
    var px = sx(a.x), py = sy(a.y);
    if (py < -40 || py > H + 40) return;
    var top = py - 24;
    if (L && a.tag) {
      var name = String(L.name).toUpperCase(), tw = Font.width(name, 1), w = tw + 9, x = Math.round(px - w / 2), y = py + 5;
      g.fillStyle = isCarrier ? AMBER : 'rgba(11,13,14,0.86)';
      g.fillRect(x, y, w, 11);
      g.fillStyle = isCarrier ? INK : L.color;
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
    var x, y, s = 1;
    if (b.holder) {
      var down = b.holder.state === 'down';
      x = sx(b.holder.x) + (down ? 7 : 6); y = sy(b.holder.y) - (down ? 2 : 9);
    } else {
      x = sx(b.x); y = sy(b.y);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x - 3, y - 1, 6, 2);
      y -= Math.round(b.z + 3); s = b.z > 25 ? 2 : 1;
    }
    // A pixel football: brown with a white lace, twice the size when it is high in the air.
    g.fillStyle = '#3a1d08';
    g.fillRect(x - 2 * s - 1, y - 3 * s, 4 * s + 2, 6 * s); g.fillRect(x - 1 * s, y - 4 * s - 1, 2 * s, 8 * s + 2);
    g.fillStyle = '#7a3d12';
    g.fillRect(x - 2 * s, y - 3 * s, 4 * s, 6 * s);
    g.fillRect(x - 1 * s, y - 4 * s, 2 * s, 8 * s);
    g.fillStyle = '#ffffff';
    g.fillRect(x - Math.max(1, s) / 2, y - 2 * s, Math.max(1, s), 4 * s);
  }

  function drawFloaters() {
    disp.floaters = disp.floaters.filter(function (f) { return clock - f.t0 < 1.7; });
    disp.floaters.forEach(function (f) {
      var age = clock - f.t0;
      if (age < 0) return;
      var x = sx(f.x), y = sy(f.y) - 46 - (CALM ? 0 : Math.round(age * 8) * 2);
      g.globalAlpha = CALM ? 1 : clamp((1.7 - age) / 0.5, 0, 1);
      text(f.text, x, y, { unit: 2, color: f.good ? '#8dff6e' : '#ff6a5c', align: 'center', shadow: INK });
      g.globalAlpha = 1;
    });
  }

  function chip(team, x, y, size) {
    var c = TEAMS[team].colors;
    g.fillStyle = RULE; g.fillRect(x - 1, y - 1, size + 2, size + 2);
    g.fillStyle = c.jersey; g.fillRect(x, y, size, size);
    g.fillStyle = c.helmet; g.fillRect(x, y, size, 2); g.fillRect(x + size / 2 - 1, y + 2, 2, size - 2);
  }

  // Broadcast score bug, the same as soccer's: half, home, score, score, away; the down and
  // distance under it; the sample tag on the right.
  function drawScore() {
    var x = 8, y = 8, h = 22;
    var tag = mode === 'final' ? tr('FINAL') : mode === 'inter' ? tr('HALF') : (state.half === 2 ? '2H' : '1H');
    var cw = Math.max(34, Font.width(tag, 2) + 12);
    g.fillStyle = AMBER; g.fillRect(x, y, cw, h);
    text(tag, x + cw / 2, y + 4, { unit: 2, color: INK, align: 'center' });
    x += cw;
    var codes = [TEAMS[0].id, TEAMS[1].id], codeW = Math.max(Font.width(codes[0], 2), Font.width(codes[1], 2));
    var nw = Math.max(20, Font.width(String(Math.max(disp.score[0], disp.score[1])), 2) + 8);
    var bw = 4 + 8 + codeW + 8 + nw + 2 + nw + 8 + codeW + 8 + 4;
    g.fillStyle = PANEL; g.fillRect(x, y, bw, h);
    g.fillStyle = TEAMS[0].colors.jersey; g.fillRect(x, y, 4, h);
    g.fillStyle = TEAMS[1].colors.jersey; g.fillRect(x + bw - 4, y, 4, h);
    text(codes[0], x + 12, y + 4, { unit: 2, color: TEXT });
    text(codes[1], x + bw - 12, y + 4, { unit: 2, color: TEXT, align: 'right' });
    // The team with the ball gets an amber mark under its code.
    if (disp.poss === 0 && mode === 'play') { g.fillStyle = AMBER; g.fillRect(x + 12, y + h - 3, codeW, 2); }
    if (disp.poss === 1 && mode === 'play') { g.fillStyle = AMBER; g.fillRect(x + bw - 12 - codeW, y + h - 3, codeW, 2); }
    var sx0 = x + 12 + codeW + 8;
    for (var i = 0; i < 2; i++) {
      var bx = sx0 + i * (nw + 2), hot = clock - disp.scoreAt[i] < 2.4 && Math.floor((clock - disp.scoreAt[i]) * 6) % 2 === 0;
      g.fillStyle = hot ? AMBER : '#1e2225'; g.fillRect(bx, y, nw, h);
      text(String(disp.score[i]), bx + nw / 2, y + 4, { unit: 2, color: hot ? INK : TEXT, align: 'center' });
    }
    var label = mode === 'final' ? tr('FINAL') : mode === 'inter' ? tr('HALFTIME') : tr(disp.dd);
    if (label) {
      var lw = Font.width(label, 1, 1) + 10;
      g.fillStyle = PANEL; g.fillRect(8, y + h, lw, 13);
      text(label, 13, y + h + 3, { color: DIM, track: 1 });
    }
    var tag = sourceTag(), l1 = tr(tag[0]), l2 = tr(tag[1]), mw = Math.max(Font.width(l1, 1, 1), Font.width(l2, 1, 1)) + 10;
    g.fillStyle = PANEL; g.fillRect(W - 8 - mw, 8, mw, 22);
    text(l1, W - 13, 11, { color: DIM, align: 'right', track: 1 });
    text(l2, W - 13, 20, { color: DIM, align: 'right', track: 1 });
  }

  // Which team a banner is about, from its words ('TOUCHDOWN GOBLINS!', 'FUMBLE! PYTHONS BALL').
  function bannerTeam(str) {
    for (var t = 0; t < 2; t++) if (str.indexOf(TEAMS[t].name.toUpperCase()) >= 0) return t;
    return disp.poss;
  }

  // Banners wipe in from the left and out to the right, as in the soccer view. A touchdown fills
  // the width in the scoring team's colors; a flag is yellow; everything else is a dark plate.
  function drawBanner() {
    var B = disp.banner;
    if (!B || clock >= B.until || mode === 'inter' || mode === 'final') return;
    var raw = String(B.text), str = tr(raw), sub = B.sub ? tr(B.sub) : '';
    var big = /^TOUCHDOWN/.test(raw), flag = B.color === '#ffd400' || /^FLAG$/.test(raw);
    var team = bannerTeam(raw.toUpperCase()), tc = TEAMS[team >= 0 ? team : 0].colors;
    var pin = CALM ? 1 : ease((clock - B.t0) / 0.16), pout = CALM ? 0 : ease((clock - (B.until - 0.16)) / 0.16);
    var y = 52, unit = big ? 4 : 3, X0 = 0, BW = W, MID = W / 2;
    while (unit > 1 && Font.width(str, unit, 1) > BW - 28) unit--;
    var th = 7 * unit, h = th + (sub ? 14 : 0) + (big ? 24 : 16);
    g.save();
    g.beginPath(); g.rect(X0 + Math.round(BW * pout), y, Math.round(BW * (pin - pout)), h); g.clip();
    var slide = Math.round((1 - pin) * -24);
    if (big) {
      g.fillStyle = tc.jersey; g.fillRect(X0, y, BW, h);
      g.fillStyle = tc.helmet; g.fillRect(X0, y, BW, 2); g.fillRect(X0, y + h - 2, BW, 2);
      // Hazard stripes along the edges.
      for (var s1 = X0 + (CALM ? 0 : Math.floor(clock * 40) % 16) - 16; s1 < X0 + BW; s1 += 16) { g.fillRect(s1, y + 4, 8, 2); g.fillRect(s1 + 8, y + h - 6, 8, 2); }
      var flick = !CALM && clock - B.t0 < 0.6 && Math.floor((clock - B.t0) * 10) % 2 === 1;
      text(str, MID + slide, y + 12, { unit: unit, color: flick ? '#ffffff' : tc.helmet, align: 'center', track: 1, shadow: 'rgba(0,0,0,0.35)' });
      if (sub) text(sub, MID, y + 12 + th + 6, { color: tc.helmet, align: 'center', track: 1 });
    } else {
      g.fillStyle = PANEL; g.fillRect(X0, y, BW, h);
      var edge = flag ? FLAG : team >= 0 ? tc.jersey : AMBER;
      g.fillStyle = edge; g.fillRect(X0, y, BW, 2);
      var lx = X0 + 14;
      if (flag) { g.fillStyle = FLAG; g.fillRect(X0, y + 2, 6, h - 2); lx = X0 + 16; }
      else { g.fillStyle = edge; g.fillRect(X0, y + 2, 4, h - 2); }
      text(str, lx + slide, y + 9, { unit: unit, color: flag ? FLAG : TEXT, track: 1 });
      if (sub) text(sub, lx, y + 9 + th + 5, { color: DIM, track: 1 });
    }
    g.restore();
  }

  // Lower third: what just happened, with the team that had the ball.
  function drawTicker() {
    var T = disp.ticker;
    if (!T || mode === 'final' || mode === 'inter' || clock - T.t0 > 6) return;
    var h = 22, y = H - h - 52 + (CALM ? 0 : Math.round((1 - ease((clock - T.t0) / 0.2)) * (h + 12)));
    var tag = T.team >= 0 ? TEAMS[T.team].id : '--';
    var mw = Math.max(34, Font.width(tag, 2) + 12), x = 8, w = W - 16;
    g.fillStyle = AMBER; g.fillRect(x, y, mw, h);
    text(tag, x + mw / 2, y + 4, { unit: 2, color: INK, align: 'center' });
    g.fillStyle = PANEL; g.fillRect(x + mw, y, w - mw, h);
    g.fillStyle = T.team >= 0 ? TEAMS[T.team].colors.jersey : RULE; g.fillRect(x + mw, y, 3, h);
    var full = tr(T.text).toUpperCase(), room = w - mw - 18, unit = Font.width(full, 2) <= room ? 2 : 1;
    var str = full;
    while (Font.width(str, unit) > room && str.length > 4) str = str.slice(0, -2);
    if (str !== full) str = str.replace(/\s*\S?$/, '') + '..';
    text(str, x + mw + 10, y + (unit === 2 ? 4 : 8), { unit: unit, color: TEXT });
  }

  // How a team scored, from the score changes of the plays so far: '2 TD  1 FG  2 XP'.
  function scoring(team) {
    var n = { TD: 0, FG: 0, XP: 0, '2PT': 0 };
    results.forEach(function (r) {
      if (!r.pre || !r.pre.score || !r.post) return;
      var d = r.post.score[team] - r.pre.score[team];
      if (d === 6) n.TD++; else if (d === 3) n.FG++; else if (d === 1) n.XP++; else if (d === 2) n['2PT']++;
    });
    return Object.keys(n).filter(function (k) { return n[k]; }).map(function (k) { return n[k] + ' ' + k; }).join('  ');
  }

  // Halftime and the final: a full board over the field, left aligned, the same as soccer's.
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
      var sc = scoring(i);
      text(sc || tr('NO POINTS'), x + 24, y + 24, { color: sc ? DIM : RULE, track: 1 });
      y += 52;
    }
    g.fillStyle = RULE; g.fillRect(x, y, W - 2 * x, 2);
    y += 16;
    if (foot && (CALM || Math.floor(clock * 2) % 2 === 0)) text(foot, x, y, { unit: 2, color: TEXT, track: 1 });
    // The sample note, on two lines when it is too long for one (Spanish).
    var note = tr(sourceTag()[2]), ny = y + (foot ? 26 : 0);
    var parts = Font.width(note, 1) <= W - 2 * x ? [note] : note.split(/(?<=\.) /);
    parts.forEach(function (ln, k) { text(ln, x, ny + k * 11, { color: DIM }); });
  }

  function drawFinal() { drawBoard(tr('FINAL'), tr('Tap for the recap')); }

  function draw() {
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.imageSmoothingEnabled = false;
    g.lineJoin = 'round';
    // A touchdown shakes the camera for a moment, as a goal does in soccer.
    var shake = !CALM && clock - disp.flash < 0.45 ? Math.round((1 - (clock - disp.flash) / 0.45) * 2) * (Math.floor(clock * 60) % 2 ? 2 : -2) : 0;
    ox = Math.round(camX) + shake; oy = Math.round(camY);
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
    // And a white flash, as soccer's goal.
    if (clock - disp.flash < 0.22) { g.fillStyle = 'rgba(255,255,255,' + (0.5 * (1 - (clock - disp.flash) / 0.22)).toFixed(3) + ')'; g.fillRect(0, 0, W, H); }
    drawScore();
    drawBanner();
    drawTicker();
    if (mode === 'inter') drawBoard(tr('HALFTIME'), '');
    if (mode === 'final') drawFinal();
  }

  // -------------------------------------------------------------- loop

  var lastNow = 0;
  function frame(now) {
    var real = Math.min(0.05, Math.max(0, (now - lastNow) / 1000));
    lastNow = now;
    try {
      update(mode === 'ready' || HOLD || (!active && !BACKGROUND) ? 0 : real * SPEED);
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
    // Jump to the start of play number `index` (from 1, counting plays only, not halftime). The plays before it
    // run at once: the app's listeners still get reset, snap, result and half for them, so its numbers stay
    // right, but there is no sound, voice, floater or banner. The game then plays on from that play at the
    // chosen speed. Returns true, or false if the index is not a play of this game. Seeking works before the
    // game has started (it starts it) and after the final (it plays that play again).
    seek: function (index) {
      var target = -1, n = 0;
      for (var k = 0; k < steps.length; k++) {
        if (steps[k].kind === 'play' && ++n === index) { target = k; break; }
      }
      if (target < 0 || index !== Math.floor(index)) return false;
      Snd.init();
      seeking = true;
      try {
        reset();
        emit('start');  // like restart(): listeners see the game as running again after the reset
        while (si < target) {
          if (mode === 'play') {
            var cues = play.cues;
            for (var c = 0; c < cues.length; c++) { if (!cues[c].done) { cues[c].done = true; cues[c].fn(); } }
          }
          si++;
          if (si < target) startStep();
          else break;
        }
      } finally { seeking = false; }
      disp.banner = null; disp.floaters = []; camSet = false;
      // One sentence from the announcer on what the jump skipped. It also fills the announcer's memory.
      var ann = window.FF_ANNOUNCER;
      if (ann && typeof ann.catchUp === 'function' && results.length) {
        try {
          say(ann.catchUp(results.slice(), { teams: TEAMS, score: disp.score.slice(), style: ann.style, leaders: [], hidden: !!(window.__app && window.__app.masked) }) || '');
        } catch (err) { /* optional */ }
      }
      if (si === target && steps[si] && (mode !== 'play' || log.length === 0 || log[log.length - 1].step !== si)) startStep();
      return true;
    },
    setFloaters: function (on) { FLOATERS = !!on; if (!FLOATERS) disp.floaters = []; },
    setBackground: function (on) { BACKGROUND = !!on; },
    // Stop (true) or release (false) the clock. The view stays open and the announcer finishes its line.
    hold: function (on) { HOLD = !!on; },
    get held() { return HOLD; },
    get calm() { return CALM; },
    get floaters() { return FLOATERS; },
    get background() { return BACKGROUND; },
    get mode() { return mode; },
    get seeking() { return seeking; },   // true while seek() runs the skipped plays (for js/audio.js)
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
