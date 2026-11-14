// Proves data/scoring.json describes what js/rules.js scores. Replays the sample game through the rules
// engine, builds each player's stat line from the plays, scores it with data/scoring.json, and compares
// with the points the game itself gave (res.fp). No packages.   node agents/scout/check-scoring.js
'use strict';
var path = require('path');
var root = path.join(__dirname, '..', '..');
var Rules = require(path.join(root, 'js', 'rules.js'));
var Data = require(path.join(root, 'js', 'data.js'));
var rules = require(path.join(root, 'data', 'scoring.json'));
var score = require('./score.js');

var s = Rules.create(Data.TEAMS);
var steps = Rules.flatten(Data.SAMPLE_GAME, Data.TEAMS);
var stat = {};      // 'team|role' -> stat line
var game = {};      // 'team|role' -> points the game gave
var bonus = {};     // 'team|role' -> field goal band bonus
var plays = {};     // 'team|role' -> number of scoring entries (for the rounding allowance)
function line(t, role) { return stat[t + '|' + role] || (stat[t + '|' + role] = {}); }
function add(t, role, k, n) { var l = line(t, role); l[k] = (l[k] || 0) + n; }

steps.forEach(function (st) {
  if (st.kind === 'half') { Rules.startHalf(s); return; }
  if (st.kind === 'final') return;
  var r = Rules.apply(s, st.e, st.team), e = st.e, off = st.team, def = 1 - off;
  (r.fp || []).forEach(function (f) { var k = f.team + '|' + f.role; game[k] = (game[k] || 0) + f.pts; plays[k] = (plays[k] || 0) + 1; });
  if (e.t === 'run') { add(off, e.by, 'rush_yards', e.yds); if (r.td) add(off, e.by, 'rush_td', 1); }
  if (e.t === 'pass') {
    add(off, 'QB', 'pass_yards', e.yds); add(off, e.to, 'rec_yards', e.yds); add(off, e.to, 'receptions', 1);
    if (r.td) { add(off, 'QB', 'pass_td', 1); add(off, e.to, 'rec_td', 1); }
  }
  if (e.t === 'sack') add(def, 'DST', 'sacks', 1);
  if (e.t === 'int') { add(off, 'QB', 'interceptions', 1); add(def, 'DST', 'def_interceptions', 1); }
  if (e.t === 'fumble') { add(off, e.by, 'rush_yards', e.yds); add(off, e.by, 'fumbles_lost', 1); add(def, 'DST', 'fumble_recoveries', 1); }
  if (e.t === 'fg' && e.good) { add(off, 'K', 'fg_made', 1); bonus[off + '|K'] = (bonus[off + '|K'] || 0) + score.kickBonus([r.fgDist], rules); }
  if (e.t === 'xp' && e.good) add(s.poss, 'K', 'xp_made', 1);
});

var bad = 0, n = 0;
Object.keys(game).forEach(function (k) {
  var role = k.split('|')[1], mine;
  if (role === 'DST') mine = score.scoreDefense(stat[k] || {}, rules);
  else mine = Math.round(((score.score(stat[k] || {}, rules)) + (bonus[k] || 0)) * 100) / 100;
  var allow = 0.05 * plays[k] + 0.001;          // the game rounds each play to one decimal
  var ok = Math.abs(mine - game[k]) <= allow;
  n++; if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'FAIL ') + Data.TEAMS[+k.split('|')[0]].id + ' ' + role + ': file ' + mine + ', game ' + Math.round(game[k] * 10) / 10);
});
if (bad) { console.log(bad + ' of ' + n + ' differ'); process.exit(1); }
console.log('OK: scoring.json gives the same points as js/rules.js for all ' + n + ' scoring slots in the sample game');
