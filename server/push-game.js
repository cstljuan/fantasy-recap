'use strict';
// Replays a game file from data/games/ with js/rules.js and sends every play to the plays service,
// with the time it happened in the game, the fantasy points and the why.
//   node server/push-game.js data/games/week11-football.json [--url http://localhost:3001] [--id my-game]
var path = require('path');
var buildPlays = require('./replay.js').buildPlays;

// A game file named weekNN-... is played in league week NN: its plays are moved by whole weeks so that week 11 stays on
// 2026-11-15 (where replay.js puts every game) and week 9 lands two weeks earlier. That is what makes the weekly
// buckets of GET /players/:id/trend real. Other file names are not moved.
var DAY = 24 * 3600 * 1000;
function weekShift(file) {
  var m = /^week(\d+)-/.exec(path.basename(file));
  return m ? (parseInt(m[1], 10) - 11) * 7 * DAY : 0;
}

function pushGame(file, baseUrl, idOverride) {
  var g = buildPlays(file);
  var shift = weekShift(file);
  if (shift) g.plays.forEach(function (p) { p.played_at = new Date(Date.parse(p.played_at) + shift).toISOString(); });
  var id = idOverride || g.id;
  var base = String(baseUrl || 'http://localhost:3001').replace(/\/$/, '');
  var batches = [];
  for (var i = 0; i < g.plays.length; i += 40) batches.push(g.plays.slice(i, i + 40));
  var sent = 0;
  return batches.reduce(function (chain, batch, bi) {
    return chain.then(function () {
      var body = { plays: batch };
      if (bi === 0) body.game = { sport: g.sport, home: g.home, away: g.away };
      return fetch(base + '/games/' + encodeURIComponent(id) + '/plays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      }).then(function (r) {
        return r.text().then(function (t) {
          if (!r.ok) throw new Error('service answered ' + r.status + ': ' + t);
          sent += batch.length;
        });
      });
    });
  }, Promise.resolve()).then(function () { return { id: id, plays: sent, final: g.final }; });
}

module.exports = { pushGame: pushGame, weekShift: weekShift };

if (require.main === module) {
  var args = process.argv.slice(2), file = null, url = null, id = null;
  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--url') url = args[++i];
    else if (args[i] === '--id') id = args[++i];
    else file = args[i];
  }
  if (!file) { console.error('Usage: node server/push-game.js <game file in data/games/> [--url http://localhost:3001] [--id name]'); process.exit(2); }
  pushGame(path.resolve(file), url, id).then(function (r) {
    console.log('pushed game ' + r.id + ': ' + r.plays + ' plays, final ' + r.final.join(' to '));
  }, function (e) { console.error('push failed: ' + e.message); process.exit(1); });
}
