// Writes pitch/BROADCAST.md: the full broadcast of the week 11 game as text, in both styles.
//   node js/announcer/transcript.js            (writes the file)
//   node js/announcer/transcript.js --print    (prints it instead)
// It plays data/games/week11-football.json through the announcer the way the app does (the
// kickoff jingle and intro, a line for every play, the crowd and its captions, half time, the
// final and the full-time jingle) and adds what the app shows around it: the player tendency
// and hot and cold remarks from data/profiles/, the halftime report and the wrap with the
// fantasy leaders, and the big call after each top play. Quarter and clock come from
// server/replay.js, which works them out the same way for the database.
'use strict';
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '../..');
var GAME = path.join(ROOT, 'data/games/week11-football.json');
var OUT = path.join(ROOT, 'pitch/BROADCAST.md');

var A = require('./index.js');
require('../audio.js');
var Snd = globalThis.FF_AUDIO;
var Rules = require('../rules.js');
var replay = require(path.join(ROOT, 'server/replay.js'));

var game = JSON.parse(fs.readFileSync(GAME, 'utf8')), teams = game.teams;
var clock = replay.buildPlays(GAME).plays;   // one record per play, in order, with quarter and clock

var profiles = {};
teams.forEach(function (t) {
  var f = path.join(ROOT, 'data/profiles/' + t.id + '.json');
  if (fs.existsSync(f)) profiles[t.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
});

var out = null;   // the lines of the style being written
A.onLine(function (text, kind) { if (kind === 'sound' && out) out.push('  *' + text + '*'); });

function broadcast(style) {
  out = [];
  A.reset(); A.setStyle(style);
  Snd.play('crowd_stop');   // so the first murmur gets its caption
  var st = Rules.create(teams), results = [], pts = {}, n = 0, firstSnap = true;
  function leaders() { return Object.keys(pts).map(function (k) { return { name: k, points: pts[k] }; }); }
  function say(where, text, label) { if (text) out.push('- ' + (where ? '**' + where + '** ' : '') + (label ? '*' + label + ':* ' : '') + text); }

  Snd.play('jingle_kickoff');
  say('Kickoff', A.intro({ teams: teams, score: [0, 0], style: style, leaders: [], plays: [] }));
  Rules.flatten(game.game, teams).forEach(function (x) {
    if (x.kind === 'half') {
      Rules.startHalf(st);
      Snd.play('crowd_stop');
      out.push('');
      say('Halftime', A.halftime({ teams: teams, score: st.score.slice(), style: style, leaders: leaders(), plays: results.slice() }) ||
        A.line({ kind: 'half' }, { teams: teams, score: st.score.slice(), style: style }), 'Halftime report');
      out.push('');
      firstSnap = true;
      return;
    }
    if (x.kind === 'final') {
      Snd.play('crowd_stop'); Snd.play('jingle_final');
      out.push('');
      say('Final', A.wrap({ teams: teams, score: st.score.slice(), style: style, leaders: leaders(), plays: results.slice() }) ||
        A.line({ kind: 'final' }, { teams: teams, score: st.score.slice(), style: style }), 'The wrap');
      return;
    }
    Snd.play('crowd_murmur');
    var res = Rules.apply(st, x.e, x.team), c = clock[n]; n++;
    results.push(res);
    res.fp.forEach(function (f) {
      var name = f.role === 'DST' ? teams[f.team].name + ' defense' : teams[f.team].roster[f.role];
      pts[name] = Math.round(((pts[name] || 0) + f.pts) * 10) / 10;
    });
    var where = c ? 'Q' + c.quarter + ' ' + c.detail.clock : 'Play ' + n;
    say(where, A.line(res, { teams: teams, score: res.post.score, style: style, profiles: profiles }));
    var crowd = Snd.crowdFor(res);
    if (crowd) Snd.play(crowd);
    if (x.e.t === 'fg' && !x.e.good) Snd.play('miss');
    var big = A.bigCall(res, { teams: teams, score: res.post.score, style: style });
    if (big) out.push('  > **Big call:** ' + big);
  });
  return out;
}

var straight = broadcast('straight'), fun = broadcast('fun');
var final = game.game && Rules ? (function () {
  var s = Rules.create(teams);
  Rules.flatten(game.game, teams).forEach(function (x) { if (x.kind === 'half') Rules.startHalf(s); else if (x.kind === 'play') Rules.apply(s, x.e, x.team); });
  return s.score;
})() : [0, 0];

var md = [
  '# The broadcast, week 11',
  '',
  'This is everything the announcer says during the week 11 game, written out so it can be read in a minute instead of listened to. ' +
  'The lines come from the team\'s own announcer code (`js/announcer/`), from rules and written lines, not from a language model. ' +
  'The game itself was built by the team\'s game engine from invented stat lines for real player names, so the plays and the final score (' +
  teams[0].name + ' ' + final[0] + ', ' + teams[1].name + ' ' + final[1] + ') are made up. The tendency and "hot lately" remarks use each player\'s ' +
  'real season and recent numbers from `data/profiles/`. Crowd and music cues are in brackets, the way television captions show them. ' +
  'Big calls are the longer calls the app shows for the top plays.',
  '',
  'Rebuild it with `node js/announcer/transcript.js`. The announcer has two styles; the app starts in Straight.',
  '',
  '## Straight',
  ''
].concat(straight, ['', '## Fun', ''], fun, ['']).join('\n');

if (/—/.test(md)) { console.error('The transcript contains an em dash. Fix the line it comes from.'); process.exit(1); }
if (process.argv.indexOf('--print') >= 0) { console.log(md); }
else {
  fs.writeFileSync(OUT, md);
  console.log('Wrote ' + path.relative(ROOT, OUT) + ': ' + straight.length + ' straight and ' + fun.length + ' fun entries.');
}
