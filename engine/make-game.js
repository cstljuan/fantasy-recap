// The game maker. It takes the week's fantasy stat lines for two rosters and builds a full,
// legal football game in which every player ends with exactly those numbers.
//
// How it works:
//   1. The stat lines become a budget: every catch, carry, touchdown, kick and turnover.
//   2. The budget is dealt into drives. Each drive has an ending (touchdown, field goal,
//      punt, interception, fumble) and the touches that happen in it.
//   3. Inside a drive, the play caller chooses the next play from the plays that still let
//      the drive finish legally. The play caller is Jev (engine/jev.js): it returns a
//      probability for every option, and the pick is drawn from those probabilities.
//      With --no-jev, or when Jev cannot be reached, every option gets the same weight.
//   4. js/rules.js referees every play. The finished game is replayed from scratch and its
//      stat lines are compared with the targets. A game that does not match is thrown away.
//
//   node engine/make-game.js --from-sample --seed 7 --out data/games/week11-football.json
//   node engine/make-game.js --from-sample --no-jev          (no network, same checks)
//   node engine/make-game.js --lines data/statlines/week11-tur-owl.json --teams TUR,OWL --no-jev --out data/games/week11-tur-owl.json
//     builds the game from a stat lines file (shape: data/statlines/README.md); carries and kick distances are chosen by the maker
//   node engine/make-game.js --plays data/rosters/plays-2026.json --week 9 [--teams GOB,PYT] --out data/games/<id>.json
//     builds the game from a real week: every catch and run our players really made that week, with its real yards
//     and touchdown, their real field goals (distance band and result), sacks, interceptions and lost fumbles.
//     Drive starts, incompletions and penalties are the filler that makes the drives fit. The quarterback's passing
//     is the catches by our own receivers, not every real throw of that week.
'use strict';
const fs = require('fs');
const path = require('path');
const Rules = require('../js/rules.js');
const Data = require('../js/data.js');
const jev = require('./jev.js');

// ---------------------------------------------------------------- small tools
function rngFrom(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function clone(s) { return Object.assign({}, s, { score: s.score.slice() }); }
function round1(x) { return Math.round(x * 10) / 10; }
const RECEIVERS = ['WR1', 'WR2', 'WR3', 'TE', 'RB'];

// ---------------------------------------------------------------- stat lines
// The stat lines of a finished game, read by replaying it through the rules.
function statlines(teams, game) {
  const s = Rules.create(teams);
  const out = teams.map(function () { return { players: {}, fg: [], xpGood: 0, xpMiss: 0, ints: 0, sacks: 0, fumbles: [], points: {}, score: 0 }; });
  function P(t, slot) { const p = out[t].players; return p[slot] || (p[slot] = { rec: 0, recYds: 0, recTD: 0, rush: 0, rushYds: 0, rushTD: 0 }); }
  Rules.flatten(game, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); return; }
    if (st.kind !== 'play') return;
    const e = st.e, t = st.team, r = Rules.apply(s, e, t);
    r.fp.forEach(function (f) { out[f.team].points[f.role] = round1((out[f.team].points[f.role] || 0) + f.pts); });
    if (e.t === 'pass') { const p = P(t, e.to); p.rec++; p.recYds += e.yds; if (r.td) p.recTD++; }
    if (e.t === 'run') { const p = P(t, e.by); p.rush++; p.rushYds += e.yds; if (r.td) p.rushTD++; }
    if (e.t === 'fumble') out[t].fumbles.push({ by: e.by, yds: e.yds });
    if (e.t === 'fg') out[t].fg.push({ good: !!e.good, dist: r.fgDist });
    if (e.t === 'xp') { if (e.good) out[t].xpGood++; else out[t].xpMiss++; }
    if (e.t === 'int') out[t].ints++;
    if (e.t === 'sack') out[t].sacks++;
  });
  out.forEach(function (o, i) { o.score = s.score[i]; });
  return out;
}

function fgClass(dist) { return dist >= 50 ? 2 : dist >= 40 ? 1 : 0; }
function sameLines(a, b) {
  const diffs = [];
  a.forEach(function (ta, i) {
    const tb = b[i];
    const roles = ta.points ? Object.keys(Object.assign({}, ta.points, tb.points)) : [];   // real-week targets have no points yet
    roles.forEach(function (role) { if (round1(ta.points[role] || 0) !== round1(tb.points[role] || 0)) diffs.push('team ' + i + ' ' + role + ' points ' + (ta.points[role] || 0) + ' vs ' + (tb.points[role] || 0)); });
    Object.keys(Object.assign({}, ta.players, tb.players)).forEach(function (slot) {
      const x = ta.players[slot] || {}, y = tb.players[slot] || {};
      ['rec', 'recYds', 'recTD', 'rush', 'rushYds', 'rushTD'].forEach(function (k) { if ((x[k] || 0) !== (y[k] || 0)) diffs.push('team ' + i + ' ' + slot + ' ' + k + ' ' + (x[k] || 0) + ' vs ' + (y[k] || 0)); });
    });
    if (ta.score !== null && ta.score !== tb.score) diffs.push('team ' + i + ' score ' + ta.score + ' vs ' + tb.score);
    if (ta.fgCount !== undefined && tb.fg.filter(function (k) { return k.good; }).length !== ta.fgCount) diffs.push('team ' + i + ' field goals made differ');
  });
  return diffs;
}

