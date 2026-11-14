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
//   voices()        which browser voice each style uses: { straight, fun, available }.
//   setStyle(name)  'straight' or 'fun'. style holds the current one.
//   reset()         starts a new game: every line becomes available again.
//   onLine(fn)      fn(text, kind, style) is called for every line produced, spoken or not.
//                   Returns a function that removes the listener.
//   ctx.profiles    optional: the data/profiles/<team>.json objects, as { GOB: {...}, PYT: {...} }
//                   or an array. When a play matches a player's tendency (number 0.7 or more)
//                   or goes against it (0.3 or less), line() adds one short sentence. Only
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
//                   after FF_GAME.seek skipped plays: one or two sentences on what was missed (the
//                   score change, then a turnover or the biggest play), or '' when no play was
//                   skipped. results are the skipped plays' result objects in order; ctx is what
//                   line() takes, plus optional leaders and hidden (no fantasy points while hidden,
//                   like halftime). It also adds those plays to the announcer's memory. After a seek
//                   backwards, call reset() first and pass every play from the start.
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
  var STYLES = ['straight', 'fun'];
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

  // Settings per style. fun is faster and a little higher.
  var VOICE_SET = {
    straight: { rate: 1.08, pitch: 1.0 },
    fun: { rate: 1.2, pitch: 1.15 }
  };
  var chosen = { straight: null, fun: null };

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
    if (/(daniel|alex|aaron|guy|davis|tony|ryan|george|fred)\b/i.test(name)) sc += style === 'straight' ? 2 : 1;
    if (/(samantha|karen|moira|aria|jenny)\b/i.test(name)) sc += style === 'fun' ? 2 : 1;
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
    // Two different voices when the browser has them, so the styles sound apart.
    if (chosen.fun && chosen.straight && chosen.fun === chosen.straight) {
      var alt = null, altSc = -1;
      list.forEach(function (v) { var sc = voiceScore(v, 'fun'); if (v !== chosen.straight && sc > altSc) { alt = v; altSc = sc; } });
      if (alt && altSc >= 10) chosen.fun = alt;
    }
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
      var u = new root.SpeechSynthesisUtterance(item.text), set = VOICE_SET[item.style] || VOICE_SET.straight;
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
      straight: ['{how} {team}, and they take the lead!', '{how}! The lead changes hands. {team} in front.', '{how}, and the {team} are back in front!'],
      fun: ['Flip the script! {how}, and the {team} lead!', 'New leader! {team} on top, {score}!', 'Look who\'s in front now! {how}, {team}!']
    },
    go_ahead: {
      straight: ['{how}, and the {team} go ahead!', '{how} {team}. They break the tie.', '{how}! The {team} lead it now.'],
      fun: ['Tie broken! {how}, {team}!', 'The {team} go ahead! {score}!', 'Not tied anymore! {how}, {team}!']
    },
    answer: {
      straight: ['{how}, and the {team} answer right back!', 'The {team} answer! {how}. {score}.', 'Right back at them! {how}, {team}.'],
      fun: ['Anything you can do! The {team} answer!', 'Tit for tat! {how}, {team}!', 'The {team} hit right back! {how}!']
    },
    rz_empty: {
      straight: ['{what}! A red zone trip with no points.', '{what}! The {team} come away empty.', '{what}! No points from the red zone.'],
      fun: ['{what}! All that work, no points!', '{what}! The {def} bend, don\'t break!', '{what}! Red zone, zero points. Ouch.']
    },
    kicker_again: {
      straight: ['{kicker} from {dist}, good! {made} for {att} today.', 'Good again! {kicker} is {made} for {att}.', '{kicker} does it again from {dist}! {made} for {att}.'],
      fun: ['Automatic! {kicker} is {made} for {att} today!', '{kicker} again! That leg is money!', '{kicker} can\'t miss today! {made} for {att}!']
    },
    hundred: {
      straight: ['{player} for {yards}, and that\'s 100 yards today.', '{player} again! Over 100 yards for the day.', '{player} for {yards}. That\'s {total} on the day.'],
      fun: ['{player} hits triple digits! {total} yards!', '100 yards and counting for {player}!', '{player} is having a day! {total} yards!']
    },
    third_catch: {
      straight: ['{player} again! Third catch on this drive.', '{qb} keeps going to {player}. That\'s three.', '{player} for {yards}, a third catch this drive.'],
      fun: ['Can\'t stop {player}! Three catches this drive!', '{qb} has a favorite! {player} again!', 'Hat trick! Third catch this drive for {player}!']
    },
    need_answer: {
      straight: ['The {team} need an answer. {player} to the {spot}.', 'Down {diff}, the {team} need a response.', 'Your move, {team}. {player} brings it out.'],
      fun: ['Time to answer, {team}! {player} to the {spot}!', 'Down {diff}! Let\'s see what the {team} have!', 'Gotta answer this one, {team}!']
    },
    rz_enter: {
      straight: ['{player} for {yards}. {team} in the red zone!', 'Inside the twenty now! {player} for {yards}.', '{player} gets the {team} inside the twenty.'],
      fun: ['Red zone! {player} gets the {team} close!', 'Knock knock! The {team} are at the door!', '{player} for {yards}! Smell the end zone!']
    },
    near_hundred: {
      straight: ['{player} for {yards}. That\'s {total} yards today.', '{player} again, up to {total} yards on the day.', '{player} is at {total} yards now.'],
      fun: ['{player} is at {total}! Triple digits coming?', '{total} yards for {player}! Keep feeding that!', '{player} closing in on 100! {total} so far!']
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
      v.how = res.td ? 'Touchdown' : e.t === 'fg' ? 'Field goal' : 'Extra point';
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
      v.what = e.t === 'int' ? 'Intercepted' : e.t === 'fumble' ? 'Fumble' : e.t === 'fg' ? 'No good' : res.downs ? 'Stopped on fourth down' : 'They punt';
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
  var CATCHUP = {
    scored: {
      straight: ['We pick it up {n} plays later: {what}, and it\'s {score}.', '{n} plays on, {what}, so it\'s {score}.', 'Since you left: {what}, making it {score}.'],
      fun: ['Fast forward {n} plays: {what}, {score}!', 'You missed {what}, so it\'s {score}!', '{n} plays later: {what}, {score}!']
    },
    quiet: {
      straight: ['We pick it up {n} plays later, still {score}.', '{n} plays on, and it\'s still {score}.', 'Skipping ahead {n} plays, still {score}.'],
      fun: ['Fast forward {n} plays, still {score}!', '{n} plays zipped by, still {score}!', 'Skipped {n} plays, and nothing on the board!']
    },
    turnover: {
      straight: ['Along the way, {turn}.', 'The big moment: {turn}.', 'Worth knowing: {turn}.'],
      fun: ['And get this: {turn}!', 'Oh, and {turn}!', 'Plot twist: {turn}!']
    },
    big: {
      straight: ['The big play was {big}.', 'Biggest gain: {big}.', 'The play of that stretch: {big}.'],
      fun: ['Best bit: {big}!', 'Highlight: {big}!', 'Did you see {big}? Big one!']
    },
    leader: {
      straight: ['{leader} leads in fantasy points with {lpts}.', '{leader} is up to {lpts} fantasy points.', 'Top of the fantasy board: {leader}, {lpts}.'],
      fun: ['{leader} is cooking: {lpts} points!', '{leader} has {lpts} already!', 'Fantasy king right now: {leader}, {lpts}!']
    }
  };

  function joinList(a) { return a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  var COUNT = ['', 'a', 'two', 'three', 'four', 'five'];

  function catchUp(results, ctx) {
    try {
      ctx = ctx || {};
      var teams = ctx.teams, plays = (results || []).filter(function (r) { return r && r.e && r.pre && r.post; });
      if (!teams || teams.length < 2 || !plays.length) return '';
      var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
      // Keep the memory right for what comes after the jump.
      plays.forEach(function (r) { playNo++; remember(r); });
      var first = plays[0].pre.score, end = plays[plays.length - 1].post.score;
      var score = ctx.score || end;
      var v = { n: plays.length, score: scoreText(teams, score) };
      // Scores, per team: touchdowns and field goals.
      var tally = [{ td: 0, fg: 0 }, { td: 0, fg: 0 }], turn = null, big = null;
      plays.forEach(function (r) {
        var e = r.e, off = r.pre.poss, R = off === 0 || off === 1 ? teams[off].roster || {} : {};
        if (r.td && (off === 0 || off === 1)) tally[off].td++;
        if (e.t === 'fg' && e.good && (off === 0 || off === 1)) tally[off].fg++;
        if (!turn && (e.t === 'int' || e.t === 'fumble' || r.downs) && (off === 0 || off === 1)) {
          turn = e.t === 'int' ? lastName(R.QB) + ' threw an interception' :
            e.t === 'fumble' ? lastName(R[e.by]) + ' lost a fumble' :
            'the ' + teams[off].name + ' turned it over on downs';
        }
        if ((e.t === 'run' || e.t === 'pass') && e.yds >= 15 && (!big || e.yds > big.yds)) {
          big = { yds: e.yds, text: e.t === 'pass' ? lastName(R.QB) + ' to ' + lastName(R[e.to]) + ' for ' + e.yds : lastName(R[e.by]) + ' for ' + e.yds };
        }
      });
      var what = [];
      [0, 1].forEach(function (t) {
        var x = tally[t], parts = [];
        if (x.td) parts.push((COUNT[x.td] || x.td) + ' ' + teams[t].name + ' touchdown' + (x.td > 1 ? 's' : ''));
        if (x.fg) parts.push((COUNT[x.fg] || x.fg) + ' ' + teams[t].name + ' field goal' + (x.fg > 1 ? 's' : ''));
        what = what.concat(parts);
      });
      var changed = first[0] !== end[0] || first[1] !== end[1];
      v.what = joinList(what);
      var s1 = fill(pick(changed && what.length ? 'scored' : 'quiet', style, CATCHUP), v);
      var s2 = '';
      if (turn) s2 = fill(pick('turnover', style, CATCHUP), { turn: turn });
      else if (big) s2 = fill(pick('big', style, CATCHUP), { big: big.text });
      else if (!ctx.hidden) {
        var top = topLeader(ctx.leaders);
        if (top) s2 = fill(pick('leader', style, CATCHUP), { leader: lastName(top.name), lpts: pts(top.points) });
      }
      var text = s2 ? s1 + ' ' + s2 : s1;
      announce(text, 'catch_up', style);
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
      ],
      fun: [
        "Buckle up, it's {t0} versus {t1}! If {w0} gets going, look out. And the {t1} have {w1} ready to cook.",
        "Welcome to the show! {t0} and {t1}, let's go! Eyes on {w0} and {w1} today.",
        "Game day! {t0} against {t1}. {w0} and {w1}, the stage is yours!"
      ]
    },
    halftime_hidden: {
      straight: [
        "That's halftime, and it's {score}. {leader} has been everywhere.",
        "Halftime here, {score}. {lead}",
        "We're at the half, {score}. Keep an eye on {leader}."
      ],
      fun: [
        "Halftime! It's {score}, and {leader} is putting on a show!",
        "Two quarters down! {score}. {leader} has been busy!",
        "Grab a snack! {score} at the break. {lead}"
      ]
    },
    halftime: {
      straight: [
        "That's halftime, and it's {score}. In fantasy points {leader} leads the way with {lpts}.",
        "We're at the half with the score {score}. The best player so far has been {leader}, {lpts} fantasy points.",
        "Halftime: {score}. {leader} tops the fantasy board at {lpts}. {lead}"
      ],
      fun: [
        "Halftime! It's {score}, and {leader} is putting on a show with {lpts} points!",
        "Two quarters down! {score}. {leader} is the fantasy MVP so far with {lpts}!",
        "Grab a snack! {score} at the break, and {leader} has {lpts} fantasy points already!"
      ]
    },
    wrap: {
      straight: [
        "Final score, {score}. The play that decided it: {decider}. Top performer, {leader} with {lpts} fantasy points.",
        "That's the final, {score}. {decider} turned out to be the difference. {leader} led everyone with {lpts}.",
        "It ends {score}. The {winner} won it on {decider}. {leader} had the best day, {lpts} fantasy points."
      ],
      fun: [
        "Game over, {score}! The dagger: {decider}. And {leader} goes home with {lpts} points!",
        "That's a wrap, {score}! {decider} won it. Shout out to {leader}, {lpts} points!",
        "Put it in the books! {score}! {decider} sealed it, and {leader} was unstoppable with {lpts}!"
      ]
    },
    wrap_tie: {
      straight: [
        "It ends level, {score}. Top performer, {leader} with {lpts} fantasy points.",
        "A tie at {score}. {leader} led everyone with {lpts} fantasy points.",
        "Final score {score}, nobody wins it. {leader} had the best day with {lpts}."
      ],
      fun: [
        "A tie! {score}! {leader} still went off for {lpts} points!",
        "Nobody blinks! {score}! At least {leader} got {lpts}!",
        "All square at {score}! {leader} takes home {lpts} points!"
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
    var list = table[kind] && table[kind][style];
    if (!list || !list.length) return '';
    var key = (table === LINES ? '' : 'story:') + kind + '|' + style;
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

  function points(n) { return n + (n === 1 ? ' point' : ' points'); }

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
    v.yards = v.yds + (v.yds === 1 ? ' yard' : ' yards');

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
      .replace(/^(\S+) pass to (\S+) for (\d+)$/, '$1 to $2 for $3')
      .replace(/^(\S+) runs for (\d+)$/, 'the $2 yard run by $1');
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
          v.lead = score[0] === score[1] ? 'All square at the break.' :
            'The ' + teams[score[0] > score[1] ? 0 : 1].name + ' lead by ' + Math.abs(score[0] - score[1]) + '.';
        }
        if (kind === 'wrap') {
          if (score[0] === score[1]) k = 'wrap_tie';
          else {
            var w = score[0] > score[1] ? 0 : 1;
            v.winner = teams[w].name;
            v.decider = decider(ctx.plays, w) || ('the ' + teams[w].name + ' defense holding on');
          }
        }
      }
      var text = fill(pick(k, style, STORIES), v);
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
      return { straight: info('straight'), fun: info('fun'), available: n };
    },

    setStyle: function (name) {
      if (STYLES.indexOf(name) >= 0) api.style = name;
      return api.style;
    },

    catchUp: catchUp,
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
    seed: function (n) { seedBase = n == null ? 1 : n; decks = {}; lastUsed = {}; rounds = {}; return seedBase; },
    _setRandom: function (fn) { rand = fn || null; decks = {}; lastUsed = {}; rounds = {}; }
  };

  root.FF_ANNOUNCER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
