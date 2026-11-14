'use strict';
// The plays service under load and bad input, with an in-memory stand-in for the database (no database needed).
//   node server/stress.js
// 1. pushes a football game and a soccer match with push-game.js and reads every route back;
// 2. sends bad input to every route: wrong types, missing fields, a body over the limit, broken JSON, odd ids,
//    SQL in strings, an unknown sport, bad query numbers, wrong methods;
// 3. sends 200 requests at once.
// Every request carries Origin: http://localhost:5173. It reports any 500, any crash (an uncaught exception or
// an unhandled rejection in the server), any answer slower than one second, and any answer without the CORS
// header. Prints OK or the problems, exit code 1 on problems. It proves the service code, not the SQL.
var http = require('http');
var path = require('path');
var createServer = require('./index.js').createServer;
var pushGame = require('./push-game.js').pushGame;

var ROOT = path.join(__dirname, '..');
var ORIGIN = 'http://localhost:5173';
var problems = [], crashes = [], count = 0;
process.on('uncaughtException', function (e) { crashes.push('uncaught exception: ' + (e && e.stack || e)); });
process.on('unhandledRejection', function (e) { crashes.push('unhandled rejection: ' + (e && e.stack || e)); });

// ---------------------------------------------------------------- the stand-in database
// Keeps games, plays and opt-ins in memory and answers the queries server/index.js sends, by their text.
function memoryDb() {
  var games = {}, plays = {}, optins = {}, releases = {}, watched = {};
  var cols = ['game_id', 'seq', 'played_at', 'quarter', 'team', 'slot', 'player', 'kind', 'yards', 'fantasy_points', 'detail', 'why', 'minute'];
  function q(text, p) {
    p = p || [];
    if (/^SELECT 1/.test(text)) return { rows: [{ ok: 1 }] };
    if (/^(BEGIN|COMMIT|ROLLBACK)/.test(text)) return { rows: [] };
    if (/^INSERT INTO games/.test(text)) {
      if (['football', 'soccer'].indexOf(p[1]) < 0) { var ce = new Error('violates check constraint "games_sport_check"'); ce.code = '23514'; throw ce; }
      if (!games[p[0]]) games[p[0]] = { id: p[0], sport: p[1], home: p[2], away: p[3] };
      return { rows: [] };
    }
    if (/^INSERT INTO plays/.test(text)) {
      if (!games[p[0]]) { var fe = new Error('violates foreign key constraint'); fe.code = '23503'; throw fe; }
      var row = {}; cols.forEach(function (c, i) { if (i < p.length) row[c] = p[i]; });
      row.detail = JSON.parse(row.detail); row.why = JSON.parse(row.why);
      var list = plays[p[0]] = plays[p[0]] || [];
      if (!list.some(function (r) { return r.seq === row.seq && r.played_at === row.played_at; })) list.push(row);
      return { rows: [] };
    }
    if (/^INSERT INTO optins/.test(text)) {
      if (!games[p[0]]) { var oe = new Error('violates foreign key constraint'); oe.code = '23503'; throw oe; }
      var o = optins[p[0]] = optins[p[0]] || [];
      if (!o.some(function (r) { return r.manager === p[1]; })) o.push({ game_id: p[0], manager: p[1], opted_in_at: new Date().toISOString() });
      return { rows: [] };
    }
    if (/FROM plays WHERE game_id/.test(text)) {
      return { rows: (plays[p[0]] || []).slice().sort(function (a, b) { return a.seq - b.seq; }).map(function (r) { return Object.assign({}, r); }) };
    }
    if (/FROM games WHERE id/.test(text)) return { rows: games[p[0]] ? [games[p[0]]] : [] };
    if (/FROM optins WHERE game_id/.test(text)) return { rows: (optins[p[0]] || []).slice() };
    if (/FROM player_points_per_game|FROM team_points_per_quarter/.test(text)) return { rows: [] };
    if (/^INSERT INTO releases/.test(text)) { releases[p[0]] = { released: p[1], changed_at: new Date().toISOString() }; return { rows: [releases[p[0]]] }; }
    if (/FROM releases WHERE week/.test(text)) return { rows: releases[p[0]] ? [releases[p[0]]] : [] };
    if (/^INSERT INTO watched/.test(text)) {
      if (!games[p[0]]) { var we = new Error('violates foreign key constraint'); we.code = '23503'; throw we; }
      (watched[p[0]] = watched[p[0]] || {})[p[1]] = 1; return { rows: [] };
    }
    if (/FROM watched WHERE game_id/.test(text)) return { rows: [{ n: String(Object.keys(watched[p[0]] || {}).length) }] };
    throw new Error('stand-in database does not know this query: ' + text.slice(0, 60));
  }
  function query(text, p) { try { return Promise.resolve(q(text, p)); } catch (e) { return Promise.reject(e); } }
  return {
    query: query,
    connect: function () { return Promise.resolve({ query: query, release: function () {} }); },
    plays: plays, games: games
  };
}

