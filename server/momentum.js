'use strict';
// Momentum: each team's fantasy points and real points per bucket of game time, with running totals.
// For a chart in the recap and the film room, to be shown only after the reveal.
//   node server/momentum.js data/games/week11-football.json [bucketSeconds]
//
// Result: { bucketSeconds, buckets: [ { start, quarter, fp: [home, away], score: [home, away],
//                                       fpTotal: [home, away], scoreTotal: [home, away] } ] }
//   start     seconds from the first play to the start of the bucket. Time is the plays' own time (played_at),
//             which the seed and push-game spread evenly over three hours: the game file has no clock
//   quarter   the quarter of the latest play so far (quarters are worked out too)
//   fp        fantasy points every player of the team gained or lost in the bucket
//   score     real points the team scored in the bucket
// Every bucket from 0 to the last play is listed, empty ones with zeros, so a chart has no gaps.
// The last bucket's totals equal the final score and the game's total fantasy points.
var path = require('path');
var buildPlays = require('./replay.js').buildPlays;

function r1(x) { return Math.round(x * 10) / 10; }

// records: { seq, quarter, played_at, detail: { fp: [{team, pts}], score_after: [home, away] } }
function fromRecords(records, home, away, bucketSeconds) {
  var bs = bucketSeconds > 0 ? bucketSeconds : 120;
  var sorted = records.slice().sort(function (a, b) { return a.seq - b.seq; });
  if (!sorted.length) return { bucketSeconds: bs, buckets: [] };
  var t0 = Date.parse(sorted[0].played_at), prev = [0, 0], by = {}, last = 0;
  sorted.forEach(function (p) {
    var b = Math.floor((Date.parse(p.played_at) - t0) / 1000 / bs);
    var x = by[b] || (by[b] = { fp: [0, 0], score: [0, 0], quarter: p.quarter });
    (p.detail.fp || []).forEach(function (f) { x.fp[f.team === home ? 0 : f.team === away ? 1 : -1] += f.pts; });
    var sa = p.detail.score_after || prev;
    x.score[0] += sa[0] - prev[0]; x.score[1] += sa[1] - prev[1];
    prev = sa; x.quarter = p.quarter;
    if (b > last) last = b;
  });
  var out = [], fpT = [0, 0], scT = [0, 0], q = sorted[0].quarter;
  for (var b = 0; b <= last; b++) {
    var x = by[b] || { fp: [0, 0], score: [0, 0], quarter: q };
    q = x.quarter;
    fpT = [fpT[0] + x.fp[0], fpT[1] + x.fp[1]]; scT = [scT[0] + x.score[0], scT[1] + x.score[1]];
    out.push({ start: b * bs, quarter: q, fp: [r1(x.fp[0]), r1(x.fp[1])], score: x.score.slice(),
      fpTotal: [r1(fpT[0]), r1(fpT[1])], scoreTotal: scT.slice() });
  }
  return { bucketSeconds: bs, buckets: out };
}

function momentum(gameFile, bucketSeconds) {
  var g = buildPlays(gameFile);
  return fromRecords(g.plays, g.home, g.away, bucketSeconds);
}

module.exports = { momentum: momentum, fromRecords: fromRecords };

if (require.main === module) {
  var file = process.argv[2], bs = parseInt(process.argv[3], 10) || 120;
  if (!file) { console.error('Usage: node server/momentum.js <game file> [bucketSeconds]'); process.exit(2); }
  var m = momentum(path.resolve(file), bs);
  m.buckets.forEach(function (b) {
    console.log(('     ' + b.start).slice(-5) + ' s Q' + b.quarter + '  fp ' + b.fp.join(' / ') + '  score ' + b.score.join(' / ') +
      '  totals fp ' + b.fpTotal.join(' / ') + ', score ' + b.scoreTotal.join(' / '));
  });
}