// ---------------------------------------------------------------- the budget
function budgetFor(line) {
  const touches = [];
  Object.keys(line.players).forEach(function (slot) {
    const p = line.players[slot];
    if (p.touches) {   // a real week: each touch keeps its real yards and touchdown
      p.touches.forEach(function (t) { touches.push({ slot: slot, kind: t.kind, td: !!t.td, yds: t.yds, fixed: true, real: t.ref || null }); });
      return;
    }
    for (let i = 0; i < p.rec; i++) touches.push({ slot: slot, kind: 'pass', td: i < p.recTD });
    for (let i = 0; i < p.rush; i++) touches.push({ slot: slot, kind: 'run', td: i < p.rushTD });
  });
  const left = {};
  Object.keys(line.players).forEach(function (slot) {
    const p = line.players[slot];
    left[slot + ':pass'] = { n: p.rec, yds: p.recYds };
    left[slot + ':run'] = { n: p.rush, yds: p.rushYds };
  });
  return { touches: touches, left: left, fg: line.fg.slice(), xp: [], ints: line.ints, sacks: line.sacks, fumbles: line.fumbles.slice(), xpGood: line.xpGood, xpMiss: line.xpMiss,
    sackYds: line.sackYds ? line.sackYds.slice() : null };
}

// Deal a team's budget into `count` drives.
function planDrives(r, b, count) {
  const drives = [];
  b.touches.filter(function (t) { return t.td; }).forEach(function (t) { drives.push({ end: 'td', last: t, touches: [] }); });
  b.fg.forEach(function (k) { drives.push({ end: 'fg', kick: k, touches: [] }); });
  for (let i = 0; i < b.ints; i++) drives.push({ end: 'int', touches: [] });
  b.fumbles.forEach(function (f) { drives.push({ end: 'fumble', fumble: f, touches: [] }); });
  while (drives.length < count) drives.push({ end: 'punt', touches: [] });
  if (drives.length > count) return null;
  const order = shuffle(r, drives);
  const weight = { td: 6, fg: 5, punt: 2.6, int: 2.4, fumble: 2 };
  const rest = shuffle(r, b.touches.filter(function (t) { return !t.td; }));
  const total = order.reduce(function (a, d) { return a + weight[d.end]; }, 0);
  let given = 0;
  order.forEach(function (d, i) {
    let n = i === order.length - 1 ? rest.length - given : Math.round(rest.length * weight[d.end] / total + (r() - 0.5));
    n = Math.max(0, Math.min(n, rest.length - given));
    d.touches = rest.slice(given, given + n); given += n;
  });
  const sackDrives = order.filter(function (d) { return d.end !== 'td'; });
  order.forEach(function (d) { d.sacks = 0; });
  for (let i = 0; i < b.sacks; i++) pick(r, sackDrives.length ? sackDrives : order).sacks++;
  if (b.sackYds) { const pool = shuffle(r, b.sackYds); order.forEach(function (d) { d.sackYds = pool.splice(0, d.sacks); }); }
  const xps = shuffle(r, Array(b.xpGood).fill(true).concat(Array(b.xpMiss).fill(false)));
  order.filter(function (d) { return d.end === 'td'; }).forEach(function (d, i) { d.xp = xps[i] !== undefined ? xps[i] : true; });
  return order;
}