// ---------------------------------------------------------------- requests
function call(port, method, p, body, rawBody) {
  return new Promise(function (ok) {
    var t0 = Date.now(), headers = { Origin: ORIGIN };
    var data = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : null;
    if (data !== null) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(data); }
    var r = http.request({ port: port, method: method, path: p, headers: headers }, function (res) {
      var s = ''; res.on('data', function (c) { s += c; });
      res.on('end', function () {
        var j = null; try { j = s ? JSON.parse(s) : null; } catch (e) { j = { notJson: s.slice(0, 80) }; }
        ok({ status: res.statusCode, headers: res.headers, body: j, ms: Date.now() - t0 });
      });
    });
    r.setTimeout(5000, function () { r.destroy(new Error('no answer in 5 s')); });
    r.on('error', function (e) { ok({ status: 0, error: e.code || e.message, ms: Date.now() - t0 }); });
    if (data !== null) r.write(data);
    r.end();
  });
}

function judge(label, r, want) {
  count++;
  if (r.status === 0) problems.push(label + ': no answer (' + r.error + ')');
  else if (r.status >= 500) problems.push(label + ': answered ' + r.status + ' ' + JSON.stringify(r.body));
  else if (r.headers['access-control-allow-origin'] !== ORIGIN) problems.push(label + ': no CORS header for ' + ORIGIN);
  if (r.ms > 1000) problems.push(label + ': took ' + r.ms + ' ms');
  if (want && r.status && want.indexOf(r.status) < 0) problems.push(label + ': answered ' + r.status + ', expected ' + want.join(' or '));
  return r;
}

