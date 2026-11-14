// Soccer viewer: feeds the sample events through the rules engine one at a
// time, asks the play library for a matching scripted move and draws it.
// Same pattern as js/main.js for football, so the app can drive both.
(function () {
  'use strict';

  var D = window.SC_DATA, Rules = window.SC_RULES, Plays = window.SC_PLAYS, Spr = window.SC_SPRITES;
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
  var rng = mulberry32(SEED);

  // Logical canvas size. The width is fixed, the height follows the phone.
  var W = 390, H = 844, SCALE = 1;
  var PX = 5.25, PY = 9.2, PAD = 70;      // pixels per meter across and along the pitch
  var MX = (W - WID * PX) / 2;
  var FONT = '"Courier New", ui-monospace, Menlo, Consolas, monospace';

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
  function initials(name) {
    return name.split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }
  function makeTeam(ti) {
    var T = TEAMS[ti], s = {}, list = [];
    Rules.SLOTS.forEach(function (slot, i) {
      var n = all.length, own = T.fantasy.indexOf(slot) >= 0;
      var a = {
        team: ti, role: slot, keeper: slot === 'GK', tone: (n * 7) % 3, hair: (n * 5) % Spr.HAIRS, phase: n * 0.37,
        jx: ((n * 37) % 7) / 2 - 1.5, jy: ((n * 53) % 7) / 2 - 1.5,
        x: WID / 2, y: LEN / 2, path: null, state: '', view: 'f', moving: false, num: [1, 3, 4, 5, 2, 8, 6, 10, 11, 9, 7][i],
        label: own ? { initials: initials(T.roster[slot]), name: Rules.lastName(T.roster[slot]), color: T.colors.tile } : null
      };
      s[slot] = a; list.push(a); all.push(a);
    });
    return { s: s, list: list };
  }
  var teams = [makeTeam(0), makeTeam(1)];

  // ------------------------------------------------------------- state

  var steps = Rules.flatten(D.SAMPLE_GAME, TEAMS);
  var state, si, play, pt, mode, clock = 0, interUntil = 0, cam = 0, camSet = false;
  var ball = { x: WID / 2, y: LEN / 2, holder: null }, spot = null, teleport = true;
  var disp = { score: [0, 0], min: 0, half: 1, banner: null };
  var log = [], errors = [];
  var active = false, listeners = [];

  function emit(type, data) {
    listeners.forEach(function (fn) {
      try { fn(type, data || {}); }
      catch (err) { errors.push(String(err && err.stack || err)); console.error(err); }
    });
  }

  var fx = {
    sound: function (name) { if (active && window.SC_SOUND) { try { window.SC_SOUND.play(name); } catch (err) { /* optional */ } } },
    banner: function (text, sub, secs, color) {
      disp.banner = { text: text, sub: sub || '', until: clock + secs, color: color || '#ffffff' };
    },
    result: function (res, p) {
      disp.score = res.post.score.slice();
      if (res.say) say(res.say);
      emit('result', { res: res, play: p.name, step: si });
    }
  };

  function say(text) {
    if (!active || !VOICE || SPEED > 2 || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 1.15;
      window.speechSynthesis.speak(u);
    } catch (err) { /* the announcer is optional */ }
  }

  function scoreText() { return TEAMS[0].id + ' ' + disp.score[0] + '   ' + TEAMS[1].id + ' ' + disp.score[1]; }
  function spokenScore() { return TEAMS[0].name + ' ' + disp.score[0] + ', ' + TEAMS[1].name + ' ' + disp.score[1] + '.'; }

  // An empty play that just holds everyone where they are (half time, final).
  function stillPlay() {
    all.forEach(function (a) { a.path = [{ t: 0, x: a.x, y: a.y }]; });
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
      fx.banner('HALF TIME', scoreText(), 3.2);
      say('Half time. ' + spokenScore());
      teleport = true; ball = { x: WID / 2, y: LEN / 2, holder: null };
      log.push({ step: si, text: 'HALF TIME', score: disp.score.slice() });
      emit('half', { score: disp.score.slice() });
      return;
    }
    if (st.kind === 'final') {
      play = stillPlay(); pt = 0;
      mode = 'final'; disp.banner = null; disp.min = 90;
      say('Full time. ' + spokenScore());
      log.push({ step: si, text: 'FULL TIME', score: state.score.slice() });
      emit('final', { score: state.score.slice() });
      return;
    }
    var res = Rules.apply(state, st.e, st.team);
    var p = Plays.build(st.e, res, {
      rng: rng, fx: fx, att: st.team, half: state.half, teams: teams, all: all,
      ball: ball, holder: ball.holder, spot: spot, teleport: teleport && st.e.t === 'kickoff'
    });
    if (st.e.t === 'kickoff') teleport = false;
    play = p; pt = 0; mode = 'play';
    disp.min = st.e.min; disp.half = state.half;
    log.push({ step: si, play: p.name, text: res.text, score: res.post.score.slice() });
    emit('snap', { res: res, play: p.name, step: si });
  }

  function endStep() {
    var b = Plays.ballAt(play, play.dur);
    ball = { x: b.x, y: b.y, holder: b.holder || null };
    spot = play.spot || null;
    si++;
    startStep();
  }

  function reset() {
    state = Rules.create(TEAMS);
    si = 0; clock = 0; camSet = false; teleport = true; spot = null;
    ball = { x: WID / 2, y: LEN / 2, holder: null };
    disp.score = [0, 0]; disp.min = 0; disp.half = 1; disp.banner = null;
    log.length = 0;
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
      if (pt >= play.dur) endStep();
    } else if (mode === 'inter') {
      clock += dt;
      if (clock >= interUntil) { si++; startStep(); }
    } else if (mode === 'final') {
      clock += dt;
    }
    for (var j = 0; j < all.length; j++) {
      var a = all[j], p = Plays.posAt(a, pt);
      a.x = p.x; a.y = p.y;
      a.moving = Math.abs(p.vx) + Math.abs(p.vy) > 0.6;
      if (a.moving) { if (Math.abs(p.vy) > 0.5) a.view = p.vy > 0 ? 'f' : 'b'; }
    }
  }

  function updateCamera(realDt) {
    var b = Plays.ballAt(play, pt);
    var target = sy0(b.y) - H * 0.5;
    target = clamp(target, 0, Math.max(0, sy0(LEN) + PAD - H));
    if (!camSet) { cam = target; camSet = true; }
    else cam += (target - cam) * (1 - Math.exp(-realDt * 4 * Math.max(1, SPEED)));
  }

  // -------------------------------------------------------------- draw

  function sx(x) { return MX + x * PX; }
  function sy0(y) { return PAD + y * PY; }
  function sy(y) { return sy0(y) - cam; }

  function line(x0, y0, x1, y1) { g.fillRect(sx(x0), sy(y0), Math.max(1.5, (x1 - x0) * PX), Math.max(1.5, (y1 - y0) * PY)); }
  function ell(cx, cy, r, a0, a1) { g.beginPath(); g.ellipse(sx(cx), sy(cy), r * PX, r * PY, 0, a0, a1); g.stroke(); }

  function drawPitch() {
    // Stadium floor, then the grass with mowing stripes past the lines.
    g.fillStyle = '#0b0d0e';
    g.fillRect(0, 0, W, H);
    var gx0 = sx(-3.5), gx1 = sx(WID + 3.5);
    for (var k = -2; k < 22; k++) {
      var y0 = sy(k * 5.25), y1 = sy((k + 1) * 5.25);
      if (y1 < 0 || y0 > H) continue;
      g.fillStyle = k % 2 === 0 ? '#2a6b33' : '#25622f';
      g.fillRect(gx0, y0, gx1 - gx0, y1 - y0 + 0.5);
    }
    // Advertising boards along both touchlines, team colors in blocks.
    for (var b = 0; b < 21; b++) {
      var by0 = sy(b * 5.25 - 3), by1 = sy(b * 5.25 + 2.25);
      if (by1 < 0 || by0 > H) continue;
      var c = TEAMS[b % 2].colors;
      g.fillStyle = b % 2 ? c.shirt : '#17191c';
      g.fillRect(gx0 - 6, by0, 4, by1 - by0); g.fillRect(gx1 + 2, by0, 4, by1 - by0);
    }
    g.fillStyle = 'rgba(255,255,255,0.88)';
    line(0, 0, WID, 0); line(0, LEN, WID, LEN);
    line(0, 0, 0, LEN); line(WID - 0.28, 0, WID, LEN);
    line(0, LEN / 2, WID, LEN / 2);
    [0, 1].forEach(function (end) {
      var y = end ? LEN : 0, s = end ? -1 : 1;
      function box(w, d) {
        var x0 = WID / 2 - w / 2, x1 = WID / 2 + w / 2, yy = y + s * d;
        line(x0, Math.min(y, yy), x0 + 0.28, Math.max(y, yy));
        line(x1 - 0.28, Math.min(y, yy), x1, Math.max(y, yy));
        line(x0, yy, x1, yy);
      }
      box(40.32, 16.5); box(18.32, 5.5);
      g.fillRect(sx(WID / 2) - 1.5, sy(y + s * 11) - 1.5, 3, 3);
    });
    g.strokeStyle = 'rgba(255,255,255,0.88)'; g.lineWidth = 1.5;
    ell(WID / 2, LEN / 2, 9.15, 0, Math.PI * 2);
    g.fillRect(sx(WID / 2) - 1.5, sy(LEN / 2) - 1.5, 3, 3);
    // Penalty arcs, outside the box only.
    var a = Math.acos(5.5 / 9.15);
    ell(WID / 2, 11, 9.15, Math.PI / 2 - a, Math.PI / 2 + a);
    ell(WID / 2, LEN - 11, 9.15, -Math.PI / 2 - a, -Math.PI / 2 + a);
    // Corner arcs.
    ell(0, 0, 1, 0, Math.PI / 2); ell(WID, 0, 1, Math.PI / 2, Math.PI);
    ell(0, LEN, 1, -Math.PI / 2, 0); ell(WID, LEN, 1, Math.PI, Math.PI * 1.5);
  }

  function drawGoal(end) {
    var y = end ? LEN : 0, s = end ? 1 : -1, x0 = sx(WID / 2 - 3.66), x1 = sx(WID / 2 + 3.66);
    var yl = sy(y), yb = sy(y + s * 2.2);
    if (Math.max(yl, yb) < -10 || Math.min(yl, yb) > H + 10) return;
    var hit = play.netHit !== undefined && pt >= play.netHit && pt < play.netHit + 0.8 && Math.abs(Plays.ballAt(play, pt).y - y) < 3;
    var top = Math.min(yl, yb), h = Math.abs(yb - yl);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(x0, top, x1 - x0, h);
    g.strokeStyle = hit ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    for (var x = x0; x <= x1; x += 4) { g.beginPath(); g.moveTo(x + 0.5, top); g.lineTo(x + 0.5, top + h); g.stroke(); }
    for (var yy = top; yy <= top + h; yy += 4) { g.beginPath(); g.moveTo(x0, yy + 0.5); g.lineTo(x1, yy + 0.5); g.stroke(); }
    g.fillStyle = '#ffffff';
    g.fillRect(x0 - 2, yl - 2, 4, 4); g.fillRect(x1 - 2, yl - 2, 4, 4);
    g.fillRect(x0 - 1, top, 2, h); g.fillRect(x1 - 1, top, 2, h);
    g.fillRect(x0, yb - 1, x1 - x0, 2);
  }

  function drawMarks() {
    play.marks.forEach(function (m) {
      if (m.kind !== 'offside' || pt < m.t) return;
      var y = Math.round(sy(m.y));
      g.fillStyle = 'rgba(255,212,0,0.75)';
      for (var x = sx(0); x < sx(WID); x += 10) g.fillRect(x, y - 1, 6, 2);
      // Assistant referee's flag on the touchline, raised.
      var fx0 = Math.round(sx(m.x)) + (m.x > 0 ? 4 : -12);
      g.fillStyle = '#d9d9d9'; g.fillRect(fx0 + 3, y - 18, 2, 18);
      g.fillStyle = '#ffd400'; g.fillRect(fx0 + 5, y - 18, 7, 6);
      g.fillStyle = '#ff3b30'; g.fillRect(fx0 + 5, y - 18, 3, 3); g.fillRect(fx0 + 8, y - 15, 4, 3);
    });
  }

  function drawPlayer(a, isCarrier) {
    var px = Math.round(sx(a.x)), py = Math.round(sy(a.y));
    if (py < -40 || py > H + 40) return;
    var colors = TEAMS[a.team].colors;
    var still = a.state === 'down' || a.state === 'dive';
    var frame = a.moving && !still ? (Math.floor(clock * 10 + a.phase) % 2 ? 'a' : 'b') : 'stand';
    var img = Spr.get(a.team, colors, a.keeper, a.view, frame, a.tone, a.hair);
    g.fillStyle = 'rgba(0,0,0,0.32)';
    g.fillRect(px - 7, py, 14, 3);
    if (isCarrier) {
      var pulse = 0.5 + 0.5 * Math.sin(clock * 10);
      g.strokeStyle = 'rgba(255,230,0,' + (0.65 + 0.35 * pulse) + ')';
      g.lineWidth = 2;
      g.beginPath(); g.ellipse(px, py + 1, 11 + pulse * 2, 5 + pulse, 0, 0, Math.PI * 2); g.stroke();
    }
    if (still) {
      g.save(); g.translate(px, py - 5); g.rotate((a.state === 'dive' ? (a.diveDir || 1) : 1) * Math.PI / 2);
      g.drawImage(img, -8, -11, 16, 22);
      g.restore();
    } else {
      var hop = a.state === 'celebrate' ? Math.abs(Math.sin(clock * 9)) * 7 : 0;
      g.drawImage(img, px - 8, py - 20 - hop, 16, 22);
    }
  }

  function drawLabel(a, isCarrier) {
    var L = a.label, px = Math.round(sx(a.x)), py = Math.round(sy(a.y));
    if (py < -40 || py > H + 40) return;
    var top = py - 22;
    if (L) {
      var tx = px - 7, ty = top - 15;
      g.fillStyle = L.color; g.fillRect(tx, ty, 14, 14);
      g.strokeStyle = isCarrier ? '#ffe600' : '#ffffff'; g.lineWidth = 1;
      g.strokeRect(tx + 0.5, ty + 0.5, 13, 13);
      g.textAlign = 'center';
      g.fillStyle = '#ffffff'; g.font = 'bold 8px ' + FONT;
      g.fillText(L.initials, px, ty + 10);
      g.font = 'bold 9px ' + FONT;
      g.lineWidth = 2.5; g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.strokeText(L.name.toUpperCase(), px, py + 11);
      g.fillStyle = isCarrier ? '#ffe600' : '#ffffff';
      g.fillText(L.name.toUpperCase(), px, py + 11);
      top = ty;
    }
    play.cards.forEach(function (c) {
      if (c.a !== a || pt < c.t0) return;
      g.fillStyle = '#111'; g.fillRect(px + 9, top - 1, 9, 12);
      g.fillStyle = c.color; g.fillRect(px + 10, top, 7, 10);
    });
    if (isCarrier) {
      var bob = Math.sin(clock * 8) * 2;
      g.fillStyle = '#ffe600';
      g.beginPath();
      g.moveTo(px - 5, top - 9 + bob); g.lineTo(px + 5, top - 9 + bob); g.lineTo(px, top - 3 + bob);
      g.closePath(); g.fill();
    }
  }

  function drawBall(b) {
    var x = sx(b.x), y = sy(b.y), s = 1 + b.z / 9;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(Math.round(x) - 2, Math.round(y), 5, 2);
    y -= b.z * PY * 0.55;
    x = Math.round(x); y = Math.round(y);
    var r = Math.round(3 * s);
    g.fillStyle = '#111';
    g.fillRect(x - r, y - r + 1, 2 * r, 2 * r - 2); g.fillRect(x - r + 1, y - r, 2 * r - 2, 2 * r);
    g.fillStyle = '#ffffff';
    g.fillRect(x - r + 1, y - r + 2, 2 * r - 2, 2 * r - 4); g.fillRect(x - r + 2, y - r + 1, 2 * r - 4, 2 * r - 2);
    g.fillStyle = '#1a1a1a';
    g.fillRect(x - 1, y - 1, 2, 2);
  }

  function drawScore() {
    var x = 8, y = 8, w = 104, h = 58;
    g.fillStyle = 'rgba(8,10,11,0.86)'; g.fillRect(x, y, w, h);
    g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    for (var i = 0; i < 2; i++) {
      var ry = y + 5 + i * 16, c = TEAMS[i].colors;
      g.fillStyle = c.shirt; g.fillRect(x + 5, ry, 12, 12);
      g.fillStyle = c.trim; g.fillRect(x + 5, ry, 12, 3);
      g.fillStyle = '#ffffff'; g.font = 'bold 14px ' + FONT;
      g.textAlign = 'left'; g.fillText(TEAMS[i].id, x + 22, ry + 11);
      g.textAlign = 'right'; g.fillText(String(disp.score[i]), x + w - 8, ry + 11);
    }
    g.fillStyle = '#ffc21a'; g.fillRect(x + 5, y + 39, w - 10, 1);
    g.textAlign = 'left'; g.fillStyle = '#ffc21a'; g.font = 'bold 12px ' + FONT;
    var minute = mode === 'final' ? 'FT' : mode === 'inter' ? 'HT' : disp.min + "'";
    g.fillText(minute, x + 5, y + 52);
    g.textAlign = 'right'; g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = 'bold 7px ' + FONT;
    g.fillText('SAMPLE, MOCK DATA', x + w - 6, y + 51);
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
    var bw = Math.max(tw, sw) + 24, bh = b.sub ? 46 : 30, bx = Math.round((W - bw) / 2), by = 80;
    g.fillStyle = 'rgba(8,10,11,0.92)'; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = b.color; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.textAlign = 'center';
    g.fillStyle = b.color; g.font = 'bold ' + fs + 'px ' + FONT;
    g.fillText(b.text, W / 2, by + 20);
    if (b.sub) { g.fillStyle = '#ffffff'; g.font = 'bold 9px ' + FONT; g.fillText(b.sub, W / 2, by + 36); }
  }

  function drawFinal() {
    var bw = 250, bh = 168, bx = (W - bw) / 2, by = Math.round(H / 2 - bh / 2);
    g.fillStyle = 'rgba(8,10,11,0.93)'; g.fillRect(bx, by, bw, bh);
    g.strokeStyle = '#ffffff'; g.lineWidth = 2; g.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    g.textAlign = 'center';
    g.fillStyle = '#ffe600'; g.font = 'bold 24px ' + FONT; g.fillText('FULL TIME', W / 2, by + 36);
    g.font = 'bold 18px ' + FONT;
    for (var i = 0; i < 2; i++) {
      g.fillStyle = '#ffffff';
      g.textAlign = 'left'; g.fillText(TEAMS[i].name.toUpperCase(), bx + 26, by + 72 + i * 28);
      g.textAlign = 'right'; g.fillText(String(disp.score[i]), bx + bw - 26, by + 72 + i * 28);
    }
    g.textAlign = 'center';
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = 'bold 10px ' + FONT;
    g.fillText('Sample match. Mock data.', W / 2, by + 128);
    g.fillText('Tap for the recap', W / 2, by + 148);
  }

  function draw() {
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    g.imageSmoothingEnabled = false;
    g.lineJoin = 'round';
    drawPitch();
    drawGoal(0);
    drawMarks();
    var b = Plays.ballAt(play, pt);
    var carrier = b.holder && b.hl ? b.holder : null;
    var list = all.slice().sort(function (p, r) { return p.y - r.y; });
    var i;
    for (i = 0; i < list.length; i++) drawPlayer(list[i], list[i] === carrier);
    drawGoal(1);
    for (i = 0; i < list.length; i++) drawLabel(list[i], list[i] === carrier);
    drawBall(b);
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
      update(mode === 'ready' ? 0 : real * SPEED);
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
      emit('start');
    },
    restart: function () {
      reset();
      emit('start');
    },
    setActive: function (on) {
      active = !!on;
      if (active) { camSet = false; resize(); }
      else if ('speechSynthesis' in window) { try { window.speechSynthesis.cancel(); } catch (err) { /* optional */ } }
    },
    get mode() { return mode; },
    get active() { return active; },
    get plays() { return steps.filter(function (st) { return st.kind === 'play'; }).length; }
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