// ---------------------------------------------------------------- one drive
// Give yards to this drive's touches so that the drive can end the way it has to.
// Returns the list of items to play (touches, penalties, sacks) or null if it cannot work.
function specFor(r, d, b, start, freeStart) {
  const cap = { pass: 55, run: 40 };
  const all = d.touches.concat(d.last ? [d.last] : []);
  const groups = {};
  all.forEach(function (t) { const k = t.slot + ':' + t.kind; (groups[k] = groups[k] || []).push(t); });
  let lo = 0, hi = 0; const ranges = {};
  for (const k in groups) {
    if (groups[k].every(function (t) { return t.fixed; })) {
      const sum = groups[k].reduce(function (a, t) { return a + t.yds; }, 0);
      ranges[k] = { lo: sum, hi: sum }; lo += sum; hi += sum; continue;
    }
    const L = b.left[k], m = groups[k].length, future = L.n - m, kind = k.split(':')[1];
    if (future < 0) return null;
    const minFuture = L.yds >= L.n ? future : 0;
    const a = Math.max(L.yds >= L.n ? m : 0, L.yds - future * cap[kind]);
    const z = Math.min(L.yds - minFuture, m * cap[kind]);
    if (future === 0 && (L.yds > m * cap[kind])) return null;
    if (a > z) return null;
    ranges[k] = { lo: future === 0 ? L.yds : a, hi: future === 0 ? L.yds : z }; lo += ranges[k].lo; hi += ranges[k].hi;
  }
  const sackYds = []; for (let i = 0; i < d.sacks; i++) sackYds.push(d.sackYds && d.sackYds[i] !== undefined ? d.sackYds[i] : -int(r, 2, 9));
  const sackSum = sackYds.reduce(function (a, y) { return a + y; }, 0);
  const fumbleYds = d.fumble ? d.fumble.yds : 0;
  let want, s = start, pen = 0;
  if (d.end === 'td') {
    if (freeStart) { const t = Math.max(lo, Math.min(hi, int(r, 55, 82))); s = 100 - t - sackSum; if (s < 8 || s > 55) return null; want = t; }
    else { want = 100 - start - sackSum; if (want > hi) { pen = want - hi; want = hi; } if (want < lo) return null; if (pen > 70) return null; }
  } else if (d.end === 'fg') {
    const c = d.kick.good ? fgClass(d.kick.dist) : int(r, 0, 1);
    const band = [[78, 93], [68, 77], [63, 67]][c];
    const spot = int(r, band[0], band[1]);
    if (freeStart) { const t = Math.max(lo, Math.min(hi, int(r, 30, 60))); s = spot - t - sackSum; if (s < 8 || s > 60) return null; want = t; }
    else { want = spot - start - sackSum; if (want > hi) { pen = want - hi; want = hi; } if (want < lo) return null; if (pen > 60) return null; }
  } else {
    if (freeStart) s = int(r, 18, 38);
    const room = (d.end === 'punt' ? 68 : 90) - s - sackSum - fumbleYds;
    if (lo > room) return null;
    want = Math.max(lo, Math.min(hi, room, lo + int(r, 0, Math.max(0, Math.min(hi, room) - lo))));
  }
  // split `want` across the groups, then across each group's touches
  let extra = want - lo; const keys = shuffle(r, Object.keys(groups)); const share = {};
  keys.forEach(function (k) { share[k] = ranges[k].lo; });
  let guard = 0;
  while (extra > 0 && guard++ < 5000) { const k = pick(r, keys); if (share[k] < ranges[k].hi) { share[k]++; extra--; } }
  if (extra > 0) return null;
  const items = [];
  keys.forEach(function (k) {
    const ts = groups[k], kind = k.split(':')[1];
    if (ts.every(function (t) { return t.fixed; })) {
      ts.forEach(function (t) { items.push({ type: 'touch', slot: t.slot, kind: t.kind, yds: t.yds, td: t === d.last, real: t.real }); });
      return;
    }
    let left = share[k]; const base = left >= ts.length ? 1 : 0;
    const y = ts.map(function () { return base; }); left -= base * ts.length; let g = 0;
    while (left > 0 && g++ < 5000) { const i = Math.floor(r() * ts.length); if (y[i] < cap[kind]) { const add = Math.min(left, int(r, 1, 6)); y[i] += Math.min(add, cap[kind] - y[i]); left -= Math.min(add, cap[kind] - (y[i] - Math.min(add, cap[kind] - y[i]))) > 0 ? Math.min(add, left) : 0; } }
    const sum = y.reduce(function (a, v) { return a + v; }, 0);
    if (sum !== share[k]) { y[0] += share[k] - sum; if (y[0] < 0 || y[0] > cap[kind] + 12) { items.bad = true; } }
    ts.forEach(function (t, i) { items.push({ type: 'touch', slot: t.slot, kind: t.kind, yds: y[i], td: t === d.last }); });
  });
  if (items.bad) return null;
  sackYds.forEach(function (y) { items.push({ type: 'sack', yds: y }); });
  while (pen > 0) { const p = pen >= 12 ? Math.min(pen, int(r, 12, 35)) : pen === 5 ? 5 : pen; items.push(p === 5 ? { type: 'offside' } : { type: 'dpi', spot: p, to: pick(r, ['WR1', 'WR2', 'WR3', 'TE']) }); pen -= p; }
  return { start: s, items: items, incs: d.end === 'td' || d.end === 'fg' ? int(r, 0, 3) : int(r, 0, 2) };
}

