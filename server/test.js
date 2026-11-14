'use strict';
// Runs the service against a fake database. It proves the routes and checks, not the SQL.
var http = require('http');
var assert = require('assert');
var createServer = require('./index.js').createServer;

var log = [];
var fake = {
  query: function (t, p) { log.push([t, p]); return Promise.resolve({ rows: [{ x: 1 }] }); },
  connect: function () { return Promise.resolve({ query: function (t, p) { log.push([t, p]); return Promise.resolve({ rows: [] }); }, release: function () { log.push(['release']); } }); }
};
var srv = createServer(fake).listen(0, function () {
  var port = srv.address().port;
  function call(method, p, body) {
    return new Promise(function (ok) {
      var r = http.request({ port: port, method: method, path: p, headers: { 'Content-Type': 'application/json' } }, function (res) {
        var s = ''; res.on('data', function (c) { s += c; }); res.on('end', function () { ok({ status: res.statusCode, body: s ? JSON.parse(s) : null }); });
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
    .then(function () { console.log('OK'); srv.close(); })
    .catch(function (e) { console.error('FAIL', e.message); process.exit(1); });
});
