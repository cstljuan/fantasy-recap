'use strict';
// Small service, no framework. Saves plays to PostgreSQL (Tiger Data) and reads them back.
//   POST /games/:id/plays    body: { game?: {sport, home, away}, plays: [ ... ] }
//   GET  /games/:id/plays    plays in order
//   GET  /games/:id/summary  { players: [...], quarters: [...] } from the two aggregates
// The connection string comes from DATABASE_URL in .env. It is never written anywhere else.

var http = require('http');
var fs = require('fs');
var path = require('path');
var topPlaysModule = require('./top-plays.js');
var topPlays = topPlaysModule.topPlays, rankPlays = topPlaysModule.rank;
var drivesModule = require('./drives.js');
var momentumModule = require('./momentum.js');
var storyModule = require('./story.js');

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
// Soccer rows also carry the match minute. The minute column comes from db/migrate-002-soccer.sql, so it is only
// written for plays that have a minute and football keeps working on a database without the migration.
var INSERT_PLAY_MINUTE =
  'INSERT INTO plays (game_id, seq, played_at, quarter, team, slot, player, kind, yards, fantasy_points, detail, why, minute) ' +
  'VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING';

// A browser page on another port may call the service only from http://localhost:<port> or http://127.0.0.1:<port>.
var LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function send(res, status, body) {
  var text = JSON.stringify(body);
  var headers = {
    'Content-Type': 'application/json',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  var origin = res.originHeader;
  if (origin && LOCAL_ORIGIN.test(origin)) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(status, headers);
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
  if (p.minute != null && (!Number.isInteger(p.minute) || p.minute < 0 || p.minute > 200)) return 'plays[' + i + '].minute must be a whole minute';
  if (p.yards != null && !Number.isInteger(p.yards)) return 'plays[' + i + '].yards must be a whole number or null';
  if (p.fantasy_points != null && (typeof p.fantasy_points !== 'number' || !isFinite(p.fantasy_points) || Math.abs(p.fantasy_points) >= 10000)) {
    return 'plays[' + i + '].fantasy_points must be a number below 10000';
  }
  if (p.slot != null && typeof p.slot !== 'string') return 'plays[' + i + '].slot must be text or null';
  if (p.player != null && typeof p.player !== 'string') return 'plays[' + i + '].player must be text or null';
  if (p.detail != null && !isPlainObject(p.detail)) return 'plays[' + i + '].detail must be an object';
  if (p.why != null && !isPlainObject(p.why)) return 'plays[' + i + '].why must be an object';
  return null;
}

function isPlainObject(x) { return typeof x === 'object' && x !== null && !Array.isArray(x); }

var SPORTS = ['football', 'soccer'];
var MAX_ID = 200, MAX_MANAGER = 100;

// db needs query(text, params) -> Promise<{rows}> and, for POST, connect() -> client with query and release.
function createServer(db) {
  return http.createServer(function (req, res) {
    res.originHeader = req.headers.origin;
    // Anything thrown while handling a request answers 500 instead of leaving the request open.
    try { route(req, res); }
    catch (e) { console.error('request failed:', e.message); if (!res.headersSent) send(res, 500, { error: 'server error' }); }
  });

  function route(req, res) {
    var url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, {});
    if (req.method === 'GET' && url.pathname === '/health') {
      return db.query('SELECT 1 AS ok').then(function () { send(res, 200, { ok: true, database: true }); },
        function (e) { console.error('health: database does not answer:', e.message); send(res, 503, { ok: false, database: false }); });
    }
    var m = url.pathname.match(/^\/games\/([^\/]+)\/(plays|summary|optin|optins|top-plays|drives|momentum|story)$/);
    if (!m) return send(res, 404, { error: 'not found' });
    var gameId;
    try { gameId = decodeURIComponent(m[1]); } catch (e) { return send(res, 400, { error: 'the game id is not valid' }); }
    if (gameId.length > MAX_ID) return send(res, 400, { error: 'the game id is longer than ' + MAX_ID + ' characters' });
    var what = m[2];

    function onErr(e) { console.error('database error:', e.message); send(res, 500, { error: 'database error' }); }
    // A throw inside a callback below would otherwise leave the request open.
    function late(e) { console.error('request failed:', e && e.message); if (!res.headersSent) send(res, 500, { error: 'server error' }); }

    if (req.method === 'GET' && what === 'story') {
      var sFile = /^[A-Za-z0-9_-]+$/.test(gameId) ? path.join(__dirname, '..', 'data', 'games', gameId + '.json') : null;
      var storyFromFile = function () {
        if (!sFile || !fs.existsSync(sFile)) return send(res, 404, { error: 'no plays in the database and no game file for ' + gameId });
        try { var st = storyModule.story(sFile); st.game_id = gameId; st.source = 'file'; send(res, 200, st); }
        catch (e) { console.error('story from file failed:', e.message); send(res, 500, { error: 'could not read the game file' }); }
      };
      Promise.all([
        db.query('SELECT seq, quarter, played_at, team, kind, yards, detail, why FROM plays WHERE game_id = $1 ORDER BY seq', [gameId]),
        db.query('SELECT home, away FROM games WHERE id = $1', [gameId])
      ]).then(function (r) {
        var rows = r[0].rows, g = r[1].rows[0];
        var ok = rows.length && g && rows.every(function (x) { return x.detail && x.detail.fp && x.detail.score_after && x.played_at; });
        if (!ok) return storyFromFile();
        var st = storyModule.fromRecords(rows, g.home, g.away); st.game_id = gameId; st.source = 'database';
        send(res, 200, st);
      }, function (e) { console.error('story: database does not answer, using the game file:', e.message); storyFromFile(); }).catch(late);
    } else if (req.method === 'GET' && what === 'momentum') {
      var bucket = parseInt(url.searchParams.get('bucket') || '120', 10);
      if (!(bucket >= 10 && bucket <= 3600)) return send(res, 400, { error: 'bucket must be a whole number of seconds from 10 to 3600' });
      var mFile = /^[A-Za-z0-9_-]+$/.test(gameId) ? path.join(__dirname, '..', 'data', 'games', gameId + '.json') : null;
      var momFromFile = function () {
        if (!mFile || !fs.existsSync(mFile)) return send(res, 404, { error: 'no plays in the database and no game file for ' + gameId });
        try { var m = momentumModule.momentum(mFile, bucket); m.game_id = gameId; m.source = 'file'; send(res, 200, m); }
        catch (e) { console.error('momentum from file failed:', e.message); send(res, 500, { error: 'could not read the game file' }); }
      };
      Promise.all([
        db.query('SELECT seq, quarter, played_at, detail FROM plays WHERE game_id = $1 ORDER BY seq', [gameId]),
        db.query('SELECT home, away FROM games WHERE id = $1', [gameId])
      ]).then(function (r) {
        var rows = r[0].rows, g = r[1].rows[0];
        var ok = rows.length && g && rows.every(function (x) { return x.detail && x.detail.fp && x.detail.score_after && x.played_at; });
        if (!ok) return momFromFile();
        var m = momentumModule.fromRecords(rows, g.home, g.away, bucket); m.game_id = gameId; m.source = 'database';
        send(res, 200, m);
      }, function (e) { console.error('momentum: database does not answer, using the game file:', e.message); momFromFile(); }).catch(late);
    } else if (req.method === 'GET' && what === 'drives') {
      var dFile = /^[A-Za-z0-9_-]+$/.test(gameId) ? path.join(__dirname, '..', 'data', 'games', gameId + '.json') : null;
      var driveFromFile = function () {
        if (!dFile || !fs.existsSync(dFile)) return send(res, 404, { error: 'no plays in the database and no game file for ' + gameId });
        try { send(res, 200, { game_id: gameId, source: 'file', drives: drivesModule.drives(dFile) }); }
        catch (e) { console.error('drives from file failed:', e.message); send(res, 500, { error: 'could not read the game file' }); }
      };
      db.query('SELECT seq, quarter, team, kind, yards, detail, why FROM plays WHERE game_id = $1 ORDER BY seq', [gameId])
        .then(function (r) {
          if (!r.rows.length || !drivesModule.usable(r.rows)) return driveFromFile();
          send(res, 200, { game_id: gameId, source: 'database', drives: drivesModule.fromRecords(r.rows) });
        }, function (e) { console.error('drives: database does not answer, using the game file:', e.message); driveFromFile(); }).catch(late);
    } else if (req.method === 'GET' && what === 'top-plays') {
      var n = parseInt(url.searchParams.get('n') || '3', 10);
      if (!(n >= 1 && n <= 20)) return send(res, 400, { error: 'n must be a whole number from 1 to 20' });
      var gameFile = /^[A-Za-z0-9_-]+$/.test(gameId) ? path.join(__dirname, '..', 'data', 'games', gameId + '.json') : null;
      var fromFile = function () {
        if (!gameFile || !fs.existsSync(gameFile)) return send(res, 404, { error: 'no plays in the database and no game file for ' + gameId });
        try { send(res, 200, { game_id: gameId, source: 'file', plays: topPlays(gameFile, n) }); }
        catch (e) { console.error('top plays from file failed:', e.message); send(res, 500, { error: 'could not read the game file' }); }
      };
      db.query('SELECT seq, quarter, team, kind, yards, detail, why FROM plays WHERE game_id = $1 ORDER BY seq', [gameId])
        .then(function (r) {
          if (!r.rows.length) return fromFile();
          send(res, 200, { game_id: gameId, source: 'database', plays: rankPlays(r.rows, n) });
        }, function (e) { console.error('top plays: database does not answer, using the game file:', e.message); fromFile(); }).catch(late);
    } else if (req.method === 'POST' && what === 'optin') {
      readJson(req, function (err, body) {
        if (err) return send(res, err.status, { error: err.message });
        if (!body || typeof body.manager !== 'string' || !body.manager.trim()) return send(res, 400, { error: 'manager is required' });
        if (body.manager.trim().length > MAX_MANAGER) return send(res, 400, { error: 'manager is longer than ' + MAX_MANAGER + ' characters' });
        db.query('INSERT INTO optins (game_id, manager) VALUES ($1, $2) ON CONFLICT (game_id, manager) DO NOTHING', [gameId, body.manager.trim()])
          .then(function () { send(res, 201, { game_id: gameId, manager: body.manager.trim() }); },
            function (e) {
              if (e && e.code === '23503') return send(res, 404, { error: 'unknown game' });
              onErr(e);
            });
      });
    } else if (req.method === 'GET' && what === 'optins') {
      db.query('SELECT game_id, manager, opted_in_at FROM optins WHERE game_id = $1 ORDER BY opted_in_at, manager', [gameId])
        .then(function (r) { send(res, 200, { game_id: gameId, optins: r.rows }); }, onErr).catch(late);
    } else if (req.method === 'GET' && what === 'plays') {
      db.query('SELECT game_id, seq, played_at, quarter, team, slot, player, kind, yards, fantasy_points, detail, why ' +
        'FROM plays WHERE game_id = $1 ORDER BY seq', [gameId])
        .then(function (r) { send(res, 200, { game_id: gameId, plays: r.rows }); }, onErr).catch(late);
    } else if (req.method === 'GET' && what === 'summary') {
      Promise.all([
        db.query('SELECT player, team, slot, sum(points) AS points, sum(plays) AS plays FROM player_points_per_game ' +
          'WHERE game_id = $1 GROUP BY player, team, slot ORDER BY points DESC', [gameId]),
        db.query('SELECT quarter, team, sum(points) AS points FROM team_points_per_quarter ' +
          'WHERE game_id = $1 GROUP BY quarter, team ORDER BY quarter, team', [gameId])
      ]).then(function (r) { send(res, 200, { game_id: gameId, players: r[0].rows, quarters: r[1].rows }); }, onErr).catch(late);
    } else if (req.method === 'POST' && what === 'plays') {
      readJson(req, function (err, body) {
        if (err) return send(res, err.status, { error: err.message });
        if (!body || !Array.isArray(body.plays) || !body.plays.length) return send(res, 400, { error: 'plays must be a non-empty array' });
        for (var i = 0; i < body.plays.length; i++) {
          var bad = checkPlay(body.plays[i], i);
          if (bad) return send(res, 400, { error: bad });
        }
        var g = body.game;
        if (g !== undefined && (!isPlainObject(g) || typeof g.sport !== 'string' || typeof g.home !== 'string' || typeof g.away !== 'string')) {
          return send(res, 400, { error: 'game needs sport, home and away as strings' });
        }
        if (g && SPORTS.indexOf(g.sport) < 0) return send(res, 400, { error: 'sport must be football or soccer' });
        var client;
        db.connect().then(function (c) {
          client = c;
          return client.query('BEGIN');
        }).then(function () {
          if (g) return client.query('INSERT INTO games (id, sport, home, away) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING', [gameId, g.sport, g.home, g.away]);
        }).then(function () {
          return body.plays.reduce(function (chain, p) {
            return chain.then(function () {
              var vals = [gameId, p.seq, p.played_at, p.quarter, p.team, p.slot || null, p.player || null,
                p.kind, p.yards == null ? null : p.yards, p.fantasy_points == null ? 0 : p.fantasy_points,
                JSON.stringify(p.detail || {}), JSON.stringify(p.why || {})];
              if (p.minute != null) return client.query(INSERT_PLAY_MINUTE, vals.concat([p.minute]));
              return client.query(INSERT_PLAY, vals);
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
  }
}

// Optional certificate check. With DATABASE_CA_FILE set to a certificate file, the server's certificate is
// verified against it. Without it the connection string is used exactly as given (no change in behavior).
// The ssl words are taken out of the string handed to pg so that they cannot override this setting.
function poolConfig(url, caFile) {
  var cfg = { connectionString: url, max: 5 };
  if (!caFile) return cfg;
  var u = new URL(url);
  ['sslmode', 'ssl', 'uselibpqcompat'].forEach(function (k) { u.searchParams.delete(k); });
  cfg.connectionString = u.toString();
  cfg.ssl = { ca: fs.readFileSync(caFile, 'utf8'), rejectUnauthorized: true };
  return cfg;
}

module.exports = { createServer: createServer, loadEnv: loadEnv, poolConfig: poolConfig };

if (require.main === module) {
  loadEnv(path.join(__dirname, '..', '.env'));
  loadEnv(path.join(__dirname, '.env'));
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Put it in .env, see server/README.md.');
    process.exit(1);
  }
  var Pool = require('pg').Pool;
  var pool = new Pool(poolConfig(process.env.DATABASE_URL, process.env.DATABASE_CA_FILE));
  var port = Number(process.env.PORT) || 3001;
  createServer(pool).listen(port, function () { console.log('plays service on http://localhost:' + port); });
}