function eventFor(it) {
  if (it.type === 'touch') return it.kind === 'pass' ? { t: 'pass', to: it.slot, yds: it.yds } : { t: 'run', by: it.slot, yds: it.yds };
  if (it.type === 'sack') return { t: 'sack', yds: it.yds };
  if (it.type === 'offside') return { t: 'pen', kind: 'offside' };
  if (it.type === 'dpi') return { t: 'pen', kind: 'dpi', to: it.to, spot: it.spot };
  if (it.type === 'inc') return { t: 'inc', to: it.to };
  return it.event;
}

// Try to finish the drive from `state` with `items` left, in a random order. Returns the events or null.
function rollout(r, state, team, d, items, incs) {
  const s = clone(state); const out = [];
  let pool = shuffle(r, items.filter(function (it) { return !it.td; })); const last = items.filter(function (it) { return it.td; })[0];
  let incLeft = incs;
  function play(e) { const res = Rules.apply(s, e, team); out.push(e); return res; }
  try {
    while (pool.length) {
      if (s.poss !== team || s.awaiting) return null;
      if (incLeft > 0 && s.down < 3 && r() < 0.18) { incLeft--; play({ t: 'inc', to: pick(r, RECEIVERS) }); continue; }
      let i = 0;
      if (s.down === 4) { i = pool.findIndex(function (it) { return it.type === 'dpi' || it.type === 'offside' || (it.type === 'touch' && it.yds >= s.toGo); }); if (i < 0) return null; }
      const it = pool.splice(i, 1)[0];
      if (it.type === 'touch' && s.ballOn + it.yds >= 100) return null;
      if (it.type === 'sack' && s.ballOn + it.yds < 2) return null;
      if (it.type === 'dpi' && s.ballOn + it.spot > 99) return null;
      const res = play(eventFor(it)); if (res.downs || res.td) return null;
    }
    if (s.poss !== team || s.awaiting) return null;
    if (d.end === 'td') {
      if (!last || s.ballOn + last.yds !== 100) return null;
      const res = play(eventFor(last)); if (!res.td) return null;
      play({ t: 'xp', good: d.xp });
    } else if (d.end === 'fumble') {
      if (s.ballOn + d.fumble.yds > 98 || s.ballOn + d.fumble.yds < 2) return null;
      play({ t: 'fumble', by: d.fumble.by, yds: d.fumble.yds });
    } else if (d.end === 'int') {
      const at = int(r, 4, Math.max(4, Math.min(28, 97 - s.ballOn))), ret = int(r, 0, 12);
      const own = 100 - (s.ballOn + at) + ret; if (own < 2 || own > 98) return null;
      play({ t: 'int', to: pick(r, ['WR1', 'WR2', 'WR3', 'TE']), at: at, ret: ret });
    } else {
      while (s.down < 4) { if (s.poss !== team) return null; play({ t: 'inc', to: pick(r, RECEIVERS) }); }
      if (d.end === 'fg') {
        const dist = (100 - s.ballOn) + 17;
        if (d.kick.good && fgClass(dist) !== fgClass(d.kick.dist)) return null;
        if (dist > 58) return null;
        play({ t: 'fg', good: d.kick.good });
      } else {
        if (s.ballOn > 70) return null;
        play({ t: 'punt', net: Math.min(int(r, 34, 52), 99 - s.ballOn + int(r, 0, 8)) });
      }
    }
    return out;
  } catch (err) { return null; }
}

// ---------------------------------------------------------------- the play caller
const LABEL = { QB: 'quarterback', RB: 'running back', WR1: 'wide receiver', WR2: 'wide receiver', WR3: 'wide receiver', TE: 'tight end', K: 'kicker' };
function callKey(e) {
  if (e.t === 'pass' || e.t === 'inc') return 'pass_' + e.to;
  if (e.t === 'run' || e.t === 'fumble') return 'run_' + e.by;
  return null; // sacks, penalties, kicks and turnovers are not calls
}

