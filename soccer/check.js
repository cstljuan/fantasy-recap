// Runs the sample match through the soccer rules in Node and prints the result.
//   node soccer/check.js
'use strict';
var D = require('./js/data.js');
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
