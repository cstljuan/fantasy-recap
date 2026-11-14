// The soccer match maker. It takes fantasy soccer stat lines for two rosters and builds a
// full, legal match in the soccer event format in which every player ends with exactly
// those numbers. Same idea as engine/make-game.js for football.
//
// How it works:
//   1. The stat lines become key moments: every goal (with its assist), every saved shot,
//      every card. Saves and clean sheets follow from the other team's shots and goals.
//   2. The moments are dealt into the 90 minutes, with ordinary possession in between
//      (shots wide or blocked, offside, fouls).
//   3. For each moment the chooser picks how it happens (open play, a corner header, a free
//      kick, a penalty...) among the ways that soccer/js/rules.js accepts from the current
//      state. The chooser is Jev (engine/jev.js) when TYPESAFE_API_KEY is in the environment,
//      and equal weights when it is not. The report says which was used.
//   4. The finished match is replayed from scratch, its stat lines and fantasy points are
//      compared with the targets, and a match that does not match is thrown away.
//
//   node soccer/engine/make-match.js --from-sample --out soccer/data/sample-soccer.json
//   node soccer/engine/make-match.js --lines soccer/data/week11-lines.json --out soccer/data/week11-soccer.json --use
//   (--use also writes soccer/data/current.js, which soccer/index.html plays)
'use strict';
const fs = require('fs');
const path = require('path');
const Data = require('../js/data.js');
const Fantasy = require('../js/fantasy.js');
const Rules = require('../js/rules.js');

// ---------------------------------------------------------------- small tools
function rngFrom(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function int(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function shuffle(r, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
function cloneState(s) { const c = JSON.parse(JSON.stringify(Object.assign({}, s, { teams: null }))); c.teams = s.teams; return c; }
const SLOTS = Rules.SLOTS;
const OUTFIELD = SLOTS.filter(function (k) { return k !== 'GK'; });
const ATTACK = ['LW', 'ST', 'RW', 'CM1', 'CM2', 'CM3'];
const STATS = ['goals', 'assists', 'sot', 'saves', 'yellow', 'red'];

// ---------------------------------------------------------------- stat lines
// The stat lines of a finished match, read by replaying it through the rules.
//   [{ players: { slot: { goals, assists, sot, saves, yellow, red } }, score, cleanSheet, points: { slot: pts } }, x2]
function statlines(teams, game) {
  const s = Rules.create(teams);
  const out = teams.map(function () {
    const players = {}; SLOTS.forEach(function (k) { players[k] = { goals: 0, assists: 0, sot: 0, saves: 0, yellow: 0, red: 0 }; });
    return { players: players, score: 0, cleanSheet: false, points: {} };
  });
  function pts(fp) { fp.forEach(function (f) { out[f.team].points[f.role] = (out[f.team].points[f.role] || 0) + f.pts; }); }
  Rules.flatten(game, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); return; }
    if (st.kind !== 'play') return;
    const e = st.e, t = st.team, r = Rules.apply(s, e, t);
    pts(r.fp);
    if ((e.t === 'shot' || e.t === 'pen') && ((e.out === 'in' && !r.disallowed) || e.out === 'saved')) out[t].players[e.by].sot++;
    if (r.goal) { out[t].players[r.scorer].goals++; if (r.assist) out[t].players[r.assist].assists++; }
    if (r.saver) out[1 - t].players.GK.saves++;
    if (r.card) out[t].players[e.by][r.card]++;
  });
  pts(Fantasy.fullTime(s.score));
  out.forEach(function (o, i) { o.score = s.score[i]; o.cleanSheet = s.score[1 - i] === 0; });
  return out;
}

