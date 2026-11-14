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
  var rand = Math.random;
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

  function announce(text, kind, style) {
    last = { text: text, kind: kind, style: style, at: Date.now() };
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
      high: ['The offense runs through {name}.', 'Feed {name}, it works.', '{name} is the engine of this ground game.'],
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

  function tendencyNote(res, teams, profiles) {
    if (!profiles || !res || !res.e || !res.pre) return '';
    var off = res.pre.poss;
    if (off !== 0 && off !== 1) return '';
    var team = teams[off], profile = profileFor(profiles, team);
    if (!profile) return '';
    var topics = tendencyTopics(res);
    for (var i = 0; i < topics.length; i++) {
      var slot = topics[i][0], key = topics[i][1];
      if (!slot || !TENDENCY[key]) continue;
      var v = tendencyValue(profile, slot, key);
      if (v === null || (v > 0.3 && v < 0.7)) continue;
      var id = team.id + '|' + slot + '|' + key;
      if (tendencySaid[id] != null && playNo - tendencySaid[id] < TENDENCY_GAP) continue;
      tendencySaid[id] = playNo;
      var who = (profile.players[slot] && profile.players[slot].name) || (team.roster || {})[slot] || '';
      if (!who) continue;
      return fill(pick(key, v >= 0.7 ? 'high' : 'low', TENDENCY), { name: lastName(who) });
    }
    return '';
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

  function pick(kind, style, table) {
    table = table || LINES;
    var list = table[kind] && table[kind][style];
    if (!list || !list.length) return '';
    var key = (table === LINES ? '' : 'story:') + kind + '|' + style;
    if (!decks[key] || !decks[key].length) {
      var d = list.map(function (_, i) { return i; });
      for (var i = d.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t;
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
        v.spot = teams[off].id + ' ' + e.to;
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
        if (!c.kind) return '';
        var text = fill(pick(c.kind, style), c.v);
        var note = ctx.profiles ? tendencyNote(res, teams, ctx.profiles) : '';
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

    reset: function () { decks = {}; lastUsed = {}; last = null; playNo = 0; tendencySaid = {}; api.hush(); },

    onLine: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    caption: function () { return last ? { text: last.text, kind: last.kind, style: last.style, at: last.at } : null; },

    // For js/announcer/check.js and tests.
    kinds: function () { return Object.keys(LINES); },
    classify: classify,
    _setRandom: function (fn) { rand = fn || Math.random; }
  };

  root.FF_ANNOUNCER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
