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
    .then(function () { console.log('OK'); srv.close(); })
    .catch(function (e) { console.error('FAIL', e.message); process.exit(1); });
});
