// Replays a game file from data/games/ through js/rules.js and returns one record per play, in the shape the
// plays service saves. The game file has no clock, so quarters and times are worked out: each half is split
// in two by play count and plays are spread evenly over three hours from an invented kickoff time.
// Runs in Node and in the browser with the same code:
//   Node:    require('./replay.js').buildPlays('<game file>')      or .buildFromGame(gameObject, id)
//   browser: <script src="server/replay.js"></script> after js/rules.js (and soccer/js/fantasy.js, soccer/js/rules.js
//            for soccer), then FR_REPLAY.buildFromGame(window.FF_GAME_FILE, 'week11-football')
(function (root) {
'use strict';
var isNode = typeof module !== 'undefined' && !!module.exports && typeof require === 'function';
var fs = isNode ? require('fs') : null;
var path = isNode ? require('path') : null;
var ROOT = isNode ? path.join(__dirname, '..') : null;
function footballRules() { return isNode ? require(path.join(ROOT, 'js', 'rules.js')) : root.FF_RULES; }
function soccerRules() { return isNode ? require(path.join(ROOT, 'soccer', 'js', 'rules.js')) : root.SC_RULES; }
function soccerFantasy() { return isNode ? require(path.join(ROOT, 'soccer', 'js', 'fantasy.js')) : root.SC_FANTASY; }

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

// A game file's path in Node. The id is the file name without .json.
function buildPlays(file) {
  var g = JSON.parse(fs.readFileSync(file, 'utf8'));
  return buildFromGame(g, path.basename(file).replace(/\.json$/, ''));
}

// A parsed game file (football or soccer), anywhere.
function buildFromGame(g, id) {
  if (g.sport === 'soccer') return buildSoccerPlays(g, id);
  var Rules = footballRules();
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
  return { id: id || g.id || null, sport: g.sport || 'football', home: teams[0].id, away: teams[1].id,
    final: state.score.slice(), started_at: new Date(START).toISOString(), plays: plays };
}

// A soccer match file (soccer/data/*.json, sport "soccer"), replayed with soccer/js/rules.js. One row per event,
// plus one 'full_time' row for the clean sheets. A shot or penalty that goes in is stored with kind 'goal' (the
// event type stays in detail.event.t). `quarter` holds the half (1 or 2) and `minute` the match minute.
// played_at: the match minute from kickoff, with a 15 minute break after the half, and events inside the same
// minute spread evenly over it. A goal row is the scorer's (team, slot, player and the goal's points). Any other
// row, like football, takes slot, player, team and fantasy_points from the biggest award of the event. Every
// award is in detail.fp, and by_team is the team that made the event.
function buildSoccerPlays(g, id) {
  var SR = soccerRules(), SF = soccerFantasy();
  var teams = g.teams;
  var s = SR.create(teams);
  var list = [];
  SR.flatten(g.game, teams).forEach(function (st) {
    if (st.kind === 'half') { SR.startHalf(s); return; }
    if (st.kind === 'final') {
      list.push({ final: true, team: null, min: 90, half: 2, fp: SF.fullTime(s.score), score: s.score.slice() });
      return;
    }
    var r = SR.apply(s, st.e, st.team);
    list.push({ e: st.e, r: r, team: st.team, min: st.e.min, half: r.half, fp: r.fp, score: s.score.slice() });
  });
  if (s.half !== 2) throw new Error('The match never reached the second half');
  var perMin = {};
  list.forEach(function (p) { var k = p.half + ':' + p.min; perMin[k] = (perMin[k] || 0) + 1; });
  var seen = {};
  function name(t, slot) { return teams[t].roster[slot] || null; }
  var plays = list.map(function (p, i) {
    var k = p.half + ':' + p.min, n = seen[k] = (seen[k] || 0) + 1;
    var secs = p.min * 60 + (p.half === 2 ? 15 * 60 : 0) + Math.floor((n - 1) * 60 / perMin[k]);
    var main = null;
    p.fp.forEach(function (f) { if (!main || Math.abs(f.pts) > Math.abs(main.pts)) main = f; });
    var team, slot = null, player = null, pts = 0, kind;
    if (p.final) {
      kind = 'full_time';
      team = main ? teams[main.team].id : teams[0].id;
    } else {
      kind = p.r.goal ? 'goal' : p.e.t;
      team = teams[p.team].id;
      slot = p.r.goal ? p.r.scorer : (typeof p.e.by === 'string' ? p.e.by : null);
      player = slot ? name(p.team, slot) : null;
    }
    if (p.r && p.r.goal) {
      // a goal row is always the scorer's, even when the scorer is not in a fantasy lineup and only the assist scored
      p.fp.forEach(function (f) { if (f.team === p.team && f.role === p.r.scorer && f.why !== 'assist') pts = f.pts; });
    } else if (main) { team = teams[main.team].id; slot = main.role; player = name(main.team, main.role); pts = main.pts; }
    return {
      seq: i + 1,
      played_at: new Date(START + secs * 1000).toISOString(),
      quarter: p.half, minute: p.min, team: team, slot: slot, player: player, kind: kind,
      yards: null,
      fantasy_points: pts,
      detail: { sport: 'soccer', event: p.e || { t: 'ft' }, by_team: p.final ? null : teams[p.team].id, text: p.final ? 'Full time' : p.r.text, score_after: p.score,
        half: p.half, min: p.min, goal: !!(p.r && p.r.goal),
        scorer: p.r && p.r.goal ? name(p.team, p.r.scorer) : null, assist: p.r && p.r.assist ? name(p.team, p.r.assist) : null,
        fp: p.fp.map(function (f) { return { team: teams[f.team].id, slot: f.role, name: name(f.team, f.role), pts: f.pts, why: f.why }; }) },
      why: (p.e && p.e.why) || {}
    };
  });
  return { id: id || g.id || null, sport: 'soccer', home: teams[0].id, away: teams[1].id,
    final: s.score.slice(), started_at: new Date(START).toISOString(), plays: plays };
}

var api = { buildPlays: buildPlays, buildFromGame: buildFromGame, buildSoccerPlays: buildSoccerPlays };
root.FR_REPLAY = api;
if (isNode) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
