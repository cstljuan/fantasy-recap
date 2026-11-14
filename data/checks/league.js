// Checks data/league.json. Prints OK or what is wrong.   node data/checks/league.js
'use strict';
var fs = require('fs');
var path = require('path');
var file = path.join(__dirname, '..', 'league.json');
var problems = [];
function bad(m) { problems.push(m); }
function r1(x) { return Math.round(x * 10) / 10; }

var d;
try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('data/league.json does not parse: ' + e.message); process.exit(1); }

if (d.invented !== true) bad('invented must be true');
// The note must say what is made up, and every past week with a game file must be named as real in it.
if (!/made up/i.test(d.note || '')) bad('note must say what is made up');
(d.weeks || []).forEach(function (w) {
  var real = w.finished && (w.matchups || []).some(function (m) { return m.gameFile; });
  if (real && !new RegExp('Week ' + w.week + ' is real', 'i').test(d.note || '')) bad('note must say week ' + w.week + ' is real');
});
var ids = {};
(d.matchups || []).forEach(function (m) { m.teams.forEach(function (t) { ids[t.id] = true; }); });
if (Object.keys(ids).length !== 4) bad('expected 4 teams in matchups, found ' + Object.keys(ids).length);
['week', 'release', 'matchups', 'fields'].forEach(function (k) { if (d[k] === undefined) bad('the old field ' + k + ' is missing'); });

var played = {}, wins = {}, losses = {}, pf = {}, pa = {};
Object.keys(ids).forEach(function (i) { played[i] = 0; wins[i] = 0; losses[i] = 0; pf[i] = 0; pa[i] = 0; });
if (!Array.isArray(d.weeks) || d.weeks.length !== 3) bad('weeks must list weeks 9, 10 and 11');
(d.weeks || []).forEach(function (w) {
  if (typeof w.week !== 'number' || typeof w.finished !== 'boolean') bad('a week needs week and finished');
  (w.matchups || []).forEach(function (m, mi) {
    var where = 'week ' + w.week + ' matchup ' + (mi + 1);
    if (!m.teams || m.teams.length !== 2) return bad(where + ': needs two teams');
    m.teams.forEach(function (t) {
      if (!ids[t.id]) bad(where + ': team ' + t.id + ' is not a league team');
      ['id', 'full', 'tile'].forEach(function (k) { if (!t[k]) bad(where + ': team ' + t.id + ' has no ' + k); });
    });
    if (m.teams[0].id === m.teams[1].id) bad(where + ': a team plays itself');
    if (w.finished) {
      if (!Array.isArray(m.final) || m.final.length !== 2 || m.final.some(function (x) { return typeof x !== 'number'; })) return bad(where + ': a finished week needs final [points, points]');
      if (m.gameFile !== null) {
        // a past week may have a game: then the file must exist, have these two teams, and its fantasy points must be the final
        var gp = require('path').join(__dirname, '..', 'games', m.gameFile), g = null;
        try { g = JSON.parse(require('fs').readFileSync(gp, 'utf8')); } catch (e) { return bad(where + ': game file ' + m.gameFile + ' cannot be read'); }
        if (g.teams[0].id !== m.teams[0].id || g.teams[1].id !== m.teams[1].id) bad(where + ': ' + m.gameFile + ' has other teams');
        var pts = (g.report && g.report.points || []).map(function (o) { return Math.round(Object.keys(o).reduce(function (a, k) { return a + o[k]; }, 0) * 10) / 10; });
        if (pts.join() !== m.final.join()) bad(where + ': final ' + m.final.join(' to ') + ' but ' + m.gameFile + ' gives ' + pts.join(' to '));
      }
      var a = m.teams[0].id, b = m.teams[1].id, fa = m.final[0], fb = m.final[1];
      if (fa === fb) bad(where + ': a tie is not handled by the standings');
      played[a]++; played[b]++;
      pf[a] += fa; pa[a] += fb; pf[b] += fb; pa[b] += fa;
      if (fa > fb) { wins[a]++; losses[b]++; } else { wins[b]++; losses[a]++; }
    } else {
      if (m.final !== null) bad(where + ': an unfinished week must have final null');
      if (m.gameFile !== null) {
        var gp = path.join(__dirname, '..', 'games', m.gameFile);
        if (!fs.existsSync(gp)) bad(where + ': game file data/games/' + m.gameFile + ' does not exist');
      }
    }
  });
  Object.keys(ids).forEach(function (i) {
    var n = (w.matchups || []).filter(function (m) { return m.teams.some(function (t) { return t.id === i; }); }).length;
    if (n !== 1) bad('week ' + w.week + ': team ' + i + ' plays ' + n + ' times, must be once');
  });
});

var rows = {};
(d.standings || []).forEach(function (s) {
  if (rows[s.id]) bad('standings lists ' + s.id + ' twice');
  rows[s.id] = s;
  if (!ids[s.id]) return bad('standings has an unknown team ' + s.id);
  if (s.wins + s.losses !== played[s.id]) bad(s.id + ': wins plus losses is ' + (s.wins + s.losses) + ' but the team played ' + played[s.id] + ' finished weeks');
  if (s.wins !== wins[s.id] || s.losses !== losses[s.id]) bad(s.id + ': record ' + s.wins + '-' + s.losses + ' but the finals give ' + wins[s.id] + '-' + losses[s.id]);
  if (r1(s.pointsFor) !== r1(pf[s.id])) bad(s.id + ': pointsFor is ' + s.pointsFor + ' but the finals add up to ' + r1(pf[s.id]));
  if (r1(s.pointsAgainst) !== r1(pa[s.id])) bad(s.id + ': pointsAgainst is ' + s.pointsAgainst + ' but the finals add up to ' + r1(pa[s.id]));
});
Object.keys(ids).forEach(function (i) { if (!rows[i]) bad('standings is missing team ' + i); });
var sorted = (d.standings || []).every(function (s, i, a) { return i === 0 || a[i - 1].wins > s.wins || (a[i - 1].wins === s.wins && a[i - 1].pointsFor >= s.pointsFor); });
if (!sorted) bad('standings must be sorted by wins, then points for');

if (problems.length) { console.log(problems.length + ' problem(s):'); problems.forEach(function (p) { console.log('  ' + p); }); process.exit(1); }
console.log('OK');
