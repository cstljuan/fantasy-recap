// Checks the soccer announcer and prints the whole broadcast of the sample match.
// Run from the repo root:  node js/announcer/soccer/check.js
'use strict';
var path = require('path');
var LINES = require('./lines.js');
var A = require('./index.js');
var data = require(path.join(__dirname, '../../../soccer/js/data.js'));
try { require(path.join(__dirname, '../../../soccer/js/fantasy.js')); } catch (err) { /* fantasy points are not needed here */ }
var Rules = require(path.join(__dirname, '../../../soccer/js/rules.js'));

var STYLES = ['straight', 'fun'];
var problems = [];
var seed = 11;
A._setRandom(function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });

function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); }); }
function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s + ' '; }
function longest(a) { return a.reduce(function (x, y) { return y.length > x.length ? y : x; }, ''); }

// The longest values a line can be filled with.
var names = [], tnames = [];
data.TEAMS.forEach(function (t) { tnames.push(t.name); Object.keys(t.roster).forEach(function (k) { names.push(String(t.roster[k]).split(' ').pop()); }); });
var N = longest(names), T = longest(tnames);
var worst = { team: T, def: T, player: N, assist: N, keeper: N, victim: N, a: N, b: N, min: 90, minth: '90th',
  score: T + ' 3, ' + T + ' 3', t0: T, t1: T, winner: T, loser: T };

function checkTable(table, label) {
  Object.keys(table).forEach(function (kind) {
    STYLES.forEach(function (style) {
      var list = table[kind][style] || [];
      if (list.length < 3) problems.push(label + kind + ' ' + style + ' has ' + list.length + ' variants, needs 3');
      list.forEach(function (t) {
        var w = fill(t, worst);
        if (w.length > A.maxLength) problems.push(label + kind + ' ' + style + ' is ' + w.length + ' characters: ' + w);
        if (/\{\w+\}/.test(w)) problems.push(label + kind + ' unknown placeholder: ' + t);
        if (/\b(he|him|his|she|her)\b/i.test(t)) problems.push(label + kind + ' has a pronoun: ' + t);
        if (/—/.test(t)) problems.push(label + kind + ' has an em dash: ' + t);
      });
    });
  });
}
checkTable(LINES, '');
checkTable(A._memoryLines, 'memory ');

console.log('== Every kind, straight and fun ==');
Object.keys(LINES).forEach(function (kind) {
  STYLES.forEach(function (style) {
    console.log(pad(kind, 16) + pad(style, 9) + fill(LINES[kind][style][0], { team: 'Ironside', def: 'Red Harbour',
      player: 'Haaland', assist: 'Saka', keeper: 'Maignan', victim: 'Rice', a: 'Rice', b: 'Saka', min: 88, minth: '88th',
      score: 'Ironside 2, Red Harbour 1', t0: 'Ironside', t1: 'Red Harbour', winner: 'Ironside', loser: 'Red Harbour' }));
  });
});

// The sample match, both styles. Straight is printed in full.
STYLES.forEach(function (style) {
  A.reset();
  var teams = data.TEAMS, s = Rules.create(teams), out = [], said = 0, events = 0, mems = {};
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); out.push('-- ' + A.line({ kind: 'half' }, { teams: teams, score: s.score.slice(), style: style })); return; }
    if (st.kind === 'final') { out.push('-- ' + A.line({ kind: 'final' }, { teams: teams, score: s.score.slice(), style: style })); return; }
    var r = Rules.apply(s, st.e, st.team); events++;
    var t = A.line(r, { teams: teams, style: style }), c = A.caption();
    if (r.goal && !t) problems.push('a goal was not called at ' + st.e.min + "'");
    if (t.length > A.maxLength) problems.push('line too long: ' + t);
    if (/\{\w+\}/.test(t)) problems.push('unfilled: ' + t);
    var isMem = t && c && /^memory_/.test(c.kind) && c.text === t;
    if (isMem) mems[c.kind.slice(7)] = (mems[c.kind.slice(7)] || 0) + 1;
    if (t) { said++; out.push((isMem ? ' * ' : '   ') + pad(st.e.min + "'", 4) + t); }
  });
  if (style === 'straight') {
    console.log('\n== Sample match, straight (* = from memory) ==');
    out.forEach(function (l) { console.log(l); });
  }
  console.log('\n' + style + ': ' + said + ' lines for ' + events + ' events, memory ' + JSON.stringify(mems));
});

