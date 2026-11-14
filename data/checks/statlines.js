// Checks the stat line files in data/statlines/. Prints OK or what is wrong.   node data/checks/statlines.js
// For every team in every file:
//   - each field is a whole number from 0 up, and every field of week11.json is there
//   - the quarterback's pass yards and pass touchdowns equal the team's receiving yards and receiving touchdowns
//   - receptions fit the yards (yards need a catch, 2 to 35 yards a catch, no more touchdowns than catches)
//   - extra points made equal the team's touchdowns (rushing plus receiving plus defense)
//   - the other defense's points allowed equal this team's score (6 a touchdown, 1 an extra point, 3 a field goal;
//     a defensive touchdown with its extra point, 7, is not allowed by the other defense)
//   - the quarterback's interceptions equal the other defense's interceptions
// A -real file holds numbers read from a stats source for 14 players of a team, not a whole team, so its sums
// are not checked, only its shape and counts.
// A team with null lines (a real week that could not be read) is skipped and listed.
// The invented flag must match what the file says about itself.
'use strict';
var fs = require('fs');
var path = require('path');
var dir = path.join(__dirname, '..', 'statlines');
var PLAYER = ['pass_yards', 'pass_td', 'interceptions', 'rush_yards', 'rush_td', 'receptions', 'rec_yards', 'rec_td', 'fg_made', 'fg_missed', 'xp_made'];
var DEF = ['sacks', 'def_interceptions', 'fumble_recoveries', 'def_td', 'points_allowed'];
// What a week must do, beyond adding up.
var EXPECT = { 'week12.json': { winner: 'PYT', bothOver: 24 } };

var problems = [], notes = [];
function bad(f, m) { problems.push(f + ': ' + m); }
function isCount(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && Math.floor(v) === v; }
function sum(obj, key) { return Object.keys(obj).reduce(function (a, s) { return a + (obj[s].line[key] || 0); }, 0); }

var files = fs.readdirSync(dir).filter(function (f) { return /^week\d+(-real)?\.json$/.test(f); }).sort();
if (!files.length) bad('data/statlines', 'no week files found');

files.forEach(function (f) {
  var d;
  try { d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return bad(f, 'does not parse: ' + e.message); }
  var real = /-real\.json$/.test(f);
  if (real ? d.invented !== false : d.invented !== true) bad(f, 'invented must be ' + (real ? 'false' : 'true') + ' for this file');
  if (!d.note) bad(f, 'needs a note');
  if (typeof d.week !== 'number') bad(f, 'needs a week number');
  var ids = Object.keys(d.teams || {});
  if (ids.length !== 2) return bad(f, 'needs two teams');
  var score = {}, skipped = {};
  ids.forEach(function (t) {
    var T = d.teams[t], where = f + ' ' + t;
    var slots = Object.keys(T.players || {});
    if (slots.join() !== 'QB,RB,WR1,WR2,WR3,TE,K') return bad(f, t + ' needs the slots QB RB WR1 WR2 WR3 TE K in that order');
    var anyNull = slots.some(function (s) { return PLAYER.some(function (k) { return T.players[s].line[k] === null; }); });
    if (anyNull) { skipped[t] = true; notes.push(where + ' has null lines, sums skipped'); return; }
    slots.forEach(function (s) {
      var line = T.players[s].line;
      if (Object.keys(line).join() !== PLAYER.join()) bad(where, s + ' needs exactly the fields ' + PLAYER.join(', ') + ' in that order');
      PLAYER.forEach(function (k) { if (!isCount(line[k])) bad(where, s + '.' + k + ' must be a whole number from 0, got ' + line[k]); });
      if (line.rec_yards > 0 && line.receptions < 1) bad(where, s + ' has receiving yards but no catches');
      if (line.receptions > 0) {
        var ypr = line.rec_yards / line.receptions;
        if (ypr < 2 || ypr > 35) bad(where, s + ' has ' + Math.round(ypr * 10) / 10 + ' yards a catch, not plausible');
      }
      if (line.rec_td > line.receptions) bad(where, s + ' has more receiving touchdowns than catches');
    });
    if (real) { notes.push(where + ': real numbers, shape and counts checked, sums not (the roster is only some of the team)'); return; }
    var P = T.players, q = P.QB.line;
    if (q.pass_yards !== sum(P, 'rec_yards')) bad(where, 'QB pass yards ' + q.pass_yards + ' but receivers add up to ' + sum(P, 'rec_yards'));
    if (q.pass_td !== sum(P, 'rec_td')) bad(where, 'QB pass touchdowns ' + q.pass_td + ' but receivers add up to ' + sum(P, 'rec_td'));
    var dl = T.defense && T.defense.line;
    if (!dl || Object.keys(dl).join() !== DEF.join()) return bad(where, 'defense needs exactly the fields ' + DEF.join(', '));
    var td = sum(P, 'rush_td') + sum(P, 'rec_td') + (dl.def_td || 0);
    if (P.K.line.xp_made !== td) bad(where, 'K extra points ' + P.K.line.xp_made + ' but the team scored ' + td + ' touchdowns');
    score[t] = 6 * td + P.K.line.xp_made + 3 * P.K.line.fg_made;
  });
  ids.forEach(function (t, i) {
    var o = ids[1 - i];
    if (skipped[t] || skipped[o] || !score[t] || score[t] === undefined) return;
    var dl = d.teams[o].defense.line;
    var allowed = score[t] - 7 * (d.teams[t].defense.line.def_td || 0);
    if (dl.points_allowed !== allowed) bad(f + ' ' + o, 'defense points allowed ' + dl.points_allowed + ' but ' + t + ' scored ' + score[t] + (allowed !== score[t] ? ' (' + allowed + ' off its defense)' : ''));
    if (d.teams[t].players.QB.line.interceptions !== dl.def_interceptions) bad(f + ' ' + o, 'defense interceptions ' + dl.def_interceptions + ' but ' + t + ' QB threw ' + d.teams[t].players.QB.line.interceptions);
  });
  var ex = EXPECT[f];
  if (ex && score[ids[0]] !== undefined && score[ids[1]] !== undefined) {
    var win = score[ids[0]] > score[ids[1]] ? ids[0] : ids[1];
    if (win !== ex.winner) bad(f, 'the winner should be ' + ex.winner + ' but is ' + win);
    ids.forEach(function (t) { if (score[t] <= ex.bothOver) bad(f, t + ' scored ' + score[t] + ', both teams must score over ' + ex.bothOver); });
  }
  if (!real) notes.push(f + ': ' + ids.map(function (t) { return t + ' ' + score[t]; }).join(', '));
});

notes.forEach(function (n) { console.log('  ' + n); });
if (problems.length) { console.log(problems.length + ' problem(s):'); problems.forEach(function (p) { console.log('  ' + p); }); process.exit(1); }
console.log('OK');
