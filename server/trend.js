// Week-over-week trend and hot streak for one player, from fantasy awards.
//   GET /players/:id/trend   (server/index.js; the same numbers from the game files when there is no database)
//   node server/trend.js "Josh Allen"      prints the trend from the game files in data/games/
//
// Result: { player, team, slot, source, weeks: [{ week, points, awards }], summary }
//   week      league week number (the 7 day bucket of game time, week 11 = the bucket that holds 2026-11-15)
//   points    fantasy points the player gained or lost that week, every award counted (a quarterback's share of a
//             touchdown pass included), rounded to one decimal
//   awards    how many plays gave him points
//   summary   average (mean of the weeks listed), last, previous, change (last minus previous), direction ('up' when
//             change is above 0.5, 'down' below -0.5, else 'flat'; 'none' with a single week), bestWeek,
//             hotStreak: how many of the latest weeks in a row beat his own average (0 when the latest week does not).
// Weeks he did not play are not listed. A trend needs two weeks; with one, direction is 'none'.
// The week of a game file comes from its name (week09-..., week11-...). A file without one (sample, current) is left out.
var fs = require('fs');
var path = require('path');

var WEEK11_START = Date.parse('2026-11-09T00:00:00Z');
var WEEK_MS = 7 * 24 * 3600 * 1000;
function r1(x) { return Math.round(x * 10) / 10; }
function weekOf(bucketStart) { return 11 + Math.round((Date.parse(bucketStart) - WEEK11_START) / WEEK_MS); }

function summarize(weeks) {
  var s = { average: null, last: null, previous: null, change: null, direction: 'none', bestWeek: null, hotStreak: 0 };
  if (!weeks.length) return s;
  var total = 0, best = weeks[0];
  weeks.forEach(function (w) { total += w.points; if (w.points > best.points) best = w; });
  s.average = r1(total / weeks.length);
  s.last = weeks[weeks.length - 1].points;
  s.bestWeek = best.week;
  if (weeks.length > 1) {
    s.previous = weeks[weeks.length - 2].points;
    s.change = r1(s.last - s.previous);
    s.direction = s.change > 0.5 ? 'up' : s.change < -0.5 ? 'down' : 'flat';
    var mean = total / weeks.length;
    for (var i = weeks.length - 1; i >= 0 && weeks[i].points > mean; i--) s.hotStreak++;
  }
  return s;
}

// rows from player_points_per_week: { bucket, points, awards, player, team, slot } (several teams or slots add up)
function fromRows(rows, id) {
  var by = {}, who = null;
  rows.forEach(function (r) {
    var w = weekOf(r.bucket instanceof Date ? r.bucket.toISOString() : r.bucket);
    var x = by[w] || (by[w] = { week: w, points: 0, awards: 0 });
    x.points += Number(r.points); x.awards += Number(r.awards);
    who = who || r;
  });
  var weeks = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { var x = by[k]; x.points = r1(x.points); return x; });
  return { player: who ? who.player : id, team: who ? who.team : null, slot: who ? who.slot : null, weeks: weeks, summary: summarize(weeks) };
}

function gameFiles(dir) {
  var d = dir || path.join(__dirname, '..', 'data', 'games');
  return fs.readdirSync(d).filter(function (f) { return /^week(\d+)-.*\.json$/.test(f); }).map(function (f) {
    return { file: path.join(d, f), week: parseInt(/^week(\d+)-/.exec(f)[1], 10) };
  });
}

// id: a player's name (any case) or TEAM.SLOT such as GOB.QB
function fromFiles(id, dir) {
  var buildPlays = require('./replay.js').buildPlays;
  var key = String(id).toLowerCase(), ts = /^([a-z]+)\.([a-z0-9]+)$/.exec(key), by = {}, who = null;
  gameFiles(dir).forEach(function (g) {
    var game;
    try { game = buildPlays(g.file); } catch (e) { return; }
    game.plays.forEach(function (p) {
      (p.detail.fp || []).forEach(function (f) {
        var hit = ts ? (f.team.toLowerCase() === ts[1] && String(f.slot).toLowerCase() === ts[2]) : (f.name || '').toLowerCase() === key;
        if (!hit) return;
        who = who || { player: f.name, team: f.team, slot: f.slot };
        var x = by[g.week] || (by[g.week] = { week: g.week, points: 0, awards: 0 });
        x.points += f.pts; x.awards++;
      });
    });
  });
  var weeks = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
    var x = by[k]; return { week: x.week, points: r1(x.points), awards: x.awards };
  });
  if (!weeks.length) return null;
  return { player: who.player, team: who.team, slot: who.slot, weeks: weeks, summary: summarize(weeks) };
}

module.exports = { fromRows: fromRows, fromFiles: fromFiles, summarize: summarize, weekOf: weekOf, gameFiles: gameFiles };

if (require.main === module) {
  var id = process.argv[2];
  if (!id) { console.error('Usage: node server/trend.js "<player name>" or TEAM.SLOT'); process.exit(2); }
  var t = fromFiles(id);
  if (!t) { console.error('no weeks found for ' + id); process.exit(1); }
  console.log(JSON.stringify(t, null, 1));
}
