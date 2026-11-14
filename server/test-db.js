'use strict';
// Runs the service against a REAL database: the SQL, the schema and the routes together.
//   DATABASE_URL=<connection string> node server/test-db.js
// Without DATABASE_URL it prints SKIPPED and exits 0. The database must already be set up (sh db/migrate.sh).
// It only creates rows whose game id starts with "dbtest-" and deletes them at the end; the commissioner's
// release of league week 11 is put back as it was. Do not point it at a database in the middle of a game night.
var http = require('http');
var assert = require('assert');
var path = require('path');
var createServer = require('./index.js').createServer;
var loadEnv = require('./index.js').loadEnv;
var poolConfig = require('./index.js').poolConfig;
var pushGame = require('./push-game.js').pushGame;

loadEnv(path.join(__dirname, '..', '.env'));
if (!process.env.DATABASE_URL) { console.log('SKIPPED: DATABASE_URL is not set, so the real database was not tested.'); process.exit(0); }

var Pool = require('pg').Pool;
var pool = new Pool(poolConfig(process.env.DATABASE_URL, process.env.DATABASE_CA_FILE));
var ID = 'dbtest-' + Date.now().toString(36), SOC = ID + '-soc';
var srv = createServer(pool);
var steps = 0;

function call(port, method, p, body) {
  return new Promise(function (ok, bad) {
    var r = http.request({ port: port, method: method, path: p, headers: { 'Content-Type': 'application/json' } }, function (res) {
      var s = ''; res.on('data', function (c) { s += c; });
      res.on('end', function () { ok({ status: res.statusCode, body: s ? JSON.parse(s) : null }); });
    });
    r.on('error', bad);
    if (body !== undefined) r.write(JSON.stringify(body));
    r.end();
  });
}
function ok(label) { steps++; console.log('  ok ' + label); }

function cleanup() {
  var like = 'dbtest-%';
  return pool.query('DELETE FROM watched WHERE game_id LIKE $1', [like]).catch(function () {})
    .then(function () { return pool.query('DELETE FROM optins WHERE game_id LIKE $1', [like]); })
    .then(function () { return pool.query('DELETE FROM plays WHERE game_id LIKE $1', [like]); })
    .then(function () { return pool.query('DELETE FROM games WHERE id LIKE $1', [like]); });
}