function sameLines(a, b) {
  const diffs = [];
  a.forEach(function (ta, i) {
    const tb = b[i];
    SLOTS.forEach(function (k) {
      STATS.forEach(function (f) { if ((ta.players[k] || {})[f] !== (tb.players[k] || {})[f]) diffs.push('team ' + i + ' ' + k + ' ' + f + ' ' + ta.players[k][f] + ' vs ' + tb.players[k][f]); });
    });
    if (ta.score !== tb.score) diffs.push('team ' + i + ' score ' + ta.score + ' vs ' + tb.score);
    Object.keys(Object.assign({}, ta.points, tb.points)).forEach(function (k) {
      if ((ta.points[k] || 0) !== (tb.points[k] || 0)) diffs.push('team ' + i + ' ' + k + ' points ' + (ta.points[k] || 0) + ' vs ' + (tb.points[k] || 0));
    });
  });
  return diffs;
}

// Fill in what follows from the lines (score, saves check, points) and refuse lines that cannot happen.
function completeTargets(lines) {
  const t = lines.map(function (L) {
    const players = {}; SLOTS.forEach(function (k) { const p = (L.players || {})[k] || {}; players[k] = {}; STATS.forEach(function (f) { players[k][f] = p[f] || 0; }); });
    return { players: players };
  });
  t.forEach(function (T, i) {
    T.score = SLOTS.reduce(function (n, k) { return n + T.players[k].goals; }, 0);
    SLOTS.forEach(function (k) {
      const p = T.players[k];
      if (p.sot < p.goals) throw new Error('team ' + i + ' ' + k + ': fewer shots on target than goals');
      if (p.yellow > 1) throw new Error('team ' + i + ' ' + k + ': two yellows are a red in the rules; give red: 1');
      if (k !== 'GK' && p.saves) throw new Error('team ' + i + ' ' + k + ': only the keeper makes saves');
      if (k === 'GK' && (p.goals || p.sot)) throw new Error('team ' + i + ': the keeper does not shoot in this format');
    });
    const assists = SLOTS.reduce(function (n, k) { return n + T.players[k].assists; }, 0);
    if (assists > T.score) throw new Error('team ' + i + ': more assists than goals');
  });
  t.forEach(function (T, i) {
    const O = t[1 - i], saved = SLOTS.reduce(function (n, k) { return n + O.players[k].sot - O.players[k].goals; }, 0);
    if (T.players.GK.saves !== saved) throw new Error('team ' + i + ' keeper: ' + T.players.GK.saves + ' saves, but the other team had ' + saved + ' saved shots');
    T.cleanSheet = O.score === 0;
  });
  // Fantasy points follow from the lines; checking them too catches a scoring mismatch.
  t.forEach(function (T, i) {
    T.points = {};
    function add(k, n) { if (n && Fantasy.LINEUP.some(function (l) { return l.role === k; })) T.points[k] = (T.points[k] || 0) + n; }
    SLOTS.forEach(function (k) {
      const p = T.players[k], pos = Fantasy.POS[k], S = Fantasy.SCORING;
      add(k, p.goals * S.goal[pos] + p.assists * S.assist + p.saves * S.save + p.yellow * S.yellow + p.red * S.red);
      if (T.cleanSheet) add(k, S.clean_sheet[pos]);
    });
  });
  return t;
}

// ---------------------------------------------------------------- moments
function momentsFor(r, targets) {
  const list = [];
  for (let t = 0; t < 2; t++) {
    const P = targets[t].players, goals = [], assisters = [];
    SLOTS.forEach(function (k) {
      for (let i = 0; i < P[k].goals; i++) goals.push(k);
      for (let i = 0; i < P[k].assists; i++) assisters.push(k);
      for (let i = 0; i < P[k].sot - P[k].goals; i++) list.push({ kind: 'saved', team: t, by: k });
      for (let i = 0; i < P[k].yellow; i++) list.push({ kind: 'card', team: t, by: k, card: 'yellow' });
      for (let i = 0; i < P[k].red; i++) list.push({ kind: 'card', team: t, by: k, card: 'red' });
    });
    // Pair each assist with a goal by someone else.
    const gs = shuffle(r, goals), as = shuffle(r, assisters), used = gs.map(function () { return null; });
    for (const a of as) {
      const i = gs.findIndex(function (g, j) { return used[j] === null && g !== a; });
      if (i < 0) return null;
      used[i] = a;
    }
    gs.forEach(function (g, j) { list.push({ kind: 'goal', team: t, by: g, assist: used[j] }); });
  }
  return list;
}

