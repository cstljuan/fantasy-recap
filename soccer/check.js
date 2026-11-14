// Runs the sample match through the soccer rules and the fantasy scoring in
// Node and prints the result and what each event was worth.
//   node soccer/check.js
'use strict';
var D = require('./js/data.js');
var F = require('./js/fantasy.js');
var R = require('./js/rules.js');

var s = R.run(D.SAMPLE_GAME, D.TEAMS);
console.log('Events: ' + D.SAMPLE_GAME.events.length);
s.goals.forEach(function (g) {
  var T = D.TEAMS[g.team];
  console.log('  ' + g.min + "' GOAL " + T.id + ' ' + T.roster[g.by] + (g.assist ? ' (assist ' + T.roster[g.assist] + ')' : '') + ', ' + g.how);
});
Object.keys(s.cards).forEach(function (k) {
  var p = k.split(':');
  console.log('  card ' + s.cards[k] + ': ' + D.TEAMS[p[0]].id + ' ' + D.TEAMS[p[0]].roster[p[1]]);
});
console.log('Final: ' + D.TEAMS[0].id + ' ' + s.score[0] + ', ' + D.TEAMS[1].id + ' ' + s.score[1]);

var b = F.breakdown(D.SAMPLE_GAME, D.TEAMS, R);
if (b.score.join() !== s.score.join()) throw new Error('Breakdown score differs from the rules');
console.log('\nFantasy points, event by event:');
b.events.forEach(function (ev) {
  console.log('  ' + ev.min + "' " + ev.text);
  ev.fp.forEach(function (f) {
    console.log('      ' + (f.pts > 0 ? '+' : '') + f.pts + '  ' + D.TEAMS[f.team].id + ' ' + f.name + ' (' + f.why + ')');
  });
});
console.log('\nFantasy totals:');
b.totals.forEach(function (t, i) {
  console.log('  ' + D.TEAMS[i].full + ': ' + t.total);
  F.LINEUP.forEach(function (l) {
    console.log('      ' + l.pos + '  ' + D.TEAMS[i].roster[l.role] + ': ' + t.players[l.role]);
  });
});
var sum = b.totals[0].total + b.totals[1].total, fromEvents = b.events.reduce(function (n, ev) { return n + ev.fp.reduce(function (m, f) { return m + f.pts; }, 0); }, 0);
if (sum !== fromEvents) throw new Error('Totals do not add up');
console.log('\nFantasy winner: ' + (b.totals[0].total === b.totals[1].total ? 'tie' : D.TEAMS[b.totals[0].total > b.totals[1].total ? 0 : 1].full));
