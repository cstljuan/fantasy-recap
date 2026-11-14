// Announcer lines for football: spoken TV play-by-play, short bursts, the call as it happens.
// Each kind has at least three variants. index.js picks them so
// the same game doesn't repeat a line until every variant has been used.
//
// Placeholders, filled in by index.js:
//   {team}    the team that had the ball (plural name, e.g. Goblins)
//   {def}     the other team
//   {player}  last name of the player who made the play
//   {qb}      last name of the quarterback
//   {kicker}  last name of the kicker
//   {yds}     yards gained (a number), {yards} the same with its unit ("1 yard", "4 yards"), {loss} yards lost, {dist} field goal distance, {net} punt net
//   {pen}     penalty yards, {spot} where the kickoff return ended (e.g. GOB 27)
//   {score}   the score, e.g. "Goblins 14, Pythons 7"; {teamscore} the {team} total, e.g. "10 points"
//   {winner} {loser}  at the final
// Lines are about the game on the field only.
(function (root) {
  'use strict';

  var LINES = {
    kickoff: {
      straight: [
        'Here\'s the kick. {player} brings it out to the {spot}.',
        'Kick is away. {player} returns it to the {spot}.',
        'High and deep. {player} back to the {spot}.'
      ]
    },
    touchdown_run: {
      straight: [
        '{player} carries it in from {yds}! Touchdown {team}!',
        '{player} runs it in! Touchdown, {team}!',
        '{player}, {yards}... and in! Touchdown {team}!'
      ]
    },
    touchdown_pass: {
      straight: [
        '{qb} drops back, fires, CAUGHT! Touchdown, {team}!',
        '{qb} finds {player} open! {yds} yards, TOUCHDOWN!',
        '{player} goes up and gets it! Six for the {team}!'
      ]
    },
    xp_good: {
      straight: [
        '{kicker} adds the extra point. {score}.',
        'Extra point is good. {score}.',
        '{kicker} knocks it through. The {team} have {teamscore}.'
      ]
    },
    xp_miss: {
      straight: [
        '{kicker} pushes it! Extra point NO good!',
        'Extra point... NO good! That could hurt.',
        '{kicker} misses the extra point! It stays {teamscore}.'
      ]
    },
    fg_good: {
      straight: [
        '{kicker} from {dist}... it\'s GOOD! {score}.',
        '{dist} yards for {kicker}, right down the middle!',
        'Snap, hold, kick... GOOD from {dist}! {teamscore}.'
      ]
    },
    fg_miss: {
      straight: [
        '{kicker} from {dist}... wide! No good!',
        'The {dist} yard try is up... and it\'s NO good!',
        '{kicker} hooks it from {dist}! {score}.'
      ]
    },
    interception: {
      straight: [
        '{qb} throws... INTERCEPTED! {def} ball!',
        '{qb} is picked off! {def} ball!',
        'Pass is up... picked off! Interception, {def}!'
      ]
    },
    fumble: {
      straight: [
        '{player} fights for more... FUMBLE! {def} ball!',
        'It\'s loose, it\'s LOOSE! The {def} have it!',
        'Fumble! {player} coughs it up! {def} ball!'
      ]
    },
    sack: {
      straight: [
        'Nowhere to go, and {qb} is SACKED! Lost {loss}.',
        '{qb} goes down! Sacked for a loss of {loss}.',
        'The {def} get home! {qb} sacked for {loss}.'
      ]
    },
    big_gain: {
      straight: [
        '{player} breaks free! Still going! {yds} yards!',
        '{player} has room to run! {yds} yards!',
        'Big play! {player} for {yds}, the {team} roll!'
      ]
    },
    first_down: {
      straight: [
        '{player} for {yards}, and that moves the chains.',
        '{player} picks up {yards}. That\'s a first down.',
        '{player} fights forward for {yards}. First down!',
        'First down {team}! {player} gets {yards}.',
        '{player} for {yards}, enough for a first down.',
        'Chains move! {player}, {yards}.',
        '{player} picks it up. First down, {team}.'
      ]
    },
    gain: {
      straight: [
        '{player} for {yards}.',
        '{player} picks up {yards} on the play.',
        '{player} gets {yards} before the tackle.',
        '{player} with a gain of {yards}.',
        '{player}, {yards} more.',
        '{yards} on the play by {player}.',
        '{player} moves it {yards}.'
      ]
    },
    no_gain: {
      straight: [
        '{player} is stuffed at the line! No gain.',
        '{player} has nowhere to go. No gain.',
        '{player} runs into a wall. Nothing there.'
      ]
    },
    incomplete: {
      straight: [
        '{qb} throws for {player}... incomplete.',
        'Intended for {player}, knocked away!',
        '{player} can\'t hang on. Incomplete.',
        'Pass falls incomplete, {player} the target.',
        '{qb} misses {player}. Incomplete.',
        'Incomplete, intended for {player}.',
        'Broken up! Incomplete for {player}.'
      ]
    },
    pen_false_start: {
      straight: [
        'Flag before the snap. False start, {team}.',
        'Somebody moved early. False start, {team}.',
        'Whistle. False start on the {team}, {pen} yards.'
      ]
    },
    pen_holding: {
      straight: [
        'Flag on the play! Holding, {team}. {pen} yards.',
        'Flag. Offensive holding, {pen} yards.',
        'Holding, {team}. That costs them {pen} yards.'
      ]
    },
    pen_offside: {
      straight: [
        'Flag! The {def} jumped. Offside, {pen} yards.',
        'Defense was early! Offside on the {def}.',
        'Offside, {def}. The {team} move up {pen}.'
      ]
    },
    pen_dpi: {
      straight: [
        'Flag downfield! Pass interference, {def}.',
        'Contact, and a flag! Pass interference, {pen}.',
        'Pass interference! A big gain for the {team}.'
      ]
    },
    punt: {
      straight: [
        'The {team} punt it away. {net} yards net, {def} ball.',
        'Punt is high and deep, {net} yards. The {def} take over.',
        'Fourth down, and the {team} will punt. A {net} yard boot.'
      ]
    },
    downs: {
      straight: [
        'Fourth down... and they\'re STOPPED! {def} ball!',
        'The {team} come up short on fourth down!',
        'Huge stop by the {def}! Turnover on downs!'
      ]
    },
    kneel: {
      straight: [
        "{qb} takes the knee. That's going to do it.",
        'Victory formation. {qb} kneels it down.',
        '{qb} takes a knee and lets the clock run.'
      ]
    },
    half: {
      straight: [
        'That\'ll bring us to halftime. {score}.',
        'Halftime here, and it\'s {score}.',
        'End of the first half. {score}.'
      ]
    },
    final: {
      straight: [
        'That\'s the ballgame! {score}!',
        'Final! The {winner} win it, {score}!',
        'It\'s all over! {winner} win, {score}!'
      ]
    },
    final_tie: {
      straight: [
        'That\'s the final, a tie. {score}.',
        'It\'s over, and we\'re tied! {score}.',
        'All square at the end. {score}.'
      ]
    }
  };

  root.FF_ANNOUNCER_LINES = LINES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LINES;
})(typeof window !== 'undefined' ? window : globalThis);