async function choose(ctx, options) {
  // options: [{ key, events }] distinct calls that still let the drive finish
  if (options.length === 1 || !ctx.useJev) return { key: pick(ctx.r, options).key, why: null };
  const T = ctx.teams[ctx.team], s = ctx.state, criteria = {};
  options.forEach(function (o) {
    const slot = o.key.split('_')[1];
    criteria[o.key] = (o.key.startsWith('pass_') ? 'Pass to ' : 'Hand the ball to ') + T.roster[slot] + ', ' + LABEL[slot];
  });
  const state = {
    sport: 'American football', offense: T.full, quarterback: T.roster.QB,
    down: s.down, yards_to_go: s.toGo, yards_from_own_goal_line: s.ballOn, yards_to_the_end_zone: 100 - s.ballOn,
    score_offense: s.score[ctx.team], score_defense: s.score[1 - ctx.team], half: s.half,
    previous_play: ctx.prev || 'none',
    player_tendencies: ctx.tendencies || 'not available'
  };
  try {
    const out = await jev.decide(state, {
      play: { type: 'choice', instructions: 'Which play should this offense call next in this situation?', criteria: criteria },
      highlight: { type: 'noul', instructions: 'Is this a high-leverage snap that a broadcast would replay?' }
    });
    const probs = out.answers.play.probabilities; let x = ctx.r(), sum = 0, key = options[0].key;
    const total = options.reduce(function (a, o) { return a + (probs[o.key] || 0); }, 0) || 1;
    for (const o of options) { sum += (probs[o.key] || 0) / total; if (x <= sum) { key = o.key; break; } }
    ctx.model = out.model;
    return { key: key, why: { play: probs, picked: key, highlight: round1(out.answers.highlight.noul * 100) / 100, by: 'jev' } };
  } catch (err) {
    ctx.jevErrors = (ctx.jevErrors || 0) + 1; if (ctx.jevErrors > 4) ctx.useJev = false;
    return { key: pick(ctx.r, options).key, why: null };
  }
}

// Play one drive: at each snap find the calls that still work, let the play caller pick.
async function playDrive(ctx, d, spec) {
  const r = ctx.r, team = ctx.team; let items = spec.items.slice(), incs = spec.incs; const events = [];
  for (let snap = 0; snap < 60; snap++) {
    const firsts = {};
    for (let i = 0; i < 90; i++) {
      const line = rollout(r, ctx.state, team, d, items, incs);
      if (!line) continue;
      const k = callKey(line[0]) || '_engine';
      if (!firsts[k]) firsts[k] = line;
      if (Object.keys(firsts).length >= 5) break;
    }
    const keys = Object.keys(firsts);
    if (!keys.length) return null;
    let line, why = null;
    if (firsts._engine && (keys.length === 1 || r() < 0.25)) line = firsts._engine;
    else {
      const options = keys.filter(function (k) { return k !== '_engine'; }).map(function (k) { return { key: k, events: firsts[k] }; });
      const c = await choose(ctx, options); line = firsts[c.key]; why = c.why;
    }
    const e = Object.assign({}, line[0]);
    if (why) { e.why = why; if (why.highlight >= 0.6) e.tags = ['highlight']; }
    const res = Rules.apply(ctx.state, e, team);
    events.push(e); ctx.prev = res.text;
    // remove what was just used
    if (e.t === 'inc') incs = Math.max(0, incs - 1);
    else {
      const idx = items.findIndex(function (it) { const x = eventFor(it); return x.t === e.t && (x.to || x.by || '') === (e.to || e.by || '') && (x.yds === undefined || x.yds === e.yds) && (x.spot === undefined || x.spot === e.spot) && (x.kind || '') === (e.kind || ''); });
      if (idx >= 0) items.splice(idx, 1);
    }
    if (res.td) { const xp = { t: 'xp', good: d.xp }; Rules.apply(ctx.state, xp, team); events.push(xp); return events; }
    if (res.flip || ctx.state.awaiting === 'kickoff') return events;
  }
  return null;
}

// ---------------------------------------------------------------- the whole game
async function attempt(teams, targets, seed, useJev, profiles) {
  const r = rngFrom(seed);
  const budgets = targets.map(budgetFor);
  const need = budgets.map(function (b) { return b.touches.filter(function (t) { return t.td; }).length + b.fg.length + b.ints + b.fumbles.length; });
  let count = Math.max(need[0] + 1, need[1] + 1, Math.ceil(Math.max(budgets[0].touches.length, budgets[1].touches.length) / 5.2));
  if (count % 2) count++;
  const plans = budgets.map(function (b) { return planDrives(r, b, count); });
  if (!plans[0] || !plans[1]) return null;
  const state = Rules.create(teams);
  const ctx = { r: r, teams: teams, state: state, useJev: useJev, team: 0, prev: '', model: '' };
  const drives = []; const firstTeam = int(r, 0, 1); const used = [0, 0];
  for (let i = 0; i < count * 2; i++) {
    const secondHalf = i >= count; const half = secondHalf && i === count;
    const team = !secondHalf ? (i % 2 === 0 ? firstTeam : 1 - firstTeam) : ((i - count) % 2 === 0 ? 1 - firstTeam : firstTeam);
    if (half) Rules.startHalf(state);
    const d = plans[team][used[team]++]; const b = budgets[team];
    const kickoff = state.awaiting === 'kickoff';
    if (!kickoff && state.poss !== team) return null;
    let spec = null;
    for (let t = 0; t < 40 && !spec; t++) {
      const cand = specFor(r, d, b, kickoff ? 25 : state.ballOn, kickoff);
      if (!cand) continue;
      const probe = clone(state);
      try { if (kickoff) Rules.apply(probe, { t: 'kickoff', to: cand.start }, team); } catch (err) { return null; }
      let ok = false; for (let k = 0; k < 60 && !ok; k++) ok = !!rollout(r, probe, team, d, cand.items, cand.incs);
      if (ok) spec = cand;
    }
    if (!spec) return null;
    const plays = [];
    if (kickoff) { const ko = { t: 'kickoff', to: spec.start }; Rules.apply(state, ko, team); plays.push(ko); }
    ctx.team = team;
    ctx.tendencies = profiles && profiles[teams[team].id] ? profiles[teams[team].id] : 'not available';
    const evs = await playDrive(ctx, d, spec);
    if (!evs) return null;
    evs.forEach(function (e) { plays.push(e); });
    spec.items.forEach(function (it) { if (it.type === 'touch') { const L = b.left[it.slot + ':' + it.kind]; L.n--; L.yds -= it.yds; } });
    const drive = { team: teams[team].id, plays: plays }; if (half) drive.half = 2;
    drives.push(drive);
  }
  const game = { note: 'Built by the game maker from the week\'s stat lines. Every play was checked by the rules engine.', drives: drives };
  let made; try { made = statlines(teams, game); } catch (err) { return null; }
  const diffs = sameLines(targets, made);
  return diffs.length ? null : { game: game, made: made, model: ctx.model, jevOn: ctx.useJev };
}

