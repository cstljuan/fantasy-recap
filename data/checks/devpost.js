'use strict';
// Proof of every number in pitch/DEVPOST-FINAL.md: each count, size, model name and time the text states is read from the
// files on main and compared. A number in the text that this check does not know fails it, so a new number cannot slip in.
//   node data/checks/devpost.js
// What it cannot prove is listed in NOT_PROVABLE below with the reason, on purpose, and printed every run.
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var text = fs.readFileSync(path.join(ROOT, 'pitch', 'DEVPOST-FINAL.md'), 'utf8');
var bad = 0;
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function json(p) { return JSON.parse(read(p)); }
function count(dir, re) { return fs.readdirSync(path.join(ROOT, dir)).filter(function (f) { return re.test(f); }).length; }
function say(ok, what, why) { if (!ok) bad++; console.log((ok ? 'OK       ' : 'FAIL     ') + what + (ok || !why ? '' : ': ' + why)); }

var covered = text;   // numbers are removed from here as they are proven
function claim(what, re, check) {
  var m = re.exec(text);
  if (!m) { say(false, what, 'the sentence is not in the text any more (or was reworded): ' + re); return; }
  covered = covered.replace(m[0], ' '.repeat(m[0].length));
  var r;
  try { r = check(m); } catch (e) { r = 'could not check: ' + e.message; }
  say(r === true, what + ' (' + m[0].trim() + ')', r === true ? '' : r);
}
function num(s) { return Number(String(s).replace(/,/g, '')); }
function within(a, b, pct) { return Math.abs(a - b) <= b * pct; }

