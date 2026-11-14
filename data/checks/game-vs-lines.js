'use strict';
// Proof that each football game file reproduces the stat lines it was built from.
//   node data/checks/game-vs-lines.js
// For every file in data/games/*.json it replays the plays through js/rules.js (read only) and adds up, per team
// and slot: receptions, receiving yards and touchdowns, carries, rushing yards and touchdowns, passing yards,
// touchdowns and interceptions (on the QB), field goals made and missed by distance band, extra points made and
// missed, fumbles lost, and per defense sacks and takeaways; then fantasy points per slot (summed from the rules'
// own fp list) and the final score. The tally is written here on purpose and does not use engine/make-game.js, so
// the engine is not checking itself.
//
// What it compares with, for each file (printed on its line):
//   source lines: the game the engine was told to rebuild. engine/make-game.js builds only from --from-sample, the
//                 scripted sample game in js/data.js, so that is the source for every football file. The sample game
//                 is tallied the same way.
//   report:       when the file has report.points and report.score (written by the engine), those too.
// Prints one line per difference and OK only when every file agrees with both. Exit code 1 on any difference.
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..', '..');
var Rules = require(path.join(ROOT, 'js', 'rules.js'));
var Data = require(path.join(ROOT, 'js', 'data.js'));

function r1(x) { return Math.round(x * 10) / 10; }
function band(d) { return d >= 50 ? '50+' : d >= 40 ? '40-49' : '0-39'; }

function tally(teams, game) {
  var s = Rules.create(teams);
  var out = teams.map(function (t) { return { id: t.id, players: {}, defense: { sacks: 0, takeaways: 0 }, points: {}, score: 0 }; });
  function P(t, slot) {
    var p = out[t].players;
    return p[slot] || (p[slot] = { rec: 0, rec_yds: 0, rec_td: 0, rush: 0, rush_yds: 0, rush_td: 0, pass_yds: 0, pass_td: 0, ints: 0,
      fumbles_lost: 0, fg: { '0-39': [0, 0], '40-49': [0, 0], '50+': [0, 0] }, xp: [0, 0] });
  }
  Rules.flatten(game, teams).forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(s); return; }
    if (st.kind !== 'play') return;
    var e = st.e, t = st.team, d = 1 - t, r = Rules.apply(s, e, t);
    (r.fp || []).forEach(function (f) { out[f.team].points[f.role] = (out[f.team].points[f.role] || 0) + f.pts; });
    if (e.t === 'pass') {
      var c = P(t, e.to); c.rec++; c.rec_yds += e.yds; if (r.td) c.rec_td++;
      var q = P(t, 'QB'); q.pass_yds += e.yds; if (r.td) q.pass_td++;
    } else if (e.t === 'run') {
      var b = P(t, e.by); b.rush++; b.rush_yds += e.yds; if (r.td) b.rush_td++;
    } else if (e.t === 'int') {
      P(t, 'QB').ints++; out[d].defense.takeaways++;
    } else if (e.t === 'fumble') {
      P(t, e.by || 'QB').fumbles_lost++; out[d].defense.takeaways++;
    } else if (e.t === 'sack') {
      out[d].defense.sacks++;
    } else if (e.t === 'fg') {
      P(t, 'K').fg[band(r.fgDist)][e.good ? 0 : 1]++;
    } else if (e.t === 'xp') {
      P(t, 'K').xp[e.good ? 0 : 1]++;
    }
  });
  out.forEach(function (o, i) {
    o.score = s.score[i];
    Object.keys(o.points).forEach(function (k) { o.points[k] = r1(o.points[k]); });
  });
  return out;
}

function flat(p) {
  var f = {};
  Object.keys(p).forEach(function (k) {
    if (k === 'fg') Object.keys(p.fg).forEach(function (b) { f['fg ' + b + ' made'] = p.fg[b][0]; f['fg ' + b + ' missed'] = p.fg[b][1]; });
    else if (k === 'xp') { f['xp made'] = p.xp[0]; f['xp missed'] = p.xp[1]; }
    else f[k] = p[k];
  });
  return f;
}