function tendencyText(file) {
  try {
    const p = JSON.parse(fs.readFileSync(file, 'utf8')); const out = {};
    Object.keys(p.players || {}).forEach(function (slot) { const t = p.players[slot].tendencies || {}; const known = Object.keys(t).filter(function (k) { return t[k] !== null && t[k] !== undefined; }); if (known.length) out[p.players[slot].name] = known.map(function (k) { return k + ' ' + t[k]; }).join(', '); });
    return Object.keys(out).length ? out : null;
  } catch (err) { return null; }
}

// ---------------------------------------------------------------- a real week
// Target lines from data/rosters/plays-2026.json (agents/scout/plays.py) for one week: each roster player's real
// catches and runs with their yards, kicks, sacks, interceptions and lost fumbles. Plays wiped out by a penalty and
// accepted pass interference are left out. Points and score are not known before the game is built.
function linesFromPlays(doc, week, teams) {
  return teams.map(function (T) {
    const out = { players: {}, fg: [], xpGood: 0, xpMiss: 0, ints: 0, sacks: 0, sackYds: [], fumbles: [], points: null, score: null, used: [] };
    Object.keys(T.roster).forEach(function (slot) {
      const pl = doc.players[T.id + '.' + slot];
      const p = out.players[slot] = { rec: 0, recYds: 0, recTD: 0, rush: 0, rushYds: 0, rushTD: 0, touches: [] };
      if (!pl || pl.name !== T.roster[slot]) return;
      pl.plays.forEach(function (x) {
        if (x.wk !== week || x.nullified || (x.dpi && x.kind === 'inc')) return;
        const ref = { event: x.ev, q: x.q, clock: x.clk, text: (x.text || '').slice(0, 140) };
        const use = function () { out.used.push(Object.assign({ slot: slot }, ref)); };
        if (x.role === 'target' && x.kind === 'pass' && typeof x.yds === 'number') {
          p.rec++; p.recYds += x.yds; if (x.td) p.recTD++; p.touches.push({ kind: 'pass', yds: x.yds, td: !!x.td, ref: ref }); use();
        } else if (x.role === 'rusher' && (x.kind === 'run' || x.kind === 'scramble') && typeof x.yds === 'number') {
          p.rush++; p.rushYds += x.yds; if (x.td) p.rushTD++; p.touches.push({ kind: 'run', yds: x.yds, td: !!x.td, ref: ref }); use();
        } else if (x.role === 'passer' && x.kind === 'int') { out.ints++; use(); }
        else if (x.role === 'passer' && x.kind === 'sack') { out.sacks++; out.sackYds.push(Math.min(-1, Math.max(-15, x.yds || -5))); use(); }
        else if (x.role === 'kicker' && x.kind === 'fg' && typeof x.dist_fg === 'number') { out.fg.push({ good: !!x.good, dist: x.dist_fg }); use(); }
      });
    });
    out.fgCount = out.fg.filter(function (k) { return k.good; }).length;
    // extra points follow the touchdowns of this game, not the kicker's real team
    out.xpGood = Object.keys(out.players).reduce(function (n, s) { return n + out.players[s].recTD + out.players[s].rushTD; }, 0);
    return out;
  });
}