// Deal moments and filler into minutes. A red card comes after every other moment of that player.
function schedule(r, moments) {
  const fill = int(r, 9, 14), items = shuffle(r, moments.concat(Array.from({ length: fill }, function () { return { kind: 'filler', team: int(r, 0, 1) }; })));
  for (let i = 0; i < items.length; i++) {
    const m = items[i];
    if (m.kind !== 'card' || m.card !== 'red') continue;
    let last = i;
    items.forEach(function (x, j) { if (j > i && x.team === m.team && (x.by === m.by || x.assist === m.by)) last = j; });
    if (last > i) { items.splice(i, 1); items.splice(last, 0, m); i--; }
  }
  const n = items.length, firstHalf = Math.round(n * (0.42 + r() * 0.16));
  const mins = [];
  for (let i = 0; i < n; i++) {
    const first = i < firstHalf, k = first ? i : i - firstHalf, of = first ? firstHalf : n - firstHalf;
    const lo = first ? 2 : 47, hi = first ? 44 : 90;
    mins.push(Math.min(hi, lo + Math.floor((k + 0.2 + r() * 0.6) * (hi - lo) / Math.max(1, of))));
  }
  for (let i = 1; i < n; i++) if (mins[i] < mins[i - 1] && (i !== firstHalf)) mins[i] = mins[i - 1];
  return items.map(function (m, i) { return Object.assign({ min: mins[i], half: i < firstHalf ? 1 : 2 }, m); });
}

// ---------------------------------------------------------------- segments
// Every option is a function of (r, state) returning events for the moment, or null.
function ok(st) { return function (slot) { return !st.sentOff[st.team + ':' + slot]; }; }
function avail(s, team, list) { return list.filter(function (k) { return !s.sentOff[team + ':' + k]; }); }
function chainTo(r, s, team, last, len) {
  const pool = avail(s, team, OUTFIELD.concat(['GK'])).filter(function (k) { return k !== last; });
  const c = shuffle(r, pool).slice(0, Math.max(1, len - 1));
  if (c[0] === 'GK' && r() < 0.5) c.shift();
  c.push(last);
  return c.filter(function (k, i) { return k !== 'GK' || i === 0; });
}
function other(s, team) { return 1 - team; }

