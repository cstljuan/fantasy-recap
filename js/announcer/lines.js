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
        "Here's the kick. {player} takes it, finds a seam, and brings it out to the {spot}.",
        'Kick is away. {player} gathers it in and the {team} will start at the {spot}.',
        "High and deep. {player} with the return, and the return ends at the {spot}."
      ],
      fun: [
        'Up it goes, and {player} carries it to the {spot}. Let us play some football!',
        '{player} takes the kick and scoots to the {spot}. The {team} are in business.',
        'Boot is away, {player} grabs it, and we are off from the {spot}!'
      ]
    },
    touchdown_run: {
      straight: [
        "{player} takes the handoff, bounces outside, {yds} yards and into the end zone! Touchdown, {team}! It's {score}.",
        'Handoff {player}, hits the hole, nobody lays a hand on {player}! Touchdown {team}! {score}.',
        "{player} up the middle, breaks one tackle, breaks two, and into the end zone! {yds} yards, touchdown {team}!"
      ],
      fun: [
        '{player} is GONE! {yds} yards and a touchdown for the {team}!',
        'Nobody lays a finger on {player}! Six points, {team}!',
        'Hand it to {player} and get out of the way! Touchdown {team}, {score}!'
      ]
    },
    touchdown_pass: {
      straight: [
        "{qb} drops back, fires, CAUGHT by {player} in the end zone! Touchdown, {team}! It's {score}.",
        "{qb} looking, looking, there's {player} open! {yds} yards, TOUCHDOWN {team}!",
        '{qb} lets it fly, {player} goes up and gets it! Six points! {score}.'
      ],
      fun: [
        '{qb} lets it fly and {player} hauls it in! Touchdown {team}!',
        'Pitch and catch, {qb} to {player}, and that is six for the {team}!',
        'What a throw, what a catch! {player} in the end zone, {score}!'
      ]
    },
    xp_good: {
      straight: [
        "{kicker} adds the extra point. It's {score}.",
        'Extra point is good. {score}.',
        '{kicker} knocks it through. The {team} have {teamscore}.'
      ],
      fun: [
        '{kicker} makes it look easy. Point after is good!',
        'Right down the middle from {kicker}. Add one more!',
        'Automatic! {kicker} tacks on the extra point.'
      ]
    },
    xp_miss: {
      straight: [
        "Oh, {kicker} pushes the extra point! It's no good! The {team} stay at {teamscore}.",
        'Extra point... is NO good! That could come back to haunt them.',
        '{kicker} misses the extra point! Score stays {score}.'
      ],
      fun: [
        'Oh no, {kicker}! The easy one gets away!',
        'Doink! {kicker} leaves a point on the field.',
        'That extra point is wide, and {kicker} cannot believe it.'
      ]
    },
    fg_good: {
      straight: [
        "{kicker} from {dist} yards. The kick is up... and it's GOOD! It's {score}.",
        '{dist} yard attempt for {kicker}. Right down the middle! Three points, {team}.',
        'Snap, hold, kick. {kicker} from {dist}... GOOD! The {team} have {teamscore}.'
      ],
      fun: [
        '{kicker} from {dist}... it is GOOD! Three points!',
        'Split the uprights! {kicker} drills it from {dist} yards!',
        'Money from {dist}! {kicker} puts three on the board!'
      ]
    },
    fg_miss: {
      straight: [
        "{kicker} from {dist} yards... it's wide! No good! The {def} take over.",
        "The {dist} yard try is up... and it's NO good! The {team} come away empty.",
        '{kicker} hooks it! From {dist}, no good! Still {score}.'
      ],
      fun: [
        '{kicker} pushes it from {dist}... no good! The {def} breathe again.',
        'Wide! That {dist} yard try sails off the mark.',
        'So close and yet so far. {kicker} misses from {dist}.'
      ]
    },
    interception: {
      straight: [
        '{qb} throws... INTERCEPTED! The {def} pick it off!',
        "{qb} under pressure, forces it, and it's PICKED! {def} ball!",
        "Pass is up... and it's caught by the defense! Interception, {def}!"
      ],
      fun: [
        'PICKED OFF! The {def} jump the route and steal it!',
        '{qb} throws it right to the wrong jersey! {def} ball!',
        'Thief! The {def} snatch it out of the air!'
      ]
    },
    fumble: {
      straight: [
        '{player} fights for extra yards and the ball comes out! FUMBLE! The {def} recover!',
        "{player} gets hit, it's loose, it's LOOSE! And the {def} have it!",
        'Fumble! {player} coughs it up and the {def} fall on it!'
      ],
      fun: [
        'The ball is LOOSE! And the {def} fall on it!',
        '{player} coughs it up! {def} ball!',
        'Butterfingers! {player} drops it and the {def} pounce!'
      ]
    },
    sack: {
      straight: [
        "{qb} drops back, nowhere to go, and {qb} is SACKED! A loss of {loss}.",
        'Pressure up the middle! {qb} goes down! Sacked for {loss}!',
        'The {def} get home! {qb} is buried, {loss} yards lost.'
      ],
      fun: [
        '{qb} goes DOWN! The {def} pass rush gets home!',
        'Nowhere to run for {qb}! Sacked, and that is {loss} yards gone.',
        'Boom! The {def} flatten {qb} for a loss of {loss}!'
      ]
    },
    big_gain: {
      straight: [
        "{player} breaks free! Past midfield, still going! A {yds} yard gain!",
        '{player} has room to run! {yds} yards before the {def} finally make the stop!',
        'Big play! {player} for {yds} yards and the {team} are rolling!'
      ],
      fun: [
        '{player} takes off! {yds} yards before anybody catches up!',
        'Look at {player} go! That is a {yds} yard chunk!',
        'Big play {team}! {player} rips off {yds}!'
      ]
    },
    first_down: {
      straight: [
        "{player} for {yds}, and that'll move the chains. First down, {team}.",
        "{player} picks up {yds}. That's a first down.",
        '{player} fights forward for {yds}. Moves the sticks!'
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
        '{player} has nowhere to go. The {def} stop {player} cold.',
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
        'Pass intended for {player}, knocked away! Incomplete.',
        "{qb} fires for {player}, can't hang on. Incomplete."
      ],
      fun: [
        '{qb} fires for {player}... off the fingertips!',
        'That one hits the turf. Nobody home!',
        'Close, but {player} cannot reel it in.'
      ]
    },
    pen_false_start: {
      straight: [
        'Flag before the snap. False start, {team}. Five yards.',
        'Somebody moved early. False start on the {team}, back {pen}.',
        'Whistle. False start on the {team} offense, {pen} yards.'
      ],
      fun: [
        'Somebody on the {team} line got a little too excited! False start.',
        'Jumpy, jumpy! False start, back {pen} yards.',
        'Flinch! The {team} get flagged before the play even starts.'
      ]
    },
    pen_holding: {
      straight: [
        'Flag on the play! Holding, {team} offense. {pen} yards.',
        "And there's a flag. Offensive holding, {pen} yards, replay the down.",
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
        'Flag! The {def} jumped. Offside, {pen} free yards for the {team}.',
        'Defense was early! Offside on the {def}, {pen} yards.',
        'Offside, {def} defense. The {team} move up {pen}.'
      ],
      fun: [
        'Too eager, {def}! Offside, and that is a free {pen} yards.',
        'The {def} jump the gun! Offside!',
        'Patience, {def}! Offside gives the {team} {pen} for free.'
      ]
    },
    pen_dpi: {
      straight: [
        'Flag downfield! Pass interference on the {def}. Ball at the spot, first down {team}.',
        "There's contact, and there's a flag! Defensive pass interference, {pen} yards.",
        "Pass interference! That's a big gain for the {team} without a catch."
      ],
      fun: [
        'Flag! The {def} defender was all over the receiver! Pass interference!',
        'You cannot do that, {def}! Interference, {pen} yards!',
        'Too much contact downfield! The {team} get a gift of {pen} yards.'
      ]
    },
    punt: {
      straight: [
        'The {team} punt it away. {net} yards net, {def} ball.',
        'Punt is high and deep, {net} yards. The {def} take over.',
        'Fourth down, and the {team} will punt. A {net} yard boot.'
      ],
      fun: [
        'Big boot! {net} yards and the {def} have to start over.',
        'Punt team on, and that one flips the field {net} yards.',
        'Away it goes! The {team} give it up with a {net} yard punt.'
      ]
    },
    downs: {
      straight: [
        "Fourth down, they go for it... and they're STOPPED! Turnover on downs!",
        'The {team} roll the dice on fourth down and come up short! {def} ball!',
        'Huge stop by the {def} defense! Turnover on downs!'
      ],
      fun: [
        'They went for it and... NO! The {def} stand tall on fourth down!',
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
        "And that'll bring us to halftime. {score}.",
        "Halftime here, and it's {score}.",
        "That's the end of the first half. {score}."
      ],
      fun: [
        'Halftime! Grab a snack, it is {score}.',
        'We take a breather at the half. {score}!',
        'Two quarters down, two to go. {score}!'
      ]
    },
    final: {
      straight: [
        'And that is the ballgame! The {winner} win it, {score}!',
        'Final whistle! The {winner} beat the {loser}, {score}!',
        "It's all over! {winner} win, {score}!"
      ],
      fun: [
        'Game over! The {winner} take it, {score}!',
        'Put it in the books! {winner} win, {score}!',
        'And that will do it! The {winner} get the W over the {loser}!'
      ]
    },
    final_tie: {
      straight: [
        "That's the final, and nobody wins this one. {score}.",
        "It's over, and we're tied! {score}.",
        'All square at the end. {score}.'
      ],
      fun: [
        'All square at the end! {score}!',
        'Nobody blinks! It ends in a tie, {score}.',
        'A tie! Everybody gets half a trophy. {score}.'
      ]
    }
  };

  root.FF_ANNOUNCER_LINES = LINES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LINES;
})(typeof window !== 'undefined' ? window : globalThis);