// Differences between a game's tally and the source tally, one text line each.
function compare(file, teams, made, want, label) {
  var diffs = [];
  made.forEach(function (m, i) {
    var w = want[i];
    if (m.id !== w.id) { diffs.push(file + ': team ' + i + ' is ' + m.id + ' in the game but ' + w.id + ' in the ' + label); return; }
    var slots = Object.keys(Object.assign({}, m.players, w.players));
    slots.forEach(function (slot) {
      var a = flat(m.players[slot] || {}), b = flat(w.players[slot] || {});
      Object.keys(Object.assign({}, a, b)).forEach(function (k) {
        if ((a[k] || 0) !== (b[k] || 0)) diffs.push(file + ': ' + m.id + ' ' + slot + ' ' + (teams[i].roster[slot] || '') + ' ' + k + ' ' + (a[k] || 0) + ' in the game, ' + (b[k] || 0) + ' in the ' + label);
      });
    });
    ['sacks', 'takeaways'].forEach(function (k) {
      if (m.defense[k] !== w.defense[k]) diffs.push(file + ': ' + m.id + ' defense ' + k + ' ' + m.defense[k] + ' in the game, ' + w.defense[k] + ' in the ' + label);
    });
    Object.keys(Object.assign({}, m.points, w.points)).forEach(function (k) {
      if (r1(m.points[k] || 0) !== r1(w.points[k] || 0)) diffs.push(file + ': ' + m.id + ' ' + k + ' fantasy points ' + (m.points[k] || 0) + ' in the game, ' + (w.points[k] || 0) + ' in the ' + label);
    });
    if (m.score !== w.score) diffs.push(file + ': ' + m.id + ' score ' + m.score + ' in the game, ' + w.score + ' in the ' + label);
  });
  return diffs;
}

function compareReport(file, made, report) {
  var diffs = [];
  made.forEach(function (m, i) {
    if (report.score && report.score[i] !== m.score) diffs.push(file + ': ' + m.id + ' score ' + m.score + ' in the plays, ' + report.score[i] + ' in the report');
    var rp = (report.points || [])[i] || {};
    Object.keys(Object.assign({}, m.points, rp)).forEach(function (k) {
      if (r1(m.points[k] || 0) !== r1(rp[k] || 0)) diffs.push(file + ': ' + m.id + ' ' + k + ' fantasy points ' + (m.points[k] || 0) + ' in the plays, ' + (rp[k] || 0) + ' in the report');
    });
  });
  return diffs;
}

var source = tally(Data.TEAMS, Data.SAMPLE_GAME);
var dir = path.join(ROOT, 'data', 'games');
var files = fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).sort();
var all = [];
files.forEach(function (f) {
  var g = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  if ((g.sport || 'football') !== 'football') { console.log('SKIPPED ' + f + ': sport ' + g.sport); return; }
  var made;
  try { made = tally(g.teams, g.game); }
  catch (e) { var msg = f + ': the rules refuse the game: ' + e.message; console.log('DIFF    ' + msg); all.push(msg); return; }
  var diffs = compare(f, g.teams, made, source, 'source lines (js/data.js sample game)');
  var against = 'source lines (js/data.js sample game)';
  if (g.report && g.report.points) { diffs = diffs.concat(compareReport(f, made, g.report)); against += ' and the file\'s report'; }
  var names = [];
  g.teams.forEach(function (t, i) {
    Object.keys(t.roster).forEach(function (slot) {
      if (Data.TEAMS[i].roster[slot] !== t.roster[slot]) names.push(t.id + ' ' + slot + ' is ' + t.roster[slot] + ' in the file, ' + Data.TEAMS[i].roster[slot] + ' in js/data.js');
    });
  });
  names.forEach(function (n) { console.log('NOTE    ' + f + ': ' + n); });
  var players = made.reduce(function (n, m) { return n + Object.keys(m.players).length; }, 0);
  if (diffs.length) { diffs.forEach(function (d) { console.log('DIFF    ' + d); }); }
  else console.log('OK      ' + f + ': ' + players + ' players, both defenses, points and score ' + made[0].score + ' to ' + made[1].score + ' equal the ' + against);
  all = all.concat(diffs);
});
console.log(all.length ? all.length + ' differences' : 'OK');
process.exit(all.length ? 1 : 0);