function optionsFor(m) {
  const T = m.team, by = m.by, as = m.assist, opts = {};
  function build(r, s, last, to) { return { t: 'build', team: T, chain: chainTo(r, s, T, last, int(r, 2, 4)), to: to }; }
  function foulOn(r, s, victimTeam, box) {
    const off = avail(s, 1 - victimTeam, OUTFIELD), vic = avail(s, victimTeam, ATTACK);
    return { t: 'foul', team: 1 - victimTeam, by: pick(r, off), on: pick(r, vic), box: box || undefined };
  }
  if (m.kind === 'goal' || m.kind === 'saved') {
    const out = m.kind === 'goal' ? 'in' : 'saved';
    opts.open_play = function (r, s) { return [build(r, s, as || by, 'box'), { t: 'shot', team: T, by: by, assist: as || undefined, out: out }]; };
    if (m.kind === 'saved' || as) opts.corner_header = function (r, s) {
      const taker = as || pick(r, avail(s, T, ['LW', 'RW', 'CM3']).filter(function (k) { return k !== by; }));
      if (!taker) return null;
      const blocker = pick(r, avail(s, T, ATTACK).filter(function (k) { return k !== by; }));
      return [build(r, s, blocker, 'box'), { t: 'shot', team: T, by: blocker, out: 'blocked' },
              { t: 'corner', team: T, by: taker, to: by }, { t: 'shot', team: T, by: by, assist: as || undefined, head: true, out: out }];
    };
    if (as) opts.free_kick_header = function (r, s) {
      return [build(r, s, pick(r, avail(s, T, ATTACK)), 'att'), foulOn(r, s, T), { t: 'freekick', team: T, by: as, to: by },
              { t: 'shot', team: T, by: by, assist: as, head: true, out: out }];
    };
    if (!as) opts.direct_free_kick = function (r, s) {
      return [build(r, s, by, 'att'), foulOn(r, s, T), { t: 'freekick', team: T, by: by }, { t: 'shot', team: T, by: by, out: out }];
    };
    if (!as && m.kind === 'goal') opts.penalty = function (r, s) {
      return [build(r, s, pick(r, avail(s, T, ATTACK)), 'box'), foulOn(r, s, T, true), { t: 'pen', team: T, by: by, out: 'in' }];
    };
  } else if (m.kind === 'card') {
    const victimTeam = 1 - T;
    opts.foul = function (r, s) {
      const vic = pick(r, avail(s, victimTeam, ATTACK));
      return [{ t: 'build', team: victimTeam, chain: chainTo(r, s, victimTeam, vic, int(r, 2, 3)), to: 'att' },
              { t: 'foul', team: T, by: by, on: vic, card: m.card }];
    };
  } else {
    opts.shot_wide = function (r, s) { const k = pick(r, avail(s, T, ATTACK)); return [build(r, s, k, 'att'), { t: 'shot', team: T, by: k, out: 'wide' }]; };
    opts.shot_blocked = function (r, s) { const k = pick(r, avail(s, T, ATTACK)); return [build(r, s, k, 'box'), { t: 'shot', team: T, by: k, out: 'blocked' }]; };
    opts.off_the_post = function (r, s) { const k = pick(r, avail(s, T, ATTACK)); return [build(r, s, k, 'box'), { t: 'shot', team: T, by: k, out: 'post' }]; };
    opts.offside = function (r, s) { const k = pick(r, avail(s, T, ['ST', 'LW', 'RW'])); return k ? [build(r, s, pick(r, avail(s, T, ['CM1', 'CM2', 'CM3'])) || 'CB1', 'mid'), { t: 'offside', team: T, by: k }] : null; };
    opts.foul = function (r, s) { return [build(r, s, pick(r, avail(s, T, ATTACK)), 'mid'), foulOn(r, s, T)]; };
    opts.corner_cleared = function (r, s) {
      const k = pick(r, avail(s, T, ATTACK)), taker = pick(r, avail(s, T, ['LW', 'RW']));
      return taker ? [build(r, s, k, 'box'), { t: 'shot', team: T, by: k, out: 'blocked' }, { t: 'corner', team: T, by: taker }] : null;
    };
  }
  return opts;
}

// Events that satisfy what the rules expect next, so that a new move can start.
function bridge(r, s, min) {
  if (!s.expect) return [];
  const x = s.expect[0], team = x.team === undefined ? 0 : x.team;
  if (x.t === 'kickoff') return [{ min: min, t: 'kickoff', team: team }];
  if (x.t) return null;  // a penalty or a direct shot is owed; never left across moves
  const mate = pick(r, avail(s, team, ['CB1', 'CB2', 'CM1', 'CM2', 'LB', 'RB']));
  if (s.restart === 'fk') return [{ min: min, t: 'freekick', team: team, by: pick(r, avail(s, team, ['CB1', 'CB2', 'CM2'])), to: mate }];
  return [{ min: min, t: 'build', team: team, chain: chainTo(r, s, team, mate, 2), to: 'mid' }];
}

function tryEvents(s, events, teams) {
  const c = cloneState(s);
  try { events.forEach(function (e) { Rules.apply(c, e, teams.findIndex(function (t) { return t.id === e.team; })); }); }
  catch (err) { return null; }
  return c;
}