// ---------------------------------------------------------------- a stat lines file
// Target lines from a file like data/statlines/week11-tur-owl.json (shape: data/statlines/README.md). The file has no
// carries, no field goal distances and no extra point misses, so the maker chooses them, the same way every time:
//   carries      rushing yards over 4.2 rounded, at least the rushing touchdowns, at least 1 when there are yards
//   field goals  made ones from 32, 41, 28, 47, 52, 36 yards in turn, missed ones from 45 yards
//   extra points the made ones are the kick after a touchdown; a touchdown without one is a missed kick
// A team's sacks taken are the other defense's sacks; its interceptions thrown are its quarterback's; fumbles come from
// the other defense's fumble recoveries (none in the file used so far). Every line is checked against the file by
// replaying the finished game (sameLines), and the score against the opposite defense's points_allowed.
function linesFromStatlines(doc, teams) {
  const KICKS = [32, 41, 28, 47, 52, 36];
  return teams.map(function (T, ti) {
    const mine = doc.teams[T.id], other = doc.teams[teams[1 - ti].id];
    if (!mine || !other) throw new Error('the stat lines file has no team ' + T.id + ' and ' + teams[1 - ti].id);
    const out = { players: {}, fg: [], xpGood: 0, xpMiss: 0, ints: 0, sacks: 0, sackYds: [], fumbles: [], points: null, score: null };
    let tds = 0, kick = 0;
    Object.keys(T.roster).forEach(function (slot) {
      const pl = mine.players[slot];
      if (!pl || pl.name !== T.roster[slot]) throw new Error('the stat lines file has ' + (pl && pl.name) + ' for ' + T.id + ' ' + slot + ', the roster has ' + T.roster[slot]);
      const l = pl.line || {};
      const rushTD = l.rush_td || 0, carries = (l.rush_yards || 0) > 0 || rushTD ? Math.max(1, rushTD, Math.round((l.rush_yards || 0) / 4.2)) : 0;
      out.players[slot] = { rec: l.receptions || 0, recYds: l.rec_yards || 0, recTD: l.rec_td || 0, rush: carries, rushYds: l.rush_yards || 0, rushTD: rushTD };
      tds += (l.rec_td || 0) + rushTD;
      out.ints += l.interceptions || 0;
      for (let i = 0; i < (l.fg_made || 0); i++) out.fg.push({ good: true, dist: KICKS[kick++ % KICKS.length] });
      for (let i = 0; i < (l.fg_missed || 0); i++) out.fg.push({ good: false, dist: 45 });
      out.xpGood += l.xp_made || 0;
    });
    out.xpMiss = Math.max(0, tds - out.xpGood);
    const od = (other.defense && other.defense.line) || {};
    out.sacks = od.sacks || 0;
    for (let i = 0; i < (od.fumble_recoveries || 0); i++) out.fumbles.push({ by: 'RB', yds: 5 });
    out.pointsAllowedByOther = od.points_allowed;
    return out;
  });
}

// Highlights: touchdowns, turnovers and gains of 20 yards or more get e.tags = ['highlight', <reason>...]
// (reasons: touchdown, turnover, big-play). Plays the maker already tagged keep their tags.
function tagGame(game, teams) {
  const s = Rules.create(teams);
  let n = 0;
  Rules.flatten(game, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); return; }
    if (st.kind !== 'play') return;
    const e = st.e, r = Rules.apply(s, e, st.team), why = [];
    if (r.td) why.push('touchdown');
    if (e.t === 'int' || e.t === 'fumble') why.push('turnover');
    if ((e.t === 'pass' || e.t === 'run') && e.yds >= 20) why.push('big-play');
    if (!why.length) return;
    const have = Array.isArray(e.tags) ? e.tags : [];
    e.tags = ['highlight'].concat(why).concat(have.filter(function (t) { return t !== 'highlight' && why.indexOf(t) < 0; }));
    n++;
  });
  return n;
}

function teamsFor(ids) {
  return ids.map(function (id) {
    const t = Data.TEAMS.filter(function (x) { return x.id === id; })[0];
    if (t) return t;
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'rosters', id + '.json'), 'utf8'));
    return { id: d.team, name: d.name, full: d.full, colors: d.colors, roster: d.roster };
  });
}

