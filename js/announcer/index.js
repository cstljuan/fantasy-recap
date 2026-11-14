// The announcer. Sets window.FF_ANNOUNCER as docs/CONTRACT.md section 3 says:
//   line(res, ctx)  the sentence for a finished play, or '' to stay quiet.
//                   res is the object the `result` event carries (from js/rules.js).
//                   ctx is { teams, score, style }. score and style are optional:
//                   score falls back to res.post.score, style to the current style.
//                   For halftime and the final there is no play result, so pass
//                   { kind: 'half' } or { kind: 'final' } as res, with ctx.score set.
//   speak(text)     says it with the browser's speech voice; does nothing without one.
//                   Lines wait their turn instead of cutting each other off. A line more
//                   than two plays old by the time its turn comes is dropped. Silent when
//                   window.__ff.speed is above 2.
//   voices()        which browser voice is used: { straight, available }.
//   setStyle(name)  kept for the code that calls it; there is one style, 'straight', and style
//                   always reads 'straight'.
//   reset()         starts a new game: every line becomes available again.
//   onLine(fn)      fn(text, kind, style) is called for every line produced, spoken or not.
//                   Returns a function that removes the listener.
//   ctx.profiles    optional: the data/profiles/<team>.json objects, as { GOB: {...}, PYT: {...} }
//                   or an array. When a play matches a player's tendency (number 0.7 or more)
//                   or goes against it (0.3 or less), line() adds one short sentence. Keys: deep_ball,
//                   short_pass, scramble, run_share, target_share, catch_rate, pass_catching,
//                   red_zone_use, kicker_range. Only
//                   tendencies with a real number count; null is never guessed. The same
//                   player and tendency is mentioned at most once every 6 plays.
//                   Hot and cold (C16): when the profile also has the player's recent form for that
//                   tendency (players.<slot>.form.tendencies.<key>, or players.<slot>.form.<key>)
//                   and it is 0.15 or more above the season number, the remark says the player has
//                   been hot lately; 0.15 or more below, cold. Once per player and tendency every
//                   8 plays, real numbers only, and only when the whole line fits maxLength.
//   memory()        what the announcer remembers about the game so far (see C11 below).
//                   line() uses it for setups and payoffs: a team that needs an answer and
//                   then answers, a red zone trip and whether it scored, a player closing in
//                   on 100 yards and then passing it, a third catch on one drive, a kicker's
//                   second make, a lead change. At most one such line every 2 plays (every 4
//                   for setups); a lead change or an answered score is always called.
//   catchUp(results, ctx)
//                   after FF_GAME.seek skipped plays: one or two short sentences on what was missed
//                   (the scores and the new score, then a turnover or the biggest gain), at most
//                   maxLength characters so it fits the captions strip, or '' when nothing was skipped. results are the skipped plays' result objects in order; ctx is what
//                   line() takes, plus optional leaders and hidden (no fantasy points while hidden,
//                   like halftime). It also adds those plays to the announcer's memory. After a seek
//                   backwards, call reset() first and pass every play from the start.
//   bigCall(res, ctx)
//                   two or three sentences for a top play: a touchdown, a turnover (interception,
//                   fumble, downs) or a gain of 20 yards or more; '' for any other play. Names the
//                   player and the distance, says what it did to the score, and adds one fact from
//                   the announcer's memory. ctx is what line() takes; ctx.hidden true keeps fantasy
//                   points out. It reads the memory and does not change it: call it after line()
//                   for the same play, or after the game.
//   preview(matchup, ctx)
//                   the pre-game show: up to four sentences from what is known before kickoff only.
//                   matchup is one of data/league.json's matchups ({ teams: [{ id, full }, ...] });
//                   ctx is { league, profiles, style }: league is data/league.json (records and
//                   standings), profiles is { <team id>: data/profiles/<id>.json } (recent form and
//                   tendencies). Says each team's record and place, the player most up and most
//                   down in recent form (0.10 or more off the season), and one tendency to watch.
//                   Nothing from the game file, no score. '' when there is nothing true to say.
//   recap(story, ctx)
//                   the spoken recap after the reveal: four to six sentences read from Ricky's story
//                   data (server/story.js, FR_STORY.fromGame) only: the final, when the winner went
//                   ahead for good, the lead changes, the longest drive, the biggest fantasy swing and
//                   each team's best fantasy player. ctx is { teams, style, hidden }; '' while hidden
//                   or without a story. Goes to onLine (kind 'recap') like every line.
//   spoken(text)
//                   the form of a line a voice reads (C27): team codes and yard lines as words ("the
//                   Pythons 21"), downs ("second and ten"), scores ("17 to 14"), clock times, Q1, TD,
//                   FG, pts, ordinals, names (St., Ja'Marr, initials) and shouting capitals turned
//                   into plain words. speak() uses it; captions keep the written line.
//   explain(kind)   one or two plain sentences on a football rule for someone who has never
//                   watched, for the app's rule cards; '' for an unknown kind. explainKinds lists
//                   the kinds; explainFor(res) gives the kinds a finished play shows.
//   transcript()    every line said in this game so far: [ { t, text, kind, play } ], t is
//                   Date.now() when it was said. reset() empties it.
//   maxLength       the longest a play line may be (characters): what fits on one line of the
//                   captions strip at 375 pixels wide. Tendency remarks are only added when the
//                   whole line still fits. intro, halftime and wrap are longer on purpose.
//   intro(ctx), halftime(ctx), wrap(ctx)
//                   two or three sentences each, built from numbers only. ctx.hidden = true
//                   (the manager opted in to hidden scores) keeps fantasy points out of halftime. ctx is what
//                   line() takes plus leaders ([{ name, points }], best first or not) and
//                   plays (the play results so far, as the result event carries them).
//   caption()       the last line: { text, kind, style, at } (at is Date.now() when it was made),
//                   or null before the first line.
// Needs js/announcer/lines.js loaded first (in Node it is required directly).
(function (root) {
  'use strict';

  var LINES = root.FF_ANNOUNCER_LINES ||
    (typeof require === 'function' ? require('./lines.js') : null) || {};
  var STYLES = ['straight'];   // one style; the 'fun' style was removed (Noah's call)
  // The short pieces the code puts together itself.
  var MSG = {
    yards1: '{n} yard', yardsN: '{n} yards', points1: '{n} point', pointsN: '{n} points',
    how_td: 'Touchdown', how_fg: 'Field goal', how_xp: 'Extra point',
    what_int: 'Intercepted', what_fumble: 'Fumble', what_fg: 'No good', what_downs: 'Stopped on fourth down', what_punt: 'They punt',
    cu_changed: '{n} plays: {what}, {sc}', cu_now: '{lead}, now {sc}', cu_still: '{lead}, still {sc}',
    cu_lead_on: '{n} plays on', cu_sc: '{a} to {b}',
    td1: '{team} TD', tdN: '{n} {team} TDs', fg1: '{team} FG', fgN: '{n} {team} FGs',
    cu_pick: '{qb} threw a pick', cu_fumble: '{name} fumbled', cu_downs: 'the {team} lost it on downs',
    cu_big: 'Big gain: {name}, {yds}', cu_leader: '{name}: {pts} fantasy pts',
    big_tie: 'That ties it at {n}.', big_lead: 'That makes it {score}, and the {team} lead by {d}.', big_take: 'The {def} take over, and it\'s still {score}.',
    big_rz: 'That puts the {team} in the red zone.', big_terr: 'That puts the {team} in {def} territory.', big_flip: 'That flips the field for the {team}.',
    fact_td2: 'That\'s a second touchdown today for {name}.', fact_td3: 'That\'s a third touchdown today for {name}.', fact_tdN: 'That\'s another touchdown today for {name}.',
    fact_rec: '{name} is up to {n} receiving yards today.', fact_rush: '{name} is up to {n} rushing yards today.',
    fact_catch: 'That\'s catch number {n} for {name}.', fact_leads: 'This game has already seen {n} lead changes.',
    fact_drives: 'That\'s {n} scoring drives for the {team}.', fact_fp: 'That play is worth {pts} fantasy points to {name}.',
    story_square: 'All square at the break.', story_lead: 'The {team} lead by {d}.', story_hold: 'the {team} defense holding on',
    dec_pass: '{a} to {b} for {n}', dec_run: 'the {n} yard run by {a}'
  };
  function M(key, v) {
    return fill(MSG[key] || '', v || {});
  }
  var decks = {};   // kind + style -> variants not used yet in this game
  var lastUsed = {}; // kind + style -> last variant index, so a reshuffle never repeats right away
  var rand = null;      // a test can set its own random source with _setRandom
  var rounds = {};      // how many times each deck has been shuffled this game
  var seedBase = 1;
  var listeners = [];
  var playNo = 0;       // counts play results, so queued speech can tell how old it is
  var queue = [];       // { text, play, style } waiting to be spoken
  var speaking = null;  // the line being spoken now
  var speakTimer = 0;
  var MAX_AGE = 2;      // plays

  var VOICE_SET = { straight: { rate: 1.08, pitch: 1.0 } };
  var chosen = { straight: null };

  function synth() { return root.speechSynthesis && root.SpeechSynthesisUtterance ? root.speechSynthesis : null; }

  // Score a browser voice: English first, US or UK English next, then the voices that
  // usually sound best (network or enhanced voices), local voices as a tie breaker.
  function voiceScore(v, style) {
    var lang = String(v.lang || '').toLowerCase().replace('_', '-'), name = String(v.name || '');
    if (lang.indexOf('en') !== 0) return -1;
    var sc = 10;
    if (lang === 'en-us') sc += 4; else if (lang === 'en-gb') sc += 3;
    if (/natural|neural|premium|enhanced|online/i.test(name)) sc += 6;
    if (/google/i.test(name)) sc += 4;
    if (/(daniel|alex|aaron|guy|davis|tony|ryan|george|fred)\b/i.test(name)) sc += 2;
    if (/(samantha|karen|moira|aria|jenny)\b/i.test(name)) sc += 1;
    if (/compact|eloquence|whisper|bad news|bells|boing|bubbles|cellos|zarvox|trinoids|organ|jester|superstar/i.test(name)) sc -= 20;
    if (v.localService) sc += 1;
    return sc;
  }

  function chooseVoices() {
    var sy = synth(), list = [];
    try { list = sy && sy.getVoices ? sy.getVoices() || [] : []; } catch (err) { list = []; }
    STYLES.forEach(function (style) {
      var best = null, bestSc = -1;
      list.forEach(function (v) { var sc = voiceScore(v, style); if (sc > bestSc) { best = v; bestSc = sc; } });
      chosen[style] = best;
    });
    return list.length;
  }

  function tooFast() { var ff = root.__ff; return !!(ff && +ff.speed > 2); }
  // Quiet while the game view is closed, even if the game cancels speech without hush().
  function offScreen() { var g = root.FF_GAME; return !!(g && g.active === false); }

  function speakNext() {
    var sy = synth();
    clearTimeout(speakTimer); speaking = null;
    if (!sy || tooFast() || offScreen()) { queue.length = 0; return; }
    while (queue.length && playNo - queue[0].play > MAX_AGE) queue.shift();
    var item = queue.shift();
    if (!item) return;
    if (!chosen.straight) chooseVoices();
    try {
      var u = new root.SpeechSynthesisUtterance(spoken(item.text)), set = VOICE_SET[item.style] || VOICE_SET.straight;
      if (chosen[item.style]) { u.voice = chosen[item.style]; u.lang = chosen[item.style].lang; }
      u.rate = set.rate; u.pitch = set.pitch;
      var done = function () { if (speaking === item) speakNext(); };
      u.onend = done; u.onerror = done;
      speaking = item;
      sy.speak(u);
      // Some browsers never send onend. Move on after a generous estimate.
      var words = item.text.split(/\s+/).length;
      speakTimer = setTimeout(done, Math.round(words / (2.6 * set.rate) * 1000) + 2500);
    } catch (err) { speaking = null; }
  }

  if (synth() && 'onvoiceschanged' in root.speechSynthesis) {
    try { root.speechSynthesis.addEventListener('voiceschanged', chooseVoices); } catch (err) { /* optional */ }
  }
  var last = null;    // the last caption

  var said = [];   // the transcript of this game

  function announce(text, kind, style) {
    last = { text: text, kind: kind, style: style, at: Date.now() };
    said.push({ t: last.at, text: text, kind: kind, play: playNo });
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](text, kind, style); } catch (err) { /* a listener must never stop the game */ }
    }
  }

  function lastName(name) { return String(name || '').split(' ').pop(); }

  // Pick a variant without repeating until all have been said.
  // Tendency remarks, added after a play line when a profile number backs them.
  var TENDENCY = {
    deep_ball: {
      high: ['{name} loves the deep ball.', 'That is what {name} does best, take the top off the defense.', 'Classic {name}, looking deep.'],
      low: ['Not often {name} takes a shot like that.', 'A rare deep one for {name}.', 'You do not see {name} go deep very often.']
    },
    short_pass: {
      high: ['Quick and short, the way {name} likes it.', 'That is {name}, taking the easy completion.', 'Bread and butter for {name}.'],
      low: ['A short one, not the usual for {name}.', 'Not often {name} settles for that.', 'Unusual to see {name} check it down.']
    },
    scramble: {
      high: ['{name} on the move again, a favorite trick.', 'Nobody extends a play like {name}.', 'That is what {name} does, takes off and runs.'],
      low: ['{name} running it, you do not see that often.', 'A rare run from {name}.', '{name} taking off, not something {name} usually does.']
    },
    run_share: {
      high: ['The offense runs through {name}.', 'They keep feeding {name}.', '{name} is the engine of this ground game.'],
      low: ['A carry for {name}, not a usual sight.', 'Rare to see {name} with the ball on the ground.', '{name} does not get many of these.']
    },
    target_share: {
      high: ['{name} is the favorite target.', 'Where else would the ball go? {name}.', 'The go-to target, {name}.'],
      low: ['Not often the ball goes to {name}.', 'A rare target for {name}.', '{name} does not see many of those.']
    },
    red_zone_use: {
      high: ['Down close, they look for {name}.', '{name} is the red zone weapon.', 'Inside the twenty, it is {name} time.'],
      low: ['A surprise choice near the goal line, {name}.', 'Not usually {name} down here.', '{name} in the red zone, that is new.']
    },
    catch_rate: {
      high: ['Sure hands from {name}.', '{name} catches everything.', '{name} rarely drops one.'],
      low: ['Good hands there from {name}.', '{name} holds on this time.', 'A nice grab by {name}.']
    },
    pass_catching: {
      high: ['{name} is a real threat out of the backfield.', 'They love throwing to {name}.', '{name} catches it like a receiver.'],
      low: ['A rare catch for {name}.', 'Not often {name} gets a pass.', '{name} with a catch, unusual.']
    },
    kicker_range: {
      high: ['From that distance, {name} is as good as anyone.', '{name} has the leg for it.', 'Long range is no problem for {name}.'],
      low: ['That is a long way for {name}.', 'Testing {name}\'s range there.', 'Not a usual distance for {name}.']
    }
  };
  var tendencySaid = {};   // "team|slot|key" -> play number when it was last said
  var TENDENCY_GAP = 6;
  var FORM = {
    hot: ['{name} has been hot lately.', '{name} is on a roll lately.', 'Hot streak for {name}.'],
    cold: ['{name} needed that one.', '{name} has been quiet lately.', 'Rare lately from {name}.']
  };
  var FORM_TABLE = { hot: { form: FORM.hot }, cold: { form: FORM.cold } };
  var formSaid = {}, FORM_GAP = 8, FORM_DIFF = 0.15;

  function formValue(profile, slot, key) {
    var p = profile && profile.players && profile.players[slot], f = p && p.form;
    if (!f) return null;
    var v = f.tendencies && typeof f.tendencies === 'object' ? f.tendencies[key] : f[key];
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1 ? v : null;
  }

  function profileFor(profiles, team) {
    if (!profiles) return null;
    if (Array.isArray(profiles)) {
      for (var i = 0; i < profiles.length; i++) if (profiles[i] && profiles[i].team === team.id) return profiles[i];
      return null;
    }
    return profiles[team.id] || null;
  }

  function tendencyValue(profile, slot, key) {
    var p = profile && profile.players && profile.players[slot];
    var v = p && p.tendencies ? p.tendencies[key] : null;
    return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1 ? v : null;
  }

  // The (slot, key) pairs a play speaks to, most interesting first.
  function tendencyTopics(res) {
    var e = res.e || {}, t = [];
    var redZone = res.pre && res.pre.ballOn >= 80;
    if (e.t === 'pass') {
      if (redZone || res.td) t.push([e.to, 'red_zone_use']);
      if (e.yds >= 20) { t.push(['QB', 'deep_ball']); t.push([e.to, 'deep_ball']); }
      else if (e.yds < 10) t.push(['QB', 'short_pass']);
      t.push([e.to, e.to === 'RB' ? 'pass_catching' : 'catch_rate']);
      t.push([e.to, 'target_share']);
    } else if (e.t === 'inc') {
      t.push([e.to, 'target_share']);
    } else if (e.t === 'run') {
      if (e.by === 'QB') t.push(['QB', 'scramble']);
      if (redZone || res.td) t.push([e.by, 'red_zone_use']);
      t.push([e.by, 'run_share']);
    } else if (e.t === 'fg' && res.fgDist >= 45) {
      t.push(['K', 'kicker_range']);
    }
    return t;
  }

  // room: how many characters the note may use so the whole line still fits maxLength.
  function tendencyNote(res, teams, profiles, room) {
    if (room == null) room = Infinity;
    if (!profiles || !res || !res.e || !res.pre) return '';
    var off = res.pre.poss;
    if (off !== 0 && off !== 1) return '';
    var team = teams[off], profile = profileFor(profiles, team);
    if (!profile) return '';
    var topics = tendencyTopics(res);
    // Hot or cold first: recent form clearly above or below the season.
    for (var h = 0; h < topics.length; h++) {
      var fs = topics[h][0], fk = topics[h][1];
      if (!fs) continue;
      var season = tendencyValue(profile, fs, fk), recent = formValue(profile, fs, fk);
      if (season === null || recent === null || Math.abs(recent - season) < FORM_DIFF) continue;
      var fid = team.id + '|' + fs + '|' + fk;
      if (formSaid[fid] != null && playNo - formSaid[fid] < FORM_GAP) continue;
      var fwho = (profile.players[fs] && profile.players[fs].name) || (team.roster || {})[fs] || '';
      if (!fwho) continue;
      var fnote = fill(pick(recent > season ? 'hot' : 'cold', 'form', FORM_TABLE), { name: lastName(fwho) });
      if (fnote.length > room) continue;
      formSaid[fid] = playNo;
      return fnote;
    }
    for (var i = 0; i < topics.length; i++) {
      var slot = topics[i][0], key = topics[i][1];
      if (!slot || !TENDENCY[key]) continue;
      var v = tendencyValue(profile, slot, key);
      if (v === null || (v > 0.3 && v < 0.7)) continue;
      var id = team.id + '|' + slot + '|' + key;
      if (tendencySaid[id] != null && playNo - tendencySaid[id] < TENDENCY_GAP) continue;
      var who = (profile.players[slot] && profile.players[slot].name) || (team.roster || {})[slot] || '';
      if (!who) continue;
      var note = fill(pick(key, v >= 0.7 ? 'high' : 'low', TENDENCY), { name: lastName(who) });
      if (note.length > room) continue;
      tendencySaid[id] = playNo;
      return note;
    }
    return '';
  }

  // ---- C11: commentary that remembers the game ----
  // Each line replaces the ordinary line for that play, so it still says what happened.
  var MEMORY = {
    lead_change: {
      straight: ['{how} {team}, and they take the lead!', '{how}! The lead changes hands. {team} in front.', '{how}, and the {team} are back in front!']
    },
    go_ahead: {
      straight: ['{how}, and the {team} go ahead!', '{how} {team}. They break the tie.', '{how}! The {team} lead it now.']
    },
    answer: {
      straight: ['{how}, and the {team} answer right back!', 'The {team} answer! {how}. {score}.', 'Right back at them! {how}, {team}.']
    },
    rz_empty: {
      straight: ['{what}! A red zone trip with no points.', '{what}! The {team} come away empty.', '{what}! No points from the red zone.']
    },
    kicker_again: {
      straight: ['{kicker} from {dist}, good! {made} for {att} today.', 'Good again! {kicker} is {made} for {att}.', '{kicker} does it again from {dist}! {made} for {att}.']
    },
    hundred: {
      straight: ['{player} for {yards}, and that\'s 100 yards today.', '{player} again! Over 100 yards for the day.', '{player} for {yards}. That\'s {total} on the day.']
    },
    third_catch: {
      straight: ['{player} again! Third catch on this drive.', '{qb} keeps going to {player}. That\'s three.', '{player} for {yards}, a third catch this drive.']
    },
    need_answer: {
      straight: ['The {team} need an answer. {player} to the {spot}.', 'Down {diff}, the {team} need a response.', 'Your move, {team}. {player} brings it out.']
    },
    rz_enter: {
      straight: ['{player} for {yards}. {team} in the red zone!', 'Inside the twenty now! {player} for {yards}.', '{player} gets the {team} inside the twenty.']
    },
    near_hundred: {
      straight: ['{player} for {yards}. That\'s {total} yards today.', '{player} again, up to {total} yards on the day.', '{player} is at {total} yards now.']
    }
  };
  var PAYOFF = ['lead_change', 'go_ahead', 'answer', 'rz_empty', 'kicker_again', 'hundred', 'third_catch'];
  var SETUP = ['need_answer', 'rz_enter', 'near_hundred'];
  var MEM_GAP = 2, SETUP_GAP = 4;

  function freshMemory() {
    return { lastPoss: -1, drive: null, players: {}, kick: [{ made: 0, att: 0 }, { made: 0, att: 0 }],
      lastScoreTeam: -1, lastRemark: -99, nearSaid: {}, leadChanges: 0, scoringDrives: [0, 0], log: [] };
  }
  var mem = freshMemory();

  function playsSinceScore() {
    var n = 0;
    for (var i = mem.log.length - 1; i > 0; i--) {
      var a = mem.log[i].score, b = mem.log[i - 1].score;
      if (a[0] !== b[0] || a[1] !== b[1]) return n;
      n++;
    }
    return n;
  }
  function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
  function playerRec(team, slot) {
    var k = team + '|' + slot;
    return mem.players[k] || (mem.players[k] = { team: team, slot: slot, rec: 0, recYds: 0, rushYds: 0, td: 0 });
  }

  // Update the record with one play and return the remark kinds this play earns, best first.
  function remember(res) {
    var e = res.e || {}, out = [];
    if (!res.pre || !res.post) return out;
    var off = e.t === 'kickoff' ? res.post.poss : res.pre.poss;
    if (off !== 0 && off !== 1) return out;
    if (e.t === 'kickoff' || off !== mem.lastPoss || !mem.drive) mem.drive = { team: off, catches: {}, redZone: false, scored: false };
    mem.lastPoss = res.post.poss;
    var d = mem.drive, pre = res.pre.score, post = res.post.score, v = {};
    var sc = post[0] > pre[0] ? 0 : post[1] > pre[1] ? 1 : -1;

    // Players: catches, yards, touchdowns.
    var p = null, before = 0, after = 0;
    if (e.t === 'pass') {
      p = playerRec(off, e.to); before = Math.max(p.recYds, p.rushYds);
      p.rec++; p.recYds += e.yds; d.catches[e.to] = (d.catches[e.to] || 0) + 1;
    } else if (e.t === 'run' || e.t === 'fumble') {
      p = playerRec(off, e.by); before = Math.max(p.recYds, p.rushYds); p.rushYds += e.yds;
    }
    if (p) { after = Math.max(p.recYds, p.rushYds); if (res.td) p.td++; v.total = after; }

    // Kicker.
    if (e.t === 'fg') { mem.kick[off].att++; if (e.good) mem.kick[off].made++; v.made = mem.kick[off].made; v.att = mem.kick[off].att; }

    // Scores, lead changes and answers (touchdowns, field goals, extra points).
    if (sc >= 0) {
      v.how = M(res.td ? 'how_td' : e.t === 'fg' ? 'how_fg' : 'how_xp');
      var leadBefore = sign(pre[0] - pre[1]), leadAfter = sign(post[0] - post[1]), mine = sc === 0 ? 1 : -1;
      // Taking the lead from behind is a lead change; breaking a tie is going ahead. The game's
      // first score is neither.
      if (leadAfter === mine && leadBefore === -mine) { out.push('lead_change'); mem.leadChanges++; }
      else if (leadAfter === mine && leadBefore === 0 && (pre[0] + pre[1]) > 0) out.push('go_ahead');
      if (res.td || e.t === 'fg') {
        if (mem.lastScoreTeam === 1 - sc) out.push('answer');
        mem.lastScoreTeam = sc; d.scored = true; mem.scoringDrives[sc]++;
      }
    }

    // Red zone: the first time a drive gets inside the twenty, and a trip that ends empty.
    var stays = !res.flip && !res.td && res.post.poss === off;
    if (stays && res.pre.ballOn < 80 && res.post.ballOn >= 80 && !d.redZone && e.t !== 'pen') out.push('rz_enter');
    if (stays && res.post.ballOn >= 80) d.redZone = true;
    var endsEmpty = e.t === 'int' || e.t === 'fumble' || e.t === 'punt' || (e.t === 'fg' && !e.good) || res.downs;
    if (endsEmpty && (d.redZone || res.pre.ballOn >= 80) && !d.scored) {
      out.push('rz_empty');
      v.what = M(e.t === 'int' ? 'what_int' : e.t === 'fumble' ? 'what_fumble' : e.t === 'fg' ? 'what_fg' : res.downs ? 'what_downs' : 'what_punt');
    }

    if (e.t === 'fg' && e.good && mem.kick[off].made >= 2) out.push('kicker_again');
    // Player remarks only on plays that score nothing, so a touchdown is always called as one.
    if (sc < 0) {
      if (p && before < 100 && after >= 100) out.push('hundred');
      if (e.t === 'pass' && d.catches[e.to] === 3) out.push('third_catch');
      if (p && after >= 75 && after < 100 && !mem.nearSaid[off + '|' + (e.to || e.by)]) out.push('near_hundred');
    }

    // A kickoff to a team that just gave up a score and trails.
    if (e.t === 'kickoff' && mem.lastScoreTeam === 1 - off && post[off] < post[1 - off]) { out.push('need_answer'); v.diff = post[1 - off] - post[off]; }

    mem.log.push({ play: playNo, t: e.t, team: off, score: post.slice(), earned: out.slice() });
    return { kinds: out, v: v, team: off, p: p, slot: e.to || e.by };
  }

  // Pick the remark for this play, if any, respecting the gaps.
  function memoryLine(r, base, style) {
    if (!r || !r.kinds || !r.kinds.length) return null;
    var gap = playNo - mem.lastRemark;
    var kind = null;
    for (var i = 0; i < PAYOFF.length && !kind; i++) {
      var k = PAYOFF[i];
      if (r.kinds.indexOf(k) < 0) continue;
      if (k === 'lead_change' || k === 'go_ahead' || k === 'answer' || gap >= MEM_GAP) kind = k;
    }
    // need_answer comes right after a score by design, so it only waits the payoff gap.
    for (var j = 0; j < SETUP.length && !kind; j++) {
      if (r.kinds.indexOf(SETUP[j]) >= 0 && gap >= (SETUP[j] === 'need_answer' ? MEM_GAP : SETUP_GAP)) kind = SETUP[j];
    }
    if (!kind) return null;
    var v = {};
    Object.keys(base).forEach(function (k2) { v[k2] = base[k2]; });
    Object.keys(r.v).forEach(function (k2) { v[k2] = r.v[k2]; });
    var text = fill(pick(kind, style, MEMORY), v);
    if (!text || /\{\w+\}/.test(text) || text.length > api.maxLength) return null;
    mem.lastRemark = playNo;
    if (kind === 'near_hundred') mem.nearSaid[r.team + '|' + r.slot] = true;
    return { kind: 'memory_' + kind, text: text };
  }

  // ---- C15: catch-up after a jump ----
  // Short enough for one line of the captions strip: the first form below that fits maxLength.
  var COUNT = ['', 'a', 'two', 'three', 'four', 'five'];

  function catchUp(results, ctx) {
    try {
      ctx = ctx || {};
      var teams = ctx.teams, plays = (results || []).filter(function (r) { return r && r.e && r.pre && r.post; });
      if (!teams || teams.length < 2 || !plays.length) return '';
      var style = 'straight';
      // Keep the memory right for what comes after the jump.
      plays.forEach(function (r) { playNo++; remember(r); });
      var first = plays[0].pre.score, end = plays[plays.length - 1].post.score, score = ctx.score || end;
      var tally = [{ td: 0, fg: 0 }, { td: 0, fg: 0 }], turn = '', big = null;
      plays.forEach(function (r) {
        var e = r.e, off = r.pre.poss;
        if (off !== 0 && off !== 1) return;
        var R = teams[off].roster || {};
        if (r.td) tally[off].td++;
        if (e.t === 'fg' && e.good) tally[off].fg++;
        if (!turn && e.t === 'int') turn = M('cu_pick', { qb: lastName(R.QB) });
        if (!turn && e.t === 'fumble') turn = M('cu_fumble', { name: lastName(R[e.by]) });
        if (!turn && r.downs) turn = M('cu_downs', { team: teams[off].name });
        if ((e.t === 'run' || e.t === 'pass') && e.yds >= 15 && (!big || e.yds > big.yds)) big = { yds: e.yds, name: lastName(R[e.t === 'pass' ? e.to : e.by]) };
      });
      var what = [];
      [0, 1].forEach(function (t) {
        var x = tally[t];
        if (x.td) what.push(M(x.td > 1 ? 'tdN' : 'td1', { n: x.td, team: teams[t].name }));
        if (x.fg) what.push(M(x.fg > 1 ? 'fgN' : 'fg1', { n: x.fg, team: teams[t].name }));
      });
      var sc = M('cu_sc', { a: score[0], b: score[1] }), end1 = '.';
      var lead = M('cu_lead_on', { n: plays.length });
      var changed = (first[0] !== end[0] || first[1] !== end[1]) && what.length;
      var s2 = '';
      if (turn) s2 = turn.charAt(0).toUpperCase() + turn.slice(1) + end1;
      else if (big) s2 = M('cu_big', { name: big.name, yds: big.yds }) + end1;
      else if (!ctx.hidden) {
        var top = topLeader(ctx.leaders);
        if (top) s2 = M('cu_leader', { name: lastName(top.name), pts: pts(top.points) }) + end1;
      }
      var forms = changed ? [M('cu_changed', { n: plays.length, what: what.join(', '), sc: sc }) + end1, M('cu_now', { lead: lead, sc: sc }) + end1]
                          : [M('cu_still', { lead: lead, sc: sc }) + end1];
      // The fullest form first, with the extra fact if it fits, then without it.
      var text = '', tries = [];
      forms.forEach(function (f) { if (s2) tries.push(f + ' ' + s2); tries.push(f); });
      for (var i = 0; i < tries.length && !text; i++) if (tries[i].length <= api.maxLength) text = tries[i];
      if (!text) text = forms[forms.length - 1].slice(0, api.maxLength);
      announce(text, 'catch_up', style);
      return text;
    } catch (err) {
      return '';
    }
  }

  // ---- C18: the big call ----
  var BIG = {
    td_pass: {
      straight: ['{qb} drops back, finds {player} for {yds} yards, and it\'s a touchdown!', '{qb} lets it go, {player} hauls it in, {yds} yards and into the end zone!', 'Touchdown! {qb} to {player}, {yds} yards!']
    },
    td_run: {
      straight: ['{player} takes it {yds} yards to the end zone for a touchdown!', '{player} carries it in from {yds} yards out! Touchdown!', 'Handoff to {player}, {yds} yards, and it\'s a touchdown!']
    },
    int: {
      straight: ['{qb} throws, and it\'s picked off! The {def} take it back {ret} yards!', 'Intercepted! {qb}\'s pass belongs to the {def}!', '{qb} forces it, and the {def} come away with the interception!']
    },
    fumble: {
      straight: ['{player} gains {yds}, but the ball comes loose, and the {def} recover!', 'Fumble! {player} loses it, and the {def} have the ball!', '{player} is stripped! The {def} pounce on it!']
    },
    downs: {
      straight: ['Fourth down, and the {def} defense stops the {team} cold!', 'The {team} go for it on fourth down, and they come up short!', 'Stopped on fourth down! The {def} take over!']
    },
    big: {
      straight: ['{player} breaks free for {yds} yards!', 'A big play: {player} for {yds} yards!', '{player} finds room and goes {yds} yards!']
    },
    big_pass: {
      straight: ['{qb} to {player}, and that\'s a {yds} yard gain!', '{qb} finds {player} for {yds} yards!', 'A deep one, {qb} to {player}, {yds} yards!']
    }
  };

  function bigKind(res) {
    var e = res.e || {};
    if (res.td && (e.t === 'pass' || e.t === 'run')) return e.t === 'pass' ? 'td_pass' : 'td_run';
    if (e.t === 'int') return 'int';
    if (e.t === 'fumble') return 'fumble';
    if (res.downs) return 'downs';
    if ((e.t === 'run' || e.t === 'pass') && e.yds >= 20) return e.t === 'pass' ? 'big_pass' : 'big';
    return '';
  }

  // One fact from the memory about this play's player or team.
  function bigFact(res, teams, off, slot, hidden) {
    var name = lastName((teams[off].roster || {})[slot]);
    var p = slot ? mem.players[off + '|' + slot] : null;
    if (p && res.td && p.td >= 2) return M(p.td === 2 ? 'fact_td2' : p.td === 3 ? 'fact_td3' : 'fact_tdN', { name: name });
    if (p && p.recYds >= 60) return M('fact_rec', { name: name, n: p.recYds });
    if (p && p.rushYds >= 60) return M('fact_rush', { name: name, n: p.rushYds });
    if (p && p.rec >= 3) return M('fact_catch', { name: name, n: p.rec });
    if (mem.leadChanges >= 2) return M('fact_leads', { n: mem.leadChanges });
    if (mem.scoringDrives[off] >= 2 && res.td) return M('fact_drives', { n: mem.scoringDrives[off], team: teams[off].name });
    if (!hidden && res.fp && res.fp.length) {
      var best = res.fp.reduce(function (a, f) { return !a || Math.abs(f.pts) > Math.abs(a.pts) ? f : a; }, null);
      if (best && best.pts > 0 && best.role !== 'DST') {
        return M('fact_fp', { pts: pts(best.pts), name: lastName((teams[best.team].roster || {})[best.role]) });
      }
    }
    return '';
  }

  function bigCall(res, ctx) {
    try {
      ctx = ctx || {};
      var teams = ctx.teams;
      if (!res || !res.e || !res.pre || !res.post || !teams || teams.length < 2) return '';
      var kind = bigKind(res);
      if (!kind) return '';
      var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
      var e = res.e, off = res.pre.poss, def = 1 - off;
      if (off !== 0 && off !== 1) return '';
      var R = teams[off].roster || {}, score = ctx.score || res.post.score;
      var slot = e.t === 'pass' ? e.to : e.t === 'run' || e.t === 'fumble' ? e.by : e.t === 'int' ? 'QB' : '';
      var v = { team: teams[off].name, def: teams[def].name, qb: lastName(R.QB), player: lastName(R[slot] || R.QB),
        yds: Math.abs(e.yds || 0), ret: e.ret || 0, score: scoreText(teams, score) };
      var s1 = fill(pick(kind, style, BIG), v);
      // What it did to the score.
      var pre = res.pre.score, post = res.post.score, s2;
      if (post[0] !== pre[0] || post[1] !== pre[1]) {
        var d = score[0] - score[1];
        s2 = d === 0 ? M('big_tie', { n: score[0] }) : M('big_lead', { score: v.score, team: teams[d > 0 ? 0 : 1].name, d: Math.abs(d) });
      } else if (kind === 'int' || kind === 'fumble' || kind === 'downs') {
        s2 = M('big_take', { def: teams[def].name, score: v.score });
      } else {
        var on = res.post.ballOn;
        s2 = M(on >= 80 ? 'big_rz' : on >= 50 ? 'big_terr' : 'big_flip', { team: v.team, def: v.def });
      }
      var s3 = bigFact(res, teams, off, slot, !!ctx.hidden);
      return [s1, s2, s3].filter(Boolean).join(' ');
    } catch (err) {
      return '';
    }
  }

  // ---- C23: the pre-game show ----
  var WHAT = {
    deep_ball: 'big plays downfield', short_pass: 'completing passes', scramble: 'running with the ball',
    run_share: 'getting carries', pass_catching: 'catching passes out of the backfield', catch_rate: 'holding on to the ball',
    red_zone_use: 'work near the goal line', target_share: 'getting targets', kicker_range: 'long kicks', accuracy: 'kicking accuracy'
  };
  var WATCH = {
    deep_ball: '{name} is a real deep threat.', short_pass: '{name} rarely misses on short throws.',
    run_share: 'The {team} offense runs through {name}.', pass_catching: '{name} is a weapon out of the backfield.',
    catch_rate: '{name} has some of the surest hands around.'
  };
  var PREVIEW = {
    record: {
      straight: ['The {a} ({ra}) take on the {b} ({rb}).', 'It\'s the {a} ({ra}) against the {b} ({rb}).', 'This week: the {a} ({ra}) and the {b} ({rb}).']
    },
    hot: {
      straight: ['Hot lately: {name} of the {team}, better at {what} in recent games.', 'In form: {name}, up on {what} lately for the {team}.', 'Trending up: {name} of the {team}, sharper at {what}.']
    },
    cold: {
      straight: ['Cooling off: {name}, down on {what} lately.', 'Out of form: {name} of the {team}, worse at {what} recently.', 'Something to fix for {name}: {what}.']
    }
  };
  var PLACES = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

  function recordOf(league, id) {
    var rows = (league && league.standings) || [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.id === id && typeof r.wins === 'number' && typeof r.losses === 'number') {
        return r.wins + '-' + r.losses + ', ' + (PLACES[i + 1] || (i + 1) + 'th');
      }
    }
    return '';
  }

  function preview(matchup, ctx) {
    try {
      ctx = ctx || {};
      var ts = (matchup && matchup.teams) || [];
      if (ts.length < 2) return '';
      var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
      var out = [];
      var ra = recordOf(ctx.league, ts[0].id), rb = recordOf(ctx.league, ts[1].id);
      if (ra && rb) out.push(fill(pick('record', style, PREVIEW), { a: ts[0].full, b: ts[1].full, ra: ra, rb: rb }));
      // Recent form against the season, and the strongest tendency, over both teams' profiles.
      var hot = null, cold = null, colds = [], watch = null, profiles = ctx.profiles || {};
      ts.forEach(function (t) {
        var pr = profiles[t.id], ps = pr && pr.players;
        if (!ps) return;
        Object.keys(ps).forEach(function (slot) {
          var pl = ps[slot], season = pl.tendencies || {}, form = (pl.form && (pl.form.tendencies || pl.form)) || {};
          Object.keys(season).forEach(function (k) {
            var sv = season[k], fv = form[k];
            if (typeof sv !== 'number' || !WHAT[k]) return;
            if (typeof fv === 'number') {
              var d = fv - sv, x = { name: lastName(pl.name), team: t.full, what: WHAT[k], d: d };
              x.key = t.id + '|' + slot;
              if (d >= 0.1 && (!hot || d > hot.d)) hot = x;
              if (d <= -0.1) colds.push(x);
            }
            if (WATCH[k] && sv >= 0.7 && (!watch || sv > watch.v)) watch = { name: lastName(pl.name), team: t.full, k: k, v: sv };
          });
        });
      });
      // The coldest player who is not also the hot one.
      colds.forEach(function (x) { if ((!hot || x.key !== hot.key) && (!cold || x.d < cold.d)) cold = x; });
      if (hot) out.push(fill(pick('hot', style, PREVIEW), hot));
      if (cold) out.push(fill(pick('cold', style, PREVIEW), cold));
      if (watch && (!hot || watch.name !== hot.name) && (!cold || watch.name !== cold.name)) {
        out.push(fill(WATCH[watch.k], { name: watch.name, team: watch.team }));
      }
      var text = out.slice(0, 4).join(' ').replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
      if (text) announce(text, 'preview', style);
      return text;
    } catch (err) {
      return '';
    }
  }

  // ---- C27: say it right ----
  // Team codes a line can contain, with the names to say. Teams passed to line() are added.
  var TEAM_NAMES = { GOB: 'Goblins', PYT: 'Pythons', IRN: 'Ironside', RHB: 'Red Harbour', TUR: 'Turtles', OWL: 'Owls' };
  var ORD = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth' };
  var ACRONYM_SAY = { TD: 'touchdown', TDs: 'touchdowns', FG: 'field goal', FGs: 'field goals', XP: 'extra point', pts: 'points', MVP: 'M V P', NFL: 'N F L', DST: 'defense' };
  function learnTeams(teams) { (teams || []).forEach(function (t) { if (t && t.id && t.name) TEAM_NAMES[t.id] = t.name; }); }

  function spoken(text) {
    if (!text) return '';
    var t = String(text), ids = Object.keys(TEAM_NAMES).join('|');
    // Names: Saint, apostrophes and hyphens inside names, initials.
    t = t.replace(/\bSt\.\s/g, 'Saint ').replace(/([A-Za-z])'([A-Z])/g, '$1$2').replace(/\b([A-Z])\.([A-Z])\./g, '$1 $2');
    t = t.replace(/([A-Za-z])-([A-Z][a-z])/g, '$1 $2');
    // Yard lines: "the GOB 27" / "la PYT 21".
    t = t.replace(new RegExp('\\b(?:the )?(' + ids + ') (\\d{1,2})\\b', 'g'), function (m, id, n) { return 'the ' + TEAM_NAMES[id] + ' ' + n; });
    // Any team code left on its own.
    t = t.replace(new RegExp('\\b(' + ids + ')\\b', 'g'), function (m, id) { return TEAM_NAMES[id]; });
    // Downs and ordinals: "2nd & 10", "1st and goal", "3rd".
    t = t.replace(/\b([1-4])(?:st|nd|rd|th)\s*(?:&|and)\s*(\d+|goal)\b/gi, function (m, d, togo) {
      return ORD[d] + ' and ' + (/goal/i.test(togo) ? 'goal' : togo);
    });
    t = t.replace(/\bQ([1-4])\b/g, function (m, q) { return ORD[q] + ' quarter'; });
    // Clock times: "7:30", "12:00", "0:35".
    t = t.replace(/\b(\d{1,2}):(\d{2})\b/g, function (m, mm, ss) {
      if (+mm === 0) return +ss + ' seconds';
      if (ss === '00') return +mm + ' minutes';
      return +mm + ' ' + (ss.charAt(0) === '0' ? 'oh ' + ss.charAt(1) : ss);
    });
    // Records before scores: "(1-1, third)" is one win and one loss, "17-14" a score.
    t = t.replace(/\b(\d+)-(\d+), (first|second|third|fourth|fifth|sixth|[a-z]+th)\b/g, '$1 and $2, $3');
    t = t.replace(/\b(\d+)-(\d+)\b/g, '$1 to $2');
    t = t.replace(/\s*\(\s*/g, ', ').replace(/\s*\)/g, ',').replace(/,\s*([,.!?])/g, '$1').replace(/^,\s*/, '');
    t = t.replace(/&/g, ' and ');
    // Short forms and shouting capitals.
    t = t.replace(/\b(TDs?|FGs?|XP|pts|MVP|NFL|DST)\b/g, function (m) { return ACRONYM_SAY[m] || m; });
    t = t.replace(/\b([A-Z]{2,})\b/g, function (m) { return m.charAt(0) + m.slice(1).toLowerCase(); });
    // Leftover symbols a voice would read out.
    t = t.replace(/[#@*_~^|<>\[\]{}"]/g, ' ').replace(/\s+([,.!?])/g, '$1').replace(/ {2,}/g, ' ').trim();
    return t;
  }

  // ---- C26: the spoken recap ----
  var RECAP = {
    final: { straight: ['Final: the {winner} {w}, the {loser} {l}.', 'The {winner} beat the {loser}, {w} to {l}.', 'It finished {winner} {w}, {loser} {l}.'] },
    final_tie: { straight: ['It finished level, {w} to {l}.', 'A tie, {w} apiece.', 'Nobody won it: {w} to {l}.'] },
    decider: { straight: ['The {team} went ahead for good in the {qth} quarter, at {clock}, to make it {s}.', 'The play that decided it came in the {qth} quarter at {clock}: {s}, and the {team} never looked back.', 'From {clock} of the {qth} quarter, when it became {s}, the {team} never trailed again.'] },
    one_lead: { straight: ['The {team} scored first and never trailed.', 'The {team} led from their first score to the end.', 'Once the {team} scored, they never gave up the lead.'] },
    many_leads: { straight: ['The lead changed hands {n} times.', 'There were {n} lead changes in all.', 'The lead went back and forth {n} times.'] },
    drive: { straight: ['The longest drive belonged to the {team}: {plays} plays and {yards} yards, ending in {result}.', 'The {team} put together the longest drive, {plays} plays for {yards} yards, ending in {result}.', 'Longest drive: the {team}, {plays} plays, {yards} yards, ending in {result}.'] },
    swing: { straight: ['The biggest swing came in the {qth} quarter: a {fp} point fantasy run for the {team}.', 'In the {qth} quarter the {team} outscored the other side by {fp} fantasy points.', 'The momentum swung hardest in the {qth} quarter, {fp} fantasy points toward the {team}.'] },
    best: { straight: ['Top fantasy players: {a} with {pa} for the {ta}, and {b} with {pb} for the {tb}.', 'Best on each side: {a}, {pa} points, and {b}, {pb}.', '{a} led the {ta} with {pa} fantasy points; {b} led the {tb} with {pb}.'] }
  };
  // Drive results from server/drives.js, said as words.
  var RESULT = {
    touchdown: 'a touchdown', 'field goal': 'a field goal', 'missed field goal': 'a missed field goal', punt: 'a punt',
      interception: 'an interception', fumble: 'a fumble', downs: 'a turnover on downs', half: 'the end of the half', end: 'the end of the game'
  };
  var QTH = ['', 'first', 'second', 'third', 'fourth'];

  function recap(story, ctx) {
    try {
      ctx = ctx || {};
      if (ctx.hidden || !story || !story.final) return '';
      var teams = ctx.teams || [], style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
      var q = QTH;
      function name(id) { for (var i = 0; i < teams.length; i++) if (teams[i].id === id) return teams[i].name; return id; }
      function qth(n) { return q[n] || String(n); }
      function sc(arr) { return arr[0] + '-' + arr[1]; }
      var out = [], f = story.final, home = story.home, away = story.away;
      function say(kind, v) { var t = fill(pick(kind, style, RECAP), v); if (t) out.push(t); }
      if (story.winner) {
        var hw = story.winner === home;
        say('final', { winner: name(story.winner), loser: name(hw ? away : home), w: hw ? f[0] : f[1], l: hw ? f[1] : f[0] });
      } else say('final_tie', { w: f[0], l: f[1] });
      var d = story.decidingPlay;
      if (d) say('decider', { team: name(d.team), qth: qth(d.quarter), clock: d.clock, s: sc(d.score) });
      var lc = story.leadChanges || [];
      if (lc.length === 1 && story.winner && lc[0].team === story.winner) say('one_lead', { team: name(lc[0].team) });
      else if (lc.length >= 2) say('many_leads', { n: lc.length });
      var dr = story.longestDrive;
      var rw = RESULT[dr && dr.result];
      if (dr && dr.plays && rw) say('drive', { team: name(dr.team), plays: dr.plays, yards: dr.yards, result: rw });
      var sw = story.biggestSwing;
      if (sw && sw.fpSwing) say('swing', { team: name(sw.team), qth: qth(sw.quarter), fp: pts(sw.fpSwing) });
      var bp = story.bestPlayers || [];
      if (bp.length >= 2) say('best', { a: lastName(bp[0].name), pa: pts(bp[0].points), ta: name(bp[0].team), b: lastName(bp[1].name), pb: pts(bp[1].points), tb: name(bp[1].team) });
      var text = out.slice(0, 6).join(' ').replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
      if (text) announce(text, 'recap', style);
      return text;
    } catch (err) {
      return '';
    }
  }

  // ---- C14: rule explainers ----
  var EXPLAIN = {
    first_down: "The offense gets four tries, called downs, to move the ball 10 yards. If they make it, that is a first down and they get four new tries.",
    downs: "If the offense does not gain 10 yards in four tries, the other team takes the ball right there. That is a turnover on downs.",
    touchdown: "Carry or catch the ball in the other team's end zone for a touchdown. It is worth 6 points, and a try for 1 more follows.",
    extra_point: "After a touchdown, the kicker tries a short kick between the posts for 1 more point.",
    field_goal: "The kicker sends the ball between the posts for 3 points. Teams try it when they are close but stuck on fourth down.",
    punt: "On fourth down far from the goal, teams usually kick the ball away, so the other team has to start a long way back.",
    interception: "A defender catches a pass that was meant for the offense. The defending team takes the ball.",
    fumble: "A player drops the ball while carrying it. Whoever picks it up keeps it, so the defense can take over.",
    sack: "The quarterback is tackled behind the line before throwing. The offense loses yards and uses up a down.",
    penalty: "A player broke a rule. The referee throws a yellow flag, and the ball moves back or forward, usually 5 to 15 yards.",
    kickoff: "Each half starts with a kickoff, and so does play after every score: one team kicks the ball deep to the other.",
    halftime: "A game has two halves. At halftime the teams rest, and the team that received the first kickoff kicks off to start the second."
  };

  // The rule kinds a finished play shows, most important first.
  function explainFor(res) {
    if (!res) return [];
    if (res.kind === 'half') return ['halftime'];
    var e = res.e || {}, k = [];
    if (e.t === 'kickoff') k.push('kickoff');
    if (res.td) k.push('touchdown');
    if (e.t === 'xp') k.push('extra_point');
    if (e.t === 'fg') k.push('field_goal');
    if (e.t === 'punt') k.push('punt');
    if (e.t === 'int') k.push('interception');
    if (e.t === 'fumble') k.push('fumble');
    if (e.t === 'sack') k.push('sack');
    if (e.t === 'pen') k.push('penalty');
    if (res.downs) k.push('downs');
    if (res.first && !res.td) k.push('first_down');
    return k;
  }

  // Longer pieces: intro, halftime and wrap. Built from the score, the leaders and the plays.
  var STORIES = {
    intro: {
      straight: [
        "Welcome in. It's the {t0} against the {t1}. Watch {w0} for the {t0}, and {w1} for the {t1}.",
        "The {t0} and the {t1}, here we go. The {t0} will lean on {w0}. The {t1} need a big day from {w1}.",
        "Good afternoon and welcome. {t0} versus {t1}. Keys to this one: {w0} for the {t0}, {w1} for the {t1}."
      ]
    },
    halftime_hidden: {
      straight: [
        "That's halftime, and it's {score}. {leader} has been everywhere.",
        "Halftime here, {score}. {lead}",
        "We're at the half, {score}. Keep an eye on {leader}."
      ]
    },
    halftime: {
      straight: [
        "That's halftime, and it's {score}. In fantasy points {leader} leads the way with {lpts}.",
        "We're at the half with the score {score}. The best player so far has been {leader}, {lpts} fantasy points.",
        "Halftime: {score}. {leader} tops the fantasy board at {lpts}. {lead}"
      ]
    },
    wrap: {
      straight: [
        "Final score, {score}. The play that decided it: {decider}. Top performer, {leader} with {lpts} fantasy points.",
        "That's the final, {score}. {decider} turned out to be the difference. {leader} led everyone with {lpts}.",
        "It ends {score}. The {winner} won it on {decider}. {leader} had the best day, {lpts} fantasy points."
      ]
    },
    wrap_tie: {
      straight: [
        "It ends level, {score}. Top performer, {leader} with {lpts} fantasy points.",
        "A tie at {score}. {leader} led everyone with {lpts} fantasy points.",
        "Final score {score}, nobody wins it. {leader} had the best day with {lpts}."
      ]
    }
  };

  // Deterministic shuffles. Each deck (kind and style) is shuffled from its own seed, so the
  // n-th line of a kind is the same in every run of the same game, whatever else was said in
  // between. That is what lets js/announcer/voice/render.js record exactly the lines a viewer
  // will hear. seed(n) changes the whole set; reset() starts every deck again.
  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seeded(n) {
    return function () {
      n = (n + 0x6D2B79F5) >>> 0;
      var t = Math.imul(n ^ (n >>> 15), 1 | n);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(kind, style, table) {
    table = table || LINES;
    var prefix = table === LINES ? '' : 'story:';
    var entry = table[kind], list = entry && entry[style];
    if (!list || !list.length) return '';
    var key = prefix + kind + '|' + style;
    if (!decks[key] || !decks[key].length) {
      rounds[key] = (rounds[key] || 0) + 1;
      var rnd = rand || seeded(hashStr(seedBase + '|' + key + '|' + rounds[key]));
      var d = list.map(function (_, i) { return i; });
      for (var i = d.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t;
      }
      if (d.length > 1 && d[d.length - 1] === lastUsed[key]) { d.unshift(d.pop()); }
      decks[key] = d;
    }
    var idx = decks[key].pop();
    lastUsed[key] = idx;
    return list[idx];
  }

  function fill(text, v) {
    return text
      .replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); })
      .replace(/\b1 yards\b/g, '1 yard')
      .replace(/\b1 (fantasy )?points\b/g, '1 $1point')
      .replace(/\b([Aa]) (8|11|18|8\d)\b/g, '$1n $2');   // "an 11 yard", "an 8 yard"
  }

  function scoreText(teams, score) {
    return teams[0].name + ' ' + score[0] + ', ' + teams[1].name + ' ' + score[1];
  }

  function points(n) { return M(n === 1 ? 'points1' : 'pointsN', { n: n }); }

  // Work out which kind of line a result needs and the values for its placeholders.
  function classify(res, teams, score) {
    var v = { score: scoreText(teams, score) };
    if (res.kind === 'half') return { kind: 'half', v: v };
    if (res.kind === 'final') {
      if (score[0] === score[1]) return { kind: 'final_tie', v: v };
      var w = score[0] > score[1] ? 0 : 1;
      v.winner = teams[w].name; v.loser = teams[1 - w].name;
      return { kind: 'final', v: v };
    }

    var e = res.e || {};
    var off = e.t === 'kickoff' ? res.post.poss : res.pre.poss;
    var def = 1 - off;
    var R = teams[off].roster || {};
    v.team = teams[off].name;
    v.def = teams[def].name;
    v.qb = lastName(R.QB);
    v.kicker = lastName(R.K);
    v.teamscore = points(score[off]);
    var slot = e.by || e.to;
    v.player = slot && R[slot] ? lastName(R[slot]) : v.qb;
    v.yds = Math.abs(res.yds || e.yds || 0);
    v.yards = M(v.yds === 1 ? 'yards1' : 'yardsN', { n: v.yds });

    switch (e.t) {
      case 'kickoff':
        v.player = lastName(R.WR3);
        v.spot = e.to === 50 ? '50' : e.to < 50 ? teams[off].id + ' ' + e.to : teams[1 - off].id + ' ' + (100 - e.to);
        return { kind: 'kickoff', v: v };
      case 'xp': return { kind: e.good ? 'xp_good' : 'xp_miss', v: v };
      case 'fg':
        v.dist = res.fgDist;
        return { kind: e.good ? 'fg_good' : 'fg_miss', v: v };
      case 'int': return { kind: 'interception', v: v };
      case 'fumble': return { kind: 'fumble', v: v };
      case 'punt':
        v.net = res.net != null ? res.net : e.net;
        return { kind: 'punt', v: v };
      case 'kneel': return { kind: 'kneel', v: v };
      case 'pen':
        v.pen = res.pen ? res.pen.yds : '';
        return { kind: 'pen_' + e.kind, v: v };
    }
    if (res.td) return { kind: e.t === 'pass' ? 'touchdown_pass' : 'touchdown_run', v: v };
    if (res.downs) return { kind: 'downs', v: v };
    if (e.t === 'sack') { v.loss = Math.abs(e.yds); return { kind: 'sack', v: v }; }
    if (e.t === 'inc') return { kind: 'incomplete', v: v };
    if (e.t === 'run' || e.t === 'pass') {
      if (e.yds >= 15) return { kind: 'big_gain', v: v };
      if (e.yds <= 0) return { kind: 'no_gain', v: v };
      if (res.first) return { kind: 'first_down', v: v };
      return { kind: 'gain', v: v };
    }
    return { kind: '', v: v };
  }

  function topLeader(leaders) {
    var best = null;
    (leaders || []).forEach(function (l) { if (l && l.name != null && (best === null || (+l.points || 0) > (+best.points || 0))) best = l; });
    return best;
  }

  function pts(n) { return String(Math.round((+n || 0) * 10) / 10); }

  // One player to watch per team: that team's best leader if given, otherwise its quarterback.
  function watchFor(team, leaders) {
    var names = {}, R = team.roster || {};
    Object.keys(R).forEach(function (k) { names[R[k]] = true; });
    var best = null;
    (leaders || []).forEach(function (l) { if (l && names[l.name] && (!best || (+l.points || 0) > (+best.points || 0))) best = l; });
    return lastName(best ? best.name : (R.QB || R.RB || team.name));
  }

  // The play that decided it: the winner's play that took the lead for the last time.
  function decider(plays, w) {
    var found = null;
    (plays || []).forEach(function (r) {
      if (!r || !r.pre || !r.post) return;
      var before = r.pre.score[w] > r.pre.score[1 - w], after = r.post.score[w] > r.post.score[1 - w];
      if (!before && after) found = r;
    });
    if (!found) return '';
    return (found.desc || found.text || '').replace(/\s+/g, ' ').trim()
      .replace(/^(\S+) pass to (\S+) for (\d+)$/, function (m, a, b, n) { return M('dec_pass', { a: a, b: b, n: n }); })
      .replace(/^(\S+) runs for (\d+)$/, function (m, a, n) { return M('dec_run', { a: a, n: n }); });
  }

  function story(kind, ctx) {
    try {
      ctx = ctx || {};
      var teams = ctx.teams;
      if (!teams || teams.length < 2) return '';
      var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
      var score = ctx.score || [0, 0];
      var v = { t0: teams[0].name, t1: teams[1].name, score: scoreText(teams, score) };
      var top = topLeader(ctx.leaders);
      v.leader = top ? lastName(top.name) : '';
      v.lpts = top ? pts(top.points) : '';
      var k = kind;
      if (kind === 'intro') {
        v.w0 = watchFor(teams[0], ctx.leaders); v.w1 = watchFor(teams[1], ctx.leaders);
      } else {
        if (!top) return '';
        if (kind === 'halftime') {
          if (ctx.hidden) k = 'halftime_hidden';
          v.lead = score[0] === score[1] ? M('story_square') :
            M('story_lead', { team: teams[score[0] > score[1] ? 0 : 1].name, d: Math.abs(score[0] - score[1]) });
        }
        if (kind === 'wrap') {
          if (score[0] === score[1]) k = 'wrap_tie';
          else {
            var w = score[0] > score[1] ? 0 : 1;
            v.winner = teams[w].name;
            v.decider = decider(ctx.plays, w) || M('story_hold', { team: teams[w].name });
          }
        }
      }
      // A filled-in value can start a sentence ("the 9 yard run by Barkley..."): capitalize it.
      var text = fill(pick(k, style, STORIES), v).replace(/(^|[.!?]\s+)([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); });
      if (text) announce(text, kind, style);
      return text;
    } catch (err) {
      return '';
    }
  }

  var api = {
    // 337 pixels of text at 600 13px in the captions strip, about 5.9 pixels a character.
    maxLength: 56,

    intro: function (ctx) { return story('intro', ctx); },
    halftime: function (ctx) { return story('halftime', ctx); },
    wrap: function (ctx) { return story('wrap', ctx); },

    style: 'straight',

    line: function (res, ctx) {
      try {
        ctx = ctx || {};
        var teams = ctx.teams;
        if (!res || !teams || teams.length < 2) return '';
        learnTeams(teams);
        var score = ctx.score || (res.post && res.post.score) || [0, 0];
        var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
        var c = classify(res, teams, score);
        if (res.e) playNo++;
        var r = res.e ? remember(res) : null;
        if (!c.kind) return '';
        var m = memoryLine(r, c.v, style);
        if (m) { announce(m.text, m.kind, style); return m.text; }
        var text = fill(pick(c.kind, style), c.v);
        var note = ctx.profiles && text ? tendencyNote(res, teams, ctx.profiles, api.maxLength - text.length - 1) : '';
        if (text && note && text.length + 1 + note.length <= api.maxLength) text += ' ' + note;
        if (text) announce(text, c.kind, style);
        return text;
      } catch (err) {
        return ''; // the announcer must never stop the game
      }
    },

    speak: function (text) {
      if (!text || !synth()) return;
      if (tooFast()) { api.hush(); return; }
      queue.push({ text: String(text), play: playNo, style: api.style });
      if (!speaking) speakNext();
    },

    // Stops speech and empties the queue (for the game view closing, or a restart).
    hush: function () {
      queue.length = 0; clearTimeout(speakTimer); speaking = null;
      var sy = synth(); if (sy) { try { sy.cancel(); } catch (err) { /* optional */ } }
    },

    voices: function () {
      var n = synth() ? chooseVoices() : 0;
      function info(style) {
        var v = chosen[style], set = VOICE_SET[style];
        return { name: v ? v.name : '(browser default)', lang: v ? v.lang : '', rate: set.rate, pitch: set.pitch };
      }
      return { straight: info('straight'), available: n };
    },

    setStyle: function (name) {
      if (STYLES.indexOf(name) >= 0) api.style = name;
      return api.style;
    },

    catchUp: catchUp,
    bigCall: bigCall,
    preview: preview,
    recap: recap,
    spoken: spoken,
    _recapLines: RECAP,
    bigCallMaxLength: 210,   // the longest names in the data give 204 (Smith-Njigba, week 9 games); check.js tests it
    _bigLines: BIG,
    explain: function (kind) { return Object.prototype.hasOwnProperty.call(EXPLAIN, kind) ? EXPLAIN[kind] : ''; },
    explainKinds: Object.keys(EXPLAIN),
    explainFor: explainFor,
    explainMaxLength: 160,
    transcript: function () { return said.map(function (x) { return { t: x.t, text: x.text, kind: x.kind, play: x.play }; }); },

    reset: function () { said = []; decks = {}; lastUsed = {}; rounds = {}; last = null; playNo = 0; tendencySaid = {}; formSaid = {}; mem = freshMemory(); api.hush(); },

    memory: function () {
      var players = Object.keys(mem.players).map(function (k) {
        var x = mem.players[k]; return { team: x.team, slot: x.slot, catches: x.rec, recYards: x.recYds, rushYards: x.rushYds, td: x.td };
      });
      return { players: players, kickers: mem.kick.map(function (k) { return { made: k.made, att: k.att }; }),
        leadChanges: mem.leadChanges, lastScoreTeam: mem.lastScoreTeam, scoringDrives: mem.scoringDrives.slice(),
        playsSinceRemark: playNo - mem.lastRemark, playsSinceScore: playsSinceScore(), log: mem.log.slice() };
    },

    // For other modules (js/audio.js sound captions): tell the onLine listeners about a text
    // that is not an announcer line. It does not go into caption() or the transcript.
    notify: function (text, kind, style) {
      if (!text) return;
      for (var i = 0; i < listeners.length; i++) { try { listeners[i](String(text), kind || 'sound', style || api.style); } catch (err) { /* optional */ } }
    },

    onLine: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    caption: function () { return last ? { text: last.text, kind: last.kind, style: last.style, at: last.at } : null; },

    // For js/announcer/check.js and tests.
    kinds: function () { return Object.keys(LINES); },
    classify: classify,
    _memoryLines: MEMORY,
    _msgKeys: Object.keys(MSG),
    seed: function (n) { seedBase = n == null ? 1 : n; decks = {}; lastUsed = {}; rounds = {}; return seedBase; },
    _setRandom: function (fn) { rand = fn || null; decks = {}; lastUsed = {}; rounds = {}; }
  };

  root.FF_ANNOUNCER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
