'use strict';
// The biggest plays of a game. Works on play records, which come from a game file (replayed with js/rules.js)
// or from the plays table, so both give the same answer.
//   node server/top-plays.js data/games/week11-football.json 3
//
// A reply item: { index, quarter, clock, team, kind, yards, players, points, highlight, text }
//   index      the play's number in the game, from 1 (the same as seq in the plays table)
//   quarter    1 to 4, and clock the time left in it. Both are worked out, the game file has no clock
//   team       the team that gets the most points from the play
//   players    names of everyone who scored or lost points on the play
//   points     the points the play moved: the sum of every player's points, ignoring the sign
//   highlight  how much a broadcast would replay the play, 0 to 1, from the play caller's why. 0 if none
//   text       one plain sentence
// Ranked by points, then by highlight, then by the earlier play.
var path = require('path');
var buildPlays = require('./replay.js').buildPlays;

function r1(x) { return Math.round(x * 10) / 10; }

// rec: { seq, quarter, team, kind, yards, why, detail } with detail.fp = [{ team, slot, name, pts }]
function summarize(rec) {
  var d = rec.detail || {}, fp = d.fp || [];
  var points = r1(fp.reduce(function (a, f) { return a + Math.abs(f.pts); }, 0));
  var main = fp.reduce(function (m, f) { return !m || Math.abs(f.pts) > Math.abs(m.pts) ? f : m; }, null);
  var names = [];
  fp.forEach(function (f) { var n = f.name || (f.team + ' ' + f.slot); if (names.indexOf(n) < 0) names.push(n); });
  var hi = rec.why && typeof rec.why.highlight === 'number' ? rec.why.highlight : 0;
  var text = String(d.text || rec.kind);
  if (d.td && !/touchdown/i.test(text)) text += ', touchdown';
  return { index: rec.seq, quarter: rec.quarter, clock: d.clock || null, team: main ? main.team : rec.team, kind: rec.kind,
    yards: rec.yards === undefined ? null : rec.yards, players: names, points: points, highlight: hi, text: text };
}

function rank(records, n) {
  return records.map(summarize).filter(function (p) { return p.points > 0; }).sort(function (a, b) {
    return b.points - a.points || b.highlight - a.highlight || a.index - b.index;
  }).slice(0, n);
}

function topPlays(gameFile, n) {
  return rank(buildPlays(gameFile).plays, n || 3);
}

module.exports = { topPlays: topPlays, rank: rank };

if (require.main === module) {
  var file = process.argv[2], n = parseInt(process.argv[3], 10) || 3;
  if (!file) { console.error('Usage: node server/top-plays.js <game file> [n]'); process.exit(2); }
  topPlays(path.resolve(file), n).forEach(function (p, i) {
    console.log((i + 1) + '. Q' + p.quarter + ' ' + p.clock + ' ' + p.team + ' ' + p.points + ' points, highlight ' + p.highlight + ': ' + p.text + ' (' + p.players.join(', ') + ')');
  });
}
