'use strict';
// Small service, no framework. Saves plays to PostgreSQL (Tiger Data) and reads them back.
//   POST /games/:id/plays    body: { game?: {sport, home, away}, plays: [ ... ] }
//   GET  /games/:id/plays    plays in order
//   GET  /games/:id/summary  { players: [...], quarters: [...] } from the two aggregates
// The connection string comes from DATABASE_URL in .env. It is never written anywhere else.

var http = require('http');
var fs = require('fs');
var path = require('path');

function loadEnv(file) {
  var text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { return; }
  text.split('\n').forEach(function (line) {
    var m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || line.trim().charAt(0) === '#') return;
    var v = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  });
}

var MAX_BODY = 1024 * 1024;
var INSERT_PLAY =
  'INSERT INTO plays (game_id, seq, played_at, quarter, team, slot, player, kind, yards, fantasy_points, detail, why) ' +
  'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT DO NOTHING';

function send(res, status, body) {
  var text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(text);
}

function readJson(req, cb) {
  var size = 0, chunks = [], done = false;
  function fail(code, msg) { if (!done) { done = true; cb({ status: code, message: msg }); } }
  req.on('data', function (c) {
    size += c.length;
    if (size > MAX_BODY) { fail(413, 'body too large'); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', function () {
    if (done) return;
    try { done = true; cb(null, JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
    catch (e) { done = false; fail(400, 'body is not valid JSON'); }
  });
  req.on('error', function () { fail(400, 'could not read body'); });
}

function checkPlay(p, i) {
  if (!p || typeof p !== 'object') return 'plays[' + i + '] is not an object';
  if (!Number.isInteger(p.seq)) return 'plays[' + i + '].seq must be an integer';
  if (typeof p.played_at !== 'string' || isNaN(Date.parse(p.played_at))) return 'plays[' + i + '].played_at must be a date string';
  if (!Number.isInteger(p.quarter)) return 'plays[' + i + '].quarter must be an integer';
  if (typeof p.team !== 'string' || !p.team) return 'plays[' + i + '].team is required';
  if (typeof p.kind !== 'string' || !p.kind) return 'plays[' + i + '].kind is required';
  return null;
}

// db needs query(text, params) -> Promise<{rows}> and, for POST, connect() -> client with query and release.
function createServer(db) {
  return http.createServer(function (req, res) {
    var url = new URL(req.url, 'http://localhost');
    var m = url.pathname.match(/^\/games\/([^\/]+)\/(plays|summary)$/);
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (!m) return send(res, 404, { error: 'not found' });
    var gameId = decodeURIComponent(m[1]);
    var what = m[2];

    function onErr(e) { console.error('database error:', e.message); send(res, 500, { error: 'database error' }); }

    if (req.method === 'GET' && what === 'plays') {
      db.query('SELECT game_id, seq, played_at, quarter, team, slot, player, kind, yards, fantasy_points, detail, why ' +
        'FROM plays WHERE game_id = $1 ORDER BY seq', [gameId])
        .then(function (r) { send(res, 200, { game_id: gameId, plays: r.rows }); }, onErr);
    } else if (req.method === 'GET' && what === 'summary') {
      Promise.all([
        db.query('SELECT player, team, slot, sum(points) AS points, sum(plays) AS plays FROM player_points_per_game ' +
          'WHERE game_id = $1 GROUP BY player, team, slot ORDER BY points DESC', [gameId]),
        db.query('SELECT quarter, team, sum(points) AS points FROM team_points_per_quarter ' +
          'WHERE game_id = $1 GROUP BY quarter, team ORDER BY quarter, team', [gameId])
      ]).then(function (r) { send(res, 200, { game_id: gameId, players: r[0].rows, quarters: r[1].rows }); }, onErr);
    } else if (req.method === 'POST' && what === 'plays') {
      readJson(req, function (err, body) {
        if (err) return send(res, err.status, { error: err.message });
        if (!body || !Array.isArray(body.plays) || !body.plays.length) return send(res, 400, { error: 'plays must be a non-empty array' });
        for (var i = 0; i < body.plays.length; i++) {
          var bad = checkPlay(body.plays[i], i);
          if (bad) return send(res, 400, { error: bad });
        }
        var g = body.game;
        if (g && (typeof g.sport !== 'string' || typeof g.home !== 'string' || typeof g.away !== 'string')) {
          return send(res, 400, { error: 'game needs sport, home and away as strings' });
        }
        var client;
        db.connect().then(function (c) {
          client = c;
          return client.query('BEGIN');
        }).then(function () {
          if (g) return client.query('INSERT INTO games (id, sport, home, away) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [gameId, g.sport, g.home, g.away]);
        }).then(function () {
          return body.plays.reduce(function (chain, p) {
            return chain.then(function () {
              return client.query(INSERT_PLAY, [gameId, p.seq, p.played_at, p.quarter, p.team, p.slot || null, p.player || null,
                p.kind, p.yards == null ? null : p.yards, p.fantasy_points == null ? 0 : p.fantasy_points,
                JSON.stringify(p.detail || {}), JSON.stringify(p.why || {})]);
            });
          }, Promise.resolve());
        }).then(function () {
          return client.query('COMMIT');
        }).then(function () {
          send(res, 201, { game_id: gameId, received: body.plays.length });
        }).catch(function (e) {
          var done = client ? client.query('ROLLBACK').catch(function () {}) : Promise.resolve();
          done.then(function () {
            // 23503 = the game row does not exist yet
            if (e && e.code === '23503') return send(res, 400, { error: 'unknown game: send a game object with the first plays' });
            onErr(e);
          });
        }).then(function () { if (client) client.release(); });
      });
    } else {
      send(res, 405, { error: 'method not allowed' });
    }
  });
}

module.exports = { createServer: createServer, loadEnv: loadEnv };

if (require.main === module) {
  loadEnv(path.join(__dirname, '..', '.env'));
  loadEnv(path.join(__dirname, '.env'));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Put it in .env, see server/README.md.');
    process.exit(1);
  }
  var Pool = require('pg').Pool;
  var pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
  var port = Number(process.env.PORT) || 3001;
  createServer(pool).listen(port, function () { console.log('plays service on http://localhost:' + port); });
}