async function main() {
  const a = process.argv.slice(2);
  function arg(name, dflt) { const i = a.indexOf(name); return i >= 0 && a[i + 1] ? a[i + 1] : dflt; }
  let teams = Data.TEAMS;
  let targets, source = { from: 'sample', note: 'the scripted sample game in js/data.js' };
  if (a.indexOf('--from-sample') >= 0) targets = statlines(teams, Data.SAMPLE_GAME);
  else if (arg('--plays', '')) {
    const week = parseInt(arg('--week', ''), 10);
    if (!(week >= 1)) { console.error('Give the week: --week <n>'); process.exit(2); }
    teams = teamsFor(arg('--teams', 'GOB,PYT').split(','));
    const doc = JSON.parse(fs.readFileSync(arg('--plays'), 'utf8'));
    targets = linesFromPlays(doc, week, teams);
    source = { from: 'plays', file: arg('--plays'), week: week, season: doc.season,
      note: 'every catch and run our players really made in week ' + week + ' (ESPN play-by-play), with real yards and touchdowns; field goals keep their real distance band and result; sacks and interceptions are real; drive starts, incompletions and penalties are filler; the quarterback\'s passing is the catches by our own receivers; extra points follow this game\'s touchdowns',
      used: targets.map(function (t, i) { return { team: teams[i].id, plays: t.used }; }) };
    targets.forEach(function (t) { delete t.used; });
  }
  else if (arg('--lines', '')) {
    const doc = JSON.parse(fs.readFileSync(arg('--lines'), 'utf8'));
    const ids = arg('--teams', Object.keys(doc.teams).join(',')).split(',').map(function (x) { return path.basename(x, '.json'); });
    if (ids.length !== 2) { console.error('--teams needs two teams'); process.exit(2); }
    teams = teamsFor(ids);
    targets = linesFromStatlines(doc, teams);
    source = { from: 'statlines', file: arg('--lines'), week: doc.week, invented: !!doc.invented,
      note: 'built from the stat lines in ' + arg('--lines') + (doc.invented ? ' (invented numbers; the player names are real)' : '') + '; carries, field goal distances and the order of everything else are chosen by the maker' };
  }
  else { console.error('Give the stat lines: --from-sample (uses the sample game in js/data.js), --plays <file> --week <n>, or --lines <stat lines file> [--teams TUR,OWL]'); process.exit(2); }

  const useJev = a.indexOf('--no-jev') < 0 && jev.hasKey();
  const profiles = {}; teams.forEach(function (t) { const x = tendencyText(path.join(__dirname, '..', 'data', 'profiles', t.id + '.json')); if (x) profiles[t.id] = x; });
  const seed0 = parseInt(arg('--seed', '1'), 10);
  // Find a seed that works without calling Jev, then build that game with Jev choosing.
  let found = null, tries = 0;
  for (let s = seed0; s < seed0 + 4000 && !found; s++) { tries++; const g = await attempt(teams, targets, s, false, profiles); if (g) found = s; }
  if (found === null) { console.error('No legal game found in ' + tries + ' tries.'); process.exit(1); }
  let result = null;
  if (useJev) { for (let k = 0; k < 6 && !result; k++) result = await attempt(teams, targets, found + k * 100003, true, profiles); }
  if (!result) result = await attempt(teams, targets, found, false, profiles);
  if (!result) { console.error('The game could not be rebuilt.'); process.exit(1); }
  if (source.from === 'statlines') {
    const bad = targets.map(function (t, i) { return t.pointsAllowedByOther !== undefined && t.pointsAllowedByOther !== result.made[i].score ? teams[1 - i].id + ' defense allowed ' + t.pointsAllowedByOther + ' in the file but ' + teams[i].id + ' scored ' + result.made[i].score : null; }).filter(Boolean);
    if (bad.length) console.error('NOTE: ' + bad.join('; '));
  }
  const tagged = tagGame(result.game, teams);
  const plays = result.game.drives.reduce(function (n, d) { return n + d.plays.length; }, 0);
  const called = result.game.drives.reduce(function (n, d) { return n + d.plays.filter(function (e) { return e.why; }).length; }, 0);
  const file = { version: 1, sport: 'football', teams: teams, game: result.game,
    report: { seedTried: tries, plays: plays, playsChosenByJev: called, model: result.model || null, jev: jev.usage(), score: result.made.map(function (m) { return m.score; }), points: result.made.map(function (m) { return m.points; }), matchesTargets: true, highlights: tagged, source: source } };
  const outFile = arg('--out', '');
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(file, null, 1));
  console.log('OK: a legal game that reproduces every stat line.');
  console.log('  tries without Jev to find a workable plan: ' + tries);
  console.log('  plays: ' + plays + ', chosen by Jev: ' + called + (result.model ? ' (' + result.model + ')' : ' (Jev not used)'));
  console.log('  score: ' + teams[0].id + ' ' + result.made[0].score + ', ' + teams[1].id + ' ' + result.made[1].score);
  console.log('  Jev calls: ' + jev.usage().calls + ', input tokens: ' + jev.usage().inputTokens);
  if (outFile) console.log('  written to ' + outFile);
}

module.exports = { statlines: statlines, attempt: attempt, linesFromStatlines: linesFromStatlines, tagGame: tagGame };
if (require.main === module) main().catch(function (err) { console.error(err); process.exit(1); });