// Memory lines on made-up results (test only): a hat-trick, a late equaliser, a late winner,
// a keeper's third save.
(function () {
  A.reset();
  var teams = data.TEAMS, got = {};
  function ev(team, e, pre, post, extra) {
    var r = Object.assign({ e: e, kind: e.t, team: team, min: e.min, half: e.min > 45 ? 2 : 1, pre: { score: pre }, post: { score: post } }, extra || {});
    var t = A.line(r, { teams: teams }), c = A.caption();
    if (c && c.text === t && /^memory_/.test(c.kind)) got[c.kind.slice(7)] = t;
    return t;
  }
  ev(0, { t: 'shot', by: 'ST', out: 'in', min: 10 }, [0, 0], [1, 0], { goal: true, scorer: 'ST' });
  ev(0, { t: 'shot', by: 'ST', out: 'in', min: 30 }, [1, 0], [2, 0], { goal: true, scorer: 'ST' });
  ev(1, { t: 'shot', by: 'ST', out: 'saved', min: 40 }, [2, 0], [2, 0]);
  ev(1, { t: 'shot', by: 'ST', out: 'saved', min: 50 }, [2, 0], [2, 0]);
  ev(1, { t: 'shot', by: 'RW', out: 'saved', min: 55 }, [2, 0], [2, 0]);
  ev(1, { t: 'shot', by: 'RW', out: 'in', min: 60 }, [2, 0], [2, 1], { goal: true, scorer: 'RW' });
  ev(1, { t: 'shot', by: 'RW', out: 'in', min: 82 }, [2, 1], [2, 2], { goal: true, scorer: 'RW' });
  ev(0, { t: 'shot', by: 'ST', out: 'in', min: 89 }, [2, 2], [3, 2], { goal: true, scorer: 'ST' });
  ['brace', 'keeper_third', 'late_equaliser', 'hat_trick'].forEach(function (k) { if (!got[k]) problems.push('made-up match: no ' + k + ' line'); });
  var m = A.memory();
  if (m.saves[0] !== 3) problems.push('made-up match: Ironside keeper should have 3 saves, memory says ' + m.saves[0]);
  console.log('\nMade-up match memory: ' + Object.keys(got).map(function (k) { return k + ': ' + got[k]; }).join(' | '));
  // Late winner when no hat-trick takes priority.
  A.reset();
  ev(1, { t: 'shot', by: 'CM1', out: 'in', min: 20 }, [0, 0], [0, 1], { goal: true, scorer: 'CM1' });
  ev(0, { t: 'shot', by: 'LW', out: 'in', min: 50 }, [0, 1], [1, 1], { goal: true, scorer: 'LW' });
  var w = ev(0, { t: 'shot', by: 'RW', out: 'in', min: 88 }, [1, 1], [2, 1], { goal: true, scorer: 'RW' });
  if (!got.late_winner) problems.push('made-up match: no late_winner line');
  console.log('Late winner: ' + w);
})();

// Rule explainers and the transcript.
(function () {
  var want = ['offside', 'corner', 'free_kick', 'penalty_kick', 'yellow', 'red', 'throw_in', 'goal_kick', 'extra_time'];
  want.forEach(function (k) {
    var t = A.explain(k), n = (t.match(/[.!?](\s|$)/g) || []).length;
    if (!t) problems.push('explain(' + k + ') is empty');
    if (t.length > A.explainMaxLength) problems.push('explain(' + k + ') is too long');
    if (n < 1 || n > 2) problems.push('explain(' + k + ') has ' + n + ' sentences');
    if (/\u2014|\b(he|him|his|she|her)\b/i.test(t)) problems.push('explain(' + k + ') has an em dash or a pronoun');
  });
  if (A.explain('nothing') !== '') problems.push('explain() of an unknown kind should be empty');
  A.reset();
  var teams = data.TEAMS, s = Rules.create(teams), shown = {}, made = 0;
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); return; }
    if (st.kind !== 'play') return;
    var r = Rules.apply(s, st.e, st.team);
    A.explainFor(r).forEach(function (k) { shown[k] = 1; if (!A.explain(k)) problems.push('explainFor gave ' + k + ' with no text'); });
    if (A.line(r, { teams: teams })) made++;
  });
  if (A.transcript().length !== made) problems.push('transcript has ' + A.transcript().length + ' lines, ' + made + ' were said');
  A.reset();
  if (A.transcript().length) problems.push('reset() should empty the transcript');
  console.log('\nRules shown in the sample match: ' + Object.keys(shown).join(', '));
})();

if (problems.length) {
  console.log('\nPROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('\nOK: ' + Object.keys(LINES).length + ' soccer kinds and ' + Object.keys(A._memoryLines).length + ' memory kinds, 2 styles, every line fits ' + A.maxLength + ' characters.');