var port, priorRelease, hadRelease = false;
pool.query("SELECT to_regclass('plays') AS p, to_regclass('optins') AS o, to_regclass('watched') AS w, to_regclass('releases') AS r")
  .then(function (r) {
    var m = r.rows[0];
    if (!m.p || !m.o || !m.w || !m.r) throw new Error('the tables are missing (plays, optins, watched, releases). Run: sh db/migrate.sh');
    return pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='plays' AND column_name='minute'");
  })
  .then(function (r) { if (!r.rows.length) throw new Error('plays has no minute column. Run: sh db/migrate.sh'); })
  .then(function () { return new Promise(function (res) { srv.listen(0, function () { port = srv.address().port; res(); }); }); })
  .then(function () { return call(port, 'GET', '/health'); })
  .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.database, true); ok('health answers from the database'); })
  // push a football game and a soccer match, twice (a repeat must not duplicate)
  .then(function () { return pushGame(path.join(__dirname, '..', 'data', 'games', 'week11-football.json'), 'http://127.0.0.1:' + port, ID); })
  .then(function (p) { assert.ok(p.plays > 50); return pushGame(path.join(__dirname, '..', 'data', 'games', 'week11-football.json'), 'http://127.0.0.1:' + port, ID).then(function () { return p; }); })
  .then(function (p) { return call(port, 'GET', '/games/' + ID + '/plays').then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.plays.length, p.plays, 'a repeat push added rows'); ok('push a game (' + p.plays + ' plays), repeat push adds nothing'); }); })
  .then(function () { return pushGame(path.join(__dirname, '..', 'soccer', 'data', 'week11-soccer.json'), 'http://127.0.0.1:' + port, SOC); })
  .then(function () { return call(port, 'GET', '/games/' + SOC + '/plays'); })
  .then(function (r) { assert.ok(r.body.plays.some(function (p) { return p.minute != null; }), 'no minute on soccer rows'); assert.ok(r.body.plays.some(function (p) { return p.kind === 'full_time'; })); ok('soccer rows keep their minute and the full_time row'); })
  .then(function () { return call(port, 'GET', '/games/' + ID + '/plays'); })
  .then(function (r) { var q = r.body.plays.map(function (p) { return p.seq; }); assert.deepEqual(q, q.slice().sort(function (a, b) { return a - b; })); ok('plays come back in seq order'); })
  .then(function () { return call(port, 'GET', '/games/' + ID + '/top-plays?n=3'); })
  .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); assert.equal(r.body.plays ? r.body.plays.length : r.body.top.length, 3); ok('top plays from the database'); })
  .then(function () { return call(port, 'GET', '/games/' + ID + '/story'); })
  .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); ok('story from the database'); })
  .then(function () { return call(port, 'GET', '/games/' + ID + '/momentum?bucket=300'); })
  .then(function (r) { assert.equal(r.status, 200); assert.equal(r.body.source, 'database'); ok('momentum from the database'); })
  // summary reads the continuous aggregates, which are filled by a refresh in Tiger Data; either answer is the right shape
  .then(function () { return call(port, 'GET', '/games/' + ID + '/summary'); })
  .then(function (r) { assert.equal(r.status, 200); assert.ok(Array.isArray(r.body.players) && Array.isArray(r.body.quarters)); ok('summary answers (' + r.body.players.length + ' player rows)'); })
  // opt-ins
  .then(function () { return call(port, 'POST', '/games/nope-' + ID + '/optin', { manager: 'GOB' }); })
  .then(function (r) { assert.equal(r.status, 404); ok('opt-in to a game that does not exist is 404'); })
  .then(function () { return call(port, 'POST', '/games/' + ID + '/optin', { manager: 'GOB' }); })
  .then(function (r) { assert.equal(r.status, 201); return call(port, 'POST', '/games/' + ID + '/optin', { manager: 'GOB' }); })
  .then(function () { return call(port, 'POST', '/games/' + ID + '/optin', { manager: 'PYT' }); })
  .then(function () { return call(port, 'GET', '/games/' + ID + '/optins'); })
  .then(function (r) { assert.deepEqual(r.body.optins.map(function (o) { return o.manager; }), ['GOB', 'PYT']); ok('opt-ins saved once each, oldest first'); })
  // league
  .then(function () { return call(port, 'GET', '/league'); })
  .then(function (r) { assert.equal(r.status, 200); assert.ok(r.body.standings.length > 1 && r.body.current.matchups.length); ok('league answers with standings and this week'); })
  // commissioner
  .then(function () { return call(port, 'GET', '/league/week/11/release'); })
  .then(function (r) { priorRelease = r.body.released; return pool.query('SELECT 1 FROM releases WHERE week=11'); })
  .then(function (r) { hadRelease = r.rows.length > 0; return call(port, 'POST', '/league/week/11/release', { released: !priorRelease }); })
  .then(function (r) { assert.ok(r.status === 200 || r.status === 201); assert.equal(r.body.source, 'database'); return call(port, 'GET', '/league/week/11/release'); })
  .then(function (r) { assert.equal(r.body.released, !priorRelease); ok('release saved in the releases table'); })
  .then(function () { return call(port, 'POST', '/games/' + ID + '/watched', { manager: 'GOB' }); })
  .then(function (r) { assert.equal(r.status, 201); assert.equal(r.body.source, 'database'); return call(port, 'POST', '/games/' + ID + '/watched', { manager: 'GOB' }); })
  .then(function () { return pool.query('SELECT count(*)::int AS n FROM watched WHERE game_id=$1', [ID]); })
  .then(function (r) { assert.equal(r.rows[0].n, 1); ok('watched counts a manager once'); })
  .then(function () { return call(port, 'GET', '/league/week/11/optins'); })
  .then(function (r) { assert.equal(r.status, 200); assert.ok(r.body.matchups.length); ok('commissioner opt-in list answers'); })
  // watch party relay (memory)
  .then(function () { return call(port, 'POST', '/party'); })
  .then(function (r) {
    assert.equal(r.status, 201); var code = r.body.code, host = r.body.host;
    return call(port, 'POST', '/party/' + code + '/command', { cmd: 'seek', value: 5 })
      .then(function (c) { assert.equal(c.status, 201); return call(port, 'GET', '/party/' + code + '/commands?after=0'); })
      .then(function (c) { assert.equal(c.body.commands[0].cmd, 'seek'); return call(port, 'POST', '/party/' + code + '/state', { host: host, index: 5, mode: 'play', speed: 1 }); })
      .then(function () { return call(port, 'GET', '/party/' + code + '/state'); })
      .then(function (s) { assert.equal(s.body.state.index, 5); ok('watch party: command, host poll and state'); });
  })
  .then(function () { return cleanup(); })
  .then(function () { return hadRelease ? call(port, 'POST', '/league/week/11/release', { released: priorRelease }) : pool.query('DELETE FROM releases WHERE week=11'); })
  .then(function () { console.log('OK: ' + steps + ' checks against the real database'); }, function (e) {
    console.error('FAILED: ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
    return cleanup().catch(function () {});
  })
  .then(function () { srv.close(); return pool.end(); });
