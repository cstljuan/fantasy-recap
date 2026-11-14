// Announcer lines for football. Two styles:
//   straight: what happened and why it matters, in one sentence.
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
        '{player} brings the kick back to the {spot}, and the {team} start their drive there.',
        'The kickoff is returned to the {spot}, so the {team} begin from there.',
        '{player} fields it and gets the {team} out to the {spot}.'
      ],
      fun: [
        'Up it goes, and {player} carries it to the {spot}. Let us play some football!',
        '{player} takes the kick and scoots to the {spot}. The {team} are in business.',
        'Boot is away, {player} grabs it, and we are off from the {spot}!'
      ]
    },
    touchdown_run: {
      straight: [
        '{player} runs it in from {yds} yards for a {team} touchdown, and it is {score}.',
        'Touchdown {team}: {player} scores on a {yds} yard run, making it {score}.',
        '{player} carries it {yds} yards into the end zone, and the {team} add six. {score}.'
      ],
      fun: [
        '{player} is GONE! {yds} yards and a touchdown for the {team}!',
        'Nobody lays a finger on {player}! Six points, {team}!',
        'Hand it to {player} and get out of the way! Touchdown {team}, {score}!'
      ]
    },
    touchdown_pass: {
      straight: [
        '{qb} finds {player} for a {yds} yard touchdown pass, and it is {score}.',
        'Touchdown {team}: {qb} to {player} from {yds} yards out, making it {score}.',
        '{player} catches a {yds} yard scoring pass from {qb}, and the {team} add six. {score}.'
      ],
      fun: [
        '{qb} lets it fly and {player} hauls it in! Touchdown {team}!',
        'Pitch and catch, {qb} to {player}, and that is six for the {team}!',
        'What a throw, what a catch! {player} in the end zone, {score}!'
      ]
    },
    xp_good: {
      straight: [
        'The extra point by {kicker} is good, and it is {score}.',
        '{kicker} converts the extra point. {score}.',
        'Extra point is good, so the {team} have {teamscore}.'
      ],
      fun: [
        '{kicker} makes it look easy. Point after is good!',
        'Right down the middle from {kicker}. Add one more!',
        'Automatic! {kicker} tacks on the extra point.'
      ]
    },
    xp_miss: {
      straight: [
        '{kicker} misses the extra point, so the {team} stay at {teamscore}.',
        'The extra point is no good, and the score stays {score}.',
        'No good on the extra point from {kicker}, and that missing point could matter later.'
      ],
      fun: [
        'Oh no, {kicker}! The easy one gets away!',
        'Doink! {kicker} leaves a point on the field.',
        'That extra point is wide, and {kicker} cannot believe it.'
      ]
    },
    fg_good: {
      straight: [
        '{kicker} makes a {dist} yard field goal, and it is {score}.',
        'The {dist} yard try is good, three points for the {team}. {score}.',
        'Field goal good from {dist} yards by {kicker}, so the {team} have {teamscore}.'
      ],
      fun: [
        '{kicker} from {dist}... it is GOOD! Three points!',
        'Split the uprights! {kicker} drills it from {dist} yards!',
        'Money from {dist}! {kicker} puts three on the board!'
      ]
    },
    fg_miss: {
      straight: [
        '{kicker} misses from {dist} yards, so the {team} come away with nothing and the {def} take over.',
        'The {dist} yard field goal is no good, and the {def} get the ball back.',
        'No good from {dist} yards, so the score stays {score}.'
      ],
      fun: [
        '{kicker} pushes it from {dist}... no good! The {def} breathe again.',
        'Wide! That {dist} yard try sails off the mark.',
        'So close and yet so far. {kicker} misses from {dist}.'
      ]
    },
    interception: {
      straight: [
        '{qb} is intercepted, and the {def} take over.',
        'Interception by the {def}, which ends the {team} drive.',
        'The {def} pick off {qb} and get the ball back.'
      ],
      fun: [
        'PICKED OFF! The {def} jump the route and steal it!',
        '{qb} throws it right to the wrong jersey! {def} ball!',
        'Thief! The {def} snatch it out of the air!'
      ]
    },
    fumble: {
      straight: [
        '{player} fumbles and the {def} recover, so the {team} lose the ball.',
        'Fumble by {player}, recovered by the {def}, a turnover.',
        'The ball comes loose from {player} and the {def} take possession.'
      ],
      fun: [
        'The ball is LOOSE! And the {def} fall on it!',
        '{player} coughs it up! {def} ball!',
        'Butterfingers! {player} drops it and the {def} pounce!'
      ]
    },
    sack: {
      straight: [
        '{qb} is sacked for a loss of {loss}, which puts the {team} behind schedule.',
        'The {def} sack {qb} and push the {team} back {loss} yards.',
        'Sack, a loss of {loss} on the play for the {team}.'
      ],
      fun: [
        '{qb} goes DOWN! The {def} pass rush gets home!',
        'Nowhere to run for {qb}! Sacked, and that is {loss} yards gone.',
        'Boom! The {def} flatten {qb} for a loss of {loss}!'
      ]
    },
    big_gain: {
      straight: [
        '{player} picks up {yds} yards, a big gain that flips the field for the {team}.',
        'A {yds} yard gain by {player} moves the {team} into better field position.',
        '{player} breaks loose for {yds} yards and puts the {team} in a much better spot.'
      ],
      fun: [
        '{player} takes off! {yds} yards before anybody catches up!',
        'Look at {player} go! That is a {yds} yard chunk!',
        'Big play {team}! {player} rips off {yds}!'
      ]
    },
    first_down: {
      straight: [
        '{player} gains {yds} and that is a first down for the {team}.',
        'A {yds} yard play by {player} keeps the drive alive with a new set of downs.',
        '{player} picks up {yds} yards, enough for the first down.'
      ],
      fun: [
        '{player} moves the chains! First down!',
        '{yds} yards for {player}, and the sticks move!',
        'Keep it rolling! {player} gets the {team} a fresh set.'
      ]
    },
    gain: {
      straight: [
        '{player} gains {yds} yards on the play.',
        'A gain of {yds} by {player} sets up the next down.',
        '{player} picks up {yds} for the {team}.'
      ],
      fun: [
        '{player} grinds out {yds}. Every yard counts!',
        'Solid work by {player}, {yds} more yards.',
        '{player} chips away, {yds} yards on that one.'
      ]
    },
    no_gain: {
      straight: [
        '{player} is stopped with no gain, a win for the {def} defense.',
        'The {def} hold {player} at the line of scrimmage.',
        'Nothing doing for {player}, so the {team} face a longer next down.'
      ],
      fun: [
        'Stuffed! {player} runs into a wall of {def}!',
        'Not today, {player}! The {def} slam the door.',
        '{player} finds nothing but traffic.'
      ]
    },
    incomplete: {
      straight: [
        '{qb} throws incomplete for {player}, so the {team} lose a down.',
        'The pass for {player} falls incomplete.',
        'Incomplete, intended for {player}, and the clock stops.'
      ],
      fun: [
        '{qb} fires for {player}... off the fingertips!',
        'That one hits the turf. Nobody home!',
        'Close, but {player} cannot reel it in.'
      ]
    },
    pen_false_start: {
      straight: [
        'False start on the {team}, a {pen} yard penalty before the snap.',
        'The {team} jump early, false start, {pen} yards back.',
        'Flag for a false start, which costs the {team} {pen} yards.'
      ],
      fun: [
        'Somebody on the {team} line got a little too excited! False start.',
        'Jumpy, jumpy! False start, back {pen} yards.',
        'Flinch! The {team} get flagged before the play even starts.'
      ]
    },
    pen_holding: {
      straight: [
        'Holding on the {team} offense, a {pen} yard penalty that sets them back.',
        'Offensive holding, {pen} yards, and the down is replayed.',
        'A holding flag costs the {team} {pen} yards.'
      ],
      fun: [
        'Hands off the jersey! Holding, {team}, {pen} yards.',
        'The ref saw that grab! Holding, back {pen}.',
        'Hugging is not blocking! Holding on the {team}.'
      ]
    },
    pen_offside: {
      straight: [
        'Offside on the {def} defense, {pen} free yards for the {team}.',
        'The {def} jump offside, a {pen} yard penalty in favor of the {team}.',
        'Flag on the {def} for offside, moving the {team} up {pen} yards.'
      ],
      fun: [
        'Too eager, {def}! Offside, and that is a free {pen} yards.',
        'The {def} jump the gun! Offside!',
        'Patience, {def}! Offside gives the {team} {pen} for free.'
      ]
    },
    pen_dpi: {
      straight: [
        'Pass interference on the {def}, which gives the {team} the ball at the spot and a first down.',
        'Defensive pass interference, a {pen} yard penalty and an automatic first down.',
        'The {def} are flagged for pass interference, moving the {team} {pen} yards.'
      ],
      fun: [
        'Flag! The {def} defender was all over the receiver! Pass interference!',
        'You cannot do that, {def}! Interference, {pen} yards!',
        'Too much contact downfield! The {team} get a gift of {pen} yards.'
      ]
    },
    punt: {
      straight: [
        'The {team} punt, a net of {net} yards, and the {def} take over.',
        'A {net} yard punt hands the ball to the {def}.',
        'The {team} punt it away, netting {net} yards.'
      ],
      fun: [
        'Big boot! {net} yards and the {def} have to start over.',
        'Punt team on, and that one flips the field {net} yards.',
        'Away it goes! The {team} give it up with a {net} yard punt.'
      ]
    },
    downs: {
      straight: [
        'The {team} come up short on fourth down, so the {def} take over.',
        'Turnover on downs, and the {def} get the ball.',
        'Stopped on fourth down, the {team} hand the ball to the {def}.'
      ],
      fun: [
        'They went for it and... NO! The {def} stand tall on fourth down!',
        'Fourth down gamble fails! {def} ball!',
        'The {def} defense holds! Turnover on downs!'
      ]
    },
    kneel: {
      straight: [
        '{qb} takes a knee to run down the clock.',
        'The {team} kneel on it.',
        '{qb} kneels, and the {team} are happy to let time run.'
      ],
      fun: [
        'Victory formation! {qb} takes a knee.',
        'Nothing fancy, {qb} kneels it down.',
        'Take a knee, {qb}. Clock is your friend.'
      ]
    },
    half: {
      straight: [
        'That is halftime, and the score is {score}.',
        'At the half it is {score}.',
        'Halftime, with the score at {score}.'
      ],
      fun: [
        'Halftime! Grab a snack, it is {score}.',
        'We take a breather at the half. {score}!',
        'Two quarters down, two to go. {score}!'
      ]
    },
    final: {
      straight: [
        'That is the final: the {winner} win, {score}.',
        'Final score, {score}, a win for the {winner}.',
        'The game is over, and the {winner} beat the {loser}, {score}.'
      ],
      fun: [
        'Game over! The {winner} take it, {score}!',
        'Put it in the books! {winner} win, {score}!',
        'And that will do it! The {winner} get the W over the {loser}!'
      ]
    },
    final_tie: {
      straight: [
        'That is the final, a tie at {score}.',
        'The game ends level, {score}.',
        'Final score {score}, and neither team wins it.'
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
