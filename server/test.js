'use strict';
// Runs the service against a fake database. It proves the routes and checks, not the SQL.
var http = require('http');
var assert = require('assert');
var createServer = require('./index.js').createServer;
var poolConfig = require('./index.js').poolConfig;

var url = 'postgres://u:p@host.example:5432/db?sslmode=require&uselibpqcompat=true';
var none = poolConfig(url);
assert.equal(none.connectionString, url);
assert.equal(none.ssl, undefined);
var caPath = require('path').join(__dirname, 'test-ca.tmp');
require('fs').writeFileSync(caPath, 'FAKE CERTIFICATE TEXT');
var withCa = poolConfig(url, caPath);
require('fs').unlinkSync(caPath);
assert.equal(withCa.ssl.rejectUnauthorized, true);
assert.equal(withCa.ssl.ca, 'FAKE CERTIFICATE TEXT');
assert.ok(withCa.connectionString.indexOf('sslmode') === -1 && withCa.connectionString.indexOf('uselibpqcompat') === -1);
assert.ok(withCa.connectionString.indexOf('host.example:5432/db') > -1);

var log = [];
var fake = {
  query: function (t, p) { log.push([t, p]); return Promise.resolve({ rows: [{ x: 1 }] }); },
  connect: function () { return Promise.resolve({ query: function (t, p) { log.push([t, p]); return Promise.resolve({ rows: [] }); }, release: function () { log.push(['release']); } }); }
};
var srv = createServer(fake).listen(0, function () {
  var port = srv.address().port;
  function call(method, p, body, extra, portOverride) {
    return new Promise(function (ok) {
      var headers = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
      var r = http.request({ port: portOverride || port, method: method, path: p, headers: headers }, function (res) {
        var s = ''; res.on('data', function (c) { s += c; }); res.on('end', function () { ok({ status: res.statusCode, headers: res.headers, body: s ? JSON.parse(s) : null }); });
      });
      if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
      r.end();
    });
  }
  var play = { seq: 1, played_at: '2026-01-01T00:00:00Z', quarter: 1, team: 'GOB', kind: 'run', yards: 4 };
  call('GET', '/games/g1/plays').then(function (r) { assert.equal(r.status, 200); assert.deepEqual(r.body.plays, [{ x: 1 }]); })
    .then(function () { return call('GET', '/games/g1/summary'); }).then(function (r) { assert.equal(r.status, 200); assert.ok(r.body.players && r.body.quarters); })
    .then(function () { return call('POST', '/games/g1/plays', { game: { sport: 'football', home: 'GOB', away: 'PYT' }, plays: [play] }); })
    .then(function (r) { assert.equal(r.status, 201); assert.equal(r.body.received, 1); assert.ok(log.some(function (l) { return l[0] === 'COMMIT'; })); })
    .then(function () { return call('POST', '/games/g1/plays', { plays: [{ seq: 'x' }] }); }).then(function (r) { assert.equal(r.status, 400); })
    .then(function () { return call('POST', '/games/g1/plays', '{nope'); }).then(function (r) { assert.equal(r.status, 400); })
    .then(function () { return call('GET', '/nowhere'); }).then(function (r) { assert.equal(r.status, 404); })
    .then(function () { return call('POST', '/games/g1/optin', { manager: ' ricky ' }); })
    .then(function (r) {
      assert.equal(r.status, 201); assert.equal(r.body.manager, 'ricky');
      assert.ok(log.some(function (l) { return /INSERT INTO optins/.test(l[0]) && l[1][0] === 'g1' && l[1][1] === 'ricky'; }), 'optin insert');
    })
    .then(function () { return call('POST', '/games/g1/optin', { manager: '' }); }).then(function (r) { assert.equal(r.status, 400); })
    .then(function () { return call('GET', '/games/g1/optins'); }).then(function (r) { assert.equal(r.status, 200); assert.deepEqual(r.body.optins, [{ x: 1 }]); })
    .then(function () { return call('GET', '/health'); }).then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.database, true); })
    // CORS: a page on localhost or 127.0.0.1 on any port is allowed, any other origin gets no header
    .then(function () { return call('GET', '/health', undefined, { Origin: 'http://localhost:5173' }); })
    .then(function (r) { assert.equal(r.headers['access-control-allow-origin'], 'http://localhost:5173'); })
    .then(function () { return call('GET', '/health', undefined, { Origin: 'http://127.0.0.1:8000' }); })
    .then(function (r) { assert.equal(r.headers['access-control-allow-origin'], 'http://127.0.0.1:8000'); })
    .then(function () { return call('GET', '/health', undefined, { Origin: 'https://evil.example' }); })
    .then(function (r) { assert.equal(r.headers['access-control-allow-origin'], undefined); })
    .then(function () { return call('GET', '/health', undefined, { Origin: 'http://localhost.evil.example' }); })
    .then(function (r) { assert.equal(r.headers['access-control-allow-origin'], undefined); })
    .then(function () { return call('OPTIONS', '/games/g1/plays', undefined, { Origin: 'http://localhost:3000' }); })
    .then(function (r) { assert.equal(r.status, 204); assert.equal(r.headers['access-control-allow-origin'], 'http://localhost:3000'); })
    // a database that does not answer, and an opt in for a game that does not exist
    .then(function () {
      var down = createServer({
        query: function (t) { var e = new Error('down'); if (/optins/.test(t)) e.code = '23503'; return Promise.reject(e); },
        connect: function () { return Promise.reject(new Error('down')); }
      }).listen(0);
      var dport = down.address().port;
      return call('GET', '/health', undefined, undefined, dport)
        .then(function (r) { assert.equal(r.status, 503); assert.equal(r.body.database, false); })
        .then(function () { return call('POST', '/games/nope/optin', { manager: 'x' }, undefined, dport); })
        .then(function (r) { assert.equal(r.status, 404); })
        .then(function () { return call('GET', '/games/nope/plays', undefined, undefined, dport); })
        .then(function (r) { assert.equal(r.status, 500); down.close(); });
    })
    // push-game.js: replays the sample game and sends every play to the service
    .then(function () {
      log.length = 0;
      var pushGame = require('./push-game.js').pushGame;
      return pushGame(require('path').join(__dirname, '..', 'data', 'games', 'sample-football.json'), 'http://localhost:' + port, 'pushed');
    })
    .then(function (r) {
      assert.equal(r.plays, 73); assert.deepEqual(r.final, [17, 14]);
      var ins = log.filter(function (l) { return /^INSERT INTO plays/.test(l[0]); });
      assert.equal(ins.length, 73, 'one insert per play');
      assert.ok(log.some(function (l) { return /^INSERT INTO games/.test(l[0]) && l[1][0] === 'pushed' && l[1][2] === 'GOB'; }), 'game row');
      assert.equal(ins[0][1][0], 'pushed'); assert.equal(ins[0][1][1], 1); assert.equal(ins[72][1][1], 73);
      var times = ins.map(function (l) { return Date.parse(l[1][2]); });
      assert.ok(times.every(function (t, i) { return i === 0 || t > times[i - 1]; }), 'times increase');
      assert.ok(ins.some(function (l) { return Number(l[1][9]) > 0; }), 'fantasy points are sent');
      assert.equal(log.filter(function (l) { return l[0] === 'COMMIT'; }).length, 2, 'two batches of at most 40');
    })
    // soccer: push-game.js replays a soccer match file with soccer/js/rules.js; goal rows equal the final score
    .then(function () {
      var P = require('path'), rp = require('./replay.js');
      ['sample-soccer.json', 'week11-soccer.json'].forEach(function (f) {
        var file = P.join(__dirname, '..', 'soccer', 'data', f), raw = JSON.parse(require('fs').readFileSync(file, 'utf8'));
        var m = rp.buildPlays(file);
        assert.equal(m.sport, 'soccer');
        assert.equal(m.plays.length, raw.game.events.filter(function (e) { return e.t !== 'ht'; }).length + 1, f + ': one row per event plus full time');
        var goals = m.plays.filter(function (p) { return p.kind === 'goal'; });
        [0, 1].forEach(function (t) {
          var id = raw.teams[t].id;
          assert.equal(goals.filter(function (p) { return p.team === id; }).length, m.final[t], f + ': goal rows of ' + id + ' equal the final score');
        });
        if (raw.report && raw.report.score) assert.deepEqual(m.final, raw.report.score, f + ': final equals the match report');
        assert.ok(m.plays.every(function (p) { return Number.isInteger(p.minute) && (p.quarter === 1 || p.quarter === 2); }), f + ': minute and half');
        var t = m.plays.map(function (p) { return Date.parse(p.played_at); });
        assert.ok(t.every(function (x, i) { return i === 0 || x >= t[i - 1]; }), f + ': times never go back');
        // the fantasy points of every award add up to the soccer fantasy breakdown
        var B = require('../soccer/js/fantasy.js').breakdown(raw.game, raw.teams, require('../soccer/js/rules.js'));
        var sum = [0, 0];
        m.plays.forEach(function (p) { p.detail.fp.forEach(function (x) { sum[x.team === raw.teams[0].id ? 0 : 1] += x.pts; }); });
        assert.deepEqual(sum, [B.totals[0].total, B.totals[1].total], f + ': fantasy points add up');
        if (raw.report && raw.report.points) raw.report.points.forEach(function (pts, ti) {
          Object.keys(pts).forEach(function (slot) {
            var got = 0;
            m.plays.forEach(function (p) { p.detail.fp.forEach(function (x) { if (x.team === raw.teams[ti].id && x.slot === slot) got += x.pts; }); });
            assert.equal(got, pts[slot], f + ': ' + raw.teams[ti].id + ' ' + slot + ' points equal the report');
          });
        });
      });
      log.length = 0;
      var file = P.join(__dirname, '..', 'soccer', 'data', 'week11-soccer.json');
      return require('./push-game.js').pushGame(file, 'http://localhost:' + port).then(function (r) {
        assert.equal(r.id, 'week11-soccer'); assert.deepEqual(r.final, [2, 0]);
        var ins = log.filter(function (l) { return /^INSERT INTO plays/.test(l[0]); });
        assert.equal(ins.length, r.plays);
        assert.ok(ins.every(function (l) { return /minute\) VALUES/.test(l[0]) && Number.isInteger(l[1][12]); }), 'soccer rows carry the minute');
        var goalRows = ins.filter(function (l) { return l[1][7] === 'goal'; });
        assert.equal(goalRows.length, 2, 'goal rows sent equal the final score 2 to 0');
        assert.ok(goalRows.every(function (l) { return l[1][4] === 'IRN' && l[1][6]; }), 'goal rows name the scorer of IRN');
        assert.ok(log.some(function (l) { return /^INSERT INTO games/.test(l[0]) && l[1][0] === 'week11-soccer' && l[1][1] === 'soccer'; }), 'game row says soccer');
      });
    })
    .then(function () {
      // football rows have no minute and use the insert without the minute column (works before the migration)
      log.length = 0;
      return call('POST', '/games/g1/plays', { plays: [play] }).then(function (r) {
        assert.equal(r.status, 201);
        assert.ok(log.some(function (l) { return /^INSERT INTO plays/.test(l[0]) && !/minute/.test(l[0]) && l[1].length === 12; }));
      });
    })
    .then(function () { return call('POST', '/games/g1/plays', { plays: [Object.assign({}, play, { minute: 1.5 })] }); })
    .then(function (r) { assert.equal(r.status, 400); })
    // top plays: from the database when it answers, from the game file when it does not
    .then(function () {
      var tp = require('./top-plays.js'), file = require('path').join(__dirname, '..', 'data', 'games', 'week11-football.json');
      var want = tp.topPlays(file, 3);
      assert.equal(want.length, 3);
      assert.ok(want[0].points >= want[1].points && want[1].points >= want[2].points, 'ranked by points');
      ['index', 'quarter', 'clock', 'team', 'kind', 'yards', 'players', 'points', 'highlight', 'text'].forEach(function (k) { assert.ok(k in want[0], 'field ' + k); });
      assert.ok(Array.isArray(want[0].players) && want[0].players.length >= 1 && typeof want[0].text === 'string');
      var rows = require('./replay.js').buildPlays(file).plays.map(function (p) { return { seq: p.seq, quarter: p.quarter, team: p.team, kind: p.kind, yards: p.yards, detail: p.detail, why: p.why }; });
      var withDb = createServer({ query: function () { return Promise.resolve({ rows: rows }); } }).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      var empty = createServer({ query: function () { return Promise.resolve({ rows: [] }); } }).listen(0);
      return call('GET', '/games/week11-football/top-plays?n=3', undefined, undefined, withDb.address().port)
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); assert.deepEqual(r.body.plays, want); })
        .then(function () { return call('GET', '/games/week11-football/top-plays?n=3', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'file'); assert.deepEqual(r.body.plays, want); })
        .then(function () { return call('GET', '/games/week11-football/top-plays', undefined, undefined, empty.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file'); assert.equal(r.body.plays.length, 3); })
        .then(function () { return call('GET', '/games/week11-football/top-plays?n=1', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.body.plays.length, 1); assert.deepEqual(r.body.plays[0], want[0]); })
        .then(function () { return call('GET', '/games/week11-football/top-plays?n=0', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 400); })
        .then(function () { return call('GET', '/games/no-such-game/top-plays', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); })
        .then(function () { return call('GET', '/games/..%2f..%2fpackage/top-plays', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); withDb.close(); noDb.close(); empty.close(); });
    })
    // drives: the same list from the database rows and from the game file, and it must add up to the final score
    .then(function () {
      var dr = require('./drives.js'), rp = require('./replay.js');
      var file = require('path').join(__dirname, '..', 'data', 'games', 'week11-football.json');
      var game = rp.buildPlays(file), list = dr.drives(file);
      assert.ok(list.length >= 8);
      ['index', 'team', 'quarter', 'startYard', 'endYard', 'plays', 'yards', 'seconds', 'result'].forEach(function (k) { assert.ok(k in list[0], 'field ' + k); });
      var RESULTS = ['touchdown', 'field goal', 'missed field goal', 'punt', 'interception', 'fumble', 'downs', 'half', 'end'];
      list.forEach(function (d, i) {
        assert.equal(d.index, i + 1);
        assert.ok(RESULTS.indexOf(d.result) >= 0, 'result ' + d.result);
        assert.ok(d.startYard >= 0 && d.startYard <= 100 && d.endYard >= 0 && d.endYard <= 100, 'yards from the goal line stay 0 to 100');
        assert.equal(d.yards, d.endYard - d.startYard);
      });
      var teams = [game.home, game.away], points = {};
      teams.forEach(function (t) { points[t] = 0; });
      list.forEach(function (d) { if (d.result === 'touchdown') points[d.team] += 6; if (d.result === 'field goal') points[d.team] += 3; });
      game.plays.forEach(function (p) { if (p.kind === 'xp' && p.detail.event.good) points[p.detail.off] += 1; });
      assert.equal(points[game.home], game.final[0], 'touchdowns, field goals and extra points add up to the home score');
      assert.equal(points[game.away], game.final[1], 'and to the away score');
      var secs = list.reduce(function (a, d) { return a + d.seconds; }, 0);
      assert.ok(secs > 3400 && secs < 3800, 'drive seconds add up to about an hour: ' + secs);
      var rows = game.plays.map(function (p) { return { seq: p.seq, quarter: p.quarter, team: p.team, kind: p.kind, yards: p.yards, detail: p.detail, why: p.why }; });
      var old = rows.map(function (r) { return { seq: r.seq, quarter: r.quarter, team: r.team, kind: r.kind, yards: r.yards, detail: { event: r.detail.event }, why: r.why }; });
      var withDb = createServer({ query: function () { return Promise.resolve({ rows: rows }); } }).listen(0);
      var oldDb = createServer({ query: function () { return Promise.resolve({ rows: old }); } }).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      return call('GET', '/games/week11-football/drives', undefined, undefined, withDb.address().port)
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); assert.deepEqual(r.body.drives, list); })
        .then(function () { return call('GET', '/games/week11-football/drives', undefined, undefined, oldDb.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file', 'rows without drive details fall back to the file'); assert.deepEqual(r.body.drives, list); })
        .then(function () { return call('GET', '/games/week11-football/drives', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file'); assert.deepEqual(r.body.drives, list); })
        .then(function () { return call('GET', '/games/nope/drives', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); withDb.close(); oldDb.close(); noDb.close(); });
    })
    // momentum: totals at the last bucket equal the final score and the game's fantasy points
    .then(function () {
      var mo = require('./momentum.js'), rp = require('./replay.js');
      var file = require('path').join(__dirname, '..', 'data', 'games', 'week11-football.json');
      var game = rp.buildPlays(file), m = mo.momentum(file, 120), last = m.buckets[m.buckets.length - 1];
      assert.equal(m.bucketSeconds, 120);
      ['start', 'quarter', 'fp', 'score', 'fpTotal', 'scoreTotal'].forEach(function (k) { assert.ok(k in m.buckets[0], 'field ' + k); });
      assert.deepEqual(last.scoreTotal, game.final, 'last bucket score equals the final score');
      var fpAll = [0, 0];
      game.plays.forEach(function (p) { p.detail.fp.forEach(function (f) { fpAll[f.team === game.home ? 0 : 1] += f.pts; }); });
      assert.ok(Math.abs(last.fpTotal[0] - fpAll[0]) < 0.06 && Math.abs(last.fpTotal[1] - fpAll[1]) < 0.06, 'last bucket fantasy points equal the game total');
      m.buckets.forEach(function (b, i) { assert.equal(b.start, i * 120, 'no gaps in the buckets'); });
      assert.equal(mo.momentum(file, 900).buckets.length, 12);
      var rows = game.plays.map(function (p) { return { seq: p.seq, quarter: p.quarter, played_at: p.played_at, detail: p.detail }; });
      var db1 = { query: function (t) { return Promise.resolve({ rows: /FROM games/.test(t) ? [{ home: game.home, away: game.away }] : rows }); } };
      var withDb = createServer(db1).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      return call('GET', '/games/week11-football/momentum?bucket=120', undefined, undefined, withDb.address().port)
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); assert.deepEqual(r.body.buckets, m.buckets); })
        .then(function () { return call('GET', '/games/week11-football/momentum', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file'); assert.deepEqual(r.body.buckets, m.buckets); })
        .then(function () { return call('GET', '/games/week11-football/momentum?bucket=5', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 400); })
        .then(function () { return call('GET', '/games/nope/momentum', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); withDb.close(); noDb.close(); });
    })
    // story: the same numbers from the database and from the file, and the right turning points
    .then(function () {
      var st = require('./story.js'), rp = require('./replay.js');
      var file = require('path').join(__dirname, '..', 'data', 'games', 'week11-football.json');
      var game = rp.buildPlays(file), want = st.story(file);
      assert.deepEqual(want.final, game.final); assert.equal(want.winner, 'GOB');
      // every lead change is a play where the leader differs from the last leader, read straight from the scores
      var lead = -1, changes = [];
      game.plays.forEach(function (p) { var s = p.detail.score_after, l = s[0] > s[1] ? 0 : s[1] > s[0] ? 1 : -1; if (l !== -1 && l !== lead) { lead = l; changes.push(p.seq); } });
      assert.deepEqual(want.leadChanges.map(function (c) { return c.index; }), changes);
      // the deciding play: the winner leads at it and at every play after it, and did not lead just before it
      var d = want.decidingPlay.index;
      game.plays.forEach(function (p) { if (p.seq >= d) assert.ok(p.detail.score_after[0] > p.detail.score_after[1], 'GOB leads from the deciding play on'); });
      var before = game.plays[d - 2].detail.score_after; assert.ok(!(before[0] > before[1]), 'GOB did not lead just before');
      // the longest drive has the most snaps of all drives
      var ds = require('./drives.js').drives(file);
      assert.equal(want.longestDrive.plays, Math.max.apply(null, ds.map(function (x) { return x.plays; })));
      assert.ok(want.longestDrive.startIndex <= want.longestDrive.endIndex);
      // best players equal the top of the game's own fantasy points per team
      var pts = require(file).report.points;
      want.bestPlayers.forEach(function (b, i) {
        var top = Math.max.apply(null, Object.keys(pts[i]).map(function (k) { return pts[i][k]; }));
        assert.equal(b.points, top, b.team + ' best player points');
      });
      assert.ok(want.biggestSwing && want.biggestSwing.index >= 1 && want.biggestSwing.fpSwing > 0);
      // soccer: no drives, the rest works
      var sc = st.story(require('path').join(__dirname, '..', 'soccer', 'data', 'week11-soccer.json'));
      assert.equal(sc.longestDrive, null); assert.equal(sc.winner, 'IRN'); assert.deepEqual(sc.final, [2, 0]);
      var rows = game.plays.map(function (p) { return { seq: p.seq, quarter: p.quarter, played_at: p.played_at, team: p.team, kind: p.kind, yards: p.yards, detail: p.detail, why: p.why }; });
      var withDb = createServer({ query: function (t) { return Promise.resolve({ rows: /FROM games/.test(t) ? [{ home: 'GOB', away: 'PYT' }] : rows }); } }).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      function strip(b) { var x = Object.assign({}, b); delete x.source; delete x.game_id; return x; }
      return call('GET', '/games/week11-football/story', undefined, undefined, withDb.address().port)
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); assert.deepEqual(strip(r.body), JSON.parse(JSON.stringify(want))); })
        .then(function () { return call('GET', '/games/week11-football/story', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file'); assert.deepEqual(strip(r.body), JSON.parse(JSON.stringify(want))); })
        .then(function () { return call('GET', '/games/nope/story', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); withDb.close(); noDb.close(); });
    })
    // watch party relay: rooms, commands, long poll, host state, expiry, limits
    .then(function () {
      var t = 1000000, parties = require('./party.js').createParties({ now: function () { return t; }, maxRooms: 3 });
      var ps = createServer(fake, { parties: parties }).listen(0), pp = ps.address().port, ORIGIN = 'http://localhost:5173';
      function pc(method, p, body) { return call(method, p, body, { Origin: ORIGIN }, pp); }
      var room;
      return pc('POST', '/party').then(function (r) {
        assert.equal(r.status, 201); assert.ok(/^[A-Z]{4}$/.test(r.body.code)); assert.ok(/^[0-9a-f]{24}$/.test(r.body.host));
        assert.equal(r.headers['access-control-allow-origin'], ORIGIN); room = r.body;
        return pc('GET', '/party/' + room.code + '/state');
      }).then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.body.state, null);
        return pc('POST', '/party/' + room.code.toLowerCase() + '/command', { cmd: 'start' });
      }).then(function (r) {
        assert.equal(r.status, 201); assert.equal(r.body.command.n, 1); assert.equal(r.body.command.value, null);
        return pc('POST', '/party/' + room.code + '/command', { cmd: 'seek', value: 14 });
      }).then(function (r) {
        assert.equal(r.body.command.n, 2);
        return pc('GET', '/party/' + room.code + '/commands?after=1');
      }).then(function (r) {
        assert.equal(r.status, 200); assert.deepEqual(r.body.commands.map(function (c) { return [c.n, c.cmd, c.value]; }), [[2, 'seek', 14]]); assert.equal(r.body.last, 2);
        // long poll: waits, then answers as soon as a command comes in
        var t0 = Date.now(), waiting = pc('GET', '/party/' + room.code + '/commands?after=2&wait=5');
        setTimeout(function () { pc('POST', '/party/' + room.code + '/command', { cmd: 'speed', value: 2 }); }, 150);
        return waiting.then(function (w) {
          assert.equal(w.status, 200); assert.deepEqual(w.body.commands.map(function (c) { return c.cmd; }), ['speed']);
          assert.ok(Date.now() - t0 >= 100 && Date.now() - t0 < 2000, 'the long poll answered when the command came');
        });
      }).then(function () {
        return pc('POST', '/party/' + room.code + '/state', { host: room.host, index: 14, mode: 'play', speed: 2 });
      }).then(function (r) {
        assert.equal(r.status, 200);
        return pc('GET', '/party/' + room.code + '/state');
      }).then(function (r) {
        assert.deepEqual(r.body.state, { index: 14, mode: 'play', speed: 2 });
        return Promise.all([
          pc('POST', '/party/' + room.code + '/state', { host: 'wrong', index: 1, mode: 'play', speed: 1 }),
          pc('POST', '/party/' + room.code + '/state', { host: room.host, index: -1, mode: 'play', speed: 1 }),
          pc('POST', '/party/' + room.code + '/state', { host: room.host, index: 1, mode: 'DROP TABLE', speed: 1 }),
          pc('POST', '/party/' + room.code + '/command', { cmd: 'explode' }),
          pc('POST', '/party/' + room.code + '/command', { cmd: 'seek', value: 0 }),
          pc('POST', '/party/' + room.code + '/command', { cmd: 'speed', value: 100 }),
          pc('POST', '/party/' + room.code + '/command', { cmd: 'hold', value: 'x' }),
          pc('POST', '/party/' + room.code + '/command', { cmd: 'start', pad: new Array(3000).join('x') }),
          pc('GET', '/party/' + room.code + '/commands?after=-1'),
          pc('GET', '/party/' + room.code + '/commands?wait=99'),
          pc('GET', '/party/AB1/state'),
          pc('GET', '/party/ZZZZ/state'),
          pc('DELETE', '/party/' + room.code + '/state'),
          pc('GET', '/party')
        ]);
      }).then(function (rs) {
        assert.deepEqual(rs.map(function (r) { return r.status; }), [403, 400, 400, 400, 400, 400, 400, 413, 400, 400, 400, 404, 405, 405]);
        rs.forEach(function (r) { assert.equal(r.headers['access-control-allow-origin'], ORIGIN, 'CORS on every party answer'); });
        // room limit (3 here), then expiry after two hours frees them
        return pc('POST', '/party').then(function () { return pc('POST', '/party'); }).then(function () { return pc('POST', '/party'); });
      }).then(function (r) {
        assert.equal(r.status, 429);
        t += 2 * 60 * 60 * 1000;
        return pc('GET', '/party/' + room.code + '/state');
      }).then(function (r) {
        assert.equal(r.status, 404); assert.equal(parties.count(), 0);
        return pc('POST', '/party');
      }).then(function (r) { assert.equal(r.status, 201); ps.close(); });
    })
    // league: standings from finished weeks, never the current week's points, opt-ins from the database or the file
    .then(function () {
      var LG = require('./league.js'), doc = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'data', 'league.json'), 'utf8'));
      var L = LG.fromLeague(doc, { finals: { 'week09-gob-tur': [47.8, 43.1] }, optins: { 'week09-gob-tur': ['GOB', 'ricky', 'TUR'] } });
      doc.standings.forEach(function (s) {
        var x = L.standings.filter(function (y) { return y.id === s.id; })[0];
        ['wins', 'losses', 'pointsFor', 'pointsAgainst'].forEach(function (k) { assert.equal(x[k], s[k], s.id + ' ' + k); });
      });
      var w9 = L.weeks.filter(function (w) { return w.week === 9; })[0];
      assert.ok(w9.matchups.every(function (m) { return m.final === null; }), 'the current week never has points, even when a final is known');
      var ours = L.current.matchups[0];
      assert.deepEqual(ours.optedIn, ['GOB', 'TUR'], 'only the matchup\'s own team ids count'); assert.equal(ours.optinsFrom, 'database');
      assert.deepEqual(L.current.matchups[1].optedIn, ['PYT', 'OWL']); assert.equal(L.current.matchups[1].optinsFrom, 'file');
      // a finished week with a known final in the database replaces the file's numbers, and a tie counts as a tie
      var d2 = JSON.parse(JSON.stringify(doc));
      d2.weeks[0].matchups[0].gameFile = 'w7.json';
      var L2 = LG.fromLeague(d2, { finals: { w7: [90, 90] } });
      var gob = L2.standings.filter(function (x) { return x.id === 'GOB'; })[0];
      assert.equal(gob.ties, 1); assert.equal(gob.wins, 1); assert.equal(L2.weeks[0].matchups[0].finalFrom, 'database');
      var withDb = createServer({ query: function (t, p) {
        if (/FROM optins/.test(t)) return Promise.resolve({ rows: p[0] === 'week09-gob-tur' ? [{ manager: 'TUR' }, { manager: 'x' }] : [] });
        return Promise.resolve({ rows: [] });
      } }).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      return call('GET', '/league', undefined, undefined, withDb.address().port).then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.body.source.optins, 'database');
        assert.deepEqual(r.body.current.matchups[0].optedIn, ['TUR']);
        assert.ok(r.body.weeks.every(function (w) { return w.finished || w.matchups.every(function (m) { return m.final === null; }); }));
        assert.equal(r.body.standings[0].id, doc.standings[0].id, 'the leader is the file\'s leader');
        return call('GET', '/league', undefined, undefined, noDb.address().port);
      }).then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.body.source.optins, 'file'); assert.deepEqual(r.body.current.matchups[0].optedIn, ['GOB', 'TUR']);
        return call('POST', '/league', {}, undefined, noDb.address().port);
      }).then(function (r) { assert.equal(r.status, 405); withDb.close(); noDb.close(); });
    })
    // commissioner: opt-ins per week, release by hand, watched counts; with a database and in memory without one
    .then(function () {
      var rel = {}, wat = {};
      var dbc = { query: function (t, p) {
        if (/^INSERT INTO releases/.test(t)) { rel[p[0]] = { released: p[1], changed_at: new Date('2026-11-17T09:00:00Z') }; return Promise.resolve({ rows: [{ changed_at: rel[p[0]].changed_at }] }); }
        if (/FROM releases/.test(t)) return Promise.resolve({ rows: rel[p[0]] ? [rel[p[0]]] : [] });
        if (/^INSERT INTO watched/.test(t)) { if (p[0] === 'nogame') { var e = new Error('fk'); e.code = '23503'; return Promise.reject(e); } (wat[p[0]] = wat[p[0]] || {})[p[1]] = 1; return Promise.resolve({ rows: [] }); }
        if (/FROM watched/.test(t)) return Promise.resolve({ rows: [{ n: String(Object.keys(wat[p[0]] || {}).length) }] });
        if (/FROM optins/.test(t)) return Promise.resolve({ rows: p[0] === 'week09-gob-tur' ? [{ manager: 'TUR' }, { manager: 'stranger' }] : [] });
        return Promise.resolve({ rows: [] });
      } };
      var down = { query: function () { return Promise.reject(new Error('down')); } };
      var a = createServer(dbc).listen(0), b = createServer(down).listen(0), O = { Origin: 'http://localhost:5173' };
      function ca(m, p, body) { return call(m, p, body, O, a.address().port); }
      function cb(m, p, body) { return call(m, p, body, O, b.address().port); }
      return ca('GET', '/league/week/9/optins').then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.headers['access-control-allow-origin'], O.Origin);
        assert.deepEqual(r.body.matchups[0].optedIn, ['TUR']); assert.equal(r.body.matchups[0].from, 'database');
        assert.deepEqual(r.body.matchups[1].optedIn, []); assert.equal(r.body.matchups[1].from, 'database');
        assert.ok(JSON.stringify(r.body).indexOf('final') < 0 && JSON.stringify(r.body).indexOf('points') < 0, 'no points in the opt-in view');
        return ca('GET', '/league/week/9/release');
      }).then(function (r) {
        assert.deepEqual([r.body.released, r.body.changed_at, r.body.source], [false, null, 'database']);
        return ca('POST', '/league/week/9/release', { released: true });
      }).then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.body.released, true); assert.equal(r.body.source, 'database');
        return ca('GET', '/league/week/9/release');
      }).then(function (r) {
        assert.equal(r.body.released, true); assert.equal(r.body.changed_at, '2026-11-17T09:00:00.000Z');
        return ca('POST', '/games/week09-gob-tur/watched', { manager: 'GOB' });
      }).then(function (r) {
        assert.equal(r.status, 201); assert.equal(r.body.watched, 1);
        return ca('POST', '/games/week09-gob-tur/watched', { manager: ' GOB ' });
      }).then(function (r) {
        assert.equal(r.body.watched, 1, 'the same manager counts once');
        return ca('GET', '/league/week/9/optins');
      }).then(function (r) {
        assert.equal(r.body.matchups[0].watched, 1);
        return Promise.all([
          ca('POST', '/games/nogame/watched', { manager: 'GOB' }),
          ca('POST', '/league/week/9/release', { released: 'yes' }),
          ca('POST', '/league/week/9/release', [true]),
          ca('POST', '/league/week/20/release', { released: true }),
          ca('GET', '/league/week/0/release'),
          ca('GET', '/league/week/eleven/optins'),
          ca('GET', '/league/week/5/optins'),
          ca('DELETE', '/league/week/9/release'),
          ca('POST', '/games/week09-gob-tur/watched', { manager: '' }),
          ca('POST', '/games/week09-gob-tur/watched', { manager: new Array(200).join('m') }),
          ca('GET', '/games/week09-gob-tur/watched')
        ]);
      }).then(function (rs) {
        assert.deepEqual(rs.map(function (r) { return r.status; }), [404, 400, 400, 404, 400, 400, 404, 405, 400, 400, 405]);
        rs.forEach(function (r) { assert.equal(r.headers['access-control-allow-origin'], O.Origin); });
        // without a database: the same routes, kept in memory
        return cb('POST', '/league/week/9/release', { released: true });
      }).then(function (r) {
        assert.equal(r.body.source, 'memory'); assert.equal(r.body.released, true);
        return cb('GET', '/league/week/9/release');
      }).then(function (r) {
        assert.equal(r.body.released, true); assert.equal(r.body.source, 'memory');
        return cb('POST', '/games/week09-gob-tur/watched', { manager: 'TUR' });
      }).then(function (r) {
        assert.equal(r.body.source, 'memory'); assert.equal(r.body.watched, 1);
        return cb('GET', '/league/week/9/optins');
      }).then(function (r) {
        assert.deepEqual(r.body.matchups[0].optedIn, ['GOB', 'TUR']); assert.equal(r.body.matchups[0].from, 'file'); assert.equal(r.body.matchups[0].watched, 1);
        return cb('GET', '/league/week/8/optins');
      }).then(function (r) {
        assert.equal(r.body.finished, true); assert.deepEqual(r.body.matchups[0].optedIn, []); assert.equal(r.body.matchups[0].from, 'none');
        a.close(); b.close();
      });
    })
    // trend and the time_bucket momentum: from the game files without a database, from aggregate rows with one
    .then(function () {
      var trend = require('./trend.js'), mom = require('./momentum.js');
      var file = require('path').join(__dirname, '..', 'data', 'games', 'week11-football.json');
      var want = trend.fromFiles('Josh Allen');
      assert.deepEqual(want.weeks.map(function (w) { return w.week; }), [7, 8, 9, 11]);
      assert.equal(trend.fromFiles('josh allen').weeks[0].points, want.weeks[0].points, 'name in any case');
      assert.equal(trend.fromFiles('GOB.QB').player, 'Josh Allen', 'TEAM.SLOT finds the same player');
      assert.equal(trend.fromFiles('Nobody Atall'), null);
      // the summary rules, on numbers worked out by hand
      var s = trend.summarize([{ week: 9, points: 10 }, { week: 10, points: 4 }, { week: 11, points: 14 }]);
      assert.equal(s.average, 9.3); assert.equal(s.change, 10); assert.equal(s.direction, 'up'); assert.equal(s.bestWeek, 11); assert.equal(s.hotStreak, 1);
      assert.equal(trend.summarize([{ week: 9, points: 5 }]).direction, 'none');
      assert.equal(trend.summarize([{ week: 9, points: 5 }, { week: 10, points: 5.2 }]).direction, 'flat');
      assert.equal(trend.summarize([{ week: 9, points: 5 }, { week: 10, points: 9 }, { week: 11, points: 8 }]).hotStreak, 2);
      assert.equal(trend.weekOf('2026-11-09T00:00:00.000Z'), 11); assert.equal(trend.weekOf('2026-10-26T00:00:00.000Z'), 9);
      var aggRows = [{ bucket: new Date('2026-10-26T00:00:00Z'), points: '25.5', awards: '43', player: 'Josh Allen', team: 'GOB', slot: 'QB' },
                     { bucket: new Date('2026-11-09T00:00:00Z'), points: '7.4', awards: '11', player: 'Josh Allen', team: 'GOB', slot: 'QB' }];
      var seen = [];
      var withDb = createServer({ query: function (t, p) {
        seen.push(t);
        if (/to_regclass\('fp_awards'\)/.test(t)) return Promise.resolve({ rows: [{ ok: true }] });
        if (/FROM player_points_per_week/.test(t)) return Promise.resolve({ rows: p[0] === 'Nobody Atall' ? [] : aggRows });
        return Promise.reject(new Error('unexpected query'));
      } }).listen(0);
      var noDb = createServer({ query: function () { return Promise.reject(new Error('down')); } }).listen(0);
      var noMig = createServer({ query: function (t) { return Promise.resolve({ rows: /to_regclass/.test(t) ? [{ ok: false }] : [] }); } }).listen(0);
      return call('GET', '/players/Josh%20Allen/trend', undefined, undefined, withDb.address().port)
        .then(function (r) {
          assert.equal(r.status, 200); assert.equal(r.body.source, 'database');
          assert.deepEqual(r.body.weeks, [{ week: 9, points: 25.5, awards: 43 }, { week: 11, points: 7.4, awards: 11 }]);
          assert.equal(r.body.summary.direction, 'down'); assert.equal(r.body.summary.change, -18.1);
          assert.ok(seen.some(function (t) { return /player_key = lower\(\$1\)/.test(t); }), 'name query');
          return call('GET', '/players/GOB.QB/trend', undefined, undefined, withDb.address().port);
        })
        .then(function (r) { assert.equal(r.body.source, 'database'); assert.ok(seen.some(function (t) { return /upper\(team\) = upper\(\$1\)/.test(t); }), 'TEAM.SLOT query'); })
        .then(function () { return call('GET', '/players/Nobody%20Atall/trend', undefined, undefined, withDb.address().port); })
        .then(function (r) { assert.equal(r.status, 404); })
        .then(function () { return call('GET', '/players/Josh%20Allen/trend', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'file'); assert.deepEqual(r.body.weeks, want.weeks); assert.deepEqual(r.body.summary, want.summary); })
        .then(function () { return call('GET', '/players/Josh%20Allen/trend', undefined, undefined, noMig.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file', 'migration 004 not applied: files'); })
        .then(function () { return call('POST', '/players/Josh%20Allen/trend', {}, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 405); })
        .then(function () { return call('GET', '/players/%20/trend', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.status, 400); })
        // momentum: the time_bucket query is asked for first; its answer is returned with engine = the function used
        .then(function () {
          var sqlSeen = [];
          var tb = createServer({ query: function (t, p) {
            if (/FROM games/.test(t)) return Promise.resolve({ rows: [{ home: 'GOB', away: 'PYT' }] });
            if (/to_regclass/.test(t)) return Promise.resolve({ rows: [{ ok: true }] });
            if (/to_regproc|proname = 'time_bucket'/.test(t)) return Promise.resolve({ rows: [{ tb: true }] });
            sqlSeen.push([t, p]);
            return Promise.resolve({ rows: [{ b: 0, team: 'GOB', pts: 5.5, quarter: null, sh: null, sa: null }, { b: 0, team: null, pts: null, quarter: 1, sh: 7, sa: 0 }, { b: 2, team: 'PYT', pts: 2, quarter: null, sh: null, sa: null }, { b: 2, team: null, pts: null, quarter: 2, sh: 7, sa: 3 }] });
          } }).listen(0);
          return call('GET', '/games/week11-football/momentum?bucket=300', undefined, undefined, tb.address().port).then(function (r) {
            assert.equal(r.body.source, 'database'); assert.equal(r.body.engine, 'time_bucket');
            assert.ok(/time_bucket\(make_interval/.test(sqlSeen[0][0]), 'uses time_bucket'); assert.deepEqual(sqlSeen[0][1], ['week11-football', 300]);
            assert.deepEqual(r.body.buckets.map(function (b) { return b.start; }), [0, 300, 600], 'empty buckets are listed');
            assert.deepEqual(r.body.buckets[0].score, [7, 0]); assert.deepEqual(r.body.buckets[2].score, [0, 3]);
            assert.deepEqual(r.body.buckets[2].fpTotal, [5.5, 2]); assert.equal(r.body.buckets[1].quarter, 1);
            tb.close();
          });
        })
        .then(function () { return call('GET', '/games/week11-football/momentum?bucket=300', undefined, undefined, noDb.address().port); })
        .then(function (r) { assert.equal(r.body.source, 'file'); assert.equal(r.body.engine, 'javascript'); assert.deepEqual(r.body.buckets, mom.momentum(file, 300).buckets); withDb.close(); noDb.close(); noMig.close(); });
    })
    // Scout through the service: stored reports without a key, a refresh only with one (a stand-in runs in place of the model)
    .then(function () {
      var fs = require('fs'), os = require('os'), pth = require('path');
      var root = fs.mkdtempSync(pth.join(os.tmpdir(), 'scout-svc-'));
      fs.mkdirSync(pth.join(root, 'data', 'profiles', 'notes'), { recursive: true });
      fs.mkdirSync(pth.join(root, 'agents', 'scout', 'runs'), { recursive: true });
      var reportFile = pth.join(root, 'data', 'profiles', 'notes', 'ZZZ-WR1-report.md');
      function report(text, by) {
        return '# Scouting report: Test Receiver\n\nZZZ, WR1. Made by ' + by + ' on 2026-11-14, from the real play-by-play.\n\n1. ' + text + ' [1, 2]\n2. Second claim. [2]\n\n## Evidence\n\n' +
          '1. Week 3, Q2 9:15: Q.Back pass short right to T.Receiver for 8 yards. ([game](https://example.test/game/1))\n' +
          '2. Week 4, Q4 0:45: Q.Back pass deep left to T.Receiver for 31 yards, TOUCHDOWN. ([game](https://example.test/game/2))\n';
      }
      fs.writeFileSync(reportFile, report('Receiver had 2 catches on third down.', 'rules, no model (agents/scout/research.py)'));
      fs.writeFileSync(pth.join(root, 'data', 'profiles', 'notes', 'ZZZ-WR1.md'), '# Notes: Test Receiver\n');
      fs.writeFileSync(pth.join(root, 'data', 'profiles', 'notes', 'ZZZ-QB-report.md'), report('Back threw.', 'rules, no model'));
      fs.writeFileSync(pth.join(root, 'agents', 'scout', 'runs', '20261114-100000-research.txt'), '10:00:00 | write_report(ZZZ.WR1) -> 2 claims, 3 plays cited\n');
      fs.writeFileSync(pth.join(root, 'agents', 'scout', 'runs', '20261114-120000-scout.txt'), '12:00:00 | split(ZZZ.WR1, down)\n12:00:05 | write_report(ZZZ.WR1) -> 2 claims, 3 plays cited\n');
      var asked = [], mode = 'ok', release = null;
      var runner = function (key) {
        asked.push(key);
        if (mode === 'hang') return new Promise(function (ok) { release = ok; });
        if (mode === 'fail') return Promise.resolve({ code: 2, output: 'NOT READY: cannot reach api.sleeper.app (URLError)' });
        fs.writeFileSync(reportFile, report('Receiver had 5 catches on third down.', 'model test-model'));
        return Promise.resolve({ code: 0, output: '' });
      };
      var KEY = 'sk-test-not-a-real-key-123';
      var noKey = createServer({ query: function () { return Promise.reject(new Error('down')); } }, { scout: require('./scout.js').createScout({ root: root, env: {}, runner: runner }) }).listen(0);
      var withKey = createServer({ query: function () { return Promise.reject(new Error('down')); } }, { scout: require('./scout.js').createScout({ root: root, env: { ANTHROPIC_API_KEY: KEY }, runner: runner }) }).listen(0);
      var pn = noKey.address().port, pk = withKey.address().port;
      return call('GET', '/scout', undefined, undefined, pn).then(function (r) {
        assert.equal(r.status, 200); assert.deepEqual(r.body.players.map(function (p) { return p.player; }), ['ZZZ.QB', 'ZZZ.WR1']); assert.equal(r.body.canRefresh, false);
        return call('GET', '/scout/zzz.wr1', undefined, undefined, pn);
      }).then(function (r) {
        assert.equal(r.status, 200); assert.equal(r.body.player, 'ZZZ.WR1'); assert.equal(r.body.refreshed, false);
        assert.equal(r.body.report.made_by, 'rules, no model (agents/scout/research.py)'); assert.equal(r.body.report.modelMade, false);
        assert.equal(r.body.report.claims.length, 2); assert.equal(r.body.report.claims[0].evidence.length, 2);
        assert.deepEqual(r.body.report.claims[0].evidence[1], { n: 2, week: 4, quarter: '4', clock: '0:45', text: 'Q.Back pass deep left to T.Receiver for 31 yards, TOUCHDOWN.', game: 'https://example.test/game/2' });
        r.body.report.claims.forEach(function (c) { assert.ok(c.evidence.length > 0 && c.evidence.every(function (e) { return /^https:/.test(e.game); }), 'every claim cites plays with a source'); });
        assert.equal(r.body.run.log, 'agents/scout/runs/20261114-120000-scout.txt', 'the newest run that wrote it');
        assert.ok(/Notes: Test Receiver/.test(r.body.notes.markdown));
        return call('GET', '/scout/ZZZ.K', undefined, undefined, pn);
      }).then(function (r) { assert.equal(r.status, 404); return call('GET', '/scout/..%2f..%2fpackage', undefined, undefined, pn); })
        .then(function (r) { assert.equal(r.status, 400); return call('POST', '/scout/ZZZ.WR1/refresh', {}, undefined, pn); })
        .then(function (r) {
          assert.equal(r.status, 200); assert.equal(r.body.refreshed, false); assert.ok(/no model key/.test(r.body.reason)); assert.equal(asked.length, 0, 'no key: the model is never started');
          assert.equal(r.body.report.claims[0].text, 'Receiver had 2 catches on third down.');
          return call('POST', '/scout/ZZZ.WR1', {}, undefined, pn);
        }).then(function (r) { assert.equal(r.status, 405); return call('POST', '/scout/ZZZ.WR1/refresh', {}, undefined, pk); })
        .then(function (r) {
          assert.equal(r.status, 200); assert.equal(r.body.refreshed, true); assert.deepEqual(asked, ['ZZZ.WR1']);
          assert.equal(r.body.report.claims[0].text, 'Receiver had 5 catches on third down.'); assert.equal(r.body.report.modelMade, true);
          assert.ok(JSON.stringify(r.body).indexOf(KEY) < 0, 'the key is never in an answer');
          mode = 'fail'; return call('POST', '/scout/ZZZ.WR1/refresh', {}, undefined, pk);
        }).then(function (r) {
          assert.equal(r.status, 502); assert.equal(r.body.refreshed, false); assert.ok(/NOT READY: cannot reach api.sleeper.app/.test(r.body.reason));
          assert.equal(r.body.report.claims[0].text, 'Receiver had 5 catches on third down.', 'a failed run still answers the stored report');
          mode = 'hang';
          var first = call('POST', '/scout/ZZZ.WR1/refresh', {}, undefined, pk);
          return new Promise(function (ok) { setTimeout(ok, 50); }).then(function () { return call('POST', '/scout/ZZZ.WR1/refresh', {}, undefined, pk); }).then(function (r2) {
            assert.equal(r2.status, 409); release({ code: 0, output: '' }); return first;
          });
        }).then(function (r) { assert.equal(r.status, 200); noKey.close(); withKey.close(); fs.rmSync(root, { recursive: true, force: true }); });
    })
    .then(function () { console.log('OK'); srv.close(); })
    .catch(function (e) { console.error('FAIL', e.message); process.exit(1); });
});
