'use strict';
// Replays a game file from data/games/ through js/rules.js and returns one record per play, in the shape the
// plays service saves. The game file has no clock, so quarters and times are worked out: each half is split
// in two by play count and plays are spread evenly over three hours from an invented kickoff time.
var fs = require('fs');
var path = require('path');
var root = path.join(__dirname, '..');
var Rules = require(path.join(root, 'js', 'rules.js'));

var START = Date.parse('2026-11-15T18:00:00Z');
var SPAN_MS = 3 * 60 * 60 * 1000;

// Where the ball is, measured in yards from the offense's own goal line. `end` is where the offense got to on
// this play: 100 for a touchdown, the kick spot for kicks and takeaways, otherwise the ball after the play.
function ballOf(p) {
  var e = p.st.e, r = p.r, pre = r.pre.ballOn, post = r.post.ballOn, end = post;
  if (r.td) end = 100;
  else if (e.t === 'fg' || e.t === 'punt' || e.t === 'int') end = pre;
  else if (e.t === 'fumble') end = pre + (e.yds || 0);
  else if (r.downs) end = pre + (typeof r.yds === 'number' ? r.yds : (e.yds || 0));
  return { pre: pre, post: post, end: end, flip: !!r.flip, downs: !!r.downs };
}

function buildPlays(file) {
  var g = JSON.parse(fs.readFileSync(file, 'utf8'));
  var teams = g.teams;
  var steps = Rules.flatten(g.game, teams);
  var state = Rules.create(teams);
  var list = [], half = 1;
  steps.forEach(function (st) {
    if (st.kind === 'half') { Rules.startHalf(state); half = 2; return; }
    if (st.kind === 'final') return;
    var r = Rules.apply(state, st.e, st.team);
    list.push({ st: st, r: r, half: half, score: state.score.slice() });
  });
  [1, 2].forEach(function (h) {
    var inHalf = list.filter(function (p) { return p.half === h; });
    var cut = Math.ceil(inHalf.length / 2);
    inHalf.forEach(function (p, i) { p.quarter = (h - 1) * 2 + (i < cut ? 1 : 2); });
  });
  // The game file has no clock either. Within a quarter the plays are spread evenly over 15:00 counting down.
  [1, 2, 3, 4].forEach(function (q) {
    var inQ = list.filter(function (p) { return p.quarter === q; });
    inQ.forEach(function (p, k) {
      var left = Math.round(900 * (1 - k / inQ.length));
      p.clock = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2);
      p.secs = Math.round(900 / inQ.length * 10) / 10;
    });
  });
  var plays = list.map(function (p, i) {
    var e = p.st.e, r = p.r, fp = r.fp || [], main = null;
    fp.forEach(function (f) { if (!main || Math.abs(f.pts) > Math.abs(main.pts)) main = f; });
    var team = teams[p.st.team].id, slot = null, player = null, pts = 0;
    if (main) {
      team = teams[main.team].id; slot = main.role; pts = main.pts;
      player = main.role === 'DST' ? team + ' defense' : teams[main.team].roster[main.role] || null;
    } else if (typeof (e.by || e.to) === 'string') {
      slot = e.by || e.to;
      player = teams[p.st.team].roster[slot] || null;
    }
    return {
      seq: i + 1,
      played_at: new Date(START + Math.round(i * SPAN_MS / list.length)).toISOString(),
      quarter: p.quarter, team: team, slot: slot, player: player, kind: e.t,
      yards: e.yds !== undefined ? e.yds : (e.net !== undefined ? e.net : null),
      fantasy_points: pts,
      detail: { event: e, text: r.text, score_after: p.score, drive: p.st.drive + 1, clock: p.clock, secs: p.secs, td: !!r.td,
        off: teams[p.st.team].id, half: p.half, ball: ballOf(p),
        fp: fp.map(function (f) {
          var id = teams[f.team].id;
          return { team: id, slot: f.role, name: f.role === 'DST' ? id + ' defense' : teams[f.team].roster[f.role] || null, pts: f.pts };
        }) },
      why: e.why || {}
    };
  });
  return { id: path.basename(file).replace(/\.json$/, ''), sport: g.sport || 'football', home: teams[0].id, away: teams[1].id,
    final: state.score.slice(), started_at: new Date(START).toISOString(), plays: plays };
}

module.exports = { buildPlays: buildPlays };