var db = memoryDb();
var srv = createServer(db).listen(0, function () {
  var port = srv.address().port, base = 'http://localhost:' + port;
  function c(label, method, p, body, want, raw) { return call(port, method, p, body, raw).then(function (r) { return judge(label, r, want); }); }

  var football = path.join(ROOT, 'data', 'games', 'week11-football.json');
  var soccer = path.join(ROOT, 'soccer', 'data', 'week11-soccer.json');
  var good = { seq: 1, played_at: '2026-11-15T18:00:00Z', quarter: 1, team: 'GOB', kind: 'run' };
  var big = JSON.stringify({ plays: [Object.assign({ pad: new Array(1100 * 1024).join('x') }, good)] });

  var steps = [
    // 1. push both sports, then read every route back
    function () { return pushGame(football, base).then(function (r) { if (r.plays !== 84) problems.push('football push sent ' + r.plays + ' plays'); }); },
    function () { return pushGame(soccer, base).then(function (r) { if (r.plays !== 83) problems.push('soccer push sent ' + r.plays + ' rows'); }); },
    function () { return c('read football plays', 'GET', '/games/week11-football/plays', undefined, [200]).then(function (r) { if (!r.body || r.body.plays.length !== 84) problems.push('football read back ' + (r.body && r.body.plays.length) + ' plays'); }); },
    function () { return c('read soccer plays', 'GET', '/games/week11-soccer/plays', undefined, [200]).then(function (r) { if (!r.body || r.body.plays.filter(function (p) { return p.kind === 'goal'; }).length !== 2) problems.push('soccer read back without its 2 goals'); }); },
    function () { return c('summary', 'GET', '/games/week11-football/summary', undefined, [200]); },
    function () { return c('optin', 'POST', '/games/week11-football/optin', { manager: 'GOB' }, [201]); },
    function () { return c('optins', 'GET', '/games/week11-football/optins', undefined, [200]); },
    function () { return c('top plays from the database', 'GET', '/games/week11-football/top-plays?n=3', undefined, [200]).then(function (r) { if (r.body && r.body.source !== 'database') problems.push('top plays did not come from the database'); }); },
    function () { return c('drives from the database', 'GET', '/games/week11-football/drives', undefined, [200]).then(function (r) { if (r.body && r.body.source !== 'database') problems.push('drives did not come from the database'); }); },
    function () { return c('momentum from the database', 'GET', '/games/week11-football/momentum?bucket=120', undefined, [200]).then(function (r) { if (r.body && r.body.source !== 'database') problems.push('momentum did not come from the database'); }); },
    function () { return c('story from the database', 'GET', '/games/week11-football/story', undefined, [200]).then(function (r) { if (r.body && r.body.source !== 'database') problems.push('story did not come from the database'); }); },
    function () { return c('story of a soccer match', 'GET', '/games/week11-soccer/story', undefined, [200, 404]); },
    function () { return c('health', 'GET', '/health', undefined, [200]); },
    function () { return c('league', 'GET', '/league', undefined, [200]).then(function (r) {
      var cur = r.body && r.body.current && r.body.current.matchups[0];
      if (!cur || cur.optinsFrom !== 'database' || cur.optedIn.indexOf('GOB') < 0) problems.push('league does not show the opt-in sent before it');
      if (r.body && r.body.weeks.some(function (w) { return !w.finished && w.matchups.some(function (m) { return m.final !== null; }); })) problems.push('league shows points of the current week');
    }); },
    function () { return c('options', 'OPTIONS', '/games/week11-football/plays', undefined, [204]); },
    // football-only routes asked about a soccer match that IS in the database
    function () { return c('top plays of a soccer match', 'GET', '/games/week11-soccer/top-plays', undefined, [200, 404]); },
    function () { return c('drives of a soccer match', 'GET', '/games/week11-soccer/drives', undefined, [200, 404]); },
    function () { return c('momentum of a soccer match', 'GET', '/games/week11-soccer/momentum', undefined, [200, 404]); }
  ];

  // 2. bad input to every route
  var bad = [
    ['plays: body is a number', 'POST', '/games/g1/plays', 5, [400]],
    ['plays: body is null', 'POST', '/games/g1/plays', null, [400]],
    ['plays: plays is a string', 'POST', '/games/g1/plays', { plays: 'x' }, [400]],
    ['plays: empty list', 'POST', '/games/g1/plays', { plays: [] }, [400]],
    ['plays: seq is text', 'POST', '/games/g1/plays', { plays: [Object.assign({}, good, { seq: '1' })] }, [400]],
    ['plays: no team', 'POST', '/games/g1/plays', { plays: [Object.assign({}, good, { team: undefined })] }, [400]],
    ['plays: bad date', 'POST', '/games/g1/plays', { plays: [Object.assign({}, good, { played_at: 'tuesday' })] }, [400]],
    ['plays: play is null', 'POST', '/games/g1/plays', { plays: [null] }, [400]],
    ['plays: game is a number', 'POST', '/games/g1/plays', { game: 7, plays: [good] }, [400]],
    ['plays: unknown sport', 'POST', '/games/curling1/plays', { game: { sport: 'curling', home: 'A', away: 'B' }, plays: [good] }, [400]],
    ['plays: unknown game, no game object', 'POST', '/games/nogame/plays', { plays: [good] }, [400]],
    ['plays: SQL in strings', 'POST', "/games/x'%3B%20DROP%20TABLE%20plays%3B--/plays", { game: { sport: 'football', home: "'; DROP TABLE games;--", away: 'B' }, plays: [Object.assign({}, good, { team: "' OR 1=1 --", kind: 'run); DELETE FROM plays;--' })] }, [201]],
    ['plays: fantasy points is text', 'POST', '/games/g2/plays', { game: { sport: 'football', home: 'A', away: 'B' }, plays: [Object.assign({}, good, { fantasy_points: 'lots' })] }, [400]],
    ['plays: yards is an object', 'POST', '/games/g3/plays', { game: { sport: 'football', home: 'A', away: 'B' }, plays: [Object.assign({}, good, { yards: { a: 1 } })] }, [400]],
    ['plays: detail is a string', 'POST', '/games/g4/plays', { game: { sport: 'football', home: 'A', away: 'B' }, plays: [Object.assign({}, good, { detail: 'x' })] }, [400]],
    ['plays: broken JSON', 'POST', '/games/g1/plays', undefined, [400], '{"plays": ['],
    ['plays: body over the limit', 'POST', '/games/g1/plays', undefined, [413], big],
    ['optin: no body', 'POST', '/games/week11-football/optin', undefined, [400], ''],
    ['optin: manager is a number', 'POST', '/games/week11-football/optin', { manager: 5 }, [400]],
    ['optin: manager is blank', 'POST', '/games/week11-football/optin', { manager: '   ' }, [400]],
    ['optin: manager is very long', 'POST', '/games/week11-football/optin', { manager: new Array(5000).join('m') }, [400]],
    ['optin: SQL in manager', 'POST', '/games/week11-football/optin', { manager: "x'); DROP TABLE optins;--" }, [201]],
    ['optin: unknown game', 'POST', '/games/nogame/optin', { manager: 'GOB' }, [404]],
    ['top plays: n is text', 'GET', '/games/week11-football/top-plays?n=abc', undefined, [400]],
    ['top plays: n is huge', 'GET', '/games/week11-football/top-plays?n=99999999999999999999', undefined, [400]],
    ['top plays: n is negative', 'GET', '/games/week11-football/top-plays?n=-1', undefined, [400]],
    ['momentum: bucket is text', 'GET', '/games/week11-football/momentum?bucket=abc', undefined, [400]],
    ['momentum: bucket 1e9', 'GET', '/games/week11-football/momentum?bucket=1e9', undefined, [400]],
    ['odd id: broken percent', 'GET', '/games/%E0%A4%A/plays', undefined, [400, 404]],
    ['odd id: dots', 'GET', '/games/..%2F..%2Fpackage/top-plays', undefined, [404]],
    ['odd id: dots for drives', 'GET', '/games/..%2F..%2Fdata%2Fgames%2Fweek11-football/drives', undefined, [404]],
    ['odd id: very long', 'GET', '/games/' + new Array(3000).join('a') + '/plays', undefined, [200, 400]],
    ['odd id: unicode', 'GET', '/games/%F0%9F%8F%88/optins', undefined, [200]],
    ['odd path', 'GET', '/games//plays', undefined, [404]],
    ['odd path: query only', 'GET', '/?x=1', undefined, [404]],
    ['wrong method on plays', 'DELETE', '/games/g1/plays', undefined, [405]],
    ['wrong method on health', 'POST', '/health', undefined, [404, 405]],
    ['wrong method on top plays', 'PUT', '/games/g1/top-plays', undefined, [405]],
    ['wrong method on league', 'POST', '/league', { x: 1 }, [405]],
    ['commissioner: release', 'POST', '/league/week/11/release', { released: true }, [200]],
    ['commissioner: read release', 'GET', '/league/week/11/release', undefined, [200]],
    ['commissioner: opt-ins', 'GET', '/league/week/11/optins', undefined, [200]],
    ['commissioner: watched', 'POST', '/games/week11-football/watched', { manager: 'GOB' }, [201]],
    ['commissioner: released is text', 'POST', '/league/week/11/release', { released: 'true' }, [400]],
    ['commissioner: released is missing', 'POST', '/league/week/11/release', {}, [400]],
    ['commissioner: body is a list', 'POST', '/league/week/11/release', [1], [400]],
    ['commissioner: broken JSON', 'POST', '/league/week/11/release', undefined, [400], '{"released":'],
    ['commissioner: body over 2 KB', 'POST', '/league/week/11/release', undefined, [413], JSON.stringify({ released: true, pad: new Array(4000).join('x') })],
    ['commissioner: week is text', 'GET', '/league/week/abc/optins', undefined, [400]],
    ['commissioner: week is huge', 'GET', '/league/week/99999999999/release', undefined, [400]],
    ['commissioner: week is negative', 'GET', '/league/week/-1/release', undefined, [400]],
    ['commissioner: week not in the league', 'GET', '/league/week/20/optins', undefined, [404]],
    ['commissioner: SQL in the week', 'GET', "/league/week/11%3B%20DROP%20TABLE%20releases/release", undefined, [400]],
    ['commissioner: wrong method', 'PUT', '/league/week/11/optins', undefined, [405]],
    ['watched: no manager', 'POST', '/games/week11-football/watched', {}, [400]],
    ['watched: manager is an object', 'POST', '/games/week11-football/watched', { manager: { a: 1 } }, [400]],
    ['watched: SQL in manager', 'POST', '/games/week11-football/watched', { manager: "x'); DROP TABLE watched;--" }, [201]],
    ['watched: unknown game', 'POST', '/games/nogame/watched', { manager: 'GOB' }, [404]],
    ['watched: wrong method', 'GET', '/games/week11-football/watched', undefined, [405]],
    ['league with a query', 'GET', '/league?week=99&x=%E0%A4%A', undefined, [200]],
    ['story: odd id', 'GET', '/games/..%2Fx/story', undefined, [404]],
    ['wrong method on story', 'POST', '/games/g1/story', undefined, [405]]
  ];
  bad.forEach(function (b) { steps.push(function () { return c(b[0], b[1], b[2], b[3], b[4], b[5]); }); });

  // the watch party relay: a room, every route, bad input
  var room = null;
  steps.push(function () { return c('party: make a room', 'POST', '/party', undefined, [201]).then(function (r) { room = r.body; }); });
  steps.push(function () { return c('party: command', 'POST', '/party/' + room.code + '/command', { cmd: 'seek', value: 14 }, [201]); });
  steps.push(function () { return c('party: commands', 'GET', '/party/' + room.code + '/commands?after=0', undefined, [200]); });
  steps.push(function () { return c('party: state', 'POST', '/party/' + room.code + '/state', { host: room.host, index: 14, mode: 'play', speed: 1 }, [200]); });
  steps.push(function () { return c('party: read state', 'GET', '/party/' + room.code + '/state', undefined, [200]); });
  [
    ['party: body is a list', 'POST', '/command', [1, 2], [400]],
    ['party: cmd is a number', 'POST', '/command', { cmd: 5 }, [400]],
    ['party: seek is text', 'POST', '/command', { cmd: 'seek', value: '14' }, [400]],
    ['party: speed is huge', 'POST', '/command', { cmd: 'speed', value: 1e308 }, [400]],
    ['party: SQL in cmd', 'POST', '/command', { cmd: "start'; DROP TABLE plays;--" }, [400]],
    ['party: broken JSON', 'POST', '/command', undefined, [400], '{"cmd":'],
    ['party: body over 2 KB', 'POST', '/command', undefined, [413], JSON.stringify({ cmd: 'start', pad: new Array(4000).join('x') })],
    ['party: state without the host key', 'POST', '/state', { index: 1, mode: 'play', speed: 1 }, [403]],
    ['party: state with an object index', 'POST', '/state', { host: '*', index: { a: 1 }, mode: 'play', speed: 1 }, [400]],
    ['party: after is text', 'GET', '/commands?after=abc', undefined, [400]],
    ['party: wait is too long', 'GET', '/commands?wait=600', undefined, [400]]
  ].forEach(function (b) {
    steps.push(function () {
      var body = b[3] && b[3].host === '*' ? Object.assign({}, b[3], { host: room.host }) : b[3];
      return c(b[0], b[1], '/party/' + room.code + b[2], body, b[4], b[5]);
    });
  });
  [
    ['party: code too short', 'GET', '/party/ABC/state', undefined, [400]],
    ['party: code with digits', 'GET', '/party/AB12/commands', undefined, [400]],
    ['party: broken percent code', 'GET', '/party/%E0%A4%A/state', undefined, [400, 404]],
    ['party: unknown room', 'POST', '/party/QQQQ/command', { cmd: 'start' }, [404]],
    ['party: unknown route', 'GET', '/party/QQQQ/other', undefined, [404]],
    ['party: wrong method', 'PUT', '/party', undefined, [405]]
  ].forEach(function (b) { steps.push(function () { return c(b[0], b[1], b[2], b[3], b[4]); }); });
  // a long poll whose phone goes away must not leave anything behind
  steps.push(function () {
    return new Promise(function (ok) {
      var r = http.request({ port: srv.address().port, method: 'GET', path: '/party/' + room.code + '/commands?after=999&wait=20', headers: { Origin: ORIGIN } });
      r.on('error', function () {}); r.end();
      setTimeout(function () { r.destroy(); setTimeout(ok, 50); }, 100);
    }).then(function () { return c('party: command after a phone left', 'POST', '/party/' + room.code + '/command', { cmd: 'hold' }, [201]); });
  });

  // the SQL strings must have been stored as plain values, and the tables must still be there
  steps.push(function () {
    return c('read back after SQL strings', 'GET', '/games/week11-football/plays', undefined, [200]).then(function (r) {
      if (!r.body || r.body.plays.length !== 84) problems.push('plays changed after the SQL strings');
    });
  });

  // 3. 200 requests at once
  steps.push(function () {
    var routes = ['/games/week11-football/plays', '/games/week11-football/top-plays?n=5', '/games/week11-football/drives',
      '/games/week11-football/momentum', '/games/week11-football/story', '/league', '/league/week/11/optins', '/league/week/11/release', '/games/week11-soccer/plays', '/health', '/games/week11-football/optins', '/games/nope/plays'];
    var all = [];
    for (var i = 0; i < 200; i++) {
      var p = routes[i % routes.length];
      if (i % 10 === 9) all.push(c('burst optin ' + i, 'POST', '/games/week11-football/optin', { manager: 'm' + i }, [201]));
      else if (i % 10 === 4) all.push(c('burst party command ' + i, 'POST', '/party/' + room.code + '/command', { cmd: 'seek', value: i }, [201]));
      else if (i % 10 === 6) all.push(c('burst party poll ' + i, 'GET', '/party/' + room.code + '/commands?after=' + i, undefined, [200]));
      else all.push(c('burst ' + p, 'GET', p, undefined, [200]));
    }
    var t0 = Date.now();
    return Promise.all(all).then(function (rs) {
      var slow = rs.filter(function (r) { return r.ms > 1000; }).length;
      console.log('200 requests at once: ' + (Date.now() - t0) + ' ms in all, slowest ' + Math.max.apply(null, rs.map(function (r) { return r.ms; })) + ' ms, ' + slow + ' over one second');
    });
  });

  steps.reduce(function (chain, s) { return chain.then(s); }, Promise.resolve()).then(function () {
    return new Promise(function (ok) { setTimeout(ok, 50); });
  }).then(function () {
    srv.close();
    var all = crashes.concat(problems);
    console.log(count + ' requests checked');
    if (all.length) { console.log('PROBLEMS (' + all.length + '):'); all.forEach(function (p) { console.log('  ' + p); }); process.exit(1); }
    console.log('OK');
  }, function (e) { console.error('FAIL', e.stack || e); process.exit(1); });
});
