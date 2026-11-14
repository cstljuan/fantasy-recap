// Checks the football rosters of the league. Prints OK or what is wrong.   node data/checks/rosters.js
//   - every team in data/league.json has a roster: js/data.js for GOB and PYT, data/rosters/<id>.json for the others
//   - each roster has the seven slots QB, RB, WR1, WR2, WR3, TE, K and no player twice
//   - no player is on two teams
//   - data/profiles/<id>.json has every slot, with the same name, and a source for every number that is filled
//   - a stat line file named for a matchup (data/statlines/week<NN>-<a>-<b>.json) uses the roster's names
'use strict';
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var Data = require(path.join(ROOT, 'js', 'data.js'));
var SLOTS = ['QB', 'RB', 'WR1', 'WR2', 'WR3', 'TE', 'K'];
var problems = [], seen = {}, rosters = {};

function read(p) { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
Data.TEAMS.forEach(function (t) { rosters[t.id] = { from: 'js/data.js', roster: t.roster }; });
var league = read('data/league.json'), ids = [];
(league.weeks || []).forEach(function (w) { w.matchups.forEach(function (m) { m.teams.forEach(function (t) { if (ids.indexOf(t.id) < 0) ids.push(t.id); }); }); });
ids.forEach(function (id) {
  if (rosters[id]) return;
  var f = 'data/rosters/' + id + '.json';
  if (!fs.existsSync(path.join(ROOT, f))) return problems.push(id + ': no roster (' + f + ')');
  var d = read(f);
  if (d.team !== id || d.sport !== 'football') problems.push(f + ': team must be ' + id + ' and sport football');
  rosters[id] = { from: f, roster: d.roster || {} };
});
Object.keys(rosters).forEach(function (id) {
  var r = rosters[id].roster, names = [];
  SLOTS.forEach(function (s) {
    var n = r[s];
    if (typeof n !== 'string' || !n) return problems.push(id + ' ' + s + ': no player in ' + rosters[id].from);
    if (names.indexOf(n) >= 0) problems.push(id + ': ' + n + ' twice');
    names.push(n);
    if (seen[n] && seen[n] !== id) problems.push(n + ' is on ' + seen[n] + ' and ' + id);
    seen[n] = id;
  });
  Object.keys(r).forEach(function (s) { if (SLOTS.indexOf(s) < 0) problems.push(id + ': unknown slot ' + s); });
  var pf = 'data/profiles/' + id + '.json';
  if (!fs.existsSync(path.join(ROOT, pf))) return problems.push(id + ': no profile file ' + pf);
  var prof = read(pf);
  SLOTS.forEach(function (s) {
    var p = prof.players && prof.players[s];
    if (!p) return problems.push(pf + ': no ' + s);
    if (p.name !== r[s]) problems.push(pf + ' ' + s + ': ' + p.name + ', roster says ' + r[s]);
    Object.keys(p.tendencies || {}).forEach(function (k) {
      var v = p.tendencies[k], src = p.tendency_sources && p.tendency_sources[k];
      if (v !== null && (typeof v !== 'number' || v < 0 || v > 1)) problems.push(pf + ' ' + s + '.' + k + ' must be 0 to 1 or null');
      if (v !== null && !(src && src.source && src.date)) problems.push(pf + ' ' + s + '.' + k + ' has a number but no source and date');
    });
  });
});
fs.readdirSync(path.join(ROOT, 'data', 'statlines')).forEach(function (f) {
  var m = /^week\d+-([a-z]+)-([a-z]+)\.json$/.exec(f);
  if (!m) return;
  var d = read('data/statlines/' + f);
  [m[1], m[2]].map(function (x) { return x.toUpperCase(); }).forEach(function (id) {
    var T = d.teams && d.teams[id], r = rosters[id] && rosters[id].roster;
    if (!T || !r) return problems.push(f + ': no team ' + id + ' or no roster for it');
    SLOTS.forEach(function (s) { if (!T.players[s] || T.players[s].name !== r[s]) problems.push(f + ' ' + id + ' ' + s + ': ' + (T.players[s] && T.players[s].name) + ', roster says ' + r[s]); });
  });
});
console.log(Object.keys(rosters).length + ' teams, ' + Object.keys(seen).length + ' players');
if (problems.length) { console.log('PROBLEMS (' + problems.length + '):'); problems.forEach(function (p) { console.log('  ' + p); }); process.exit(1); }
console.log('OK');
