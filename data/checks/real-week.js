'use strict';
// The demo plays a real week (week 9). This check proves the points the app shows for it are the real week's:
//   1. for every running back, receiver and tight end (the players whose points come only from their own catches and
//      runs), the points in the game file equal the points the scoring rules give the real stat line read from Sleeper
//      (data/statlines/week09-<teams>-real.json), within 0.25 (the two sources count a few plays differently);
//   2. quarterbacks and kickers are listed with their difference and the reason, not hidden: a quarterback's passing in
//      the game is only the catches by our own receivers, and a kicker's extra points follow the game's touchdowns;
//   3. the league's current week names those games, its finished weeks (7 and 8) have the points of their game files,
//      and the current week's points are not in the league file.
//   node data/checks/real-week.js
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var S = require(path.join(ROOT, 'agents', 'scout', 'score.js'));
var rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scoring.json'), 'utf8'));
function json(p) { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); }
var bad = 0;
function say(ok, what, why) { if (!ok) bad++; console.log((ok ? 'OK    ' : 'FAIL  ') + what + (ok || !why ? '' : ': ' + why)); }
function r1(x) { return Math.round(x * 10) / 10; }

var checked = 0;
[['week09-gob-tur', 'week09-gob-tur-real'], ['week09-pyt-owl', 'week09-pyt-owl-real']].forEach(function (pair) {
  var g = json('data/games/' + pair[0] + '.json'), real = json('data/statlines/' + pair[1] + '.json');
  say(real.invented === false && real.week === 9, pair[1] + '.json is real week 9 data (invented: false)');
  g.teams.forEach(function (T, i) {
    var pts = g.report.points[i];
    Object.keys(T.roster).forEach(function (slot) {
      var pl = real.teams[T.id].players[slot], line = pl && pl.line;
      if (!pl || pl.name !== T.roster[slot]) return say(false, T.id + ' ' + slot + ' is the same player in the game and the real stat lines', (pl && pl.name) + ' vs ' + T.roster[slot]);
      if (!line || line.pass_yards === null) { console.log('NOTE  ' + T.id + ' ' + slot + ' ' + pl.name + ': no real stat line for week 9 (' + ((real.unresolved.filter(function (u) { return u.team === T.id && u.slot === slot; })[0] || {}).reason || 'not read') + '), not compared'); return; }
      var want = S.score(line, rules), have = pts[slot] || 0, diff = r1(have - want);
      if (slot === 'QB' || slot === 'K') {
        console.log('NOTE  ' + T.id + ' ' + slot + ' ' + pl.name + ': game ' + have + ', real stat line ' + want + ' (' + (diff > 0 ? '+' : '') + diff + '). ' +
          (slot === 'QB' ? 'The quarterback\'s passing in the game is only the catches by our own receivers, whoever threw them (a quarterback who did not play shows 0 in the real line).' : 'The kicker\'s extra points follow this game\'s touchdowns, and kick distances come from the plays.'));
        return;
      }
      checked++;
      say(Math.abs(diff) <= 0.25, T.id + ' ' + slot + ' ' + pl.name + ': game ' + have + ', real stat line ' + want, 'differs by ' + diff);
    });
  });
});
say(checked >= 18, checked + ' running backs, receivers and tight ends compared with their real stat lines', 'expected at least 18');

var L = json('data/league.json');
var cur = L.weeks.filter(function (w) { return w.week === L.week; })[0];
say(L.week === 9 && cur && !cur.finished, 'the league\'s current week is 9 and not finished');
say(cur.matchups.every(function (m) { return m.final === null; }), 'the current week has no points in the league file');
say(L.matchups[0].ours && cur.matchups[0].gameFile === 'week09-gob-tur.json' && L.matchups[0].teams.map(function (t) { return t.id; }).join() === 'GOB,TUR', 'our matchup is Goblins against Turtles and plays week09-gob-tur.json');
L.weeks.filter(function (w) { return w.finished; }).forEach(function (w) {
  w.matchups.forEach(function (m) {
    var g = json('data/games/' + m.gameFile);
    var tot = g.report.points.map(function (p) { return r1(Object.keys(p).reduce(function (a, k) { return a + p[k]; }, 0)); });
    say(m.final[0] === tot[0] && m.final[1] === tot[1] && m.real === true, 'week ' + w.week + ' ' + m.teams[0].id + ' v ' + m.teams[1].id + ': ' + m.final.join(' to ') + ' equals the points of ' + m.gameFile, tot.join(' to '));
  });
});
console.log(bad ? bad + ' failed' : 'OK');
process.exit(bad ? 1 : 0);
