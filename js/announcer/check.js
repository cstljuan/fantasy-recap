// Prints one announcer line per kind and style so a person can read them all,
// then plays the sample game through the rules engine and prints what the
// announcer would say on every play. Fails if a placeholder is left unfilled,
// a kind has fewer than three variants per style, or a line repeats too soon.
// Run from the repo root:  node js/announcer/check.js        (add --all to print every variant)
'use strict';
var LINES = require('./lines.js');
var A = require('./index.js');
var data = require('../data.js');
var Rules = require('../rules.js');

var showAll = process.argv.indexOf('--all') >= 0;
var STYLES = ['straight', 'fun'];
var problems = [];

// A fixed random source so the output is the same every run.
var seed = 7;
A._setRandom(function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });

// Sample values for every placeholder, for the catalogue below.
var sample = {
  team: 'Goblins', def: 'Pythons', player: 'Vance', qb: 'Marlowe', kicker: 'Petrov',
  yds: 12, loss: 7, dist: 44, net: 41, pen: 5, spot: 'GOB 27',
  score: 'Goblins 14, Pythons 10', teamscore: '14 points', winner: 'Goblins', loser: 'Pythons'
};
function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); }); }

console.log('== Every kind, every style ==');
Object.keys(LINES).forEach(function (kind) {
  STYLES.forEach(function (style) {
    var list = LINES[kind][style] || [];
    if (list.length < 3) problems.push(kind + ' ' + style + ' has ' + list.length + ' variants, needs 3');
    list.forEach(function (t) {
      if (/\u2014/.test(t)) problems.push('em dash in ' + kind + ' ' + style + ': ' + t);
      var out = fill(t, sample);
      if (/\{\w+\}/.test(out)) problems.push('unknown placeholder in ' + kind + ' ' + style + ': ' + t);
    });
    var shown = showAll ? list : list.slice(0, 1);
    shown.forEach(function (t) {
      console.log(pad(kind, 16) + pad(style, 9) + fill(t, sample));
    });
  });
});

// Play the sample game, both styles.
STYLES.forEach(function (style) {
  console.log('\n== Sample game, ' + style + ' ==');
  A.reset();
  var teams = data.TEAMS;
  var s = Rules.create(teams);
  var steps = Rules.flatten(data.SAMPLE_GAME, teams);
  var recent = {};
  steps.forEach(function (st, i) {
    var res;
    if (st.kind === 'half') { Rules.startHalf(s); res = { kind: 'half' }; }
    else if (st.kind === 'final') { res = { kind: 'final' }; }
    else res = Rules.apply(s, st.e, st.team);
    var kind = res.kind === 'half' || res.kind === 'final' ? res.kind : A.classify(res, teams, res.post.score).kind;
    var text = A.line(res, { teams: teams, score: s.score.slice(), style: style });
    if (!text) problems.push('no line for step ' + i + ' (' + (st.e ? st.e.t : st.kind) + ')');
    if (/\{\w+\}/.test(text)) problems.push('unfilled placeholder: ' + text);
    // The same sentence must not come back before the other variants of its kind have been used.
    var n = (LINES[kind] && LINES[kind][style] || []).length;
    if (recent[text] != null && i - recent[text] < n) {
      var between = 0;
      for (var k in recent) if (recent[k] > recent[text]) between++;
      if (between < n - 1) problems.push('repeated too soon: ' + text);
    }
    recent[text] = i;
    console.log('  ' + pad(kind, 16) + text);
  });
});

console.log('\nStyle switch: ' + A.setStyle('fun') + ', ' + A.setStyle('nonsense') + ', ' + A.setStyle('straight'));
console.log('speak() without a speech voice does nothing: ' + (A.speak('test') === undefined ? 'ok' : 'unexpected'));
console.log('line() with no teams is quiet: ' + (A.line({}, {}) === '' ? 'ok' : 'unexpected'));

if (problems.length) {
  console.log('\nPROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('\nOK: ' + Object.keys(LINES).length + ' kinds, 2 styles, at least 3 variants each, no problems found.');

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s + ' '; }
