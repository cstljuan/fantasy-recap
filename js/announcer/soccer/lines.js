// Soccer announcer lines, written the way a British football commentator talks.
// Two styles, like football: straight (the default, a TV match call) and fun.
// At least three variants per kind and style; index.js deals them so a match does
// not repeat a line until every variant has been used. Every line fits on one line of
// the captions strip (56 characters) with the longest names in the data.
//
// Placeholders, filled in by index.js:
//   {team}    the team on the ball (Ironside, Red Harbour; British usage: "Ironside are")
//   {def}     the other team
//   {player}  last name of the player who made the play (shooter, taker, fouler...)
//   {assist}  last name of the player who set up a goal
//   {keeper}  last name of the goalkeeper facing the shot
//   {victim}  last name of the player who was fouled
//   {a} {b}   first and last names in a passing move
//   {min}     the minute, {minth} the same as an ordinal (82nd), {score} the score ("Ironside 2, Red Harbour 1")
//   {t0} {t1} the two teams in order, {winner} {loser} at full time
// The lines are about the match only.
(function (root) {
  'use strict';

  var LINES = {
    kickoff_start: {
      straight: ['And we\'re under way! {t0} against {t1}.', 'The referee blows, and we\'re off.', 'Here we go. {t0} and {t1}, kick off.'],
      fun: ['Here we go! {t0} versus {t1}, game on!', 'And we\'re off! Let\'s have it!', 'Kick off! Settle in, this should be good.']
    },
    kickoff_second: {
      straight: ['We\'re back under way for the second half.', 'The second half is under way.', 'Off we go again. Forty-five minutes left.'],
      fun: ['Round two! Back under way!', 'Second half, here we go!', 'And we\'re back! Forty-five to play!']
    },
    kickoff_restart: {
      straight: ['{team} get us going again.', 'We restart. {score}.', '{team} kick off again.'],
      fun: ['Back to the centre circle. {score}.', 'Restart! {team} need a response.', 'Off we go again. {score}!']
    },
    build: {
      straight: ['{a} to {b}. Lovely stuff.', '{team} keep it, {a} to {b}.', 'Patient build-up, {a} then {b}.'],
      fun: ['Tiki-taka! {a} to {b}!', 'Pass and move! {a} finds {b}!', '{team} are knocking it about nicely!']
    },
    regain: {
      straight: ['{team} win it back, {a} on the ball.', 'Turnover. {a} takes it for {team}.', '{a} nicks it, and {team} break.'],
      fun: ['Pinched it! {a} wins it for {team}!', 'Stolen! {a} and {team} go again!', '{a} reads it and takes it away!']
    },
    goal: {
      straight: ['{player} shoots... and it\'s IN! Goal, {team}!', 'GOAL! {player} finishes it!', '{player} strikes, and it\'s in! What a finish!'],
      fun: ['GET IN! {player} buries it!', 'Back of the net! {player}, take a bow!', 'Oh, {player}! You beauty! GOAL!']
    },
    goal_assist: {
      straight: ['{assist} finds {player}, and it\'s IN!', 'GOAL! {player}, from {assist}\'s pass!', '{assist} sets it up, {player} puts it away!'],
      fun: ['{assist} to {player}... GOAL! Lovely stuff!', 'What a ball from {assist}! {player} scores!', 'One-two, and {player} smashes it home!']
    },
    goal_head: {
      straight: ['{player} rises... and heads it in! GOAL!', 'A header from {player}! It\'s in!', 'GOAL! {player} with the header!'],
      fun: ['Bullet header! {player}! GOAL!', '{player} gets up highest... and it\'s IN!', 'Head and shoulders above! {player} scores!']
    },
    goal_pen: {
      straight: ['{player} steps up... and scores!', 'Penalty converted. {player}, cool as you like.', '{player} sends the keeper the wrong way. GOAL!'],
      fun: ['Ice cold! {player} buries the penalty!', '{player} from the spot... GET IN!', 'No nerves at all! {player} scores!']
    },
    goal_disallowed: {
      straight: ['It\'s in! But the flag is up. Offside, no goal.', '{player} scores... but it\'s ruled out!', 'The flag is up! {player} was offside. No goal.'],
      fun: ['Oh, the flag! Heartbreak for {team}!', 'Wild celebrations... cut short! Offside!', 'Not so fast! The flag says no!']
    },
    save: {
      straight: ['{player} shoots... saved by {keeper}!', 'Good save from {keeper}! {player} denied.', '{keeper} gets down well to keep it out.'],
      fun: ['What a stop! {keeper} says no!', '{keeper} with the gloves of steel!', 'Denied! {keeper} is having none of it!']
    },
    save_pen: {
      straight: ['{player} steps up... SAVED! {keeper}!', 'Penalty saved! {keeper} guesses right!', '{keeper} keeps out the penalty!'],
      fun: ['{keeper} the hero! Penalty SAVED!', 'Saved! {keeper} reads it all the way!', 'No way past! {keeper} stops the penalty!']
    },
    wide: {
      straight: ['{player} shoots... just wide.', '{player} pulls it past the post.', 'Wide from {player}. Goal kick.'],
      fun: ['Row Z! {player} will want that back.', 'Oh, {player}! Into the stands!', 'Close, but no cigar for {player}.']
    },
    pen_miss: {
      straight: ['{player} steps up... and it\'s WIDE!', 'Penalty missed! {player} drags it wide.', '{player} misses from the spot!'],
      fun: ['Oh no! {player} misses the penalty!', 'Agony! {player} puts it wide!', 'The spot kick is wide! {player}!']
    },
    post: {
      straight: ['Off the post! So close from {player}.', '{player} hits the woodwork!', 'It cannons off the post! {player} unlucky.'],
      fun: ['Clang! {player} rattles the post!', 'Off the frame! So, so close!', 'The woodwork saves {def}! {player}!']
    },
    blocked: {
      straight: ['{player} shoots, and it\'s blocked.', 'Blocked! {def} throw bodies in the way.', '{player} has a go, blocked.'],
      fun: ['Brave block from {def}!', 'Blocked! Somebody\'s going to feel that.', 'Charged down! {def} stand firm!']
    },
    corner_to: {
      straight: ['Corner to {team}. {player} swings it in.', '{player} delivers the corner for {victim}.', 'In comes the corner from {player}.'],
      fun: ['Corner! {player} whips it in!', 'Set piece! {player} to {victim}!', 'Here comes the delivery from {player}!']
    },
    corner_cleared: {
      straight: ['{player}\'s corner is headed clear.', 'The corner comes to nothing.', 'Cleared! {def} deal with the corner.'],
      fun: ['Headed away! {def} breathe again.', 'Nope! {def} clear the corner.', 'Corner cleared! Big header from {def}.']
    },
    freekick_to: {
      straight: ['Free kick. {player} finds {victim}.', '{player} chips the free kick to {victim}.', '{player} plays it short from the free kick.'],
      fun: ['Free kick! {player} picks out {victim}!', 'Clever from {player}, short to {victim}!', 'Set piece routine! {player} to {victim}!']
    },
    freekick_direct: {
      straight: ['Free kick to {team}. {player} stands over it.', '{player} lines up the free kick.', 'Within range. {player} will have a go.'],
      fun: ['Ooh, free kick! {player} fancies this!', '{player} over the ball. Any chance?', 'Shooting range! {player} lines it up!']
    },
    foul: {
      straight: ['Foul by {player} on {victim}.', '{player} brings down {victim}. Free kick.', 'The whistle goes. {player} on {victim}.'],
      fun: ['Ouch! {player} clatters {victim}!', '{player} takes a chunk out of {victim}!', 'Late one from {player}!']
    },
    foul_yellow: {
      straight: ['{player} goes into the book. Yellow card.', 'Yellow card for {player}.', 'A booking for {player} for that one.'],
      fun: ['Yellow! {player} is on thin ice now!', 'Into the book goes {player}!', 'The referee reaches for yellow! {player}!']
    },
    foul_red: {
      straight: ['Red card! {player} is sent off!', '{player} is off! {team} down to ten.', 'Second yellow, so it\'s red for {player}.'],
      fun: ['RED! {player} is walking!', 'Off you go, {player}! Red card!', 'Early bath for {player}!']
    },
    penalty_given: {
      straight: ['Penalty! {player} brings down {victim}!', 'The referee points to the spot!', 'Penalty to {def}! {victim} is down.'],
      fun: ['PENALTY! {player} takes out {victim}!', 'It\'s a penalty! Huge moment!', 'Spot kick! {victim} goes down!']
    },
    offside: {
      straight: ['Flag up. {player} is offside.', '{player} strays offside.', 'Offside against {player}.'],
      fun: ['Too keen, {player}! Offside!', 'The flag is up! {player} went early.', 'Offside! Timing, {player}, timing!']
    },
    half: {
      straight: ['That\'s half time. {score}.', 'Half time, then. {score}.', 'Half time here. {score}.'],
      fun: ['Half time! {score}. Cuppa time.', 'Break time! {score}.', 'That\'s the half! {score}.']
    },
    final: {
      straight: ['Full time! {winner} win it!', 'It\'s all over! {winner} take the points.', 'The final whistle! {score}.'],
      fun: ['FULL TIME! {winner} take it!', 'All over! Three points for {winner}!', 'That\'s that! {winner} win!']
    },
    final_draw: {
      straight: ['It ends level. {score}.', 'All square at full time. {score}.', 'Honours even. {score}.'],
      fun: ['A point apiece! {score}.', 'Nobody wins it! {score}.', 'Level at the end! {score}.']
    }
  };

  root.SC_ANNOUNCER_LINES = LINES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LINES;
})(typeof window !== 'undefined' ? window : globalThis);
