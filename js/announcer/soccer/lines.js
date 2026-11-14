// Soccer announcer lines, written the way a British football commentator talks.
// One style, like football: a TV match call.
// At least three variants per kind; index.js deals them so a match does
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
      straight: ['And we\'re under way! {t0} against {t1}.', 'The referee blows, and we\'re off.', 'Here we go. {t0} and {t1}, kick off.']
    },
    kickoff_second: {
      straight: ['We\'re back under way for the second half.', 'The second half is under way.', 'Off we go again. Forty-five minutes left.']
    },
    kickoff_restart: {
      straight: ['{team} get us going again.', 'We restart. {score}.', '{team} kick off again.']
    },
    build: {
      straight: ['{a} to {b}. Lovely stuff.', '{team} keep it, {a} to {b}.', 'Patient build-up, {a} then {b}.']
    },
    regain: {
      straight: ['{team} win it back, {a} on the ball.', 'Turnover. {a} takes it for {team}.', '{a} nicks it, and {team} break.']
    },
    goal: {
      straight: ['{player} shoots... and it\'s IN! Goal, {team}!', 'GOAL! {player} finishes it!', '{player} strikes, and it\'s in! What a finish!']
    },
    goal_assist: {
      straight: ['{assist} finds {player}, and it\'s IN!', 'GOAL! {player}, from {assist}\'s pass!', '{assist} sets it up, {player} puts it away!']
    },
    goal_head: {
      straight: ['{player} rises... and heads it in! GOAL!', 'A header from {player}! It\'s in!', 'GOAL! {player} with the header!']
    },
    goal_pen: {
      straight: ['{player} steps up... and scores!', 'Penalty converted. {player}, cool as you like.', '{player} sends the keeper the wrong way. GOAL!']
    },
    goal_disallowed: {
      straight: ['It\'s in! But the flag is up. Offside, no goal.', '{player} scores... but it\'s ruled out!', 'The flag is up! {player} was offside. No goal.']
    },
    save: {
      straight: ['{player} shoots... saved by {keeper}!', 'Good save from {keeper}! {player} denied.', '{keeper} gets down well to keep it out.']
    },
    save_pen: {
      straight: ['{player} steps up... SAVED! {keeper}!', 'Penalty saved! {keeper} guesses right!', '{keeper} keeps out the penalty!']
    },
    wide: {
      straight: ['{player} shoots... just wide.', '{player} pulls it past the post.', 'Wide from {player}. Goal kick.']
    },
    pen_miss: {
      straight: ['{player} steps up... and it\'s WIDE!', 'Penalty missed! {player} drags it wide.', '{player} misses from the spot!']
    },
    post: {
      straight: ['Off the post! So close from {player}.', '{player} hits the woodwork!', 'It cannons off the post! {player} unlucky.']
    },
    blocked: {
      straight: ['{player} shoots, and it\'s blocked.', 'Blocked! {def} throw bodies in the way.', '{player} has a go, blocked.']
    },
    corner_to: {
      straight: ['Corner to {team}. {player} swings it in.', '{player} delivers the corner for {victim}.', 'In comes the corner from {player}.']
    },
    corner_cleared: {
      straight: ['{player}\'s corner is headed clear.', 'The corner comes to nothing.', 'Cleared! {def} deal with the corner.']
    },
    freekick_to: {
      straight: ['Free kick. {player} finds {victim}.', '{player} chips the free kick to {victim}.', '{player} plays it short from the free kick.']
    },
    freekick_direct: {
      straight: ['Free kick to {team}. {player} stands over it.', '{player} lines up the free kick.', 'Within range. {player} will have a go.']
    },
    foul: {
      straight: ['Foul by {player} on {victim}.', '{player} brings down {victim}. Free kick.', 'The whistle goes. {player} on {victim}.']
    },
    foul_yellow: {
      straight: ['{player} goes into the book. Yellow card.', 'Yellow card for {player}.', 'A booking for {player} for that one.']
    },
    foul_red: {
      straight: ['Red card! {player} is sent off!', '{player} is off! {team} down to ten.', 'Second yellow, so it\'s red for {player}.']
    },
    penalty_given: {
      straight: ['Penalty! {player} brings down {victim}!', 'The referee points to the spot!', 'Penalty to {def}! {victim} is down.']
    },
    offside: {
      straight: ['Flag up. {player} is offside.', '{player} strays offside.', 'Offside against {player}.']
    },
    half: {
      straight: ['That\'s half time. {score}.', 'Half time, then. {score}.', 'Half time here. {score}.']
    },
    final: {
      straight: ['Full time! {winner} win it!', 'It\'s all over! {winner} take the points.', 'The final whistle! {score}.']
    },
    final_draw: {
      straight: ['It ends level. {score}.', 'All square at full time. {score}.', 'Honours even. {score}.']
    }
  };

  root.SC_ANNOUNCER_LINES = LINES;
  if (typeof module !== 'undefined' && module.exports) module.exports = LINES;
})(typeof window !== 'undefined' ? window : globalThis);
