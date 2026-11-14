// Play library. Each entry is a scripted play with a name, the kind of event
// it can act out and a condition on that event. build() picks one at random
// among the entries that match, then the script lays out a path for all 22
// players and for the ball. Coordinates inside a script are local:
//   lx = yards left or right of the middle of the field
//   d  = yards downfield from the line of scrimmage (negative is the backfield)
(function (root) {
  'use strict';

  var CX = 26.65;      // middle of the field, in yards from the left sideline
  var T_SET = 1.0;     // players reach the formation
  var T_SNAP = 1.4;    // ball is snapped

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function dist(a, b) { var dx = a.lx - b.lx, dy = a.d - b.d; return Math.sqrt(dx * dx + dy * dy); }

  // ---------------------------------------------------------------- Play

  function Play(ctx, name) {
    this.ctx = ctx; this.rng = ctx.rng; this.fx = ctx.fx; this.name = name;
    this.los = ctx.los; this.dir = ctx.dir;
    this.m = ctx.rng() < 0.5 ? -1 : 1; // mirror the script left to right for variety
    this.O = ctx.O; this.D = ctx.D;
    this.actors = []; this.offs = []; this.defs = [];
    this.ball = []; this.cues = []; this.flags = [];
    this.dur = 4; this.playmaker = null;
  }

  Play.prototype.xy = function (lx, d) {
    return { x: clamp(CX + lx * this.m, 0.8, 52.5), y: clamp(this.los + this.dir * d, -9.3, 109.3) };
  };

  // Put a player in the formation. A player already on the field walks there.
  Play.prototype.place = function (a, lx, d, side) {
    var p = this.xy(lx, d), sx = p.x, sy = p.y;
    if (a.onField) {
      var dx = a.x - p.x, dy = a.y - p.y;
      if (dx * dx + dy * dy < 900) { sx = a.x; sy = a.y; }
    }
    a.path = [{ t: 0, x: sx, y: sy, lx: lx, d: d }, { t: T_SET, x: p.x, y: p.y, lx: lx, d: d }];
    a.state = ''; a.tag = side === 'o'; a.covers = null;
    this.actors.push(a);
    (side === 'o' ? this.offs : this.defs).push(a);
    return a;
  };

  Play.prototype.last = function (a) { return a.path[a.path.length - 1]; };

  Play.prototype.go = function (a, t, lx, d) {
    var l = this.last(a);
    if (t < l.t + 0.01) t = l.t + 0.01;
    var p = this.xy(lx, d);
    a.path.push({ t: t, x: p.x, y: p.y, lx: lx, d: d });
    return t;
  };

  Play.prototype.hold = function (a, t) {
    var l = this.last(a);
    if (t > l.t) a.path.push({ t: t, x: l.x, y: l.y, lx: l.lx, d: l.d });
  };

  Play.prototype.holdAll = function (t) {
    for (var i = 0; i < this.actors.length; i++) this.hold(this.actors[i], t);
  };

  // Drop every keyframe after time t so the player can be sent somewhere else.
  Play.prototype.cut = function (a, t) {
    var keep = a.path.filter(function (k) { return k.t <= t; });
    if (keep.length >= 2) a.path = keep;
  };

  Play.prototype.cue = function (t, fn) { this.cues.push({ t: t, fn: fn, done: false }); };

  Play.prototype.flag = function (t, lx, d) {
    this.flags.push({ t: t, x: CX + lx * this.m, y: this.los + this.dir * d });
  };

  // Ball segments, in time order.
  Play.prototype.held = function (t, a, highlight) {
    this.ball.push({ t: t, kind: 'held', a: a, hl: highlight !== false });
  };
  Play.prototype.air = function (t0, t1, target, height) {
    var seg = { t: t0, t1: t1, kind: 'air', h: height || 8 };
    if (target.path) seg.a = target;
    else seg.to = { x: CX + target.lx * this.m, y: this.los + this.dir * target.d };
    this.ball.push(seg);
  };

  // ------------------------------------------------------- formations

  Play.prototype.scrimmage = function (form) {
    var o = this.O, d = this.D, me = this, ytg = this.ctx.ytg;
    function O(a, lx, dd) { me.place(a, lx, dd, 'o'); }
    function Df(a, lx, dd) { me.place(a, lx, Math.min(dd, ytg + 7), 'd'); }
    O(o.C, 0, -0.9); O(o.LG, -3, -0.9); O(o.RG, 3, -0.9); O(o.LT, -6, -0.9); O(o.RT, 6, -0.9); O(o.TE, 9, -0.9);
    O(o.WR1, -21, -0.9); O(o.WR2, 21, -0.9); O(o.WR3, -14, -1.6);
    if (form === 'gun') { O(o.QB, 0, -4.6); O(o.RB, 4.5, -5); }
    else { O(o.QB, 0, -1.9); O(o.RB, 0, -6.2); }
    Df(d.DL1, -4.5, 1.3); Df(d.DL2, -1.5, 1.3); Df(d.DL3, 1.5, 1.3); Df(d.DL4, 4.5, 1.3);
    Df(d.LB1, -8, 4.5); Df(d.LB2, 0, 5); Df(d.LB3, 8, 4.5);
    Df(d.CB1, -21, 5.5); Df(d.CB2, 21, 5.5); Df(d.S1, -12, 11); Df(d.S2, 7, 13);
    this.held(0, o.C, false);
  };

  Play.prototype.snap = function (ts, gun) {
    this.holdAll(ts);
    if (gun) { this.air(ts, ts + 0.25, this.O.QB, 3); this.held(ts + 0.25, this.O.QB); return ts + 0.25; }
    this.held(ts, this.O.QB);
    return ts;
  };

  // ------------------------------------------------- shared behaviour

  var OLINE = ['C', 'LG', 'RG', 'LT', 'RT'];
  var DLINE = ['DL1', 'DL2', 'DL3', 'DL4'];

  Play.prototype.passBlock = function (ts, tEnd) {
    var me = this;
    OLINE.forEach(function (k) {
      var a = me.O[k], l = me.last(a);
      me.go(a, ts + 0.5, l.lx * 1.05, -1.7 - me.rng() * 0.5);
      me.go(a, Math.max(tEnd, ts + 0.8), l.lx * 1.1 + me.rng() - 0.5, -2.4 - me.rng() * 0.8);
    });
  };

  Play.prototype.passRush = function (ts, tEnd, skip) {
    var me = this;
    DLINE.forEach(function (k) {
      var a = me.D[k], l = me.last(a);
      if (a === skip) return;
      me.go(a, ts + 0.5, l.lx * 1.05, -0.4 - me.rng() * 0.4);
      me.go(a, Math.max(tEnd, ts + 0.8), l.lx + me.rng() - 0.5, -1.2 - me.rng() * 0.9);
    });
  };

  Play.prototype.runBlock = function (ts, side) {
    var me = this;
    OLINE.concat(['TE']).forEach(function (k) {
      var a = me.O[k], l = me.last(a);
      me.go(a, ts + 0.6, l.lx + side * 0.6, 0.5 + me.rng() * 0.5);
      me.go(a, ts + 1.6, l.lx + side * 1.5, 1.5 + me.rng());
    });
    DLINE.forEach(function (k) {
      var a = me.D[k], l = me.last(a);
      me.go(a, ts + 0.6, l.lx + me.rng() - 0.5, 0.7);
    });
    ['LB1', 'LB2', 'LB3'].forEach(function (k) {
      var a = me.D[k], l = me.last(a);
      me.go(a, ts + 0.7, l.lx + side * 1.5, l.d - 1);
    });
  };

  // Routes for the receivers who are not getting the ball.
  Play.prototype.fillRoutes = function (ts, target) {
    var o = this.O, me = this, ytg = this.ctx.ytg;
    function run(a, pts) {
      if (a === target) return;
      var t = ts, cur = me.last(a);
      pts.forEach(function (p) {
        p.d = Math.min(p.d, ytg + 7);
        t += dist(cur, p) / 7;
        me.go(a, t, p.lx, p.d);
        cur = p;
      });
    }
    var l = me.last(o.WR1); run(o.WR1, [{ lx: l.lx, d: 12 + me.rng() * 6 }]);
    l = me.last(o.WR2); run(o.WR2, [{ lx: l.lx, d: 8 }, { lx: l.lx * 0.6, d: 13 }]);
    l = me.last(o.WR3); run(o.WR3, [{ lx: l.lx, d: 6 }, { lx: l.lx + 8, d: 7 }]);
    l = me.last(o.TE); run(o.TE, [{ lx: l.lx + 1, d: 5 }, { lx: l.lx + 5, d: 6 }]);
    l = me.last(o.RB); run(o.RB, [{ lx: l.lx * 0.6 + 1.6, d: -3.8 }]);
  };

  // Man coverage on the receivers, zones for the rest.
  Play.prototype.coverage = function (ts, skip) {
    var o = this.O, d = this.D, me = this, ytg = this.ctx.ytg;
    function man(def, off, cushion) {
      if (def === skip) return;
      def.covers = off;
      off.path.forEach(function (k) {
        if (k.t > ts) me.go(def, k.t + 0.12, k.lx + (k.lx > 0 ? -0.8 : 0.8), Math.min(k.d + cushion, ytg + 8.5));
      });
    }
    man(d.CB1, o.WR1, 1.6); man(d.CB2, o.WR2, 1.6); man(d.S1, o.WR3, 2.2); man(d.LB3, o.TE, 1.5);
    var l;
    if (d.LB1 !== skip) { l = me.last(d.LB1); me.go(d.LB1, ts + 1.0, l.lx + 1, Math.min(7, ytg + 6)); }
    if (d.LB2 !== skip) { me.go(d.LB2, ts + 1.0, me.rng() * 4 - 2, Math.min(7.5, ytg + 6)); }
    if (d.S2 !== skip) { l = me.last(d.S2); me.go(d.S2, ts + 1.4, l.lx * 0.5, Math.min(l.d + 5, ytg + 8)); }
  };

  Play.prototype.coverOf = function (off) {
    for (var i = 0; i < this.defs.length; i++) if (this.defs[i].covers === off) return this.defs[i];
    return this.D.S2;
  };

  Play.prototype.nearest = function (list, pt, skip) {
    var best = null, bd = 1e9;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (skip && skip.indexOf(a) >= 0) continue;
      var dd = dist(this.last(a), pt);
      if (dd < bd) { bd = dd; best = a; }
    }
    return best;
  };

  // Everyone in the list closes part of the way to the spot by time t.
  Play.prototype.pursue = function (list, t, pt, skip) {
    var me = this;
    list.forEach(function (a) {
      if (skip && skip.indexOf(a) >= 0) return;
      var l = me.last(a);
      if (l.t >= t) return;
      var f = 0.4 + me.rng() * 0.4;
      me.go(a, t, l.lx + (pt.lx - l.lx) * f + me.rng() * 2 - 1, l.d + (pt.d - l.d) * f + me.rng() * 2 - 1);
    });
  };

  Play.prototype.tackle = function (t, carrier, tackler, pt) {
    var me = this;
    if (tackler) this.go(tackler, t, pt.lx + (this.rng() < 0.5 ? -0.7 : 0.7), pt.d + 0.5);
    this.cue(t, function () { carrier.state = 'down'; me.fx.sound('tackle'); });
  };

  Play.prototype.touchdown = function (t, scorer) {
    var me = this;
    this.cue(t, function () { scorer.state = 'celebrate'; me.fx.sound('td'); });
    var l = this.last(scorer);
    this.offs.forEach(function (a) {
      if (a === scorer) return;
      var k = me.last(a);
      me.go(a, Math.max(t, k.t) + 1.5, k.lx + (l.lx - k.lx) * 0.6 + me.rng() * 4 - 2, k.d + (l.d - k.d) * 0.6 + me.rng() * 3 - 2);
    });
  };

  // Close the play: result banners, score, floating fantasy points.
  Play.prototype.finish = function (tEnd, res, opt) {
    var me = this, fx = this.fx;
    opt = opt || {};
    var tc = opt.callsAt === undefined ? tEnd + 0.1 : opt.callsAt;
    var secs = res.td ? 2.4 : 1.15;
    this.cue(tEnd, function () { fx.result(res, me); });
    res.calls.forEach(function (c, i) {
      me.cue(tc + i * (secs + 0.1), function () { fx.banner(c, '', secs); });
    });
    this.tEnd = tEnd;
    this.dur = Math.max(tEnd + 1.2, tc + res.calls.length * (secs + 0.1) + 0.3);
  };

  Play.prototype.penaltyCalls = function (t, res) {
    var me = this, fx = this.fx;
    this.cue(t, function () { fx.banner('FLAG', '', 0.8, '#ffd400'); });
    this.cue(t + 0.9, function () { fx.banner(res.pen.title, res.pen.sub, 2.3); fx.result(res, me); });
    this.tEnd = t;
    this.dur = t + 0.9 + 2.6;
  };

  // ------------------------------------------------------------ scripts

  function buildRun(P, e, res, v, noFinish) {
    var o = P.O, rng = P.rng, yds = res.yds, td = res.td, gun = v.form === 'gun';
    P.scrimmage(gun ? 'gun' : 'I');
    var ts = T_SNAP, tq = P.snap(ts, gun), rb = o[e.by] || o.RB;
    var side = rng() < 0.5 ? -1 : 1, hx = v.hole * side, th;
    if (v.toss) {
      P.go(o.QB, tq + 0.3, side * 1.2, -2.8);
      th = tq + 0.75;
      P.go(rb, th, side * 6.5, -5.6);
      P.air(tq + 0.3, th, rb, 5); P.held(th, rb);
    } else if (v.draw) {
      P.go(o.QB, tq + 0.7, 0, -6.4);
      th = tq + 0.95;
      P.go(rb, th, side * 0.9, -5.6); P.held(th, rb);
      P.go(o.QB, th + 0.7, -side * 2.5, -7);
    } else {
      th = tq + 0.55;
      P.go(o.QB, th, side * 0.7, -3.2);
      P.go(rb, th, side * 1.3, -3.9); P.held(th, rb);
      P.go(o.QB, th + 0.7, -side * 2.5, -5);
    }
    var endD = td ? yds + 2.5 + rng() * 3.5 : yds;
    var endLx = (yds < 1 && !td) ? hx * 0.5 : clamp(hx + rng() * 8 - 4 - (yds > 10 ? side * rng() * 5 : 0), -23, 23);
    var t = th, cur = P.last(rb), sp = 7.2;
    if (yds >= 1 || td) {
      var hole = { lx: hx, d: 0.2 };
      t += dist(cur, hole) / sp; P.go(rb, t, hole.lx, hole.d); cur = hole;
    }
    var end = { lx: endLx, d: endD };
    t += Math.max(0.2, dist(cur, end) / sp); P.go(rb, t, end.lx, end.d);
    var tEnd = t, tk = null;
    P.runBlock(ts, side);
    [o.WR1, o.WR2, o.WR3].forEach(function (w) { var l = P.last(w); P.go(w, ts + 1.3, l.lx, 3 + rng() * 2); });
    if (td) {
      P.pursue(P.defs, tEnd, end, []);
      P.touchdown(tEnd, rb);
    } else {
      tk = P.nearest(P.defs, end, []);
      P.tackle(tEnd, rb, tk, end);
      P.pursue(P.defs, tEnd, end, [tk]);
    }
    if (!noFinish) P.finish(tEnd, res);
    return { tEnd: tEnd, carrier: rb, end: end, tackler: tk };
  }

  // Formation, snap, drop back and the target's route. Returns the timing.
  function passSetup(P, tgt, cd, route) {
    var o = P.O;
    P.scrimmage('gun');
    var ts = T_SNAP; P.snap(ts, true);
    var st = P.last(tgt), s = st.lx, sg = s < 0 ? -1 : 1, brk, cp;
    switch (route) {
      case 'slant': brk = { lx: s, d: cd * 0.35 }; cp = { lx: s - sg * 7, d: cd }; break;
      case 'out': brk = { lx: s, d: cd }; cp = { lx: sg * Math.min(Math.abs(s) + 6, 24), d: cd }; break;
      case 'curl': brk = { lx: s, d: cd + 2.5 }; cp = { lx: s - sg * 1.2, d: cd }; break;
      case 'cross': brk = { lx: s, d: cd * 0.8 }; cp = { lx: s - sg * 11, d: cd }; break;
      case 'post': brk = { lx: s, d: cd * 0.6 }; cp = { lx: s - sg * 7, d: cd }; break;
      case 'corner': brk = { lx: s, d: cd * 0.6 }; cp = { lx: sg * Math.min(Math.abs(s) + 7, 24), d: cd }; break;
      case 'screen': brk = { lx: s + sg * 3, d: -4 }; cp = { lx: s + sg * 7, d: -2 }; break;
      default: brk = { lx: s, d: cd * 0.5 }; cp = { lx: s + sg * 0.5, d: cd }; // go
    }
    var len = dist(st, brk) + dist(brk, cp);
    var qb = { lx: 0, d: -7.2 };
    var flight = clamp(dist(qb, cp) / 21, 0.35, 1.5);
    var tCatch = Math.max(ts + 1.25 + flight, ts + len / 7.6);
    var tThrow = tCatch - flight;
    P.go(o.QB, ts + 0.9, 0, -7.2); P.hold(o.QB, tThrow);
    P.go(tgt, ts + (tCatch - ts) * dist(st, brk) / len, brk.lx, brk.d);
    P.go(tgt, tCatch, cp.lx, cp.d);
    P.fillRoutes(ts, tgt); P.coverage(ts);
    P.passBlock(ts, tThrow + 0.3); P.passRush(ts, tThrow + 0.3);
    P.cue(tThrow, function () { P.fx.sound('pass'); });
    return { ts: ts, tThrow: tThrow, tCatch: tCatch, cp: cp, brk: brk, sg: sg, arc: 6 + flight * 16 };
  }

  function buildPass(P, e, res, v, noFinish) {
    var o = P.O, rng = P.rng, tgt = o[e.to], yds = res.yds, td = res.td, cd, endD, inEndZone = false;
    if (v.route === 'screen') { cd = -2; endD = td ? yds + 3 : yds; }
    else if (td) {
      if (yds <= 14 || rng() < 0.6) { cd = yds + 2 + rng() * 4; endD = cd; inEndZone = true; }
      else { cd = yds - 2 - rng() * 5; endD = yds + 2 + rng() * 3; }
    } else {
      var yac = v.deep ? rng() * 4 : rng() * Math.min(5, Math.max(0, yds - 1));
      cd = Math.max(1, yds - yac); endD = yds;
    }
    var s = passSetup(P, tgt, cd, v.route);
    P.air(s.tThrow, s.tCatch, tgt, s.arc); P.held(s.tCatch, tgt);
    P.cue(s.tCatch, function () { P.fx.sound('catch'); });
    var end = inEndZone ? s.cp : { lx: clamp(s.cp.lx + rng() * 6 - 3, -24, 24), d: endD };
    var tEnd = s.tCatch + (inEndZone ? 0.15 : Math.max(0.25, dist(s.cp, end) / 7.2)), tk = null;
    if (!inEndZone) P.go(tgt, tEnd, end.lx, end.d);
    if (td) {
      P.pursue(P.defs, tEnd, end, []);
      P.touchdown(tEnd, tgt);
    } else {
      tk = P.nearest(P.defs, end, []);
      P.tackle(tEnd, tgt, tk, end);
      P.pursue(P.defs, tEnd, end, [tk]);
    }
    if (!noFinish) P.finish(tEnd, res);
    return { tEnd: tEnd, carrier: tgt, end: end, tackler: tk };
  }

  function buildInc(P, e, res, v) {
    var o = P.O, rng = P.rng, tgt = o[e.to], ytg = P.ctx.ytg, tRest;
    if (v.how === 'away') {
      P.scrimmage('gun');
      var ts = T_SNAP; P.snap(ts, true);
      var sd = rng() < 0.5 ? -1 : 1;
      P.go(o.QB, ts + 0.9, 0, -7); P.go(o.QB, ts + 1.9, sd * 8, -6.4);
      P.fillRoutes(ts, null); P.coverage(ts); P.passBlock(ts, ts + 2); P.passRush(ts, ts + 2);
      P.air(ts + 2.0, ts + 2.8, { lx: sd * 31, d: 6 }, 16);
      P.cue(ts + 2.0, function () { P.fx.sound('pass'); });
      P.finish(ts + 2.8, res);
      return;
    }
    var routes = ['slant', 'out', 'curl', 'go', 'post'];
    var cd = Math.min(5 + rng() * 13, ytg + 5);
    var s = passSetup(P, tgt, cd, routes[Math.floor(rng() * routes.length)]), cp = s.cp;
    if (v.how === 'over') {
      var land = { lx: cp.lx + s.sg * 0.5, d: cp.d + 5.5 };
      P.air(s.tThrow, s.tCatch + 0.2, land, s.arc);
      P.air(s.tCatch + 0.2, s.tCatch + 0.55, { lx: land.lx + 0.5, d: land.d + 2 }, 3);
      P.go(tgt, s.tCatch + 0.5, cp.lx, cp.d + 2.5);
      tRest = s.tCatch + 0.55;
    } else if (v.how === 'drop') {
      P.air(s.tThrow, s.tCatch, tgt, s.arc);
      P.air(s.tCatch, s.tCatch + 0.4, { lx: cp.lx + s.sg * 1.2, d: cp.d + 1.6 }, 4);
      P.cue(s.tCatch, function () { P.fx.sound('tackle'); });
      tRest = s.tCatch + 0.4;
    } else { // broken up by the defender
      var def = P.coverOf(tgt);
      P.cut(def, s.tThrow);
      P.go(def, s.tCatch - 0.05, cp.lx - s.sg * 0.5, cp.d - 0.5);
      P.air(s.tThrow, s.tCatch - 0.05, { lx: cp.lx - s.sg * 0.5, d: cp.d - 0.5 }, s.arc);
      P.air(s.tCatch - 0.05, s.tCatch + 0.4, { lx: cp.lx - s.sg * 4, d: cp.d - 2.5 }, 5);
      P.cue(s.tCatch - 0.05, function () { P.fx.sound('tackle'); });
      tRest = s.tCatch + 0.4;
    }
    P.finish(tRest, res);
  }

  function buildSack(P, e, res, v) {
    var o = P.O, d = P.D, rng = P.rng, yds = res.yds;
    P.scrimmage('gun');
    var ts = T_SNAP; P.snap(ts, true);
    var side = rng() < 0.5 ? -1 : 1;
    var tEnd = ts + 2.0 + rng() * 0.4 + (v.late ? 0.7 : 0);
    P.go(o.QB, ts + 0.9, 0, Math.min(-7, yds - 0.5));
    P.go(o.QB, tEnd - 0.45, side * 2.5, yds - 0.8);
    P.go(o.QB, tEnd, side * 2, yds);
    var sacker = d[v.who], l = P.last(sacker);
    if (v.who === 'LB2') P.go(sacker, ts + 0.7, side * 1.5, 0);
    else P.go(sacker, ts + 0.8, l.lx * 1.9, -2.2);
    P.go(sacker, tEnd, side * 2 + (l.lx > 0 ? 0.7 : -0.7), yds + 0.4);
    P.fillRoutes(ts, null); P.coverage(ts, sacker);
    P.passBlock(ts, tEnd); P.passRush(ts, tEnd, sacker);
    sacker.tag = true; P.playmaker = sacker;
    P.cue(tEnd, function () { o.QB.state = 'down'; P.fx.sound('tackle'); });
    P.finish(tEnd, res);
  }

  function buildKneel(P, e, res) {
    var o = P.O;
    P.scrimmage('I');
    var ts = T_SNAP; P.snap(ts, false);
    P.go(o.QB, ts + 0.5, 0, -2.6);
    P.cue(ts + 0.55, function () { o.QB.state = 'down'; });
    P.finish(ts + 0.8, res);
  }

  function buildPunt(P, e, res, v) {
    var o = P.O, d = P.D, rng = P.rng, ytg = P.ctx.ytg;
    function O(a, lx, dd) { P.place(a, lx, dd, 'o'); }
    function Df(a, lx, dd) { P.place(a, lx, dd, 'd'); }
    var how = res.touchback ? 'tb' : v.how;
    var net = res.touchback ? ytg + 4 : e.net;
    var ret = how === 'ret' ? 3 + Math.floor(rng() * 6) : 0;
    if (how === 'ret' && net + ret > ytg - 2) ret = Math.max(0, ytg - 2 - net);
    var kd = net + ret;
    var land = { lx: how === 'oob' ? 27.3 : rng() * 14 - 7, d: kd };
    O(o.C, 0, -0.9); O(o.LG, -3, -0.9); O(o.RG, 3, -0.9); O(o.LT, -6, -0.9); O(o.RT, 6, -0.9);
    O(o.TE, 9, -0.9); O(o.WR3, -9, -0.9); O(o.WR1, -21, -0.9); O(o.WR2, 21, -0.9);
    O(o.RB, 2.5, -6.5); O(o.P, 0, -14);
    o.TE.tag = false; o.WR3.tag = false; o.RB.tag = false;
    Df(d.DL1, -4.5, 1.3); Df(d.DL2, -1.5, 1.3); Df(d.DL3, 1.5, 1.3); Df(d.DL4, 4.5, 1.3);
    Df(d.LB1, -21, 1.6); Df(d.LB3, 21, 1.6); Df(d.LB2, 0, 4.5); Df(d.CB1, -10, 3); Df(d.CB2, 10, 3);
    Df(d.S2, 6, Math.max(8, kd - 12));
    Df(d.S1, how === 'oob' ? 8 : land.lx * 0.3, Math.min(kd - 1, ytg - 2));
    P.held(0, o.C, false);
    var ts = T_SNAP; P.holdAll(ts);
    P.air(ts, ts + 0.55, o.P, 4); P.held(ts + 0.55, o.P, false);
    var tk = ts + 1.35; P.go(o.P, tk, 0.4, -12.6);
    var hang = clamp(kd / 14, 2.2, 3.6), tl = tk + hang;
    P.air(tk, tl, land, 55);
    P.cue(tk, function () { P.fx.sound('kick'); });
    [o.WR1, o.WR2].forEach(function (g, i) { P.go(g, tl + 0.25, land.lx + (i ? 4 : -4), Math.max(2, kd - 3 - rng() * 3)); });
    ['C', 'LG', 'RG', 'LT', 'RT', 'TE', 'WR3', 'RB'].forEach(function (k) {
      var a = o[k], l = P.last(a);
      P.go(a, tk + 0.2, l.lx, l.d - 0.8);
      P.go(a, tl + 0.3, l.lx * 1.6 + rng() * 4 - 2, kd * (0.35 + rng() * 0.3));
    });
    DLINE.forEach(function (k) {
      var a = d[k], l = P.last(a);
      P.go(a, tk, l.lx * 0.8, -3 - rng() * 3);
      P.go(a, tl, l.lx * 2, kd * 0.3);
    });
    ['LB1', 'LB3', 'LB2', 'CB1', 'CB2', 'S2'].forEach(function (k) {
      var a = d[k], l = P.last(a);
      P.go(a, tl, l.lx * 0.8 + rng() * 4 - 2, Math.max(l.d, kd * (0.5 + rng() * 0.25)));
    });
    var rt = d.S1, tEnd;
    if (how === 'oob' || how === 'tb') {
      P.air(tl, tl + 0.5, { lx: how === 'oob' ? 31 : land.lx, d: kd + 2 }, 4);
      P.go(rt, tl + 0.4, how === 'oob' ? 17 : land.lx * 0.5, Math.min(kd - 1, ytg - 3));
      tEnd = tl + 0.5;
      if (how === 'tb') P.cue(tl + 0.5, function () { P.fx.banner('TOUCHBACK', '', 1.2); });
    } else {
      P.go(rt, tl - 0.4, land.lx, kd + 0.3);
      P.held(tl, rt); rt.tag = true; P.playmaker = rt;
      P.cue(tl, function () { P.fx.sound('catch'); });
      if (how === 'fair' || ret === 0) {
        tEnd = tl + 0.3;
        if (how === 'fair') P.cue(tl + 0.1, function () { P.fx.banner('FAIR CATCH', '', 1.1); });
      } else {
        var end = { lx: clamp(land.lx + rng() * 8 - 4, -22, 22), d: net };
        tEnd = tl + ret / 6.5 + 0.3;
        P.go(rt, tEnd, end.lx, end.d);
        P.tackle(tEnd, rt, P.nearest([o.WR1, o.WR2], end, []), end);
      }
    }
    P.finish(tEnd, res);
  }

  function buildKick(P, e, res, v) {
    P.m = 1; // keep left and right honest for the kick
    var o = P.O, d = P.D, rng = P.rng, ytg = P.ctx.ytg, good = !!e.good;
    function O(a, lx, dd) { P.place(a, lx, dd, 'o'); }
    function Df(a, lx, dd) { P.place(a, lx, dd, 'd'); }
    O(o.C, 0, -0.9); O(o.LG, -3, -0.9); O(o.RG, 3, -0.9); O(o.LT, -6, -0.9); O(o.RT, 6, -0.9);
    O(o.TE, 9, -0.9); O(o.WR1, -9, -0.9); O(o.RB, -11.5, -1.6); O(o.WR2, 11.5, -1.6);
    O(o.QB, 1, -7.3); O(o.K, -2.6, -9.6);
    P.offs.forEach(function (a) { a.tag = a === o.K; }); // only the kicker is labelled
    Df(d.DL1, -4.5, 1.3); Df(d.DL2, -1.5, 1.3); Df(d.DL3, 1.5, 1.3); Df(d.DL4, 4.5, 1.3);
    Df(d.LB1, -7.5, 1.2); Df(d.LB3, 7.5, 1.2); Df(d.LB2, 0, 2.4); Df(d.CB1, -11, 1.3); Df(d.CB2, 11, 1.3);
    Df(d.S1, -2, Math.min(7, ytg + 4)); Df(d.S2, 4, Math.min(12, ytg + 6));
    P.held(0, o.C, false);
    var ts = T_SNAP; P.holdAll(ts);
    var spot = { lx: 0.1, d: -7.2 };
    P.air(ts, ts + 0.45, spot, 3);
    var k = o.K, tk = ts + 1.2;
    P.go(k, ts + 0.55, -1.6, -8.6); P.go(k, tk, -0.4, -7.6); P.go(k, tk + 0.5, 0.3, -6.6);
    var endD = ytg + 10, X = (v.x || 0) * P.dir;
    var flight = 1.3 + res.fgDist / 70;
    var target = v.short ? { lx: X, d: ytg + 4 } : { lx: X * 1.25, d: endD + 3.5 };
    P.air(tk, tk + flight, target, v.short ? 30 : 60);
    P.cue(tk, function () { P.fx.sound('kick'); });
    var u = v.short ? 1 : (endD - spot.d) / (target.d - spot.d);
    var tJudge = tk + flight * u;
    P.cue(tJudge, function () { P.fx.sound(good ? 'fg' : 'miss'); });
    OLINE.concat(['TE', 'WR1']).forEach(function (r) { var a = o[r], l = P.last(a); P.go(a, tk, l.lx, -1.2 - rng() * 0.4); });
    DLINE.concat(['LB1', 'LB3', 'CB1', 'CB2']).forEach(function (r) { var a = d[r], l = P.last(a); P.go(a, tk, l.lx * 0.9, -0.2 - rng() * 0.5); });
    P.finish(tJudge, res);
  }

  function buildInt(P, e, res, v) {
    var o = P.O, d = P.D, rng = P.rng, tgt = o[e.to];
    var routes = ['post', 'out', 'go'];
    var s = passSetup(P, tgt, e.at + 1.2, routes[Math.floor(rng() * routes.length)]);
    var def = v.who === 's' ? d.S2 : P.coverOf(tgt);
    P.cut(def, s.tThrow);
    var ip = { lx: s.cp.lx - s.sg * 0.8, d: e.at }, tc = s.tCatch - 0.05;
    P.go(def, tc, ip.lx, ip.d);
    P.air(s.tThrow, tc, def, s.arc); P.held(tc, def);
    def.tag = true; P.playmaker = def;
    P.cue(tc, function () { P.fx.sound('turnover'); });
    var end = { lx: clamp(ip.lx + rng() * 10 - 5, -22, 22), d: e.at - e.ret };
    var tEnd = tc + e.ret / 6.5 + 0.3;
    P.go(def, tEnd, end.lx, end.d);
    P.go(tgt, tEnd, end.lx + 0.7, end.d + 0.5);
    P.cue(tEnd, function () { def.state = 'down'; P.fx.sound('tackle'); });
    P.pursue(P.offs, tEnd, end, [tgt]);
    P.finish(tEnd, res, { callsAt: tc + 0.05 });
  }

  function buildFumble(P, e, res, v) {
    var rng = P.rng, fake = { yds: e.yds, td: false, calls: [], fp: [] };
    var r = buildRun(P, e, fake, pick('run', e, fake, rng), true);
    var rec = P.nearest(P.defs, r.end, [r.tackler]);
    var spot = { lx: r.end.lx + (rng() < 0.5 ? -1 : 1) * (v.far ? 4 : 2.2), d: r.end.d };
    P.air(r.tEnd, r.tEnd + 0.5, spot, 7);
    P.go(rec, r.tEnd + 0.95, spot.lx, spot.d);
    P.held(r.tEnd + 0.95, rec); rec.tag = true; P.playmaker = rec;
    P.cue(r.tEnd + 0.05, function () { P.fx.sound('turnover'); });
    P.cue(r.tEnd + 1.05, function () { rec.state = 'down'; });
    P.finish(r.tEnd + 1.05, res, { callsAt: r.tEnd + 0.1 });
  }

  // Frame of reference: the kicking team, with its own 35 as the line.
  function buildKickoff(P, e, res, v) {
    var c = P.ctx, rng = P.rng, K = c.K, rt = c.returner;
    var lanes = [-22, -17.5, -13, -8.5, -4, 4, 8.5, 13, 17.5, 22];
    var spots = [[-16, 38], [-8, 37], [0, 38], [8, 37], [16, 38], [-11, 47], [0, 48], [11, 47], [-5, 55], [5, 55]];
    c.kickers.forEach(function (a, i) { P.place(a, lanes[i], -1.2, 'o'); a.tag = false; });
    P.place(K, -1.2, -6, 'o');
    c.blockers.forEach(function (a, i) { P.place(a, spots[i][0], spots[i][1], 'd'); a.tag = false; });
    P.place(rt, 0, 62, 'd'); rt.tag = true;
    var tee = { lx: 0, d: 0 };
    P.air(0, 0.01, tee, 0);
    var tk = 2.0; P.holdAll(1.3);
    P.go(K, tk, 0, -0.4); P.go(K, tk + 0.6, 0.5, 3);
    P.cue(1.1, function () { P.fx.sound('whistle'); });
    P.cue(tk, function () { P.fx.sound('kick'); });
    var cd = 65 - (1 + rng() * 5), clx = rng() * 12 - 6, tl = tk + 3.1;
    P.air(tk, tl, { lx: clx, d: cd }, 70);
    P.go(rt, tl - 0.3, clx, cd); P.held(tl, rt);
    P.cue(tl, function () { P.fx.sound('catch'); });
    var endD = 65 - e.to;
    var mid = { lx: clamp(clx + v.lane * 9 + rng() * 4 - 2, -21, 21), d: cd - (cd - endD) * 0.55 };
    var end = { lx: clamp(mid.lx + rng() * 8 - 4, -21, 21), d: endD };
    var t = tl + dist({ lx: clx, d: cd }, mid) / 7.4; P.go(rt, t, mid.lx, mid.d);
    t += dist(mid, end) / 7.4; P.go(rt, t, end.lx, end.d);
    var tEnd = t;
    c.kickers.forEach(function (a, i) { P.hold(a, tk - 0.1); P.go(a, tl, lanes[i] * 0.85, 24 + rng() * 8); });
    c.blockers.forEach(function (a) { var l = P.last(a); P.go(a, tl, l.lx, l.d - 4 - rng() * 3); });
    var tkl = P.nearest(c.kickers, end, []);
    P.tackle(tEnd, rt, tkl, end);
    P.pursue(c.kickers, tEnd, end, [tkl]);
    P.pursue(c.blockers, tEnd, { lx: end.lx, d: end.d - 4 }, []);
    P.finish(tEnd, res);
  }

  function buildPresnapFoul(P, e, res) {
    var rng = P.rng, who, l, nd;
    P.scrimmage(rng() < 0.5 ? 'gun' : 'I');
    if (e.kind === 'false_start') {
      who = P.O[['LG', 'RT', 'TE', 'LT'][Math.floor(rng() * 4)]]; l = P.last(who); nd = l.d + 1.1;
    } else {
      who = P.D[['DL2', 'DL3', 'DL4'][Math.floor(rng() * 3)]]; l = P.last(who); nd = -0.3;
    }
    P.holdAll(1.45);
    P.go(who, 1.6, l.lx, nd);
    P.flag(1.7, l.lx + 1.5, 0.3);
    P.cue(1.65, function () { P.fx.sound('whistle'); });
    P.penaltyCalls(1.75, res);
  }

  function buildHolding(P, e, res) {
    var rng = P.rng, d = e.during, fake = { yds: d.yds, td: false, calls: [], fp: [] };
    var r = d.t === 'pass' ? buildPass(P, d, fake, pick('pass', d, fake, rng), true)
                           : buildRun(P, d, fake, pick('run', d, fake, rng), true);
    P.flag(T_SNAP + 1.0, (rng() < 0.5 ? -1 : 1) * 4.5, -0.9);
    P.cue(r.tEnd + 0.4, function () { P.fx.sound('whistle'); });
    P.penaltyCalls(r.tEnd + 0.5, res);
  }

  function buildDPI(P, e, res) {
    var tgt = P.O[e.to], ytg = P.ctx.ytg, rng = P.rng;
    var cd = Math.min(e.spot, ytg + 5);
    var s = passSetup(P, tgt, cd, rng() < 0.5 ? 'go' : 'post'), cp = s.cp;
    var def = P.coverOf(tgt);
    P.cut(def, s.tThrow);
    P.go(def, s.tCatch - 0.25, cp.lx - s.sg * 0.3, cp.d - 0.2);
    P.cue(s.tCatch - 0.2, function () { tgt.state = 'down'; P.fx.sound('tackle'); });
    var land = { lx: cp.lx + s.sg * 0.5, d: cp.d + 3.5 };
    P.air(s.tThrow, s.tCatch + 0.25, land, s.arc);
    P.air(s.tCatch + 0.25, s.tCatch + 0.6, { lx: land.lx + 0.5, d: land.d + 1.5 }, 3);
    P.flag(s.tCatch + 0.1, cp.lx - s.sg * 1.5, cp.d - 1);
    P.cue(s.tCatch + 0.6, function () { P.fx.sound('whistle'); });
    P.penaltyCalls(s.tCatch + 0.7, res);
  }

  // ------------------------------------------------------------ library

  function notRB(e) { return e.to !== 'RB'; }
  var LIB = [
    { name: 'Inside dive', kind: 'run', hole: 1.5, form: 'I', ok: function (e, r) { return r.yds <= 12; } },
    { name: 'Off tackle', kind: 'run', hole: 7.5, form: 'I' },
    { name: 'Toss sweep', kind: 'run', hole: 16, form: 'I', toss: true, ok: function (e, r) { return r.yds >= -3 && !(r.td && r.yds <= 2); } },
    { name: 'Shotgun draw', kind: 'run', hole: 1.5, form: 'gun', draw: true, ok: function (e, r) { return r.yds >= 0; } },
    { name: 'Goal line plunge', kind: 'run', hole: 1, form: 'I', ok: function (e, r) { return r.td && r.yds <= 3; } },

    { name: 'Quick slant', kind: 'pass', route: 'slant', ok: function (e, r) { return r.yds < 15 && notRB(e); } },
    { name: 'Out route', kind: 'pass', route: 'out', ok: function (e, r) { return r.yds < 15 && notRB(e); } },
    { name: 'Curl', kind: 'pass', route: 'curl', ok: function (e, r) { return r.yds >= 4 && r.yds < 15 && notRB(e) && !r.td; } },
    { name: 'Crossing route', kind: 'pass', route: 'cross', ok: function (e, r) { return r.yds < 22 && notRB(e); } },
    { name: 'Running back screen', kind: 'pass', route: 'screen', ok: function (e) { return e.to === 'RB'; } },
    { name: 'Go route', kind: 'pass', route: 'go', deep: true, ok: function (e, r) { return r.yds >= 15 && notRB(e); } },
    { name: 'Deep post', kind: 'pass', route: 'post', deep: true, ok: function (e, r) { return r.yds >= 15 && notRB(e); } },
    { name: 'Corner route', kind: 'pass', route: 'corner', deep: true, ok: function (e, r) { return r.yds >= 15 && notRB(e); } },
    { name: 'Fade to the corner', kind: 'pass', route: 'corner', ok: function (e, r) { return r.td && r.yds <= 14 && notRB(e); } },

    { name: 'Overthrown', kind: 'inc', how: 'over' },
    { name: 'Dropped pass', kind: 'inc', how: 'drop' },
    { name: 'Pass broken up', kind: 'inc', how: 'breakup' },
    { name: 'Throwaway', kind: 'inc', how: 'away' },

    { name: 'Edge rush sack', kind: 'sack', who: 'DL4' },
    { name: 'Edge rush sack, other side', kind: 'sack', who: 'DL1' },
    { name: 'Blitz up the middle', kind: 'sack', who: 'LB2' },
    { name: 'Coverage sack', kind: 'sack', who: 'DL2', late: true },

    { name: 'Punt and return', kind: 'punt', how: 'ret' },
    { name: 'Punt, fair catch', kind: 'punt', how: 'fair' },
    { name: 'Punt out of bounds', kind: 'punt', how: 'oob' },

    { name: 'Kick down the middle', kind: 'fg', x: 0, ok: function (e) { return e.good; } },
    { name: 'Kick inside the left upright', kind: 'fg', x: 2.1, ok: function (e) { return e.good; } },
    { name: 'Kick inside the right upright', kind: 'fg', x: -2.1, ok: function (e) { return e.good; } },
    { name: 'Kick wide left', kind: 'fg', x: 6, ok: function (e) { return !e.good; } },
    { name: 'Kick wide right', kind: 'fg', x: -6, ok: function (e) { return !e.good; } },
    { name: 'Kick falls short', kind: 'fg', x: 1, short: true, ok: function (e, r) { return !e.good && r.fgDist >= 45; } },

    { name: 'Jumped route', kind: 'int', who: 'cb' },
    { name: 'Overthrown to the safety', kind: 'int', who: 's' },

    { name: 'Strip on the tackle', kind: 'fumble' },
    { name: 'Ball punched out', kind: 'fumble', far: true },

    { name: 'Kickoff return left', kind: 'kickoff', lane: -1 },
    { name: 'Kickoff return up the middle', kind: 'kickoff', lane: 0 },
    { name: 'Kickoff return right', kind: 'kickoff', lane: 1 },

    { name: 'Kneel down', kind: 'kneel' }
  ];

  var BUILDERS = {
    run: buildRun, pass: buildPass, inc: buildInc, sack: buildSack, kneel: buildKneel,
    punt: buildPunt, fg: buildKick, int: buildInt, fumble: buildFumble, kickoff: buildKickoff
  };

  // Pick at random among the scripted plays that can act out this event.
  function pick(kind, e, res, rng) {
    var c = LIB.filter(function (p) { return p.kind === kind && (!p.ok || p.ok(e, res)); });
    if (!c.length) c = LIB.filter(function (p) { return p.kind === kind; });
    return c[Math.floor(rng() * c.length)];
  }

  function build(e, res, ctx) {
    var P;
    if (e.t === 'pen') {
      if (e.kind === 'holding') { P = new Play(ctx, 'Holding on the offense'); buildHolding(P, e, res); }
      else if (e.kind === 'dpi') { P = new Play(ctx, 'Pass interference'); buildDPI(P, e, res); }
      else { P = new Play(ctx, e.kind === 'offside' ? 'Offside' : 'False start'); buildPresnapFoul(P, e, res); }
    } else {
      var kind = e.t === 'xp' ? 'fg' : e.t;
      var v = pick(kind, e, res, ctx.rng);
      P = new Play(ctx, v.name);
      BUILDERS[kind](P, e, res, v);
    }
    P.cues.sort(function (a, b) { return a.t - b.t; });
    P.ball.sort(function (a, b) { return a.t - b.t; });
    return P;
  }

  // ------------------------------------------------------------ sampling

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

  function segPos(play, i, t) {
    var s = play.ball[i];
    if (s.kind === 'held') {
      var p = posAt(s.a, t);
      return { x: p.x, y: p.y, z: 0, holder: s.a, hl: s.hl };
    }
    var u = clamp((t - s.t) / Math.max(0.001, s.t1 - s.t), 0, 1);
    var from = i > 0 ? segPos(play, i - 1, s.t) : (s.to || posAt(s.a, s.t1));
    var to = s.a ? posAt(s.a, s.t1) : s.to;
    return { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u, z: s.h * 4 * u * (1 - u), holder: null, hl: false };
  }

  function ballAt(play, t) {
    var b = play.ball, i = 0;
    for (var j = 0; j < b.length; j++) if (b[j].t <= t) i = j;
    return segPos(play, i, t);
  }

  root.FF_PLAYS = { build: build, posAt: posAt, ballAt: ballAt, LIB: LIB, CX: CX };
})(typeof window !== 'undefined' ? window : globalThis);
