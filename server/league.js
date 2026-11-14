// The league for the league home: standings worked out from the finished weeks, each week's results, and who has
// opted in this week. Runs in Node and in the browser with the same code:
//   node server/league.js                 prints the league from data/league.json and checks the standings
//   service: GET /league                  (opt-ins and finals from the database when it answers)
//   browser: <script src="server/league.js"></script>, then FR_LEAGUE.fromLeague(leagueJson)
//
// fromLeague(doc, opts) with doc = data/league.json and opts (all optional):
//   optins: { <game id>: [manager, ...] }   who opted in, from the service's optins table. Only managers equal to
//                                           one of the matchup's team ids count. Without it: doc's optedIn lists
//   finals: { <game id>: [home, away] }     fantasy points of a finished game, from the database or a game file
//   source: { optins: 'database' | 'file', finals: 'database' | 'file' }   said in the result
// Result: {
//   name, week, invented, release,
//   weeks: [ { week, finished, matchups: [ { teams: [{id, full, tile}, x2], final: [a, b] or null, gameId, finalFrom } ] } ],
//   standings: [ { id, full, wins, losses, ties, pointsFor, pointsAgainst } ]   from finished weeks only, best first
//   current: { week, matchups: [ { teams, gameId, optedIn: [team ids], optinsFrom } ] },
//   note
// }
// The current (unfinished) week's points are always null, even when a database or game file holds them: the
// league home must never show hidden points before the final. finalFrom and optinsFrom say 'file' or 'database'.
(function (root) {
'use strict';
var isNode = typeof module !== 'undefined' && !!module.exports && typeof require === 'function';

function r1(x) { return Math.round(x * 10) / 10; }
function gameIdOf(m) { return m && typeof m.gameFile === 'string' && m.gameFile ? m.gameFile.replace(/^.*\//, '').replace(/\.json$/, '') : null; }
function key(teams) { return teams.map(function (t) { return t.id; }).slice().sort().join('|'); }

function fromLeague(doc, opts) {
  opts = opts || {};
  var src = opts.source || {};
  var weeks = (doc.weeks || []).map(function (w) {
    return { week: w.week, finished: !!w.finished, matchups: (w.matchups || []).map(function (m) {
      var id = gameIdOf(m), final = null, from = null;
      if (w.finished) {
        if (id && opts.finals && opts.finals[id]) { final = opts.finals[id].map(r1); from = src.finals || 'database'; }
        else if (Array.isArray(m.final)) { final = m.final.slice(); from = 'file'; }
      }
      return { teams: m.teams.map(function (t) { return { id: t.id, full: t.full, tile: t.tile }; }), final: final, gameId: id, finalFrom: from };
    }) };
  });

  // standings from the finished weeks
  var table = {}, order = [];
  function row(t) {
    if (!table[t.id]) { table[t.id] = { id: t.id, full: t.full, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 }; order.push(t.id); }
    return table[t.id];
  }
  weeks.forEach(function (w) {
    w.matchups.forEach(function (m) {
      var a = row(m.teams[0]), b = row(m.teams[1]);
      if (!w.finished || !m.final) return;
      a.pointsFor += m.final[0]; a.pointsAgainst += m.final[1];
      b.pointsFor += m.final[1]; b.pointsAgainst += m.final[0];
      if (m.final[0] > m.final[1]) { a.wins++; b.losses++; }
      else if (m.final[1] > m.final[0]) { b.wins++; a.losses++; }
      else { a.ties++; b.ties++; }
    });
  });
  var standings = order.map(function (id) {
    var x = table[id];
    return { id: x.id, full: x.full, wins: x.wins, losses: x.losses, ties: x.ties, pointsFor: r1(x.pointsFor), pointsAgainst: r1(x.pointsAgainst) };
  }).sort(function (a, b) {
    return (b.wins + b.ties / 2) - (a.wins + a.ties / 2) || b.pointsFor - a.pointsFor || (a.id < b.id ? -1 : 1);
  });

  // this week: who opted in
  var current = weeks.filter(function (w) { return !w.finished; }).sort(function (a, b) { return a.week - b.week; })[0] || null;
  var fileOptins = {};
  (doc.matchups || []).forEach(function (m) { fileOptins[key(m.teams)] = (m.optedIn || []).slice(); });
  var cur = current ? { week: current.week, matchups: current.matchups.map(function (m) {
    var ids = m.teams.map(function (t) { return t.id; }), optedIn, from;
    if (m.gameId && opts.optins && opts.optins[m.gameId]) {
      optedIn = ids.filter(function (id) { return opts.optins[m.gameId].indexOf(id) >= 0; });
      from = src.optins || 'database';
    } else {
      optedIn = (fileOptins[key(m.teams)] || []).filter(function (id) { return ids.indexOf(id) >= 0; });
      from = 'file';
    }
    return { teams: m.teams, gameId: m.gameId, optedIn: optedIn, optinsFrom: from };
  }) } : null;

  return { name: doc.name || null, week: doc.week != null ? doc.week : current && current.week, invented: !!doc.invented,
    release: doc.release || null, weeks: weeks, standings: standings, current: cur, note: doc.note || null };
}

// Fantasy points per team of a whole game, from play records (detail.fp), home first.
function finalFromRecords(records, home, away) {
  var t = [0, 0];
  records.forEach(function (p) { ((p.detail && p.detail.fp) || []).forEach(function (f) { if (f.team === home) t[0] += f.pts; else if (f.team === away) t[1] += f.pts; }); });
  return [r1(t[0]), r1(t[1])];
}

// Node: the league from data/league.json and, for finished weeks, the game files in data/games/.
function fromFiles(rootDir) {
  var fs = require('fs'), path = require('path');
  var base = rootDir || path.join(__dirname, '..');
  var doc = JSON.parse(fs.readFileSync(path.join(base, 'data', 'league.json'), 'utf8'));
  var finals = {};
  (doc.weeks || []).forEach(function (w) {
    if (!w.finished) return;
    (w.matchups || []).forEach(function (m) {
      var id = gameIdOf(m), f = id && /^[A-Za-z0-9_-]+$/.test(id) ? path.join(base, 'data', 'games', id + '.json') : null;
      if (f && fs.existsSync(f)) { var g = require('./replay.js').buildPlays(f); finals[id] = finalFromRecords(g.plays, g.home, g.away); }
    });
  });
  return { doc: doc, league: fromLeague(doc, { finals: finals, source: { finals: 'file' } }) };
}

var api = { fromLeague: fromLeague, finalFromRecords: finalFromRecords, fromFiles: fromFiles, gameIdOf: gameIdOf };
root.FR_LEAGUE = api;
if (isNode) module.exports = api;

if (isNode && require.main === module) {
  var r = fromFiles(), L = r.league, problems = [];
  // the standings worked out here must equal the ones written in data/league.json
  (r.doc.standings || []).forEach(function (s) {
    var x = L.standings.filter(function (y) { return y.id === s.id; })[0];
    if (!x) return problems.push(s.id + ' is in the file standings but not worked out');
    ['wins', 'losses', 'pointsFor', 'pointsAgainst'].forEach(function (k) { if (x[k] !== s[k]) problems.push(s.id + ' ' + k + ' ' + x[k] + ' worked out, ' + s[k] + ' in the file'); });
  });
  if (L.current && L.current.matchups.some(function (m) { return 'final' in m; })) problems.push('the current week shows points');
  L.weeks.forEach(function (w) { if (!w.finished && w.matchups.some(function (m) { return m.final !== null; })) problems.push('week ' + w.week + ' is not finished but has points'); });
  console.log(L.name + ', week ' + L.week + (L.invented ? ' (invented)' : ''));
  L.standings.forEach(function (s, i) { console.log('  ' + (i + 1) + '. ' + s.full + '  ' + s.wins + '-' + s.losses + (s.ties ? '-' + s.ties : '') + '  for ' + s.pointsFor + ', against ' + s.pointsAgainst); });
  if (L.current) L.current.matchups.forEach(function (m) { console.log('  week ' + L.current.week + ': ' + m.teams[0].id + ' v ' + m.teams[1].id + ', opted in: ' + (m.optedIn.join(', ') || 'nobody') + ' (' + m.optinsFrom + ')'); });
  if (problems.length) { console.log('PROBLEMS:'); problems.forEach(function (p) { console.log('  ' + p); }); process.exit(1); }
  console.log('OK');
}
})(typeof window !== 'undefined' ? window : globalThis);
