'use strict';
// Commissioner routes for the league (server/README.md, "Commissioner"). There are no accounts: anyone who can
// reach the service can call them.
//   GET  /league/week/:n/optins    who opted in, per matchup of week n. No points
//   POST /league/week/:n/release   { released: true | false }   the Tuesday release, set by hand
//   GET  /league/week/:n/release   { week, released, changed_at, source }
//   POST /games/:id/watched        { manager }   a manager reached the final of that game
// Each answer says source 'database' or 'memory'. With the database (tables in db/migrate-003-commissioner.sql)
// the data lasts; when the database does not answer, the same routes work on a store in the service's memory,
// which ends when the service stops. Opt-ins come from the optins table, or from data/league.json without it.
var leagueModule = require('./league.js');

var MAX_MANAGER = 100;

function createCommish(db) {
  var mem = { releases: {}, watched: {} };   // week -> { released, changed_at }; game id -> { manager: time }

  function leagueDoc() { return leagueModule.fromFiles().doc; }
  function weekOf(doc, n) { return (doc.weeks || []).filter(function (w) { return w.week === n; })[0] || null; }
  function parseWeek(text) {
    if (!/^\d{1,2}$/.test(text)) return null;
    var n = Number(text);
    return n >= 1 && n <= 30 ? n : null;
  }
  function watchers(id) { return Object.keys(mem.watched[id] || {}).length; }

  // GET /league/week/:n/optins
  function optins(n, cb) {
    var doc = leagueDoc(), w = weekOf(doc, n);
    if (!w) return cb({ status: 404, body: { error: 'no week ' + n + ' in the league' } });
    var fileLists = {};
    (doc.matchups || []).forEach(function (m) { fileLists[m.teams.map(function (t) { return t.id; }).sort().join('|')] = m.optedIn || []; });
    var current = !w.finished && doc.week === n;
    var rows = w.matchups.map(function (m) {
      return { teams: m.teams.map(function (t) { return t.id; }), gameId: leagueModule.gameIdOf(m), optedIn: [], from: null, watched: null };
    });
    var asked = rows.map(function (r) {
      if (!r.gameId) return Promise.resolve();
      return Promise.all([
        db.query('SELECT game_id, manager, opted_in_at FROM optins WHERE game_id = $1 ORDER BY opted_in_at, manager', [r.gameId]),
        db.query('SELECT count(*) AS n FROM watched WHERE game_id = $1', [r.gameId]).then(function (x) { return x; }, function () { return null; })
      ]).then(function (x) {
        r.optedIn = r.teams.filter(function (id) { return x[0].rows.some(function (o) { return o.manager === id; }); });
        r.from = 'database';
        r.watched = x[1] && x[1].rows[0] ? Number(x[1].rows[0].n) || 0 : watchers(r.gameId);
      }, function () { r.from = null; r.watched = watchers(r.gameId); });
    });
    Promise.all(asked).then(function () {
      rows.forEach(function (r) {
        if (r.from) return;
        // the file only knows the current week's opt-ins
        r.optedIn = current ? (fileLists[r.teams.slice().sort().join('|')] || []).filter(function (id) { return r.teams.indexOf(id) >= 0; }) : [];
        r.from = current ? 'file' : 'none';
        if (r.watched === null) r.watched = r.gameId ? watchers(r.gameId) : 0;
      });
      cb({ status: 200, body: { week: n, finished: !!w.finished, matchups: rows } });
    });
  }

  // POST /league/week/:n/release
  function setRelease(n, body, cb) {
    if (!weekOf(leagueDoc(), n)) return cb({ status: 404, body: { error: 'no week ' + n + ' in the league' } });
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.released !== 'boolean') {
      return cb({ status: 400, body: { error: 'the body must be { released: true or false }' } });
    }
    var at = new Date().toISOString();
    db.query('INSERT INTO releases (week, released, changed_at) VALUES ($1, $2, now()) ' +
      'ON CONFLICT (week) DO UPDATE SET released = EXCLUDED.released, changed_at = now() RETURNING changed_at', [n, body.released])
      .then(function (r) {
        var t = r.rows[0] && r.rows[0].changed_at ? new Date(r.rows[0].changed_at).toISOString() : at;
        cb({ status: 200, body: { week: n, released: body.released, changed_at: t, source: 'database' } });
      }, function (e) {
        console.error('release: database does not answer, keeping it in memory:', e.message);
        mem.releases[n] = { released: body.released, changed_at: at };
        cb({ status: 200, body: { week: n, released: body.released, changed_at: at, source: 'memory' } });
      });
  }

  // GET /league/week/:n/release
  function getRelease(n, cb) {
    if (!weekOf(leagueDoc(), n)) return cb({ status: 404, body: { error: 'no week ' + n + ' in the league' } });
    db.query('SELECT released, changed_at FROM releases WHERE week = $1', [n]).then(function (r) {
      var x = r.rows[0];
      cb({ status: 200, body: { week: n, released: x ? x.released === true : false,
        changed_at: x && x.changed_at ? new Date(x.changed_at).toISOString() : null, source: 'database' } });
    }, function (e) {
      console.error('release: database does not answer, reading memory:', e.message);
      var x = mem.releases[n];
      cb({ status: 200, body: { week: n, released: x ? x.released : false, changed_at: x ? x.changed_at : null, source: 'memory' } });
    });
  }

  // POST /games/:id/watched
  function watched(gameId, body, cb) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.manager !== 'string' || !body.manager.trim()) {
      return cb({ status: 400, body: { error: 'manager is required' } });
    }
    var manager = body.manager.trim();
    if (manager.length > MAX_MANAGER) return cb({ status: 400, body: { error: 'manager is longer than ' + MAX_MANAGER + ' characters' } });
    db.query('INSERT INTO watched (game_id, manager) VALUES ($1, $2) ON CONFLICT (game_id, manager) DO NOTHING', [gameId, manager])
      .then(function () { return db.query('SELECT count(*) AS n FROM watched WHERE game_id = $1', [gameId]); })
      .then(function (r) {
        cb({ status: 201, body: { game_id: gameId, manager: manager, watched: Number(r.rows[0] && r.rows[0].n) || 0, source: 'database' } });
      }, function (e) {
        if (e && e.code === '23503') return cb({ status: 404, body: { error: 'unknown game' } });
        console.error('watched: database does not answer, keeping it in memory:', e.message);
        var g = mem.watched[gameId] = mem.watched[gameId] || {};
        if (!g[manager]) {
          if (Object.keys(mem.watched).length > 1000 || Object.keys(g).length >= 1000) return cb({ status: 429, body: { error: 'too many entries in memory' } });
          g[manager] = new Date().toISOString();
        }
        cb({ status: 201, body: { game_id: gameId, manager: manager, watched: watchers(gameId), source: 'memory' } });
      });
  }

  return { optins: optins, setRelease: setRelease, getRelease: getRelease, watched: watched, parseWeek: parseWeek };
}

module.exports = { createCommish: createCommish };
