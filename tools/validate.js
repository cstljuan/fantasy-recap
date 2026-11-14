// Checks the sample game against the rules engine without a browser.
// Run from the repo root:  node fantasy-football/tools/validate.js
'use strict';
var data = require('../js/data.js');
var Rules = require('../js/rules.js');

var s = Rules.create(data.TEAMS);
var steps = Rules.flatten(data.SAMPLE_GAME, data.TEAMS);
var seen = { td: 0, fg: 0, punt: 0, turnover: 0, penalty: 0, downs: 0, missedFg: 0 };
var plays = 0, scoring = 0, kickoffs = 0, boardChanges = 0;
var prevDrive = -1;

steps.forEach(function (st) {
  if (st.kind === 'half') { Rules.startHalf(s); console.log('\n-- HALFTIME ' + scoreLine() + ' --'); return; }
  if (st.kind === 'final') { console.log('\n-- FINAL ' + scoreLine() + ' --'); return; }
  if (st.drive !== prevDrive) {
    if (prevDrive >= 0 && st.e.t !== 'kickoff' && s.poss !== st.team) throw new Error('Drive ' + (st.drive + 1) + ' starts with the wrong team');
    console.log('\nDrive ' + (st.drive + 1) + ' (' + data.TEAMS[st.team].id + ')');
    prevDrive = st.drive;
  }
  var r = Rules.apply(s, st.e, st.team);
  plays++;
  if (st.e.t === 'kickoff') kickoffs++;
  if (r.scoring) scoring++;
  if (r.post.score[0] !== r.pre.score[0] || r.post.score[1] !== r.pre.score[1]) boardChanges++;
  if (r.td) seen.td++;
  if (st.e.t === 'fg' && st.e.good) seen.fg++;
  if (st.e.t === 'fg' && !st.e.good) seen.missedFg++;
  if (st.e.t === 'punt') seen.punt++;
  if (st.e.t === 'int' || st.e.t === 'fumble') seen.turnover++;
  if (st.e.t === 'pen') seen.penalty++;
  if (r.downs) seen.downs++;
  if (st.last && !(r.flip || s.awaiting === 'kickoff' || st.e.t === 'kneel')) throw new Error('Drive ' + (st.drive + 1) + ' ends without a change of possession');
  if (!st.last && r.flip) throw new Error('Drive ' + (st.drive + 1) + ' loses the ball before its last play');
  console.log('  ' + r.text + '   [' + scoreLine() + ']' + (r.scoring ? ' *' : ''));
});

function scoreLine() { return data.TEAMS[0].id + ' ' + s.score[0] + ', ' + data.TEAMS[1].id + ' ' + s.score[1]; }

console.log('\nPlays: ' + plays + ' (' + kickoffs + ' kickoffs)');
console.log('Plays that move a fantasy score by a full point or change the scoreboard (*): ' + scoring + ' of ' + plays + ', so ' + Math.round(100 * (plays - scoring) / plays) + '% score nothing');
console.log('Plays that change the scoreboard: ' + boardChanges);
console.log('Seen: ' + JSON.stringify(seen));
['td', 'fg', 'punt', 'turnover', 'penalty'].forEach(function (k) {
  if (!seen[k]) throw new Error('Sample game is missing a ' + k);
});
console.log('OK');
