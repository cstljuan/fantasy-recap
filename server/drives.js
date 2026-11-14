'use strict';
// One entry per drive, for the film room's drive chart. Works on play records, which come from a game file
// (replayed with js/rules.js) or from the plays table, so both give the same answer.
//   node server/drives.js data/games/week11-football.json
//
// An entry: { index, team, quarter, startYard, endYard, plays, yards, seconds, result }
//   index      drive number from 1
//   team       the team with the ball
//   quarter    the quarter the drive started in. Quarters are worked out: the game file has no clock
//   startYard  where the drive started, in yards from the offense's own goal line (0 to 100)
//   endYard    where the offense got to: 100 for a touchdown, the kick spot for a kick, otherwise the last spot
//   plays      snaps in the drive, not counting the kickoff and the extra point
//   yards      endYard minus startYard
//   seconds    game time the drive took. Worked out the same way as quarters: plays share their quarter evenly
//   result     touchdown, field goal, missed field goal, punt, interception, fumble, downs, half or end
var path = require('path');
var buildPlays = require('./replay.js').buildPlays;

function usable(records) {
  return records.length > 0 && records.every(function (r) {
    var d = r.detail || {};
    return d.ball && typeof d.drive === 'number' && d.off && typeof d.secs === 'number';
  });
}

function fromRecords(records) {
  var byDrive = {}, order = [];
  records.slice().sort(function (a, b) { return a.seq - b.seq; }).forEach(function (r) {
    var k = r.detail.drive;
    if (!byDrive[k]) { byDrive[k] = []; order.push(k); }
    byDrive[k].push(r);
  });
  var lastOfGame = order[order.length - 1];
  var out = order.map(function (k, i) {
    var plays = byDrive[k], first = plays[0], d0 = first.detail;
    var scrim = plays.filter(function (p) { return p.kind !== 'kickoff' && p.kind !== 'xp'; });
    var startYard = first.kind === 'kickoff' ? d0.ball.post : d0.ball.pre;
    var result = null, end = startYard;
    scrim.forEach(function (p) {
      var b = p.detail.ball;
      end = b.end;
      if (p.detail.td) result = 'touchdown';
      else if (p.kind === 'fg' && !result) result = p.detail.event.good ? 'field goal' : 'missed field goal';
      else if (p.kind === 'punt' && !result) result = 'punt';
      else if (p.kind === 'int' && !result) result = 'interception';
      else if (p.kind === 'fumble' && !result) result = 'fumble';
      else if (b.downs && !result) result = 'downs';
    });
    if (!result) {
      var lastPlay = plays[plays.length - 1], nextFirst = byDrive[order[i + 1]] && byDrive[order[i + 1]][0];
      result = nextFirst && nextFirst.detail.half !== lastPlay.detail.half ? 'half' : 'end';
      if (k === lastOfGame) result = 'end';
    }
    return {
      index: i + 1, team: d0.off, quarter: first.quarter, startYard: startYard, endYard: end, plays: scrim.length,
      yards: end - startYard, seconds: Math.round(plays.reduce(function (a, p) { return a + p.detail.secs; }, 0)), result: result
    };
  });
  return out;
}

function drives(gameFile) { return fromRecords(buildPlays(gameFile).plays); }

module.exports = { drives: drives, fromRecords: fromRecords, usable: usable };

if (require.main === module) {
  var file = process.argv[2];
  if (!file) { console.error('Usage: node server/drives.js <game file>'); process.exit(2); }
  drives(path.resolve(file)).forEach(function (d) {
    console.log(('  ' + d.index).slice(-2) + ' ' + d.team + ' Q' + d.quarter + ' ' + d.startYard + ' to ' + d.endYard + ', ' + d.plays + ' plays, ' +
      d.yards + ' yards, ' + d.seconds + ' s: ' + d.result);
  });
}
