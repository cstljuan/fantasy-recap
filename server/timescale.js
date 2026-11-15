// The TimescaleDB queries of the service. On Tiger Data they use time_bucket; on a plain PostgreSQL (a laptop test)
// the same queries use date_bin, which does the same bucketing (PostgreSQL 14 and newer). Nothing else differs.
//   fn(db)            -> Promise<'time_bucket' | 'date_bin'>  which one this database has (asked once)
//   momentum(db, fn, gameId, home, away, bucketSeconds) -> the same shape as server/momentum.js, or null with no awards
//   hasAwards(db)     -> Promise<boolean>  whether migration 004 is applied (the fp_awards table exists)
//   trend(db, id)     -> Promise<{rows}> weekly points per player from the player_points_per_week aggregate
var momentumModule = require('./momentum.js');

function fn(db) {
  return db.query("SELECT to_regproc('time_bucket') IS NOT NULL AS tb").then(function (r) { return r.rows[0] && r.rows[0].tb ? 'time_bucket' : 'date_bin'; });
}
function hasAwards(db) {
  return db.query("SELECT to_regclass('fp_awards') IS NOT NULL AS ok").then(function (r) { return !!(r.rows[0] && r.rows[0].ok); });
}

// Fantasy points per team and the last score and quarter, per bucket of game time counted from the first play.
// Same buckets as server/momentum.js: floor((played_at - first play) / width).
function momentumSql(f) {
  return 'WITH o AS (SELECT min(played_at) AS t0 FROM plays WHERE game_id = $1) ' +
    'SELECT floor(extract(epoch FROM (' + f + '(make_interval(secs => $2::double precision), a.played_at, o.t0) - o.t0)) / $2::double precision)::int AS b, ' +
    "a.team AS team, sum(a.pts)::float8 AS pts, NULL::int AS quarter, NULL::int AS sh, NULL::int AS sa " +
    'FROM fp_awards a, o WHERE a.game_id = $1 GROUP BY 1, 2 ' +
    'UNION ALL ' +
    'SELECT floor(extract(epoch FROM (' + f + '(make_interval(secs => $2::double precision), p.played_at, o.t0) - o.t0)) / $2::double precision)::int, ' +
    "NULL, NULL, (array_agg(p.quarter ORDER BY p.seq DESC))[1], " +
    "(array_agg((p.detail -> 'score_after' ->> 0)::int ORDER BY p.seq DESC))[1], " +
    "(array_agg((p.detail -> 'score_after' ->> 1)::int ORDER BY p.seq DESC))[1] " +
    'FROM plays p, o WHERE p.game_id = $1 GROUP BY 1 ORDER BY 1';
}

function r1(x) { return Math.round(x * 10) / 10; }

function momentum(db, f, gameId, home, away, bs) {
  return db.query(momentumSql(f), [gameId, bs]).then(function (r) {
    var by = {}, last = -1;
    r.rows.forEach(function (x) {
      var b = by[x.b] || (by[x.b] = { fp: [0, 0] });
      if (x.team) { var i = x.team === home ? 0 : x.team === away ? 1 : -1; if (i >= 0) b.fp[i] += x.pts; }
      else { b.quarter = x.quarter; b.sc = [x.sh || 0, x.sa || 0]; }
      if (x.b > last) last = x.b;
    });
    if (last < 0) return null;
    var out = [], fpT = [0, 0], prev = [0, 0], q = 1, scT = [0, 0];
    for (var b = 0; b <= last; b++) {
      var x = by[b] || { fp: [0, 0] };
      if (x.sc) { x.score = [x.sc[0] - prev[0], x.sc[1] - prev[1]]; prev = x.sc; scT = x.sc; q = x.quarter; } else x.score = [0, 0];
      fpT = [fpT[0] + x.fp[0], fpT[1] + x.fp[1]];
      out.push({ start: b * bs, quarter: q, fp: [r1(x.fp[0]), r1(x.fp[1])], score: x.score, fpTotal: [r1(fpT[0]), r1(fpT[1])], scoreTotal: scT.slice() });
    }
    return { bucketSeconds: bs, buckets: out };
  });
}

// id: a name (any case) or TEAM.SLOT
function trend(db, id) {
  var m = /^([A-Za-z]+)\.([A-Za-z0-9]+)$/.exec(id);
  if (m) return db.query('SELECT bucket, points, awards, player, team, slot FROM player_points_per_week WHERE upper(team) = upper($1) AND upper(slot) = upper($2) ORDER BY bucket', [m[1], m[2]]);
  return db.query('SELECT bucket, points, awards, player, team, slot FROM player_points_per_week WHERE player_key = lower($1) ORDER BY bucket', [id]);
}

module.exports = { fn: fn, hasAwards: hasAwards, momentum: momentum, momentumSql: momentumSql, trend: trend };
