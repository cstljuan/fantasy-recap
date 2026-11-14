// Boss tool. Makes a game file the one the app plays:  node tools/use-game.js data/games/<id>.json
// Writes data/games/current.js, which index.html loads before the game starts.
// Open the app with ?game=sample to play the built-in sample instead.
'use strict';
const fs = require('fs'), path = require('path');
const src = process.argv[2];
if (!src) { console.error('usage: node tools/use-game.js data/games/<id>.json'); process.exit(2); }
const file = JSON.parse(fs.readFileSync(src, 'utf8'));
const Rules = require('../js/rules.js');
const s = Rules.create(file.teams); let plays = 0;
Rules.flatten(file.game, file.teams).forEach(function (st) { if (st.kind === 'half') Rules.startHalf(s); else if (st.kind === 'play') { Rules.apply(s, st.e, st.team); plays++; } });
const out = path.join(__dirname, '..', 'data', 'games', 'current.js');
fs.writeFileSync(out, '// Written by tools/use-game.js from ' + path.basename(src) + '. Do not edit by hand.\nwindow.FF_GAME_FILE = ' + JSON.stringify({ id: path.basename(src, '.json'), version: file.version, sport: file.sport, teams: file.teams, game: file.game, report: file.report || null }) + ';\n');
console.log('OK: ' + path.basename(src) + ' is now the app\'s game. ' + plays + ' plays, final ' + file.teams[0].id + ' ' + s.score[0] + ', ' + file.teams[1].id + ' ' + s.score[1]);