// ---------------------------------------------------------------- the chooser
const LABEL = {
  open_play: 'A move in open play that ends with the shot', corner_header: 'A header from a corner',
  free_kick_header: 'A header from a free kick', direct_free_kick: 'A direct free kick', penalty: 'A penalty after a foul in the box',
  foul: 'A foul', shot_wide: 'A shot that goes wide', shot_blocked: 'A shot that is blocked', off_the_post: 'A shot off the post',
  offside: 'A run caught offside', corner_cleared: 'A corner that is headed clear'
};

async function choose(ctx, m, keys) {
  if (keys.length === 1 || !ctx.jev || m.kind === 'filler') return { key: pick(ctx.r, keys), why: null };
  const T = ctx.teams[m.team], criteria = {};
  keys.forEach(function (k) { criteria[k] = LABEL[k]; });
  const st = ctx.state;
  const state = {
    sport: 'soccer', team: T.full, minute: m.min, score_team: st.score[m.team], score_opponent: st.score[1 - m.team],
    moment: m.kind === 'goal' ? 'a goal by ' + T.roster[m.by] + (m.assist ? ', assisted by ' + T.roster[m.assist] : '')
          : m.kind === 'saved' ? 'a shot on target by ' + T.roster[m.by] + ' that the keeper saves'
          : 'a ' + m.card + ' card for ' + T.roster[m.by]
  };
  try {
    const out = await ctx.jev.decide(state, { how: { type: 'choice', instructions: 'How does this moment of the match most likely happen?', criteria: criteria } });
    const probs = out.answers.how.probabilities;
    const total = keys.reduce(function (a, k) { return a + (probs[k] || 0); }, 0) || 1;
    let x = ctx.r(), sum = 0, key = keys[0];
    for (const k of keys) { sum += (probs[k] || 0) / total; if (x <= sum) { key = k; break; } }
    ctx.model = out.model; ctx.jevPicks++;
    return { key: key, why: { how: probs, picked: key, by: 'jev' } };
  } catch (err) {
    ctx.jevErrors++; if (ctx.jevErrors > 3) ctx.jev = null;
    return { key: pick(ctx.r, keys), why: null };
  }
}

// ---------------------------------------------------------------- the whole match
async function attempt(teams, targets, seed, jev) {
  const r = rngFrom(seed);
  const moments = momentsFor(r, targets);
  if (!moments) return null;
  const plan = schedule(r, moments);
  const s = Rules.create(teams), events = [];
  const ctx = { r: r, teams: teams, state: s, jev: jev, jevPicks: 0, jevErrors: 0, model: '' };
  const firstKick = int(r, 0, 1);
  function push(e) { const team = teams.findIndex(function (t) { return t.id === e.team; }); Rules.apply(s, e, team); events.push(e); }
  push({ min: 0, t: 'kickoff', team: teams[firstKick].id });
  let half = 1;
  for (const m of plan) {
    if (m.half === 2 && half === 1) {
      events.push({ min: 45, t: 'ht' }); Rules.startHalf(s); half = 2;
      push({ min: 46, t: 'kickoff', team: teams[1 - firstKick].id });
    }
    const br = bridge(r, s, m.min);
    if (!br) return null;
    br.forEach(function (e) { e.team = typeof e.team === 'number' ? teams[e.team].id : e.team; push(e); });
    const opts = optionsFor(m), valid = {};
    for (const k of Object.keys(opts)) {
      for (let tries = 0; tries < 6 && !valid[k]; tries++) {
        const evs = opts[k](r, s);
        if (!evs || evs.some(function (e) { return !e; })) continue;
        evs.forEach(function (e) { e.team = typeof e.team === 'number' ? teams[e.team].id : e.team; e.min = m.min; Object.keys(e).forEach(function (f) { if (e[f] === undefined) delete e[f]; }); });
        if (tryEvents(s, evs, teams)) valid[k] = evs;
      }
    }
    const keys = Object.keys(valid);
    if (!keys.length) return null;
    const c = await choose(ctx, m, keys);
    const evs = valid[c.key];
    if (c.why) evs[0].why = c.why;
    if (m.kind === 'goal') evs[evs.length - 1].tags = ['highlight'];
    evs.forEach(push);
  }
  if (half === 1) return null;
  const game = { note: 'Built by the soccer match maker from fantasy stat lines. Every event was checked by soccer/js/rules.js.', events: events };
  let made; try { made = statlines(teams, game); } catch (err) { return null; }
  const diffs = sameLines(targets, made);
  return diffs.length ? null : { game: game, made: made, model: ctx.model, jevPicks: ctx.jevPicks, jevUsed: !!ctx.jev && ctx.jevPicks > 0 };
}

