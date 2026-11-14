// The announcer. Sets window.FF_ANNOUNCER as docs/CONTRACT.md section 3 says:
//   line(res, ctx)  the sentence for a finished play, or '' to stay quiet.
//                   res is the object the `result` event carries (from js/rules.js).
//                   ctx is { teams, score, style }. score and style are optional:
//                   score falls back to res.post.score, style to the current style.
//                   For halftime and the final there is no play result, so pass
//                   { kind: 'half' } or { kind: 'final' } as res, with ctx.score set.
//   speak(text)     says it with the browser's speech voice; does nothing without one.
//   setStyle(name)  'straight' or 'fun'. style holds the current one.
//   reset()         starts a new game: every line becomes available again.
//   onLine(fn)      fn(text, kind, style) is called for every line produced, spoken or not.
//                   Returns a function that removes the listener.
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
  var last = null;    // the last caption

  function announce(text, kind, style) {
    last = { text: text, kind: kind, style: style, at: Date.now() };
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](text, kind, style); } catch (err) { /* a listener must never stop the game */ }
    }
  }

  function lastName(name) { return String(name || '').split(' ').pop(); }

  // Pick a variant without repeating until all have been said.
  function pick(kind, style) {
    var list = LINES[kind] && LINES[kind][style];
    if (!list || !list.length) return '';
    var key = kind + '|' + style;
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

  var api = {
    style: 'straight',

    line: function (res, ctx) {
      try {
        ctx = ctx || {};
        var teams = ctx.teams;
        if (!res || !teams || teams.length < 2) return '';
        var score = ctx.score || (res.post && res.post.score) || [0, 0];
        var style = STYLES.indexOf(ctx.style) >= 0 ? ctx.style : api.style;
        var c = classify(res, teams, score);
        if (!c.kind) return '';
        var text = fill(pick(c.kind, style), c.v);
        if (text) announce(text, c.kind, style);
        return text;
      } catch (err) {
        return ''; // the announcer must never stop the game
      }
    },

    speak: function (text) {
      if (!text || typeof root.speechSynthesis === 'undefined' || typeof root.SpeechSynthesisUtterance === 'undefined') return;
      try {
        root.speechSynthesis.cancel();
        var u = new root.SpeechSynthesisUtterance(text);
        u.rate = api.style === 'fun' ? 1.2 : 1.1;
        u.pitch = api.style === 'fun' ? 1.15 : 1;
        root.speechSynthesis.speak(u);
      } catch (err) { /* speech is optional */ }
    },

    setStyle: function (name) {
      if (STYLES.indexOf(name) >= 0) api.style = name;
      return api.style;
    },

    reset: function () { decks = {}; lastUsed = {}; last = null; },

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
