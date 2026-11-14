// Line audit: plays every football game file through the announcer, in both styles, the way
// js/main.js asks for lines (intro at kickoff, a line per play, half time, final), and reports
// what a viewer would hear wrong.
//   node js/announcer/audit.js
// Problems: a play line longer than FF_ANNOUNCER.maxLength; a line with undefined, NaN, null,
// a leftover {placeholder}, a double space or an empty name; a play that got no line; the
// same line more than three times in one game; and, once assets/voice/football/index.js
// exists, every line a game says with no recording and every recording no game says.
// Prints OK or the list, and exits 1 on a problem.
'use strict';
var fs = require('fs');
var path = require('path');
var A = require('./index.js');
var Rules = require('../rules.js');

var ROOT = path.join(__dirname, '../..');
var GAMES = ['data/games/week11-football.json', 'data/games/sample-football.json'];
var STYLES = ['straight'];
var LANGS = ['en'];
var LONG_KINDS = { intro: 1, halftime: 1, wrap: 1, catch_up: 1 };   // longer by design
var problems = [], said = {}, total = 0, lang = 'en';

function bad(text) {
  if (/undefined|NaN|\bnull\b/.test(text)) return 'undefined, NaN or null';
  if (/\{\w+\}/.test(text)) return 'a leftover placeholder';
  if (/ {2}/.test(text)) return 'a double space';
  if (/^[\s,.!?]|\s[,.!?]|,\s*,|\bthe\s+(ball|take|have|are|get)\b(?=.*\bthe\s*$)| (to|for|from|by) [.,!?]/.test(text)) return 'an empty name';
  return '';
}

var heard = [];
A.onLine(function (text, kind) { if (kind !== 'sound') heard.push({ text: text, kind: kind }); });

LANGS.forEach(function (L) {
lang = L;
GAMES.forEach(function (rel) {
  var file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) { problems.push(rel + ' is missing'); return; }
  var game = JSON.parse(fs.readFileSync(file, 'utf8')), teams = game.teams;
  STYLES.forEach(function (style) {
    A.reset(); A.setStyle(style); heard.length = 0;
    var tag = rel + ' ' + style;
    var s = Rules.create(teams), results = [], silent = {}, count = {};
    function check(text, where) {
      if (!text) return;
      total++; if (lang === 'en') said[text] = true;
      count[text] = (count[text] || 0) + 1;
      var h = heard.filter(function (x) { return x.text === text; }).pop(), kind = h ? h.kind : '';
      if (!LONG_KINDS[kind] && text.length > A.maxLength) problems.push(tag + ', ' + where + ': ' + text.length + ' characters: ' + text);
      var why = bad(text);
      if (why) problems.push(tag + ', ' + where + ': ' + why + ': ' + JSON.stringify(text));
    }
    check(A.intro({ teams: teams, score: [0, 0], style: style, leaders: [], plays: [], hidden: false }), 'intro');
    var n = 0;
    Rules.flatten(game.game, teams).forEach(function (st) {
      if (st.kind === 'half') {
        Rules.startHalf(s);
        check(A.halftime({ teams: teams, score: s.score.slice(), style: style, leaders: [], plays: results.slice() }) ||
          A.line({ kind: 'half' }, { teams: teams, score: s.score.slice(), style: style }), 'half time');
        return;
      }
      if (st.kind === 'final') {
        check(A.wrap({ teams: teams, score: s.score.slice(), style: style, leaders: [], plays: results.slice() }) ||
          A.line({ kind: 'final' }, { teams: teams, score: s.score.slice(), style: style }), 'final');
        return;
      }
      var res = Rules.apply(s, st.e, st.team); results.push(res); n++;
      var t = A.line(res, { teams: teams, score: res.post.score, style: style });
      if (!t) silent[st.e.t + (st.e.kind ? ' ' + st.e.kind : '')] = (silent[st.e.t] || 0) + 1;
      check(t, 'play ' + n + ' (' + st.e.t + ')');
    });
    Object.keys(silent).forEach(function (k) { problems.push(tag + ': no line for ' + k + ' plays'); });
    Object.keys(count).forEach(function (t) { if (count[t] > 3) problems.push(tag + ': said ' + count[t] + ' times: ' + t); });
  });
});
});

// Recordings, once render.js has made them (English; the Spanish voice is the browser's).
// render.js writes index.json and index.js with the same lines; read the JSON when it is there.
var vdir = path.join(ROOT, 'assets/voice/football'), recorded = 0, idx = null;
try {
  if (fs.existsSync(path.join(vdir, 'index.json'))) idx = JSON.parse(fs.readFileSync(path.join(vdir, 'index.json'), 'utf8'));
  else if (fs.existsSync(path.join(vdir, 'index.js'))) {
    var src = fs.readFileSync(path.join(vdir, 'index.js'), 'utf8'), at = src.indexOf('] = ');
    idx = JSON.parse(src.slice(at + 4, src.lastIndexOf('}') + 1));
  }
} catch (err) { problems.push('cannot read the recordings index in assets/voice/football/: ' + err.message); }
if (idx) {
  var lines = idx.lines || {};
  recorded = Object.keys(lines).length;
  Object.keys(said).forEach(function (t) { if (!lines[t]) problems.push('no recording: ' + t); });
  Object.keys(lines).forEach(function (t) {
    if (!said[t]) problems.push('recording no game says: ' + lines[t] + ' "' + t + '"');
    if (!fs.existsSync(path.join(ROOT, 'assets/voice/football', lines[t]))) problems.push('index names a missing file: ' + lines[t]);
  });
}

if (problems.length) {
  console.log('PROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('OK: ' + total + ' lines from ' + GAMES.length + ' games, ' + Object.keys(said).length +
  ' different, every play has a line, none too long, no gaps, none said more than 3 times' +
  (recorded ? ', all ' + recorded + ' recordings match.' : '; no recordings yet (assets/voice/football/index.js), so that part was skipped.'));