async function main() {
  const a = process.argv.slice(2);
  function arg(name, dflt) { const i = a.indexOf(name); return i >= 0 && a[i + 1] ? a[i + 1] : dflt; }
  const teams = Data.TEAMS;
  let lines, source;
  if (a.indexOf('--from-sample') >= 0) { lines = statlines(teams, Data.SAMPLE_GAME); source = 'the sample match in soccer/js/data.js'; }
  else if (arg('--lines', '')) { lines = JSON.parse(fs.readFileSync(arg('--lines'), 'utf8')).teams; source = arg('--lines'); }
  else { console.error('Give the stat lines: --from-sample, or --lines <file.json>'); process.exit(2); }
  const targets = completeTargets(lines);
  // Jev only when the key is in the environment. Without it, every option has the same weight.
  const jev = process.env.TYPESAFE_API_KEY && a.indexOf('--no-jev') < 0 ? require('../../engine/jev.js') : null;
  const seed0 = parseInt(arg('--seed', '1'), 10);
  let result = null, tries = 0;
  for (let sd = seed0; sd < seed0 + 3000 && !result; sd++) { tries++; result = await attempt(teams, targets, sd, jev); }
  if (!result) { console.error('No legal match found in ' + tries + ' tries.'); process.exit(1); }
  const chooser = result.jevUsed ? 'jev' : 'equal weights';
  const id = arg('--id', path.basename(arg('--out', 'soccer-match.json'), '.json'));
  const file = {
    id: id, version: 1, sport: 'soccer', teams: teams, game: result.game,
    report: {
      chooser: chooser, model: result.model || null, jevCalls: jev ? jev.usage().calls : 0, momentsChosenByJev: result.jevPicks,
      statLinesFrom: source, seedsTried: tries, events: result.game.events.length,
      score: result.made.map(function (m) { return m.score; }), points: result.made.map(function (m) { return m.points; }), matchesTargets: true
    }
  };
  const outFile = arg('--out', '');
  if (outFile) fs.writeFileSync(outFile, JSON.stringify(file, null, 1) + '\n');
  if (outFile && a.indexOf('--use') >= 0) {
    const cur = path.join(path.dirname(outFile), 'current.js');
    fs.writeFileSync(cur, '// Written by soccer/engine/make-match.js from ' + path.basename(outFile) + '. Do not edit by hand.\nwindow.SC_GAME_FILE = ' + JSON.stringify(file) + ';\n');
  }
  console.log('OK: a legal match that reproduces every stat line.');
  console.log('  chooser: ' + chooser + (result.model ? ' (' + result.model + ')' : ''));
  console.log('  seeds tried: ' + tries + ', events: ' + result.game.events.length);
  console.log('  score: ' + teams[0].id + ' ' + result.made[0].score + ', ' + teams[1].id + ' ' + result.made[1].score);
  if (outFile) console.log('  written to ' + outFile + (a.indexOf('--use') >= 0 ? ' and current.js' : ''));
}

module.exports = { statlines: statlines, completeTargets: completeTargets, attempt: attempt };
if (require.main === module) main().catch(function (err) { console.error(err.message || err); process.exit(1); });