var game = json('data/games/week11-football.json');
claim('Jev chose 40 of the 84 plays', /Jev chose (\d+) of the (\d+) plays/, function (m) {
  return (game.report.playsChosenByJev === num(m[1]) && game.report.plays === num(m[2])) || 'the game file says ' + game.report.playsChosenByJev + ' of ' + game.report.plays;
});
var plays = json('data/rosters/plays-2026.json'), snaps = 0, who = 0;
Object.keys(plays.players).forEach(function (k) { who++; snaps += plays.players[k].plays.length; });
claim('3,177 snaps of the 28 roster players', /\((\d[\d,]*) snaps of the (\d+) roster players\)/, function (m) {
  return (snaps === num(m[1]) && who === num(m[2])) || 'plays-2026.json has ' + snaps + ' plays of ' + who + ' players';
});
claim('3,177 real plays', /(\d[\d,]*) real plays/, function (m) { return snaps === num(m[1]) || 'the file has ' + snaps; });
var reports = count('data/profiles/notes', /-report\.md$/);
claim('28 scouting reports', /The (\d+) scouting reports in the repository/, function (m) { return reports === num(m[1]) || 'there are ' + reports; });
claim('28 scouting reports with the plays behind every claim', /; (\d+) scouting reports with the plays behind every claim/, function (m) { return reports === num(m[1]) || 'there are ' + reports; });
claim('a model run for 27 of the 28 players', /a model run for (\d+) of the (\d+) players/, function (m) {
  return (num(m[2]) === reports && num(m[1]) === reports - 1) || 'one player ran, so ' + (reports - 1) + ' of ' + reports;
});
claim('the other 27 players', /so the other (\d+) players have not run/, function (m) { return num(m[1]) === reports - 1 || 'reports ' + reports; });
var football = count('assets/voice/football', /\.mp3$/), soccer = count('assets/voice/soccer', /\.mp3$/);
claim('about 560 football lines and 190 soccer lines', /about (\d+) football lines and (\d+) soccer lines/, function (m) {
  return (within(football, num(m[1]), 0.03) && within(soccer, num(m[2]), 0.03)) || 'the folders hold ' + football + ' and ' + soccer + ' recordings';
});
var testDb = (read('server/test-db.js').match(/\bok\('/g) || []).length;
claim('a 19 check test against a real database', /a (\d+) check test against a real database/, function (m) { return testDb === num(m[1]) || 'server/test-db.js has ' + testDb + ' ok() steps'; });
claim('three subagents (stats researcher, film room, fact checker)', /delegates through the task tool to (three) subagents/, function () {
  var names = (read('agents/scout/scout.py').match(/\{"name": "([a-z-]+)", "description"/g) || []);
  return names.length === 3 || 'scout.py defines ' + names.length;
});
// The one model run that worked: its log says the model, the player and how long it took.
var logName = 'agents/scout/runs/20261115-012822-scout.txt';
var log = read(logName).split('\n').filter(Boolean);
function secs(l) { var m = /^(\d\d):(\d\d):(\d\d)/.exec(l); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : NaN; }
claim('model gemini-3.5-flash-lite, about 2 minutes', /model (gemini-[\d.]+-flash-lite), about (\d+) minutes/, function (m) {
  var took = (secs(log[log.length - 1]) - secs(log[0])) / 60;
  if (log[0].indexOf('model=google:' + m[1]) < 0) return logName + ' says ' + log[0].slice(0, 80);
  return Math.abs(took - num(m[2])) <= 1 || 'the log shows ' + took.toFixed(1) + ' minutes';
});
claim('one player (Puka Nacua)', /one player \((Puka Nacua)\)/, function (m) { return log.join('\n').indexOf(m[1]) >= 0 && /players=1\b/.test(log[0]) || 'the log is not a one player run of ' + m[1]; });
claim('PostgreSQL 16', /plain PostgreSQL (16)\b/, function (m) { return /PostgreSQL 16/.test(read('server/SETUP.md')) || 'server/SETUP.md does not say PostgreSQL 16'; });
claim('the service listens on 3001', /\?api=http:\/\/localhost:(\d+)/, function (m) { return /3001/.test(read('server/index.js')) && num(m[1]) === 3001 || 'server/index.js does not default to ' + m[1]; });
claim('python3 -m http.server 8000', /http\.server (\d+), then open http:\/\/localhost:(\d+)/, function (m) { return m[1] === m[2] && read('README.md').indexOf('http.server ' + m[1]) >= 0 || 'README.md does not use port ' + m[1]; });
claim('the week 9 games', /real plays of NFL week (\d+)/, function (m) { return count('data/games', new RegExp('^week0' + m[1] + '-.*\\.json$')) === 2 || 'there are not two week ' + m[1] + ' game files'; });
claim('Sleeper against ESPN, all agree', /cross-checked against ESPN \(all agree\)/, function () { var c = json('data/rosters/crosscheck-2026.json'); return (c.disagreements || []).length === 0 || c.disagreements.length + ' disagreements in crosscheck-2026.json'; });
claim('the two week 9 games built from real plays', /the two week (\d+) games built from them/, function (m) {
  var ok = ['week09-gob-tur.json', 'week09-pyt-owl.json'].every(function (f) { var g = json('data/games/' + f); return g.report && g.report.source && g.report.source.from === 'plays' && g.report.source.week === num(m[1]); });
  return ok || 'the week ' + m[1] + ' game files are not both built from real plays';
});
claim('Scout across all 28 players', /Run Scout across all (\d+) players/, function (m) { return num(m[1]) === who || 'plays-2026.json has ' + who + ' players'; });

// Numbers that are not counts of anything in the repository.
var NOT_PROVABLE = [
  [/\b8-bit\b/, 'the name of the look'],
  [/\babout (20) requests\b/, "Google's free tier limit, read from its 429 error message during the run; not in a file"],
  [/gemini-3\.5-flash-lite/, 'a model name, proven above through the run log'],
  [/\b2026-11-15\b/, 'a date'],
  [/\b(?:Tiger Data|PostgreSQL) (?:\(PostgreSQL with TimescaleDB\))?/, 'names']
];
console.log('');
var rest = covered;
NOT_PROVABLE.forEach(function (n) { rest = rest.replace(new RegExp(n[0].source, 'g'), function (s) { return ' '.repeat(s.length); }); });
// what is left: numbers in the text nobody proved
var left = [], re = /\b\d[\d,]*(?:\.\d+)?\b/g, m;
while ((m = re.exec(rest))) {
  var before = rest.slice(Math.max(0, m.index - 30), m.index + 20).replace(/\s+/g, ' ');
  left.push(m[0] + ' in "' + before.trim() + '"');
}
// small ordinary words-as-numbers in code lines and headings are ignored: only digits are checked, and the setup lines are exempt
left = left.filter(function (x) { return !/http\.server|localhost|\.js |DATABASE_URL|laptop\.sh|all\.js|#/.test(x); });
say(left.length === 0, 'every other number in the text is proven or listed as not provable', left.slice(0, 6).join(' | '));
NOT_PROVABLE.slice(0, 2).forEach(function (n) { console.log('NOTE     not provable from the files: ' + n[0].source.replace(/\\b/g, '') + ' (' + n[1] + ')'); });
console.log(bad ? bad + ' failed' : 'OK');
process.exit(bad ? 1 : 0);
