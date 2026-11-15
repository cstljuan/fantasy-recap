// Opens another game file: index.html?game=<id> plays data/games/<id>.json instead of the game
// data/games/current.js holds (task B40, two matchups that each open their own game).
// Loaded by index.html right after data/games/current.js and before the inline script that hands
// FF_GAME_FILE to the game, so it must run at once: the file is read with a synchronous request.
// Without ?game=, with ?game=sample (the built-in sample) or when the file cannot be read, it
// changes nothing and the app plays current.js as before. Football files only.
(function () {
  'use strict';
  window.FR_PICK_GAME = { ready: true, picked: '' };
  var mm = /[?&]game=([a-z0-9-]{1,60})(?:&|#|$)/i.exec(location.search + '&');
  if (!mm || mm[1] === 'sample') return;
  var id = mm[1].toLowerCase();
  if (window.FF_GAME_FILE && window.FF_GAME_FILE.id === id) { window.FR_PICK_GAME.picked = id; return; }
  try {
    var x = new XMLHttpRequest();
    x.open('GET', 'data/games/' + id + '.json', false);
    x.send(null);
    if (x.status !== 200 && x.status !== 0) return;
    var g = JSON.parse(x.responseText);
    if (!g || (g.sport && g.sport !== 'football') || !Array.isArray(g.teams) || g.teams.length !== 2 || !g.game) return;
    // The same fields tools/use-game.js writes into current.js, plus the honest label (contract section 1).
    window.FF_GAME_FILE = { id: id, version: g.version, sport: g.sport || 'football', teams: g.teams, game: g.game, report: g.report || null,
      source: g.source, source_note: g.source_note };
    window.FR_PICK_GAME.picked = id;
  } catch (err) { /* current.js stays */ }
})();
