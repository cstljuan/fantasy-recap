// Soccer play library. Each entry is a scripted move with a name, the kind of
// event it can act out and a condition on that event. build() picks one at
// random (weighted) among the entries that fit, then the script lays out a
// path for all 22 players and for the ball.
//
// Coordinates are meters on the pitch: x from 0 to 68 across, y from 0 to 105
// down the screen. Inside a script, a team's own frame is used:
//   F  = meters from that team's own goal line toward the goal it attacks
//   lx = meters to that team's right (negative) or left (positive) of the middle
// Teams change ends at half time, so P.at() and P.F() know the half.
(function (root) {
  'use strict';

  var LEN = 105, WID = 68, CX = 34;
  var GOAL_HALF = 3.66;   // half the goal width

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }

  // Base 4-3-3. [lx, line] where line is 0 back, 1 middle, 2 front.
  var BASE = {
    GK: [0, 0], LB: [-24, 0], CB1: [-8, 0], CB2: [8, 0], RB: [24, 0],
    CM1: [-14, 1], CM2: [0, 1], CM3: [14, 1], LW: [-23, 2], ST: [0, 2], RW: [23, 2]
  };
  var GAP_ATT = [0, 17, 33], GAP_DEF = [0, 11, 23];

  // ---------------------------------------------------------------- Play

  function Play(ctx, name) {
    this.ctx = ctx; this.rng = ctx.rng; this.fx = ctx.fx; this.name = name;
    this.half = ctx.half; this.att = ctx.att; this.T = ctx.teams; this.all = ctx.all;
    this.actors = ctx.all;
    this.ball = []; this.cues = []; this.marks = []; this.cards = [];
    this.dur = 4; this.tEnd = 3; this.spot = null;
    this.ball0 = { x: ctx.ball.x, y: ctx.ball.y };
    this.holder0 = ctx.holder || null;
    // Every player starts where the last play left them.
    this.all.forEach(function (a) { a.path = [{ t: 0, x: a.x, y: a.y }]; a.state = ''; });
  }

  Play.prototype.down = function (team) { return (team === 0) === (this.half === 1); };

  Play.prototype.at = function (team, F, lx) {
    var dn = this.down(team);
    return { x: clamp(CX + (dn ? -lx : lx), 0.6, WID - 0.6), y: clamp(dn ? F : LEN - F, -2.5, LEN + 2.5) };
  };
  Play.prototype.F = function (team, y) { return this.down(team) ? y : LEN - y; };
  Play.prototype.LX = function (team, x) { return this.down(team) ? CX - x : x - CX; };

  Play.prototype.last = function (a) { return a.path[a.path.length - 1]; };

  // Run to a point by time t, no faster than `speed` meters per second.
  // speed 'cut' places the player there from the start, like a camera cut to a set piece.
  Play.prototype.go = function (a, t, p, speed) {
    if (speed === 'cut') { a.path = [{ t: 0, x: p.x, y: p.y }]; return 0; }
    var l = this.last(a);
    if (t < l.t + 0.01) t = l.t + 0.01;
    var max = (speed || 8.5) * (t - l.t), dx = p.x - l.x, dy = p.y - l.y, d = Math.sqrt(dx * dx + dy * dy);
    var x = p.x, y = p.y;
    if (d > max && d > 0) { x = l.x + dx * max / d; y = l.y + dy * max / d; }
    a.path.push({ t: t, x: x, y: y });
    return t;
  };

  Play.prototype.hold = function (a, t) {
    var l = this.last(a);
    if (t > l.t) a.path.push({ t: t, x: l.x, y: l.y });
  };
  Play.prototype.holdAll = function (t) {
    for (var i = 0; i < this.all.length; i++) this.hold(this.all[i], t);
  };

  Play.prototype.cue = function (t, fn) { this.cues.push({ t: t, fn: fn, done: false }); };

  // Ball segments, in time order.
  Play.prototype.held = function (t, a, highlight) { this.ball.push({ t: t, kind: 'held', a: a, hl: highlight !== false }); };
  Play.prototype.kick = function (t0, t1, to, h) {
    var s = { t: t0, t1: t1, kind: 'move', h: h || 0 };
    if (to.path) s.a = to; else s.to = { x: to.x, y: to.y };
    this.ball.push(s);
  };
  Play.prototype.place = function (t, p) { this.ball.push({ t: t, kind: 'rest', x: p.x, y: p.y }); };

  // Where a player stands in the team shape, given where the ball is and who has it.
  Play.prototype.target = function (a, bx, by, attTeam) {
    var team = a.team, b = BASE[a.role], bF = this.F(team, by), bL = this.LX(team, bx), f, lx;
    if (a.role === 'GK') {
      f = team === attTeam ? clamp(bF * 0.2, 4, 18) : clamp(2.5 + bF * 0.05, 2.5, 7);
      lx = clamp(bL * 0.18, -3, 3);
      return this.at(team, f, lx);
    }
    if (team === attTeam) {
      var back = clamp(bF - 28, 12, 58);
      f = back + GAP_ATT[b[1]];
      if (b[1] === 2) f = Math.max(f, Math.min(bF + 4, 90));
      lx = b[0] + bL * 0.3;
    } else {
      var back2 = clamp(bF - 12, 7, 36);
      f = back2 + GAP_DEF[b[1]];
      lx = b[0] * 0.75 + bL * 0.4;
    }
    return this.at(team, clamp(f + a.jy, 1, 100), clamp(lx + a.jx, -32, 32));
  };

  Play.prototype.shape = function (t, bx, by, attTeam, skip, speed) {
    for (var i = 0; i < this.all.length; i++) {
      var a = this.all[i];
      if (skip && skip.indexOf(a) >= 0) continue;
      this.go(a, t, this.target(a, bx, by, attTeam), speed);
    }
  };

  // The nearest defender steps in, on the goal side of the ball.
  Play.prototype.press = function (t, p, attTeam, skip) {
    var me = this, dt = 1 - attTeam, best = null, bd = 1e9;
    this.T[dt].list.forEach(function (a) {
      if (a.role === 'GK' || (skip && skip.indexOf(a) >= 0)) return;
      var d = d2(me.last(a), p);
      if (d < bd) { bd = d; best = a; }
    });
    if (!best) return null;
    var g = this.at(dt, 0, 0), dx = g.x - p.x, dy = g.y - p.y, dd = Math.sqrt(dx * dx + dy * dy) || 1;
    this.go(best, t, { x: p.x + dx / dd * 2.2, y: p.y + dy / dd * 2.2 }, 9);
    return best;
  };

  Play.prototype.nearest = function (list, p, skip) {
    var best = null, bd = 1e9, me = this;
    list.forEach(function (a) {
      if (skip && skip.indexOf(a) >= 0) return;
      var d = d2(me.last(a), p);
      if (d < bd) { bd = d; best = a; }
    });
    return best;
  };

  // Close the play: the result, the banners and the score.
  Play.prototype.finish = function (tEnd, res, opt) {
    var me = this, fx = this.fx;
    opt = opt || {};
    var tc = opt.callsAt === undefined ? tEnd + 0.1 : opt.callsAt;
    var secs = res.goal ? 2.0 : 1.2;
    this.cue(tEnd, function () { fx.result(res, me); });
    res.calls.forEach(function (c, i) {
      me.cue(tc + i * (secs + 0.1), function () { fx.banner(c, secs); });
    });
    this.tEnd = tEnd;
    this.dur = Math.max(tEnd + 0.8, tc + res.calls.length * (secs + 0.1) + 0.2, opt.minDur || 0);
  };

  // Get the ball to player `a` from wherever it is. Returns the time he has it.
  Play.prototype.collect = function (a, t0) {
    if (this.holder0 === a) { this.held(0, a); return 0; }
    var b = this.ball0, rng = this.rng;
    var meet = { x: clamp(b.x + rng() * 4 - 2, 1, WID - 1), y: clamp(b.y + rng() * 4 - 2, 1, LEN - 1) };
    var d = d2(this.last(a), meet);
    var tm = (t0 || 0) + clamp(d / 9, 0.5, 1.8);
    this.go(a, tm, meet, 11);
    var dk = d2(b, meet);
    this.kick((t0 || 0) + 0.05, tm, a, dk > 25 ? 3 + dk / 10 : 0);
    this.held(tm, a);
    return tm;
  };

  // ------------------------------------------------------------ scripts

  function kickoff(P, e, res) {
    var k = P.att, rng = P.rng, c = { x: CX, y: LEN / 2 }, tele = !!P.ctx.teleport;
    var ts = tele ? 1.2 : 2.0;
    P.place(0, c);
    P.all.forEach(function (a) {
      var tg = P.target(a, c.x, c.y, k), F = P.F(a.team, tg.y), lx = P.LX(a.team, tg.x);
      F = Math.min(F, a.team === k ? 50.5 : 42.5);
      if (a.team === k && a.role === 'ST') { F = 52; lx = 0.6; }
      if (a.team === k && a.role === 'CM2') { F = 48.5; lx = -1.5; }
      var p = P.at(a.team, F, lx);
      if (tele) a.path = [{ t: 0, x: p.x, y: p.y }];
      else P.go(a, ts - 0.3, p, 12);
    });
    P.holdAll(ts);
    var S = P.T[k].s, st = S.ST, cm = S.CM2, back = S[rng() < 0.5 ? 'CB1' : 'CB2'];
    P.kick(ts, ts + 0.5, cm, 0);
    P.held(ts + 0.5, cm);
    P.go(st, ts + 1.1, P.at(k, 60, 3), 8);
    var t2 = ts + 1.0, bp = P.at(k, 34, P.LX(k, P.last(back).x) * 0.8);
    P.go(back, t2 + 1.0, bp, 7);
    P.kick(t2, t2 + 1.0, back, 0);
    P.held(t2 + 1.0, back);
    P.shape(t2 + 1.2, bp.x, bp.y, k, [back]);
    P.press(t2 + 1.3, bp, k);
    P.finish(t2 + 1.3, res, { callsAt: 0.3 });
  }

  // Passes along the chain, each one moving the ball toward the zone named in `to`.
  function buildUp(P, e, res, v) {
    var team = P.att, rng = P.rng, S = P.T[team].s;
    var chain = e.chain.map(function (k) { return S[k]; });
    var zoneF = { mid: 56, att: 74, box: 87 }[e.to] || 60;
    var n = chain.length;
    var t = P.collect(chain[0]);
    var p0 = P.last(chain[0]);
    if (t > 0) P.shape(t, p0.x, p0.y, team, [chain[0]]);
    var startF = P.F(team, p0.y);
    for (var i = 1; i < n; i++) {
      var h = chain[i - 1], a = chain[i], hp = P.last(h);
      // Carry it forward a few strides, then release.
      var carry = v.long ? 1 + rng() * 2 : 2 + rng() * 4;
      var cp = P.at(team, Math.min(P.F(team, hp.y) + carry, 96), P.LX(team, hp.x) + rng() * 2 - 1);
      t = P.go(h, t + (v.long ? 0.35 : 0.55) + rng() * 0.3, cp, 7);
      var f = startF + (zoneF - startF) * (i / (n - 1));
      if (a.role === 'GK') f = 6;
      var base = P.target(a, cp.x, cp.y, team), lx = P.LX(team, base.x) + rng() * 6 - 3;
      if (a.role === 'ST') lx = rng() * 8 - 4;
      if (v.switchPlay && i === 1) lx = -Math.sign(P.LX(team, cp.x) || 1) * (18 + rng() * 8);
      var tg = P.at(team, Math.max(f, 4), lx);
      var dist = d2(cp, tg), travel = clamp(dist / 17, 0.5, 1.5), lofted = v.long || dist > 28;
      P.go(a, t + travel, tg, 9.5);
      P.kick(t, t + travel, a, lofted ? 2.5 + dist / 8 : 0);
      P.held(t + travel, a);
      P.shape(t + travel, tg.x, tg.y, team, [a]);
      P.press(t + travel + 0.35, tg, team);
      t += travel;
    }
    var lh = chain[n - 1], lp = P.last(lh);
    var endP = P.at(team, Math.min(P.F(team, lp.y) + 3, 97), P.LX(team, lp.x) * 0.85);
    t = P.go(lh, t + 0.7, endP, 7);
    P.shape(t, endP.x, endP.y, team, [lh]);
    P.press(t + 0.1, endP, team);
    P.finish(t, res);
  }

  function setupPenalty(P, team) {
    var opp = 1 - team, S = P.T[team].s, sh = S[P.ctx.e.by], spot = P.at(team, 94, 0), rng = P.rng;
    P.place(0, spot);
    var ts = 1.0;
    P.all.forEach(function (a) {
      if (a === sh) { P.go(a, 0, P.at(team, 91.8, -0.9), 'cut'); return; }
      if (a === P.T[opp].s.GK) { P.go(a, 0, P.at(team, 104.8, 0), 'cut'); return; }
      var tg = P.target(a, spot.x, spot.y, team), F = P.F(team, tg.y);
      if (a.role === 'GK') { P.go(a, 0, tg, 'cut'); return; }
      if (F > 86) tg = P.at(team, 84 - rng() * 5, clamp(P.LX(team, tg.x), -18, 18));
      P.go(a, 0, tg, 'cut');
    });
    P.holdAll(ts);
    P.go(sh, ts + 0.4, P.at(team, 93.4, -0.3), 6);
    return ts + 0.45;
  }

  function shot(P, e, res, v) {
    var team = P.att, opp = 1 - team, rng = P.rng, S = P.T[team].s, O = P.T[opp].s;
    var sh = S[e.by], gk = O.GK, t = 0, holder = P.holder0, fx = P.fx;
    var pen = e.t === 'pen', head = !!e.head;
    var setPiece = res.restart === 'fk' || res.restart === 'corner' || pen;
    if (pen) {
      t = setupPenalty(P, team);
    } else if (res.restart === 'fk' && holder !== sh && !head) {
      // Direct free kick: the ball is set, the kicker runs up.
      P.place(0, P.ball0);
      t = P.go(sh, 0.5, { x: P.ball0.x + (P.down(team) ? 0.3 : -0.3), y: P.ball0.y + (P.down(team) ? -0.6 : 0.6) }, 6);
    } else if (holder !== sh) {
      var as = e.assist ? S[e.assist] : (holder && holder.team === team ? holder : null);
      if (as && as !== holder) t = P.collect(as);
      if (!as) { t = P.collect(sh); }
      else {
        var ap = P.last(as);
        var spotF = head ? 92 + rng() * 5 : 80 + rng() * 9, slx = rng() * 16 - 8;
        var sp = P.at(team, spotF, slx);
        var dist = d2(ap, sp), travel = clamp(dist / 17, 0.55, 1.3) + (head ? 0.25 : 0);
        P.go(as, t + 0.3, { x: ap.x, y: ap.y }, 4);
        P.go(sh, t + travel, sp, 10);
        P.kick(t, t + travel, sh, head ? 5 + dist / 8 : (dist > 22 ? 2.5 : 0));
        t += travel;
        P.held(t, sh);
      }
    } else if (!head) {
      P.held(0, sh);
      var hp = P.last(sh), F0 = P.F(team, hp.y);
      var dp = P.at(team, clamp(F0 + 4, 0, 91), P.LX(team, hp.x) * 0.8);
      t = P.go(sh, 0.8, dp, 7);
    } else {
      P.held(0, sh);
      t = 0.15;
    }
    var spot = P.last(sh);
    if (!setPiece) P.shape(t, spot.x, spot.y, team, [sh, gk], 8);
    else P.holdAll(t);
    P.go(gk, t, P.at(team, 104.6, clamp(P.LX(team, spot.x) * 0.12, -2, 2)), 6);
    var ts = t + (head ? 0.02 : 0.25);
    var side = rng() < 0.5 ? -1 : 1, distToGoal = Math.max(6, 105 - P.F(team, spot.y));
    var travel = clamp(distToGoal / (v.power || 30), 0.32, 0.95), h = head ? 1.2 : (v.lift || 1.2) + rng() * 0.8;
    var te = ts + travel, endT, tgt;
    function dive(at, toward) {
      P.cue(at, function () { gk.state = 'dive'; gk.diveDir = toward; });
    }
    if (e.out === 'in') {
      tgt = P.at(team, 106.2, side * (1.1 + rng() * 2.2));
      P.kick(ts, te, tgt, h);
      var wrong = rng() < 0.5;
      P.go(gk, te, P.at(team, 104.6, wrong ? -side * 1.6 : side * 1.2), 9);
      dive(ts + travel * 0.5, P.LX(team, P.last(gk).x) > 0 ? 1 : -1);
      P.cue(te, function () { fx.sound('goal'); P.netHit = te; });
      endT = te + 0.4;
      // Celebration: the scorer runs for the corner, his teammates chase him.
      var cf = P.at(team, 99, (P.LX(team, spot.x) >= 0 ? 1 : -1) * 28);
      P.cue(te + 0.3, function () { sh.state = 'celebrate'; });
      P.go(sh, te + 2.4, cf, 7.5);
      P.T[team].list.forEach(function (a) {
        if (a === sh || a.role === 'GK') return;
        P.go(a, te + 3.0, { x: cf.x + rng() * 6 - 3, y: cf.y + (rng() * 6 - 3) }, 7.5);
      });
      P.cue(te + 0.8, function () { gk.state = 'down'; });
    } else if (e.out === 'saved') {
      tgt = P.at(team, 104.4, side * (0.5 + rng() * 2.6));
      P.go(gk, te, tgt, 14);
      if (Math.abs(P.LX(team, tgt.x)) > 1.2) dive(ts + travel * 0.4, P.LX(team, tgt.x) > 0 ? 1 : -1);
      P.kick(ts, te, gk, h);
      P.held(te, gk, false);
      P.cue(te + 0.9, function () { gk.state = ''; });
      endT = te + 0.3;
      P.go(gk, te + 1.6, P.at(team, 99, 0), 4);
    } else if (e.out === 'wide') {
      tgt = P.at(team, 108, side * (4.8 + rng() * 3));
      P.kick(ts, te + 0.1, tgt, h + 0.6);
      P.go(gk, te, P.at(team, 104.6, side * 2.2), 10);
      dive(ts + travel * 0.5, side * (P.down(team) ? -1 : 1));
      P.cue(te + 0.7, function () { gk.state = ''; });
      endT = te + 0.4;
    } else if (e.out === 'post') {
      tgt = P.at(team, 105, side * GOAL_HALF);
      P.kick(ts, te, tgt, 1.0);
      var reb = P.at(team, 90 - rng() * 6, side * (2 + rng() * 6));
      P.kick(te, te + 0.7, reb, 0.8);
      P.cue(te, function () { fx.sound('post'); });
      P.go(gk, te, P.at(team, 104.6, side * 1.8), 10);
      endT = te + 0.6;
    } else {
      // Blocked: the nearest defender throws himself in the way.
      var dx = P.at(team, 105, 0), dl = d2(spot, dx) || 1;
      var mid = { x: spot.x + (dx.x - spot.x) / dl * 2.6, y: spot.y + (dx.y - spot.y) / dl * 2.6 };
      var blk = P.nearest(P.T[opp].list.filter(function (a) { return a.role !== 'GK'; }), mid);
      P.go(blk, ts + 0.15, mid, 12);
      P.kick(ts, ts + 0.15, mid, 0.3);
      var defl = P.at(team, P.F(team, mid.y) + 6 + rng() * 6, P.LX(team, mid.x) + (rng() < 0.5 ? -1 : 1) * (8 + rng() * 6));
      P.kick(ts + 0.15, ts + 0.85, defl, 1.6);
      P.cue(ts + 0.15, function () { blk.state = 'down'; fx.sound('block'); });
      P.cue(ts + 1.3, function () { blk.state = ''; });
      endT = ts + 0.6;
    }
    P.cue(ts, function () { fx.sound('kick'); });
    P.finish(endT, res, { minDur: res.goal ? endT + 3.6 : 0 });
  }

  function corner(P, e, res) {
    var team = P.att, opp = 1 - team, rng = P.rng, S = P.T[team].s, O = P.T[opp].s;
    var kicker = S[e.by], side = P.LX(team, P.ball0.x) >= 0 ? 1 : -1;
    var cs = P.at(team, 104.6, side * 33.4);
    P.place(0, cs);
    var ts = 1.1;
    P.go(kicker, 0, P.at(team, 105.6, side * 34.2), 'cut');
    var boxSlots = ['CB1', 'CB2', 'ST', 'CM2', 'LW', 'RW', 'CM3'].filter(function (k) { return S[k] !== kicker; });
    if (e.to && boxSlots.indexOf(e.to) < 0) boxSlots.unshift(e.to);
    boxSlots = boxSlots.slice(0, 5);
    var spots = [[-5, 94], [-1.5, 97.5], [2.5, 95.5], [6, 93.5], [-8, 91]];
    var boxers = boxSlots.map(function (k, i) {
      var sp = spots[i], p = P.at(team, sp[1] + rng() * 2 - 1, sp[0] + rng() * 2 - 1);
      P.go(S[k], 0, p, 'cut');
      return S[k];
    });
    P.T[team].list.forEach(function (a) {
      if (a === kicker || boxers.indexOf(a) >= 0) return;
      var spot = a.role === 'GK' ? P.at(team, 32, 0) : a.role === 'CM1' || a.role === 'CM3' ? P.at(team, 80, rng() * 16 - 8) : P.at(team, 62, BASE[a.role][0] * 0.6);
      P.go(a, 0, spot, 'cut');
    });
    var defs = ['CB1', 'CB2', 'RB', 'LB', 'CM2', 'CM1', 'CM3', 'LW', 'RW', 'ST'].map(function (k) { return O[k]; });
    defs.forEach(function (a, i) {
      var p;
      if (i < boxers.length) { var bp = P.last(boxers[i]); p = { x: bp.x + (rng() - 0.5), y: bp.y + (P.down(team) ? 1.1 : -1.1) }; }
      else if (i === boxers.length) p = P.at(team, 104, side * 3.2);
      else if (i < boxers.length + 3) p = P.at(team, 85 - rng() * 3, rng() * 20 - 10);
      else p = P.at(team, 66, (i % 2 ? -1 : 1) * 10);
      P.go(a, 0, p, 'cut');
    });
    P.go(O.GK, 0, P.at(team, 104.2, side * 0.8), 'cut');
    P.holdAll(ts);
    var tc = ts + 0.35;
    P.go(kicker, tc, P.at(team, 104.9, side * 33.7), 6);
    var tEnd;
    if (e.to) {
      var r = S[e.to], sp = P.at(team, 94 + rng() * 3, rng() * 8 - 4);
      P.go(r, tc + 1.15, sp, 9);
      var mk = defs[boxers.indexOf(r)];
      if (mk) P.go(mk, tc + 1.15, { x: sp.x + 0.8, y: sp.y + (P.down(team) ? 0.9 : -0.9) }, 9);
      P.kick(tc, tc + 1.15, r, 7.5);
      P.held(tc + 1.15, r);
      tEnd = tc + 1.15;
    } else {
      var dfn = O.CB1, hp = P.at(team, 96, rng() * 6 - 3);
      P.go(dfn, tc + 1.1, hp, 9);
      P.kick(tc, tc + 1.1, hp, 7.5);
      var cl = P.at(team, 68 - rng() * 10, rng() * 30 - 15);
      P.kick(tc + 1.1, tc + 2.0, cl, 6);
      P.cue(tc + 1.1, function () { P.fx.sound('head'); });
      tEnd = tc + 2.0;
    }
    P.cue(tc, function () { P.fx.sound('kick'); });
    P.finish(tEnd, res, { callsAt: 0.2 });
  }

  function freekick(P, e, res) {
    var team = P.att, opp = 1 - team, rng = P.rng, S = P.T[team].s, O = P.T[opp].s, k = S[e.by];
    var spot = P.ctx.spot || P.ball0, sF = P.F(team, spot.y), sL = P.LX(team, spot.x);
    P.place(0, spot);
    var ts = 1.1;
    P.go(k, 0, P.at(team, sF - 2.2, sL - 0.6), 'cut');
    P.shape(0, spot.x, spot.y, team, [k], 'cut');
    if (sF > 66) {
      var dL = -sL, dF = 105 - sF, dd = Math.sqrt(dL * dL + dF * dF) || 1;
      var wF = sF + dF / dd * 9.15, wL = sL + dL / dd * 9.15, pL = dF / dd, pF = -dL / dd;
      ['CM1', 'CM2', 'CM3', 'ST'].forEach(function (s, i) {
        var o = (i - 1.5) * 0.9;
        P.go(O[s], 0, P.at(team, wF + pF * o, wL + pL * o), 'cut');
      });
      P.go(O.GK, 0, P.at(team, 104.4, clamp(-sL * 0.1, -1.5, 1.5)), 'cut');
    }
    P.holdAll(ts);
    var tEnd;
    if (e.to) {
      var r = S[e.to], tgF = sF > 60 ? 93 + rng() * 3 : Math.min(sF + 22, 90);
      var tg = P.at(team, tgF, rng() * 12 - 6), dist = d2(spot, tg), tr = clamp(dist / 16, 0.8, 1.5);
      P.go(k, ts + 0.3, { x: spot.x, y: spot.y - (P.down(team) ? 0.5 : -0.5) }, 6);
      P.go(r, ts + 0.3 + tr, tg, 9);
      P.kick(ts + 0.3, ts + 0.3 + tr, r, sF > 60 ? 6.5 : 3);
      P.held(ts + 0.3 + tr, r);
      P.cue(ts + 0.3, function () { P.fx.sound('kick'); });
      tEnd = ts + 0.3 + tr;
    } else {
      tEnd = ts + 0.2;
    }
    P.finish(tEnd, res, { callsAt: 0.2 });
  }

  function foul(P, e, res) {
    var team = P.att, vt = 1 - team, rng = P.rng, fx = P.fx;
    var off = P.T[team].s[e.by], vic = P.T[vt].s[e.on];
    var t = P.collect(vic);
    var vp = P.last(vic), vF = P.F(vt, vp.y);
    var tF = e.box ? 95 : Math.min(vF + 7, 88);
    var dp = P.at(vt, tF, e.box ? clamp(P.LX(vt, vp.x) * 0.5, -12, 12) : P.LX(vt, vp.x));
    var tc = t + clamp(d2(vp, dp) / 7.5, 0.9, 2.2);
    P.go(vic, tc, dp, e.box ? 9 : 7.5);
    P.shape(tc, dp.x, dp.y, vt, [vic, off]);
    var back = P.down(vt) ? -1 : 1;
    P.go(off, tc - 0.3, { x: dp.x + (rng() < 0.5 ? -1.8 : 1.8), y: dp.y + back * 1.2 }, 12);
    P.go(off, tc, { x: dp.x + 0.6, y: dp.y + back * 0.3 }, 12);
    P.cue(tc, function () { vic.state = 'down'; fx.sound('whistle'); });
    var loose = P.at(vt, Math.min(tF + 2.5, 104), P.LX(vt, dp.x) + 1);
    P.kick(tc, tc + 0.6, loose, 0);
    P.spot = e.box ? P.at(vt, 94, 0) : { x: dp.x, y: dp.y };
    if (res.card) P.cards.push({ a: off, color: res.card === 'red' ? '#ff3b30' : '#ffd400', t0: tc + 1.0 });
    P.hold(vic, tc + 1.6);
    P.cue(tc + 2.6, function () { vic.state = ''; });
    P.finish(tc + 0.3, res);
  }

  function offside(P, e, res) {
    var team = P.att, opp = 1 - team, rng = P.rng, S = P.T[team].s, O = P.T[opp].s, run = S[e.by];
    var holder = P.holder0 && P.holder0.team === team && P.holder0 !== run ? P.holder0 : S.CM2;
    var t = P.collect(holder);
    var hp = P.last(holder), hF = P.F(team, hp.y);
    var lineF = clamp(hF + 15, 62, 86);
    var back4 = ['LB', 'CB1', 'CB2', 'RB'].map(function (k) { return O[k]; });
    back4.forEach(function (a) { P.go(a, t + 0.7, P.at(team, lineF + rng() * 0.6, P.LX(team, P.last(a).x) * 0.9), 9); });
    P.go(run, t + 0.7, P.at(team, lineF + 1.9, rng() * 10 - 5), 10);
    P.shape(t + 0.7, hp.x, hp.y, team, [holder, run].concat(back4));
    var tp = t + 0.9;
    var tg = P.at(team, Math.min(lineF + 13, 99), P.LX(team, P.last(run).x) + rng() * 6 - 3);
    P.go(run, tp + 1.0, tg, 9.5);
    P.kick(tp, tp + 1.0, run, 2.2);
    P.held(tp + 1.0, run, false);
    var lineY = P.at(team, lineF, 0).y;
    P.marks.push({ kind: 'offside', t: tp, y: lineY, x: P.down(team) ? WID : 0 });
    P.cue(tp + 0.7, function () { P.fx.sound('whistle'); });
    P.spot = P.at(team, lineF + 1.9, P.LX(team, P.last(run).x));
    P.finish(tp + 1.0, res);
  }

  // ------------------------------------------------------------- library

  var LIB = [
    { name: 'kickoff tap', kind: 'kickoff', weight: 1, fn: kickoff },
    { name: 'short passing', kind: 'build', weight: 3, fn: buildUp, v: {} },
    { name: 'switch of play', kind: 'build', weight: 1.5, when: function (e) { return e.chain.length >= 3; }, fn: buildUp, v: { switchPlay: true } },
    { name: 'long ball', kind: 'build', weight: 1.2, when: function (e) { return e.chain.length <= 3 && e.to !== 'mid'; }, fn: buildUp, v: { long: true } },
    { name: 'low drive', kind: 'shot', weight: 2, when: function (e) { return !e.head; }, fn: shot, v: { power: 32, lift: 0.6 } },
    { name: 'curler', kind: 'shot', weight: 1.5, when: function (e) { return !e.head; }, fn: shot, v: { power: 24, lift: 2.0 } },
    { name: 'header', kind: 'shot', weight: 1, when: function (e) { return !!e.head; }, fn: shot, v: { power: 22 } },
    { name: 'penalty', kind: 'pen', weight: 1, fn: shot, v: { power: 30, lift: 0.8 } },
    { name: 'corner to the box', kind: 'corner', weight: 1, fn: corner },
    { name: 'free kick', kind: 'freekick', weight: 1, fn: freekick },
    { name: 'foul from behind', kind: 'foul', weight: 1, fn: foul },
    { name: 'through ball, flag up', kind: 'offside', weight: 1, fn: offside }
  ];

  function build(e, res, ctx) {
    var fits = LIB.filter(function (p) { return p.kind === e.t && (!p.when || p.when(e, res)); });
    if (!fits.length) throw new Error('No play fits ' + e.t);
    var total = fits.reduce(function (s, p) { return s + p.weight; }, 0), r = ctx.rng() * total, pick = fits[0];
    for (var i = 0; i < fits.length; i++) { r -= fits[i].weight; if (r <= 0) { pick = fits[i]; break; } }
    ctx.e = e;
    var P = new Play(ctx, pick.name);
    pick.fn(P, e, res, pick.v || {});
    P.cues.sort(function (a, b) { return a.t - b.t; });
    P.ball.sort(function (a, b) { return a.t - b.t; });
    return P;
  }

  // ------------------------------------------------------------- motion

  function posAt(a, t) {
    var p = a.path, n = p.length;
    if (t <= p[0].t) return { x: p[0].x, y: p[0].y, vx: 0, vy: 0 };
    for (var i = 1; i < n; i++) {
      if (t <= p[i].t) {
        var k0 = p[i - 1], k1 = p[i], span = k1.t - k0.t, u = span > 0 ? (t - k0.t) / span : 1;
        return { x: k0.x + (k1.x - k0.x) * u, y: k0.y + (k1.y - k0.y) * u, vx: span > 0 ? (k1.x - k0.x) / span : 0, vy: span > 0 ? (k1.y - k0.y) / span : 0 };
      }
    }
    return { x: p[n - 1].x, y: p[n - 1].y, vx: 0, vy: 0 };
  }

  function feet(a, t) { var p = posAt(a, t); return { x: p.x + 0.35, y: p.y + 0.45 }; }

  function segPos(play, i, t) {
    var s = play.ball[i];
    if (!s) return { x: play.ball0.x, y: play.ball0.y, z: 0, holder: null };
    if (s.kind === 'held') { var f = feet(s.a, t); return { x: f.x, y: f.y, z: 0, holder: s.a, hl: s.hl }; }
    if (s.kind === 'rest') return { x: s.x, y: s.y, z: 0, holder: null };
    if (!s.from) {
      var pv = i > 0 ? segPos(play, i - 1, s.t) : { x: play.ball0.x, y: play.ball0.y };
      s.from = { x: pv.x, y: pv.y };
    }
    var to = s.a ? feet(s.a, s.t1) : s.to, span = s.t1 - s.t;
    var u = span > 0 ? clamp((t - s.t) / span, 0, 1) : 1;
    return { x: s.from.x + (to.x - s.from.x) * u, y: s.from.y + (to.y - s.from.y) * u, z: s.h * 4 * u * (1 - u),
             holder: u >= 1 && s.a ? s.a : null, hl: true };
  }

  function ballAt(play, t) {
    var b = play.ball, i = -1;
    for (var j = 0; j < b.length; j++) if (b[j].t <= t) i = j;
    if (i < 0) return { x: play.ball0.x, y: play.ball0.y, z: 0, holder: play.holder0, hl: false };
    return segPos(play, i, t);
  }

  root.SC_PLAYS = { build: build, posAt: posAt, ballAt: ballAt, LIB: LIB, LEN: LEN, WID: WID, GOAL_HALF: GOAL_HALF };
})(window);
