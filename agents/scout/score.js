'use strict';
// Turns a stat line into fantasy points using data/scoring.json. No dependencies.
// Use: node agents/scout/score.js   (prints every player's points for data/statlines/week11.json)

var fs = require('fs');
var path = require('path');

function round2(n) { return Math.round(n * 100) / 100; }

// line: { pass_yards: 268, ... }, rules: the parsed scoring.json. Missing stats count as 0.
function score(line, rules) {
  var per = rules.per, total = 0;
  Object.keys(per).forEach(function (k) { total += (Number(line[k]) || 0) * per[k]; });
  return round2(total);
}

module.exports = { score: score };

if (require.main === module) {
  var root = path.join(__dirname, '..', '..');
  var rules = JSON.parse(fs.readFileSync(path.join(root, 'data', 'scoring.json'), 'utf8'));
  var week = JSON.parse(fs.readFileSync(path.join(root, 'data', 'statlines', 'week11.json'), 'utf8'));
  Object.keys(week.teams).forEach(function (t) {
    var sum = 0;
    console.log(t);
    var players = week.teams[t].players;
    Object.keys(players).forEach(function (slot) {
      var p = players[slot], pts = score(p.line, rules);
      sum += pts;
      console.log('  ' + slot + ' ' + p.name + ': ' + pts);
    });
    console.log('  total: ' + round2(sum));
  });
  console.log('(invented sample week, defense not scored)');
}
