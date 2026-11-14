// The soccer announcer. Sets window.SC_ANNOUNCER with the same members as FF_ANNOUNCER
// (docs/CONTRACT.md section 3), for the soccer game in soccer/:
//   line(res, ctx)  the line for a finished soccer event, or '' to stay quiet. res is the object
//                   the soccer `result` event carries (soccer/js/rules.js). ctx is { teams, score,
//                   style }; score falls back to res.post.score. For half time and full time pass
//                   { kind: 'half' } or { kind: 'final' } with ctx.score.
//   speak(text)     says it with the browser's voice, British English when there is one. Lines
//                   wait their turn, a line more than two events old is dropped, silent when
//                   window.__sc.speed is above 2 or the soccer view is closed. hush() stops it.
//   setStyle(name)  'straight' or 'fun'. style holds the current one.
//   onLine(fn)      fn(text, kind, style) for every line produced; returns a remover.
//   caption()       the last line: { text, kind, style, at }, or null.
//   memory()        what the announcer remembers: goals per player, saves per keeper, the score.
//                   line() uses it for a brace, a hat-trick, an equaliser, a late equaliser, a
//                   late winner and a keeper's third save. Goals are always called; other
//                   remarks wait at least 2 events after the last one.
//   explain(kind)   one or two plain sentences on a soccer rule for the rule cards; '' for an
//                   unknown kind. explainKinds lists them; explainFor(res) gives a result's kinds.
//   transcript()    every line said in this match: [ { t, text, kind, event } ]. reset() empties it.
//   maxLength       56, one line of the captions strip at 375 pixels wide.
//   reset()         a new match.
// Needs js/announcer/soccer/lines.js loaded first (in Node it is required directly).
(function (root) {
  'use strict';

  var LINES = root.SC_ANNOUNCER_LINES ||
    (typeof require === 'function' ? require('./lines.js') : null) || {};
  var STYLES = ['straight', 'fun'];
  var decks = {}, lastUsed = {}, rand = null, rounds = {}, seedBase = 1;
  var listeners = [], last = null, eventNo = 0;

  function lastName(name) { return String(name || '').split(' ').pop(); }

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
    var key = (table === LINES ? '' : 'm:') + kind + '|' + style;
    if (!decks[key] || !decks[key].length) {
      rounds[key] = (rounds[key] || 0) + 1;
      var rnd = rand || seeded(hashStr(seedBase + '|' + key + '|' + rounds[key]));
      var d = list.map(function (_, i) { return i; });
      for (var i = d.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = d[i]; d[i] = d[j]; d[j] = t; }
      if (d.length > 1 && d[d.length - 1] === lastUsed[key]) d.unshift(d.pop());
      decks[key] = d;
    }
    var idx = decks[key].pop();
    lastUsed[key] = idx;
    return list[idx];
  }

  function fill(text, v) {
    return text.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); });
  }

  function ordinal(n) {
    n = +n || 0;
    var t = n % 100, u = n % 10;
    return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th');
  }

  function scoreText(teams, score) { return teams[0].name + ' ' + score[0] + ', ' + teams[1].name + ' ' + score[1]; }

  var said = [];

  function announce(text, kind, style) {
    last = { text: text, kind: kind, style: style, at: Date.now() };
    said.push({ t: last.at, text: text, kind: kind, event: eventNo });
    for (var i = 0; i < listeners.length; i++) { try { listeners[i](text, kind, style); } catch (err) { /* never stop the match */ } }
  }

  // ---- What kind of line a soccer result needs ----
  var secondHalfStarted = false;

  function classify(res, teams, score) {
    var v = { score: scoreText(teams, score), t0: teams[0].name, t1: teams[1].name };
    if (res.kind === 'half') return { kind: 'half', v: v };
    if (res.kind === 'final') {
      if (score[0] === score[1]) return { kind: 'final_draw', v: v };
      var w = score[0] > score[1] ? 0 : 1;
      v.winner = teams[w].name; v.loser = teams[1 - w].name;
      return { kind: 'final', v: v };
    }
    var e = res.e || {}, t = res.team;
    if (t !== 0 && t !== 1) return { kind: '', v: v };
    var R = teams[t].roster || {}, O = teams[1 - t].roster || {};
    v.team = teams[t].name; v.def = teams[1 - t].name; v.min = e.min; v.minth = ordinal(e.min);
    v.player = lastName(R[e.by]); v.keeper = lastName(O.GK);
    switch (e.t) {
      case 'kickoff':
        if (e.min === 0) return { kind: 'kickoff_start', v: v };
        if (res.half === 2 && !secondHalfStarted) { secondHalfStarted = true; return { kind: 'kickoff_second', v: v }; }
        return { kind: 'kickoff_restart', v: v };
      case 'build':
        var chain = e.chain || [];
        v.a = lastName(R[chain[0]]); v.b = lastName(R[chain[chain.length - 1]]);
        if (res.regain) return { kind: 'regain', v: v };
        return { kind: chain.length >= 3 ? 'build' : '', v: v };
      case 'shot':
      case 'pen':
        if (e.out === 'in') {
          if (res.disallowed) return { kind: 'goal_disallowed', v: v };
          if (e.t === 'pen') return { kind: 'goal_pen', v: v };
          if (e.head) return { kind: 'goal_head', v: v };
          if (e.assist) { v.assist = lastName(R[e.assist]); return { kind: 'goal_assist', v: v }; }
          return { kind: 'goal', v: v };
        }
        if (e.out === 'saved') return { kind: e.t === 'pen' ? 'save_pen' : 'save', v: v };
        if (e.out === 'wide') return { kind: e.t === 'pen' ? 'pen_miss' : 'wide', v: v };
        if (e.out === 'post') return { kind: 'post', v: v };
        if (e.out === 'blocked') return { kind: 'blocked', v: v };
        return { kind: '', v: v };
      case 'corner':
        if (e.to) { v.victim = lastName(R[e.to]); return { kind: 'corner_to', v: v }; }
        return { kind: 'corner_cleared', v: v };
      case 'freekick':
        if (e.to) { v.victim = lastName(R[e.to]); return { kind: 'freekick_to', v: v }; }
        return { kind: 'freekick_direct', v: v };
      case 'foul':
        v.victim = lastName(O[e.on]);
        if (e.box) return { kind: 'penalty_given', v: v };
        if (res.card === 'red') return { kind: 'foul_red', v: v };
        if (res.card === 'yellow') return { kind: 'foul_yellow', v: v };
        return { kind: 'foul', v: v };
      case 'offside':
        return { kind: 'offside', v: v };
    }
    return { kind: '', v: v };   // 'ft' (clean sheets) and anything new stays quiet
  }

  // ---- Rule explainers ----
  var EXPLAIN = {
    offside: "An attacker is offside when the ball is played to them while they are past the last defender. The goal or chance does not count.",
    corner: "When a defender sends the ball out over their own goal line, the attackers take a corner kick from the corner flag.",
    free_kick: "After a foul, the fouled team restarts with a free kick from where it happened. Close to goal, the taker can shoot.",
    penalty_kick: "A foul inside the big box in front of goal gives a penalty: one shot from 11 meters with only the keeper to beat.",
    yellow: "A yellow card is a warning for a bad foul or bad behavior. A second yellow in the same match means a red card.",
    red: "A red card sends a player off for the rest of the match, and the team cannot replace them. They play with ten.",
    throw_in: "When the ball goes out over the side line, the other team throws it back in with both hands from over the head.",
    goal_kick: "When an attacker sends the ball out over the goal line, the defending team restarts with a kick from its own box.",
    extra_time: "A few minutes are added at the end of each half for time lost to stoppages. Tied knockout games can also play 30 more minutes."
  };

  function explainFor(res) {
    if (!res) return [];
    var e = res.e || {}, k = [];
    if (e.t === 'offside' || res.disallowed) k.push('offside');
    if (e.t === 'corner') k.push('corner');
    if (e.t === 'freekick') k.push('free_kick');
    if (e.t === 'pen' || (e.t === 'foul' && e.box)) k.push('penalty_kick');
    if (res.card === 'yellow') k.push('yellow');
    if (res.card === 'red') k.push('red');
    if (e.t === 'shot' && e.out === 'wide') k.push('goal_kick');
    if (e.t === 'throwin') k.push('throw_in');
    if (e.min > 90 || (e.min > 45 && res.half === 1)) k.push('extra_time');
    return k;
  }

  // ---- Memory: the match so far ----
  var MEMORY = {
    hat_trick: {
      straight: ['HAT-TRICK! {player} has three!', '{player} completes the hat-trick!', 'Three for {player}! A hat-trick!'],
      fun: ['HAT-TRICK! Somebody get {player} the ball!', 'Three! {player} takes the match ball home!', '{player}! Hat-trick hero!']
    },
    late_winner: {
      straight: ['{player} in the {minth} minute! Surely the winner!', 'Late drama! {player} puts {team} ahead!', '{min} minutes gone, and {player} scores!'],
      fun: ['LATE, LATE WINNER! {player}!', 'Scenes! {player} at the death!', 'Never in doubt! {player} wins it late!']
    },
    late_equaliser: {
      straight: ['{player} levels it in the {minth} minute!', 'A late equaliser! {player}!', 'Right at the end, {player} pulls {team} level!'],
      fun: ['LATE EQUALISER! {player}!', 'Never say die! {player} levels it!', '{player} rescues a point! Unbelievable!']
    },
    brace: {
      straight: ['{player} again! That\'s two for {player}.', 'A brace for {player}! {score}.', 'Second of the game for {player}!'],
      fun: ['{player} again! Two goals! Hat-trick on?', 'Double trouble! {player} has two!', '{player} is on fire! That\'s a brace!']
    },
    equaliser: {
      straight: ['{player} levels it! {score}.', 'And {team} are level! {player} scores!', 'The equaliser! {player}! All square.'],
      fun: ['Game on! {player} levels it!', 'All square! {player} with the equaliser!', 'Back in it! {player} equalises!']
    },
    keeper_third: {
      straight: ['Another save from {keeper}. That\'s three now.', '{keeper} again! A busy day for {keeper}.', 'Third save of the match for {keeper}.'],
      fun: ['{keeper} is a wall today!', 'Brick wall! {keeper} denies {player}!', '{keeper} again! Give the keeper a raise!']
    }
  };
  var GOAL_MEMORY = ['hat_trick', 'late_winner', 'late_equaliser', 'brace', 'equaliser'];
  var MEM_GAP = 2;

  function freshMemory() { return { goals: {}, saves: [0, 0], lastRemark: -99, log: [] }; }
  var mem = freshMemory();

  function remember(res) {
    var e = res.e || {}, t = res.team, out = [], v = {};
    if ((t !== 0 && t !== 1) || !res.post || !res.pre) return { kinds: out, v: v };
    var pre = res.pre.score, post = res.post.score;
    if (res.goal) {
      var k = t + '|' + res.scorer;
      mem.goals[k] = (mem.goals[k] || 0) + 1;
      var n = mem.goals[k];
      var levelNow = post[0] === post[1], levelBefore = pre[0] === pre[1];
      if (n === 3) out.push('hat_trick');
      if (e.min >= 85 && levelBefore && !levelNow) out.push('late_winner');
      if (e.min >= 80 && levelNow) out.push('late_equaliser');
      if (n === 2) out.push('brace');
      if (levelNow) out.push('equaliser');
    }
    if ((e.t === 'shot' || e.t === 'pen') && e.out === 'saved') {
      var kt = 1 - t; mem.saves[kt]++;
      if (mem.saves[kt] === 3) out.push('keeper_third');
    }
    mem.log.push({ event: eventNo, t: e.t, team: t, min: e.min, score: post.slice(), earned: out.slice() });
    return { kinds: out, v: v };
  }

  function memoryLine(r, base, style) {
    if (!r.kinds.length) return null;
    var kind = null, gap = eventNo - mem.lastRemark;
    for (var i = 0; i < GOAL_MEMORY.length && !kind; i++) if (r.kinds.indexOf(GOAL_MEMORY[i]) >= 0) kind = GOAL_MEMORY[i];
    if (!kind && r.kinds.indexOf('keeper_third') >= 0 && gap >= MEM_GAP) kind = 'keeper_third';
    if (!kind) return null;
    var text = fill(pick(kind, style, MEMORY), base);
    if (!text || /\{\w+\}/.test(text) || text.length > api.maxLength) return null;
    mem.lastRemark = eventNo;
    return { kind: 'memory_' + kind, text: text };
  }

  // ---- Speech: British English first, one line at a time ----
  var queue = [], speaking = null, speakTimer = 0, chosen = { straight: null, fun: null };
  var VOICE_SET = { straight: { rate: 1.05, pitch: 1.0 }, fun: { rate: 1.15, pitch: 1.1 } };
  function synth() { return root.speechSynthesis && root.SpeechSynthesisUtterance ? root.speechSynthesis : null; }
  function voiceScore(v) {
    var lang = String(v.lang || '').toLowerCase().replace('_', '-'), name = String(v.name || '');
    if (lang.indexOf('en') !== 0) return -1;
    var sc = 10 + (lang === 'en-gb' ? 8 : lang === 'en-ie' || lang === 'en-au' ? 3 : 0);
    if (/natural|neural|premium|enhanced|online/i.test(name)) sc += 6;
    if (/google uk english male|daniel|george|arthur|ryan|thomas|oliver/i.test(name)) sc += 3;
    if (/compact|eloquence|whisper|zarvox|trinoids|organ|jester|bells|bubbles/i.test(name)) sc -= 20;
    return sc;
  }
  function chooseVoices() {
    var sy = synth(), list = [];
    try { list = sy && sy.getVoices ? sy.getVoices() || [] : []; } catch (err) { list = []; }
    var best = null, bs = -1;
    list.forEach(function (v) { var s = voiceScore(v); if (s > bs) { best = v; bs = s; } });
    chosen.straight = chosen.fun = best;
    return list.length;
  }
  function tooFast() { var sc = root.__sc; return !!(sc && +sc.speed > 2); }
  function offScreen() { var g = root.SC_GAME; return !!(g && g.active === false); }
  function speakNext() {
    var sy = synth();
    clearTimeout(speakTimer); speaking = null;
    if (!sy || tooFast() || offScreen()) { queue.length = 0; return; }
    while (queue.length && eventNo - queue[0].at > 2) queue.shift();
    var item = queue.shift();
    if (!item) return;
    if (!chosen.straight) chooseVoices();
    try {
      var u = new root.SpeechSynthesisUtterance(item.text), set = VOICE_SET[item.style] || VOICE_SET.straight;
      if (chosen[item.style]) { u.voice = chosen[item.style]; u.lang = chosen[item.style].lang; }
      u.rate = set.rate; u.pitch = set.pitch;
      var done = function () { if (speaking === item) speakNext(); };
      u.onend = done; u.onerror = done;
      speaking = item; sy.speak(u);
      speakTimer = setTimeout(done, Math.round(item.text.split(/\s+/).length / (2.6 * set.rate) * 1000) + 2500);
    } catch (err) { speaking = null; }
  }

  var api = {
    style: 'straight',
    maxLength: 56,

    line: function (res, ctx) {
      try {
        ctx = ctx || {};
        var teams = ctx.teams;
        if (!res || !teams || teams.length < 2) return '';
        var score = ctx.score || (res.post && res.post.score) || [0, 0];
        var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
        var c = classify(res, teams, score);
        var r = { kinds: [], v: {} };
        if (res.e) { eventNo++; r = remember(res); }
        if (!c.kind) return '';
        var m = memoryLine(r, c.v, style);
        if (m) { announce(m.text, m.kind, style); return m.text; }
        var text = fill(pick(c.kind, style), c.v);
        if (/\{\w+\}/.test(text)) text = '';
        if (text) announce(text, c.kind, style);
        return text;
      } catch (err) {
        return '';
      }
    },

    speak: function (text) {
      if (!text || !synth()) return;
      if (tooFast()) { api.hush(); return; }
      queue.push({ text: String(text), at: eventNo, style: api.style });
      if (!speaking) speakNext();
    },

    hush: function () {
      queue.length = 0; clearTimeout(speakTimer); speaking = null;
      var sy = synth(); if (sy) { try { sy.cancel(); } catch (err) { /* optional */ } }
    },

    voices: function () {
      var n = synth() ? chooseVoices() : 0, v = chosen.straight;
      return { voice: v ? v.name : '(browser default)', lang: v ? v.lang : '', available: n };
    },

    setStyle: function (name) { if (STYLES.indexOf(name) >= 0) api.style = name; return api.style; },

    onLine: function (fn) {
      if (typeof fn !== 'function') return function () {};
      listeners.push(fn);
      return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    },

    caption: function () { return last ? { text: last.text, kind: last.kind, style: last.style, at: last.at } : null; },

    memory: function () {
      return {
        goals: Object.keys(mem.goals).map(function (k) { var p = k.split('|'); return { team: +p[0], slot: p[1], goals: mem.goals[k] }; }),
        saves: mem.saves.slice(), log: mem.log.slice()
      };
    },

    explain: function (kind) { return Object.prototype.hasOwnProperty.call(EXPLAIN, kind) ? EXPLAIN[kind] : ''; },
    explainKinds: Object.keys(EXPLAIN),
    explainFor: explainFor,
    explainMaxLength: 160,
    transcript: function () { return said.map(function (x) { return { t: x.t, text: x.text, kind: x.kind, event: x.event }; }); },

    reset: function () {
      said = [];
      decks = {}; lastUsed = {}; rounds = {}; last = null; eventNo = 0; secondHalfStarted = false; mem = freshMemory(); api.hush();
    },

    kinds: function () { return Object.keys(LINES); },
    classify: classify,
    _memoryLines: MEMORY,
    seed: function (n) { seedBase = n == null ? 1 : n; decks = {}; lastUsed = {}; rounds = {}; return seedBase; },
    _setRandom: function (fn) { rand = fn || null; decks = {}; lastUsed = {}; rounds = {}; }
  };

  if (synth() && root.speechSynthesis.addEventListener) {
    try { root.speechSynthesis.addEventListener('voiceschanged', chooseVoices); } catch (err) { /* optional */ }
  }

  root.SC_ANNOUNCER = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
