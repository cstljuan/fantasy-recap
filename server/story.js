// The turning points of a game, as numbers, for the written recap. No sentences: the screen writes them.
// Works on play records (from a game file replayed with js/rules.js, or from the plays table), so the file and
// the database give the same answer. Runs in Node and in the browser with the same code:
//   node server/story.js data/games/week11-football.json
//   browser: after js/rules.js, load server/replay.js, server/drives.js, server/momentum.js, server/story.js, then
//            var s = FR_STORY.fromGame(window.FF_GAME_FILE, 'week11-football');
//
// Result: {
//   home, away, final: [home, away], winner: team id or null for a tie,
//   leadChanges:  [ { index, quarter, clock, team, score: [home, away] } ]   every play after which a different
//                 team leads than the last team that led (the first score counts); ties are not lead changes
//   longestDrive: { drive, team, quarter, plays, yards, seconds, result, startIndex, endIndex } or null
//                 the drive with the most snaps, then the most yards, then the earlier one (football only)
//   biggestSwing: { start, quarter, team, fpSwing, index } or null
//                 the 120 second momentum bucket (server/momentum.js) where one team gained the most fantasy points
//                 over the other; fpSwing is that margin, index the play in it that gave the team the most points
//   bestPlayers:  [ { team, slot, name, points, index }, x2 ]   each team's top fantasy scorer, index = the play
//                 where that player gained the most points
//   decidingPlay: { index, quarter, clock, team, score: [home, away] } or null
//                 the play after which the winner led for good; null for a tie
// }
// index is the play's number in the game from 1, the same as seq in the plays table and index in top plays,
// so the screen can jump to it with FF_GAME.seek(index).
(function (root) {
'use strict';
var isNode = typeof module !== 'undefined' && !!module.exports && typeof require === 'function';
function mod(name, global) { return isNode ? require('./' + name + '.js') : root[global]; }

function r1(x) { return Math.round(x * 10) / 10; }
function side(score) { return score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : -1; }

// records: { seq, quarter, played_at, team, detail: { fp: [{team, slot, name, pts}], score_after, clock, drive, ... } }
function fromRecords(records, home, away) {
  var ids = [home, away];
  var plays = records.slice().sort(function (a, b) { return a.seq - b.seq; });
  var last = plays.length ? plays[plays.length - 1] : null;
  var final = last && last.detail && last.detail.score_after ? last.detail.score_after.slice() : [0, 0];
  var w = side(final);
  function at(p) { return { index: p.seq, quarter: p.quarter, clock: (p.detail && p.detail.clock) || null }; }

  // lead changes and the deciding play
  var leader = -1, leadChanges = [], lastToWinner = null;
  plays.forEach(function (p) {
    var sa = p.detail && p.detail.score_after;
    if (!sa) return;
    var now = side(sa);
    if (now !== -1 && now !== leader) {
      leader = now;
      leadChanges.push(Object.assign(at(p), { team: ids[now], score: sa.slice() }));
    }
  });
  if (w !== -1) {
    // the winner leads for good after the last play at which the score was not in the winner's favour
    var lastNotAhead = -1;
    plays.forEach(function (p, i) { var sa = p.detail && p.detail.score_after; if (sa && side(sa) !== w) lastNotAhead = i; });
    var dp = plays[lastNotAhead + 1];
    if (dp) lastToWinner = Object.assign(at(dp), { team: ids[w], score: dp.detail.score_after.slice() });
  }

  // longest drive (football records only)
  var Drives = mod('drives', 'FR_DRIVES'), longestDrive = null;
  if (Drives && Drives.usable(plays)) {
    var ds = Drives.fromRecords(plays), firstSeq = {}, lastSeq = {};
    plays.forEach(function (p) {
      var d = p.detail.drive;
      if (firstSeq[d] == null) firstSeq[d] = p.seq;
      lastSeq[d] = p.seq;
    });
    var order = Object.keys(firstSeq).sort(function (a, b) { return firstSeq[a] - firstSeq[b]; });
    ds.forEach(function (d, i) {
      if (!longestDrive || d.plays > longestDrive.plays || (d.plays === longestDrive.plays && d.yards > longestDrive.yards)) {
        longestDrive = { drive: d.index, team: d.team, quarter: d.quarter, plays: d.plays, yards: d.yards, seconds: d.seconds,
          result: d.result, startIndex: firstSeq[order[i]], endIndex: lastSeq[order[i]] };
      }
    });
  }

  // biggest swing in momentum, and the play inside it
  var Mom = mod('momentum', 'FR_MOMENTUM'), biggestSwing = null;
  var timed = plays.every(function (p) { return p.played_at && p.detail && p.detail.fp; });
  if (Mom && timed && plays.length) {
    var bs = 120, m = Mom.fromRecords(plays, home, away, bs), t0 = Date.parse(plays[0].played_at);
    m.buckets.forEach(function (b) {
      var margin = r1(b.fp[0] - b.fp[1]);
      if (margin !== 0 && (!biggestSwing || Math.abs(margin) > Math.abs(biggestSwing.fpSwing))) {
        biggestSwing = { start: b.start, quarter: b.quarter, team: ids[margin > 0 ? 0 : 1], fpSwing: Math.abs(margin), index: null };
      }
    });
    if (biggestSwing) {
      var best = null;
      plays.forEach(function (p) {
        if (Math.floor((Date.parse(p.played_at) - t0) / 1000 / bs) * bs !== biggestSwing.start) return;
        var gain = 0;
        p.detail.fp.forEach(function (f) { gain += f.team === biggestSwing.team ? f.pts : -f.pts; });
        if (!best || gain > best.gain) best = { gain: gain, index: p.seq };
      });
      biggestSwing.index = best ? best.index : null;
    }
  }

  // best fantasy player per team
  var tot = {};
  plays.forEach(function (p) {
    ((p.detail && p.detail.fp) || []).forEach(function (f) {
      var k = f.team + '|' + f.slot, x = tot[k] || (tot[k] = { team: f.team, slot: f.slot, name: f.name || null, points: 0, index: null, bestPlay: -Infinity });
      x.points += f.pts;
      if (f.pts > x.bestPlay) { x.bestPlay = f.pts; x.index = p.seq; }
    });
  });
  var bestPlayers = ids.map(function (id) {
    var top = null;
    Object.keys(tot).forEach(function (k) { var x = tot[k]; if (x.team === id && (!top || x.points > top.points)) top = x; });
    return top ? { team: top.team, slot: top.slot, name: top.name, points: r1(top.points), index: top.index } : null;
  }).filter(Boolean);

  return { home: home, away: away, final: final, winner: w === -1 ? null : ids[w], leadChanges: leadChanges,
    longestDrive: longestDrive, biggestSwing: biggestSwing, bestPlayers: bestPlayers, decidingPlay: lastToWinner };
}

// A parsed game file (football or soccer). In the browser it needs FR_REPLAY (server/replay.js).
function fromGame(game, id) {
  var g = mod('replay', 'FR_REPLAY').buildFromGame(game, id);
  return fromRecords(g.plays, g.home, g.away);
}

// A game file's path, in Node.
function story(gameFile) { var g = require('./replay.js').buildPlays(gameFile); return fromRecords(g.plays, g.home, g.away); }

var api = { story: story, fromGame: fromGame, fromRecords: fromRecords };
root.FR_STORY = api;
if (isNode) module.exports = api;

if (isNode && require.main === module) {
  var file = process.argv[2];
  if (!file) { console.error('Usage: node server/story.js <game file>'); process.exit(2); }
  console.log(JSON.stringify(story(require('path').resolve(file)), null, 2));
}
})(typeof window !== 'undefined' ? window : globalThis);
