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
    .then(function () { console.log('OK'); srv.close(); })
    .catch(function (e) { console.error('FAIL', e.message); process.exit(1); });
});
