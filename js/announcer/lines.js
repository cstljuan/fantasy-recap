// Announcer lines for football. Two styles:
//   straight: the default. Spoken TV play-by-play: short bursts, the call as it happens.
//   fun:      the same fact with some personality.
// Each kind has at least three variants per style. index.js picks them so
// the same game does not repeat a line until every variant has been used.
//
// Placeholders, filled in by index.js:
//   {team}    the team that had the ball (plural name, e.g. Goblins)
//   {def}     the other team
//   {player}  last name of the player who made the play
//   {qb}      last name of the quarterback
//   {kicker}  last name of the kicker
//   {yds}     yards gained, {loss} yards lost, {dist} field goal distance, {net} punt net
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
      ],
      fun: [
        'Up it goes! {player} to the {spot}. Let\'s play!',
        '{player} takes the kick and scoots to the {spot}!',
        'Boot is away! {player} grabs it, off we go!'
      ]
    },
    touchdown_run: {
      straight: [
        '{player} bounces outside, {yds} yards... TOUCHDOWN!',
        '{player} hits the hole! Touchdown {team}!',
        '{player} breaks one tackle, two... and in! {team}!'
      ],
      fun: [
        '{player} is GONE! {yds} yards to the house!',
        'Get out of the way! {player} scores! {team}!',
        'Hand it to {player}... TOUCHDOWN {team}!'
      ]
    },
    touchdown_pass: {
      straight: [
        '{qb} drops back, fires, CAUGHT! Touchdown, {team}!',
        '{qb} finds {player} open! {yds} yards, TOUCHDOWN!',
        '{player} goes up and gets it! Six for the {team}!'
      ],
      fun: [
        '{qb} lets it fly, {player} hauls it in! Six!',
        'Pitch and catch, {qb} to {player}! Touchdown!',
        'What a catch by {player}! {score}!'
      ]
    },
    xp_good: {
      straight: [
        '{kicker} adds the extra point. {score}.',
        'Extra point is good. {score}.',
        '{kicker} knocks it through. {teamscore}.'
      ],
      fun: [
        '{kicker} makes it look easy. Point after is good!',
        'Right down the middle from {kicker}. Add one more!',
        'Automatic! {kicker} tacks on the extra point.'
      ]
    },
    xp_miss: {
      straight: [
        '{kicker} pushes it! Extra point NO good!',
        'Extra point... NO good! That could hurt.',
        '{kicker} misses the extra point! It stays {teamscore}.'
      ],
      fun: [
        'Oh no, {kicker}! The easy one gets away!',
        'Doink! {kicker} leaves a point out there.',
        'Wide! {kicker} cannot believe it.'
      ]
    },
    fg_good: {
      straight: [
        '{kicker} from {dist}... it\'s GOOD! {score}.',
        '{dist} yards for {kicker}, right down the middle!',
        'Snap, hold, kick... GOOD from {dist}! {teamscore}.'
      ],
      fun: [
        '{kicker} from {dist}... it is GOOD! Three points!',
        'Split the uprights! {kicker} drills it from {dist} yards!',
        'Money from {dist}! {kicker} puts three on the board!'
      ]
    },
    fg_miss: {
      straight: [
        '{kicker} from {dist}... wide! No good!',
        'The {dist} yard try is up... and it\'s NO good!',
        '{kicker} hooks it from {dist}! {score}.'
      ],
      fun: [
        '{kicker} pushes it from {dist}... no good!',
        'Wide! That {dist} yard try sails off the mark.',
        'So close! {kicker} misses from {dist}.'
      ]
    },
    interception: {
      straight: [
        '{qb} throws... INTERCEPTED! {def} ball!',
        '{qb} forces it, and it\'s PICKED! {def} ball!',
        'Pass is up... picked off! Interception, {def}!'
      ],
      fun: [
        'PICKED OFF! The {def} jump the route!',
        '{qb} throws it to the wrong jersey! {def} ball!',
        'Thief! The {def} snatch it out of the air!'
      ]
    },
    fumble: {
      straight: [
        '{player} fights for more... FUMBLE! {def} ball!',
        'It\'s loose, it\'s LOOSE! The {def} have it!',
        'Fumble! {player} coughs it up! {def} ball!'
      ],
      fun: [
        'The ball is LOOSE! And the {def} fall on it!',
        '{player} coughs it up! {def} ball!',
        'Butterfingers! {player} drops it! {def} pounce!'
      ]
    },
    sack: {
      straight: [
        'Nowhere to go, and {qb} is SACKED! Lost {loss}.',
        'Pressure up the middle! {qb} goes down!',
        'The {def} get home! {qb} sacked for {loss}.'
      ],
      fun: [
        '{qb} goes DOWN! The {def} pass rush gets home!',
        'Nowhere to run for {qb}! That is {loss} gone.',
        'Boom! The {def} flatten {qb} for {loss}!'
      ]
    },
    big_gain: {
      straight: [
        '{player} breaks free! Still going! {yds} yards!',
        '{player} has room to run! {yds} yards!',
        'Big play! {player} for {yds}, the {team} roll!'
      ],
      fun: [
        '{player} takes off! {yds} yards before anybody catches up!',
        'Look at {player} go! That is a {yds} yard chunk!',
        'Big play {team}! {player} rips off {yds}!'
      ]
    },
    first_down: {
      straight: [
        '{player} for {yds}, and that moves the chains.',
        '{player} picks up {yds}. That\'s a first down.',
        '{player} fights forward for {yds}. First down!'
      ],
      fun: [
        '{player} moves the chains! First down!',
        '{yds} yards for {player}, and the sticks move!',
        'Keep it rolling! {player} gets the {team} a fresh set.'
      ]
    },
    gain: {
      straight: [
        '{player} for {yds}.',
        '{player} picks up {yds} on the play.',
        "{player} gets {yds} before the {def} make the tackle."
      ],
      fun: [
        '{player} grinds out {yds}. Every yard counts!',
        'Solid work by {player}, {yds} more yards.',
        '{player} chips away, {yds} yards on that one.'
      ]
    },
    no_gain: {
      straight: [
        '{player} is stuffed at the line! No gain.',
        '{player} has nowhere to go. No gain.',
        '{player} runs into a wall. Nothing there.'
      ],
      fun: [
        'Stuffed! {player} runs into a wall of {def}!',
        'Not today, {player}! The {def} slam the door.',
        '{player} finds nothing but traffic.'
      ]
    },
    incomplete: {
      straight: [
        '{qb} throws for {player}... incomplete.',
        'Intended for {player}, knocked away!',
        '{player} can\'t hang on. Incomplete.'
      ],
      fun: [
        '{qb} fires for {player}... off the fingertips!',
        'That one hits the turf. Nobody home!',
        'Close, but {player} cannot reel it in.'
      ]
    },
    pen_false_start: {
      straight: [
        'Flag before the snap. False start, {team}.',
        'Somebody moved early. False start, {team}.',
        'Whistle. False start on the {team}, {pen} yards.'
      ],
      fun: [
        'Somebody got a little too excited! False start.',
        'Jumpy, jumpy! False start, back {pen} yards.',
        'Flinch! The {team} get flagged early.'
      ]
    },
    pen_holding: {
      straight: [
        'Flag on the play! Holding, {team}. {pen} yards.',
        'Flag. Offensive holding, {pen} yards.',
        'Holding, {team}. That costs them {pen} yards.'
      ],
      fun: [
        'Hands off the jersey! Holding, {team}, {pen} yards.',
        'The ref saw that grab! Holding, back {pen}.',
        'Hugging is not blocking! Holding on the {team}.'
      ]
    },
    pen_offside: {
      straight: [
        'Flag! The {def} jumped. Offside, {pen} yards.',
        'Defense was early! Offside on the {def}.',
        'Offside, {def}. The {team} move up {pen}.'
      ],
      fun: [
        'Too eager, {def}! Offside, {pen} free yards.',
        'The {def} jump the gun! Offside!',
        'Patience, {def}! Offside, {pen} for free.'
      ]
    },
    pen_dpi: {
      straight: [
        'Flag downfield! Pass interference, {def}.',
        'Contact, and a flag! Pass interference, {pen}.',
        'Pass interference! A big gain for the {team}.'
      ],
      fun: [
        'Flag! The {def} were all over the receiver!',
        'You cannot do that, {def}! {pen} yards!',
        'Too much contact! A gift of {pen} yards.'
      ]
    },
    punt: {
      straight: [
        'The {team} punt it away. {net} yards net, {def} ball.',
        'Punt is high and deep, {net} yards. The {def} take over.',
        'Fourth down, and the {team} will punt. A {net} yard boot.'
      ],
      fun: [
        'Big boot! {net} yards, the {def} start over.',
        'Punt team on, and that one flips the field.',
        'Away it goes! A {net} yard punt.'
      ]
    },
    downs: {
      straight: [
        'Fourth down... and they\'re STOPPED! {def} ball!',
        'The {team} come up short on fourth down!',
        'Huge stop by the {def}! Turnover on downs!'
      ],
      fun: [
        'They went for it and... NO! {def} ball!',
        'Fourth down gamble fails! {def} ball!',
        'The {def} defense holds! Turnover on downs!'
      ]
    },
    kneel: {
      straight: [
        "{qb} takes the knee. That's going to do it.",
        'Victory formation. {qb} kneels it down.',
        '{qb} takes a knee and lets the clock run.'
      ],
      fun: [
        'Victory formation! {qb} takes a knee.',
        'Nothing fancy, {qb} kneels it down.',
        'Take a knee, {qb}. Clock is your friend.'
      ]
    },
    half: {
      straight: [
        'That\'ll bring us to halftime. {score}.',
        'Halftime here, and it\'s {score}.',
        'End of the first half. {score}.'
      ],
      fun: [
        'Halftime! Grab a snack, it is {score}.',
        'We take a breather at the half. {score}!',
        'Two quarters down, two to go. {score}!'
      ]
    },
    final: {
      straight: [
        'That\'s the ballgame! {score}!',
        'Final! The {winner} win it, {score}!',
        'It\'s all over! {winner} win, {score}!'
      ],
      fun: [
        'Game over! {winner} take it, {score}!',
        'In the books! {winner} win, {score}!',
        'That will do it! The {winner} get the W!'
      ]
    },
    final_tie: {
      straight: [
        'That\'s the final, a tie. {score}.',
        'It\'s over, and we\'re tied! {score}.',
        'All square at the end. {score}.'
      ],
      fun: [
        'All square at the end! {score}!',
        'Nobody blinks! It\'s a tie, {score}.',
        'A tie! Half a trophy each. {score}.'
      ]
    }
  };

  root.FF_ANNOUNCER_LINES = LINES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LINES;
})(typeof window !== 'undefined' ? window : globalThis);
