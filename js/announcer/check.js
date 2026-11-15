// Prints one announcer line per kind and style so a person can read them all,
// then plays the sample game through the rules engine and prints what the
// announcer would say on every play. Fails if a placeholder is left unfilled,
// a kind has fewer than three variants per style, or a line repeats too soon.
// Run from the repo root:  node js/announcer/check.js        (add --all to print every variant)
'use strict';
var LINES = require('./lines.js');
var A = require('./index.js');
var data = require('../data.js');
var Rules = require('../rules.js');

var showAll = process.argv.indexOf('--all') >= 0;
var STYLES = ['straight'];
var problems = [];

// A fixed random source so the output is the same every run.
var seed = 7;
A._setRandom(function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; });

// Sample values for every placeholder, for the catalogue below.
var sample = {
  team: 'Goblins', def: 'Pythons', player: 'Vance', qb: 'Marlowe', kicker: 'Petrov',
  yds: 12, yards: '12 yards', loss: 7, dist: 44, net: 41, pen: 5, spot: 'GOB 27',
  score: 'Goblins 14, Pythons 10', teamscore: '14 points', winner: 'Goblins', loser: 'Pythons'
};
function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (m, k) { return v[k] == null ? m : String(v[k]); }); }

// The longest values a line can be filled with: the longest last name and team name in the
// data, the longest score. Every line must still fit FF_ANNOUNCER.maxLength.
var worst = (function () {
  var names = [], tnames = [], fs = require('fs'), path = require('path'), all = data.TEAMS.slice();
  // Also every game file the app can play, so a new game with longer names fails here.
  var dir = path.join(__dirname, '../../data/games');
  (fs.existsSync(dir) ? fs.readdirSync(dir) : []).forEach(function (f) {
    if (!/\.json$/.test(f)) return;
    try { (JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')).teams || []).forEach(function (t) { if (t && t.roster) all.push(t); }); } catch (err) { /* not a game file */ }
  });
  all.forEach(function (t) {
    tnames.push(t.name);
    Object.keys(t.roster).forEach(function (k) { names.push(String(t.roster[k]).split(' ').pop()); });
  });
  function longest(a) { return a.reduce(function (x, y) { return y.length > x.length ? y : x; }, ''); }
  var n = longest(names), t = longest(tnames);
  return { team: t, def: t, player: n, qb: n, kicker: n, yds: 99, yards: '99 yards', loss: 12, dist: 58, net: 62, pen: 15,
    spot: 'GOB 35', score: t + ' 28, ' + t + ' 24', teamscore: '28 points', winner: t, loser: t };
})();

console.log('== Every kind, every style ==');
Object.keys(LINES).forEach(function (kind) {
  STYLES.forEach(function (style) {
    var list = LINES[kind][style] || [];
    if (list.length < 3) problems.push(kind + ' ' + style + ' has ' + list.length + ' variants, needs 3');
    list.forEach(function (t) {
      if (/\u2014/.test(t)) problems.push('em dash in ' + kind + ' ' + style + ': ' + t);
      var long = fill(t, worst);
      if (long.length > A.maxLength) problems.push(kind + ' ' + style + ' is ' + long.length + ' characters with the longest names (max ' + A.maxLength + '): ' + long);
      var out = fill(t, sample);
      if (/\{\w+\}/.test(out)) problems.push('unknown placeholder in ' + kind + ' ' + style + ': ' + t);
    });
    var shown = showAll ? list : list.slice(0, 1);
    shown.forEach(function (t) {
      console.log(pad(kind, 16) + pad(style, 9) + fill(t, sample));
    });
  });
});

// Play the sample game, both styles.
STYLES.forEach(function (style) {
  console.log('\n== Sample game, ' + style + ' ==');
  A.reset();
  var teams = data.TEAMS;
  var s = Rules.create(teams);
  var steps = Rules.flatten(data.SAMPLE_GAME, teams);
  var recent = {};
  steps.forEach(function (st, i) {
    var res;
    if (st.kind === 'half') { Rules.startHalf(s); res = { kind: 'half' }; }
    else if (st.kind === 'final') { res = { kind: 'final' }; }
    else res = Rules.apply(s, st.e, st.team);
    var kind = res.kind === 'half' || res.kind === 'final' ? res.kind : A.classify(res, teams, res.post.score).kind;
    var text = A.line(res, { teams: teams, score: s.score.slice(), style: style });
    if (!text) problems.push('no line for step ' + i + ' (' + (st.e ? st.e.t : st.kind) + ')');
    if (/\{\w+\}/.test(text)) problems.push('unfilled placeholder: ' + text);
    if (text.length > A.maxLength) problems.push('sample game line too long (' + text.length + '): ' + text);
    // The same sentence must not come back before the other variants of its kind have been used.
    var n = (LINES[kind] && LINES[kind][style] || []).length;
    if (recent[text] != null && i - recent[text] < n) {
      var between = 0;
      for (var k in recent) if (recent[k] > recent[text]) between++;
      if (between < n - 1) problems.push('repeated too soon: ' + text);
    }
    recent[text] = i;
    console.log('  ' + pad(kind, 16) + text);
  });
});

// Captions: onLine gets every line, caption() returns the last one, and a
// listener that throws or is removed does not break anything.
(function () {
  A.reset();
  if (A.caption() !== null) problems.push('caption() should be null after reset');
  var got = [], off = A.onLine(function (text, kind, style) { got.push([text, kind, style]); });
  A.onLine(function () { throw new Error('bad listener'); });
  var teams = data.TEAMS, s = Rules.create(teams), n = 0;
  Rules.flatten(data.SAMPLE_GAME, teams).slice(0, 12).forEach(function (st) {
    if (st.kind !== 'play') return;
    var res = Rules.apply(s, st.e, st.team);
    var t = A.line(res, { teams: teams, style: 'straight' });
    if (t) n++;
    var c = A.caption();
    if (t && (!c || c.text !== t || c.style !== 'straight' || typeof c.at !== 'number')) problems.push('caption() does not match the last line: ' + t);
  });
  if (got.length !== n) problems.push('onLine got ' + got.length + ' lines, expected ' + n);
  if (got.length && !got[0][1]) problems.push('onLine got no kind');
  var half = A.line({ kind: 'half' }, { teams: teams, score: [7, 3], style: 'straight' });
  var last = got[got.length - 1];
  if (!last || last[0] !== half || last[1] !== 'half' || last[2] !== 'straight') problems.push('onLine missed the halftime line');
  off();
  A.line({ kind: 'final' }, { teams: teams, score: [7, 3] });
  if (got[got.length - 1][1] === 'final') problems.push('removed listener still called');
  if (A.caption().kind !== 'final') problems.push('caption() not updated after the listener was removed');
  console.log('\nCaptions: ' + got.length + ' lines heard by onLine, last caption: ' + A.caption().text);
})();

// Intro, halftime and wrap: two or three sentences each, both styles, every variant,
// built from the sample game's real numbers.
(function () {
  var teams = data.TEAMS, st = Rules.create(teams), plays = [], fp = {}, halfScore = null, halfLeaders = null;
  function leaders() { return Object.keys(fp).map(function (n) { return { name: n, points: fp[n] }; }); }
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) {
    if (x.kind === 'half') { Rules.startHalf(st); halfScore = st.score.slice(); halfLeaders = leaders(); return; }
    if (x.kind !== 'play') return;
    var r = Rules.apply(st, x.e, x.team); plays.push(r);
    r.fp.forEach(function (f) {
      var n = f.role === 'DST' ? teams[f.team].name + ' defense' : teams[f.team].roster[f.role];
      fp[n] = (fp[n] || 0) + f.pts;
    });
  });
  var heard = 0, off = A.onLine(function () { heard++; }), made = 0;
  var cases = [
    ['intro', { teams: teams, leaders: leaders() }],
    ['halftime', { teams: teams, score: halfScore, leaders: halfLeaders, plays: plays }],
    ['wrap', { teams: teams, score: st.score.slice(), leaders: leaders(), plays: plays }],
    ['wrap', { teams: teams, score: [7, 7], leaders: leaders(), plays: plays }]
  ];
  console.log('\n== Intro, halftime, wrap ==');
  cases.forEach(function (c) {
    STYLES.forEach(function (style) {
      for (var i = 0; i < 3; i++) {
        var ctx = Object.assign({ style: style }, c[1]);
        var t = A[c[0]](ctx); made++;
        var n = (t.match(/[.!?](\s|$)/g) || []).length;
        if (!t) problems.push(c[0] + ' ' + style + ' returned nothing');
        if (n < 2 || n > 3) problems.push(c[0] + ' ' + style + ' has ' + n + ' sentences: ' + t);
        if (/\{\w+\}|undefined|NaN/.test(t)) problems.push(c[0] + ' ' + style + ' left a gap: ' + t);
        if (i === 0) console.log('  ' + pad(c[0], 9) + pad(style, 9) + t);
      }
    });
  });
  // Hidden scores: no fantasy numbers in the halftime piece.
  STYLES.forEach(function (style) {
    for (var i = 0; i < 3; i++) {
      var t = A.halftime({ teams: teams, score: halfScore, leaders: halfLeaders, plays: plays, style: style, hidden: true }); made++;
      var nums = (t.match(/\d+(\.\d+)?/g) || []).filter(function (x) { return halfScore.indexOf(+x) < 0 && +x !== Math.abs(halfScore[0] - halfScore[1]); });
      if (/fantasy|points/i.test(t) || nums.length) problems.push('hidden halftime gives fantasy numbers away: ' + t);
      if (i === 0) console.log('  ' + pad('half/hid', 9) + pad(style, 9) + t);
    }
  });
  if (heard !== made) problems.push('onLine heard ' + heard + ' of ' + made + ' longer pieces');
  off();
  if (A.intro({}) !== '' || A.wrap({ teams: teams, score: [3, 0] }) !== '') problems.push('intro or wrap without data should be quiet');
})();

// Voice choice and the speech queue, with a stand-in for the browser's speech engine.
(function () {
  var spoken = [], cancels = 0, current = null;
  var voiceList = [
    { name: 'Zarvox', lang: 'en-US', localService: true },
    { name: 'Thomas', lang: 'fr-FR', localService: true },
    { name: 'Samantha', lang: 'en-US', localService: true },
    { name: 'Microsoft Guy Online (Natural)', lang: 'en-US', localService: false },
    { name: 'Daniel', lang: 'en-GB', localService: true }
  ];
  globalThis.SpeechSynthesisUtterance = function (t) { this.text = t; };
  globalThis.speechSynthesis = {
    getVoices: function () { return voiceList; },
    speak: function (u) { spoken.push(u); current = u; },
    cancel: function () { cancels++; current = null; }
  };
  function end() { var u = current; current = null; if (u && u.onend) u.onend(); }
  var teams = data.TEAMS, st = Rules.create(teams), plays = [];
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) { if (x.kind === 'play') plays.push(x); });
  function play(i) { return A.line(Rules.apply(st, plays[i].e, plays[i].team), { teams: teams }); }

  A.reset(); spoken.length = 0; cancels = 0;
  var v = A.voices();
  if (v.straight.name !== 'Microsoft Guy Online (Natural)') problems.push('straight voice should be the natural English one, got ' + v.straight.name);

  // Three lines in a row: one at a time, nothing cut off.
  A.speak('one'); A.speak('two'); A.speak('three');
  if (spoken.length !== 1 || cancels !== 0) problems.push('a new line cut off or skipped the queue');
  end(); end(); end();
  if (spoken.map(function (u) { return u.text; }).join() !== 'one,two,three') problems.push('queue order wrong: ' + spoken.map(function (u) { return u.text; }).join());

  // A line that waits more than two plays is dropped; one that waits two is kept.
  spoken.length = 0;
  A.speak('long line'); A.speak('stale'); play(0);
  A.speak('fresh'); play(1); play(2);
  end();
  var said = spoken.map(function (u) { return u.text; });
  if (said.indexOf('stale') >= 0) problems.push('a line three plays old was still spoken');
  if (said.indexOf('fresh') < 0) problems.push('a line two plays old was dropped');
  end();

  // Above speed 2 it stays silent and empties the queue.
  spoken.length = 0; globalThis.__ff = { speed: 4 };
  A.speak('too fast');
  if (spoken.length) problems.push('spoke at speed 4');
  globalThis.__ff = { speed: 1 };

  // Game view closed: the game cancels speech, the queue must not carry on.
  spoken.length = 0; globalThis.FF_GAME = { active: true };
  A.speak('on screen'); A.speak('queued');
  globalThis.FF_GAME.active = false; end();
  if (spoken.length !== 1) problems.push('kept speaking after the game view closed');
  delete globalThis.FF_GAME;
  A.hush();
  console.log('\nVoices: straight ' + v.straight.name + ' (rate ' + v.straight.rate + '), queue and age checks run');
  delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; delete globalThis.__ff;
})();

// Tendency remarks: nothing from the real profiles while their numbers are null, and the
// right remark from numbers made up here for the test only (never written to data/).
(function () {
  var fs = require('fs'), path = require('path');
  var teams = data.TEAMS, real = {};
  teams.forEach(function (t) {
    var f = path.join(__dirname, '../../data/profiles/' + t.id + '.json');
    if (fs.existsSync(f)) real[t.id] = JSON.parse(fs.readFileSync(f, 'utf8'));
  });
  function run(profiles) {
    A.reset();
    var st = Rules.create(teams), lines = [];
    Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) {
      if (x.kind === 'half') { Rules.startHalf(st); return; }
      if (x.kind !== 'play') return;
      lines.push(A.line(Rules.apply(st, x.e, x.team), { teams: teams, profiles: profiles }));
    });
    return lines;
  }
  var plain = run(null), withReal = run(real);
  // Lines are picked from shuffled decks, so compare lengths: a remark makes a line longer.
  var longer = withReal.filter(function (t, i) { return t.split('. ').length > plain[i].split('. ').length + 1; }).length;
  // While a profile's tendencies are all null, it must add nothing. Real numbers may add remarks.
  var anyNumber = Object.keys(real).some(function (id) {
    var ps = real[id].players || {};
    return Object.keys(ps).some(function (sl) { var t = ps[sl].tendencies || {}; return Object.keys(t).some(function (k) { return typeof t[k] === 'number'; }); });
  });
  if (Object.keys(real).length && !anyNumber && longer) problems.push('real profiles have null tendencies but ' + longer + ' remarks were added');

  var fake = {};
  fake[teams[0].id] = { team: teams[0].id, players: {
    QB: { name: teams[0].roster.QB, tendencies: { deep_ball: 0.9, short_pass: 0.2, scramble: null } },
    RB: { name: teams[0].roster.RB, tendencies: { run_share: 0.85 } },
    WR1: { name: teams[0].roster.WR1, tendencies: { target_share: 0.1 } }
  } };
  var TEN = ['loves the deep ball', 'does best, take the top', 'Classic', 'not the usual', 'Not often', 'settles for that', 'check it down',
    'Quick and short', 'easy completion', 'Bread and butter', 'runs through', 'keep feeding', 'engine of this ground game', 'A rare target',
    'does not see many', 'Not often the ball goes to'];
  var noted = run([fake[teams[0].id]]).filter(function (t) { return TEN.some(function (k) { return t.indexOf(k) >= 0; }); });
  if (!noted.length) problems.push('made-up tendencies produced no remark');
  noted.forEach(function (t) { if (/\b(he|him|his|she|her)\b/i.test(t)) problems.push('pronoun in a tendency remark: ' + t); });
  console.log('\nTendencies: real profiles added ' + longer + ' remarks; test numbers added ' + noted.length + ', e.g. "' + (noted[0] || '') + '"');
})();

// C11: the announcer's memory. Replay the default game file (the one the app plays) and print
// the whole broadcast so a person can read it, with the remarks that came from memory marked.
(function () {
  var fs = require('fs'), path = require('path');
  Object.keys(A._memoryLines).forEach(function (kind) {
    STYLES.forEach(function (style) {
      var list = A._memoryLines[kind][style] || [];
      if (list.length < 3) problems.push('memory ' + kind + ' ' + style + ' has ' + list.length + ' variants');
      list.forEach(function (t) {
        var w = fill(t, Object.assign({ how: 'Extra point', what: 'Stopped on fourth down', total: 199, made: 3, att: 3, diff: 14 }, worst));
        if (w.length > A.maxLength) problems.push('memory ' + kind + ' ' + style + ' is ' + w.length + ' characters: ' + w);
        if (/\{\w+\}/.test(w)) problems.push('memory ' + kind + ' unknown placeholder: ' + t);
        if (/\b(he|him|his|she|her)\b/i.test(t)) problems.push('memory ' + kind + ' has a pronoun: ' + t);
      });
    });
  });
  var file = path.join(__dirname, '../../data/games/current.js'), game = null;
  try { var src = fs.readFileSync(file, 'utf8'); game = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)); } catch (err) { game = null; }
  if (!game) { console.log('\n(no data/games/current.js, broadcast replay skipped)'); return; }
  var teams = game.teams;
  STYLES.forEach(function (style) {
    A.reset();
    var st = Rules.create(teams), n = 0, mems = 0, lastMem = -9, kinds = {}, out = [];
    out.push(A.intro({ teams: teams, style: style }));
    Rules.flatten(game.game, teams).forEach(function (x) {
      if (x.kind === 'half') { Rules.startHalf(st); out.push('-- ' + A.line({ kind: 'half' }, { teams: teams, score: st.score.slice(), style: style })); return; }
      if (x.kind === 'final') { out.push('-- ' + A.line({ kind: 'final' }, { teams: teams, score: st.score.slice(), style: style })); return; }
      var res = Rules.apply(st, x.e, x.team); n++;
      var t = A.line(res, { teams: teams, style: style }), c = A.caption();
      var isMem = c && /^memory_/.test(c.kind) && c.text === t;
      if (isMem) {
        var k = c.kind.slice(7); kinds[k] = (kinds[k] || 0) + 1; mems++;
        var big = k === 'lead_change' || k === 'go_ahead' || k === 'answer';
        if (!big && n - lastMem < 2) problems.push('memory lines too close together at play ' + n + ': ' + t);
        lastMem = n;
      }
      if (t.length > A.maxLength) problems.push('broadcast line too long: ' + t);
      out.push((isMem ? ' * ' : '   ') + t);
    });
    var mm = A.memory();
    if (!mems) problems.push('the ' + style + ' broadcast used no memory lines');
    if (mems > n / 4) problems.push('memory talks over too many plays: ' + mems + ' of ' + n);
    if (style === 'straight') {
      console.log('\n== Full broadcast, ' + game.id + ', straight (* = from memory) ==');
      out.forEach(function (l) { console.log(l); });
    }
    console.log('\n' + style + ': ' + mems + ' memory lines in ' + n + ' plays: ' + JSON.stringify(kinds) +
      '; lead changes ' + mm.leadChanges + ', kickers ' + JSON.stringify(mm.kickers) + ', plays since last score ' + mm.playsSinceScore);
  });
})();

// C11 again, on a short made-up game (test only) that has what the real one lacks: a lead
// change from behind, a player passing 100 yards, a kicker's second make.
(function () {
  var teams = data.TEAMS;
  var game = { drives: [
    { team: teams[0].id, plays: [{ t: 'kickoff', to: 25 }, { t: 'pass', to: 'WR1', yds: 50 }, { t: 'pass', to: 'WR1', yds: 25 }, { t: 'xp', good: true }] },
    { team: teams[1].id, plays: [{ t: 'kickoff', to: 25 }, { t: 'pass', to: 'WR1', yds: 75 }, { t: 'xp', good: true }] },
    { team: teams[0].id, plays: [{ t: 'kickoff', to: 25 }, { t: 'run', by: 'RB', yds: 4 }, { t: 'run', by: 'RB', yds: 3 }, { t: 'pass', to: 'WR1', yds: 30 }, { t: 'fg', good: true }] },
    { team: teams[1].id, plays: [{ t: 'kickoff', to: 25 }, { t: 'pass', to: 'WR1', yds: 75 }, { t: 'xp', good: true }] },
    { team: teams[0].id, plays: [{ t: 'kickoff', to: 25 }, { t: 'run', by: 'RB', yds: 2 }, { t: 'run', by: 'RB', yds: 3 }, { t: 'run', by: 'RB', yds: 4 }, { t: 'pass', to: 'WR2', yds: 30 }, { t: 'fg', good: true }] }
  ] };
  A.reset();
  var st = Rules.create(teams), seen = {}, lines = [];
  Rules.flatten(game, teams).forEach(function (x) {
    if (x.kind !== 'play') return;
    var t = A.line(Rules.apply(st, x.e, x.team), { teams: teams, style: 'straight' }), c = A.caption();
    if (c && /^memory_/.test(c.kind) && c.text === t) { seen[c.kind.slice(7)] = true; lines.push(t); }
  });
  ['lead_change', 'go_ahead', 'answer', 'hundred', 'need_answer'].forEach(function (k) { if (!seen[k]) problems.push('made-up game: no ' + k + ' line'); });
  var mm = A.memory();
  if (mm.leadChanges !== 1) problems.push('made-up game: expected 1 lead change, memory says ' + mm.leadChanges);
  if (mm.kickers[0].made !== 2) problems.push('made-up game: kicker makes should be 2');
  console.log('\nMade-up game memory lines: ' + lines.join(' | '));
})();

console.log('\nOne style: setStyle(\'fun\') gives ' + A.setStyle('fun') + ', style is ' + A.style);
if (A.setStyle('fun') !== 'straight' || A.style !== 'straight') problems.push('there must be only the straight style');
console.log('speak() without a speech voice does nothing: ' + (A.speak('test') === undefined ? 'ok' : 'unexpected'));
console.log('line() with no teams is quiet: ' + (A.line({}, {}) === '' ? 'ok' : 'unexpected'));

// C23: the pre-game show.
(function () {
  var fs = require('fs'), path = require('path');
  var league = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/league.json'), 'utf8')), profiles = {};
  ['GOB', 'PYT'].forEach(function (id) {
    var f = path.join(__dirname, '../../data/profiles/' + id + '.json');
    if (fs.existsSync(f)) profiles[id] = JSON.parse(fs.readFileSync(f, 'utf8'));
  });
  function sentences(t) { return (t.match(/[.!?](\s|$)/g) || []).length; }
  console.log('\n== Pre-game show ==');
  STYLES.forEach(function (style) {
    var ours = A.preview(league.matchups[0], { league: league, profiles: profiles, style: style });
    // The no-profiles case on purpose: since week 9 every team has a profile, so pass none here.
    var other = A.preview(league.matchups[1], { league: league, profiles: {}, style: style });
    console.log('  ' + pad(style, 9) + ours);
    console.log('  ' + pad(style, 9) + other);
    if (sentences(ours) < 3 || sentences(ours) > 4) problems.push('preview of our matchup has ' + sentences(ours) + ' sentences: ' + ours);
    if (!/\b\d+-\d+\b/.test(ours) || !/first|second|third|fourth/.test(ours)) problems.push('preview misses the records: ' + ours);
    if (/\b(17|14)\b|fantasy|score/i.test(ours)) problems.push('preview gives away something from the game: ' + ours);
    var hot = ours.match(/(?:Hot lately|In form|Trending up|Red hot): (\S+?)\b/), cold = ours.match(/(?:Cooling off|Out of form|Ice cold|Rough patch for): (\S+?)\b/);
    if (hot && cold && hot[1] === cold[1]) problems.push('preview names the same player hot and cold: ' + ours);
    if (sentences(other) !== 1 || !/\b\d+-\d+\b/.test(other)) problems.push('preview of a matchup with no profiles should be the records only: ' + other);
    if (/\{\w+\}|undefined|NaN|\b(he|him|his|she|her)\b/i.test(ours + other)) problems.push('preview gap or pronoun: ' + ours + ' ' + other);
  });
  if (A.preview(league.matchups[0], {}) !== '') problems.push('preview with no league and no profiles should be empty');
  if (A.preview(null, { league: league }) !== '') problems.push('preview with no matchup should be empty');
  // Profiles whose numbers are all null add nothing; only the records are left.
  var nulls = JSON.parse(JSON.stringify(profiles));
  Object.keys(nulls).forEach(function (id) { var ps = nulls[id].players; Object.keys(ps).forEach(function (sl) {
    Object.keys(ps[sl].tendencies || {}).forEach(function (k) { ps[sl].tendencies[k] = null; });
    if (ps[sl].form) ps[sl].form.tendencies = {};
  }); });
  var onlyRecords = A.preview(league.matchups[0], { league: league, profiles: nulls });
  if (sentences(onlyRecords) !== 1) problems.push('preview with null numbers should be the records only: ' + onlyRecords);
})();

// C18: the big call.
(function () {
  var fs = require('fs'), path = require('path');
  var src = fs.readFileSync(path.join(__dirname, '../../data/games/current.js'), 'utf8');
  var game = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1)), teams = game.teams;
  A.reset();
  var st = Rules.create(teams), calls = [], ordinary = 0, quietOk = true, longest = '';
  var seen = { td: 0, turnover: 0, big: 0 };
  Rules.flatten(game.game, teams).forEach(function (x) {
    if (x.kind === 'half') { Rules.startHalf(st); return; }
    if (x.kind !== 'play') return;
    var r = Rules.apply(st, x.e, x.team);
    A.line(r, { teams: teams });
    var before = A.memory().log.length;
    var b = A.bigCall(r, { teams: teams }), h = A.bigCall(r, { teams: teams, hidden: true });
    if (A.memory().log.length !== before) problems.push('bigCall changed the memory');
    var big = r.td || r.e.t === 'int' || r.e.t === 'fumble' || r.downs || ((r.e.t === 'run' || r.e.t === 'pass') && r.e.yds >= 20);
    if (!big) { ordinary++; if (b) { quietOk = false; problems.push('bigCall for an ordinary play: ' + b); } return; }
    if (!b) { problems.push('no bigCall for a big play: ' + r.text); return; }
    if (r.td) seen.td++; else if (r.e.t === 'int' || r.e.t === 'fumble' || r.downs) seen.turnover++; else seen.big++;
    var n = (b.match(/[.!?](\s|$)/g) || []).length;
    if (n < 2 || n > 4) problems.push('bigCall has ' + n + ' sentences: ' + b);
    if (/fantasy|points to/i.test(h)) problems.push('hidden bigCall names fantasy points: ' + h);
    if (/\{\w+\}|undefined|NaN|\b(he|him|his|she|her)\b/i.test(b)) problems.push('bigCall gap or pronoun: ' + b);
    if (b.length > longest.length) longest = b;
    calls.push(b);
  });
  ['td', 'turnover', 'big'].forEach(function (k) { if (!seen[k]) problems.push('the default game gave no ' + k + ' big call'); });
  // The longest a big call can be: the longest names in the data in the longest templates.
  var worstLen = 0;
  Object.keys(A._bigLines).forEach(function (k) {
    STYLES.forEach(function (style) {
      A._bigLines[k][style].forEach(function (t) {
        var s1 = fill(t, Object.assign({ ret: 99 }, worst)).length;
        worstLen = Math.max(worstLen, s1 + 1 + ('That makes it ' + worst.score + ', and the ' + worst.team + ' lead by 28.').length + 1 +
          ('That play is worth 12.5 fantasy points to ' + worst.player + '.').length);
      });
    });
  });
  console.log('\nBig calls in the default game: ' + calls.length + ' (' + JSON.stringify(seen) + '), ' + ordinary + ' ordinary plays quiet; longest ' + longest.length + ' characters, worst case ' + worstLen);
  console.log('  e.g. ' + calls[0]);
  if (worstLen > A.bigCallMaxLength) problems.push('a big call can reach ' + worstLen + ' characters, over bigCallMaxLength ' + A.bigCallMaxLength);
})();

// C17: sound captions from js/audio.js reach the announcer's onLine listeners as kind 'sound'.
(function () {
  require('../audio.js');
  var Snd = globalThis.FF_AUDIO;
  if (!Snd) { problems.push('js/audio.js did not load'); return; }
  A.reset();
  var got = [], off = A.onLine(function (text, kind) { if (kind === 'sound') got.push(text); });
  ['crowd_murmur', 'crowd_murmur', 'pass', 'catch', 'tackle', 'kick', 'whistle', 'crowd_roar', 'crowd_groan', 'crowd_swell',
   'crowd_stop', 'crowd_murmur', 'whistle_long', 'jingle_kickoff', 'jingle_final'].forEach(function (n) { Snd.play(n); });
  var want = ['[crowd murmurs]', '[crowd roars]', '[crowd groans]', '[crowd rises]', '[crowd murmurs]', '[half-time whistle]',
    '[kickoff theme plays]', '[full-time theme plays]'];
  if (got.join('|') !== want.join('|')) problems.push('sound captions: got ' + JSON.stringify(got));
  // Muted: the captions still come, they are for people who cannot hear.
  Snd.mute(true); got.length = 0; Snd.play('crowd_roar'); Snd.mute(false);
  if (got[0] !== '[crowd roars]') problems.push('no caption while muted');
  if (Snd.captionFor('tackle') !== '' || Snd.captionFor('no_such_sound') !== '') problems.push('captionFor should be empty for small or unknown sounds');
  if (A.transcript().length) problems.push('sound captions must not go into the transcript');
  off();
  console.log('\nSound captions: ' + want.join(' '));
})();

// C16: hot and cold, on a fixture until Ricky's form data (D24) is merged. Numbers made up
// for the test only. RB run share is hot (0.80 lately vs 0.50), WR1 targets are cold (0.30 vs
// 0.60), QB short passes are no different (0.55 vs 0.50) and must never get a remark.
// Tendencies sit at 0.5 or 0.6 so the plain C6 tendency remarks stay out of the way.
(function () {
  var teams = data.TEAMS, id = teams[0].id, R = teams[0].roster;
  function fixture(shapeB) {
    function form(o) { return shapeB ? o : { tendencies: o, weeks: [9, 10, 11] }; }
    var f = {}; f[id] = { team: id, players: {
      QB: { name: R.QB, tendencies: { deep_ball: 0.5, short_pass: 0.5 }, form: form({ deep_ball: null, short_pass: 0.55 }) },
      WR1: { name: R.WR1, tendencies: { target_share: 0.6 }, form: form({ target_share: 0.3 }) },
      RB: { name: R.RB, tendencies: { run_share: 0.5 }, form: form({ run_share: 0.8 }) }
    } };
    return f;
  }
  [false, true].forEach(function (shapeB) {
    // Its own fixed random sequence, so what ran before this test cannot change its wording.
    var sd = 99; A._setRandom(function () { sd = (sd * 16807) % 2147483647; return (sd - 1) / 2147483646; });
    A.reset();
    var st = Rules.create(teams), hot = [], cold = [], lastAt = {}, n = 0;
    Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) {
      if (x.kind === 'half') { Rules.startHalf(st); return; }
      if (x.kind !== 'play') return;
      n++;
      var t = A.line(Rules.apply(st, x.e, x.team), { teams: teams, profiles: fixture(shapeB) });
      if (t.length > A.maxLength) problems.push('hot/cold line too long: ' + t);
      var who = null;
      if (/hot lately|on a roll lately|Hot streak/.test(t)) { hot.push(t); who = 'hot'; }
      if (/needed that one|quiet lately|Rare lately/.test(t)) { cold.push(t); who = 'cold'; }
      if (who) {
        var name = t.match(/(\S+) (has been|is on|needed)|for (\S+)\.|from (\S+)\.$/);
        var key = who + (name ? name[0] : '');
        if (lastAt[key] != null && n - lastAt[key] < 8) problems.push('hot/cold remark repeated within 8 plays: ' + t);
        lastAt[key] = n;
      }
      var qb = String(R.QB).split(' ').pop();
      if (new RegExp(qb + ' (has been|is on|needed)|for ' + qb + '\\.|from ' + qb + '\\.').test(t)) problems.push('remark for a form that is no different: ' + t);
    });
    if (!hot.length) problems.push('fixture ' + (shapeB ? 'B' : 'A') + ': no hot remark');
    if (!cold.length) problems.push('fixture ' + (shapeB ? 'B' : 'A') + ': no cold remark');
    if (!shapeB) console.log('\nHot and cold (fixture): ' + hot.length + ' hot, ' + cold.length + ' cold, e.g. "' + (hot[0] || '') + '" / "' + (cold[0] || '') + '"');
  });
})();

// C15: catch-up after a jump (FF_GAME.seek).
(function () {
  var teams = data.TEAMS, st = Rules.create(teams), res = [];
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) {
    if (x.kind === 'half') { Rules.startHalf(st); return; }
    if (x.kind === 'play') res.push(Rules.apply(st, x.e, x.team));
  });
  var tdAt = -1, toAt = -1;
  res.forEach(function (r, i) { if (tdAt < 0 && r.td) tdAt = i; if (toAt < 0 && (r.e.t === 'int' || r.e.t === 'fumble')) toAt = i; });
  var leaders = [{ name: teams[0].roster.WR1, points: 9.5 }];
  function sentences(t) { return (t.match(/[.!?](\s|$)/g) || []).length; }
  var cases = [
    ['no skipped plays', [], {}, function (t) { return t === ''; }],
    ['a touchdown', res.slice(0, tdAt + 1), {}, function (t) { return /TD/.test(t) && t.indexOf(teams[0].name) >= 0; }],
    ['a turnover', res.slice(toAt - 2, toAt + 1), {}, function (t) { return /pick|fumbled|downs/i.test(t); }],
    ['nothing scored, leader shown', res.slice(1, 4), { leaders: leaders }, function (t) { return /still/i.test(t) && /9\.5/.test(t); }],
    ['hidden scores', res.slice(1, 4), { leaders: leaders, hidden: true }, function (t) { return !/fantasy|9\.5|points/i.test(t) && t.length > 0; }],
    ['fun style, long jump', res.slice(0, 45), { style: 'fun' }, function (t) { return /TD/.test(t); }]
  ];
  console.log('\n== Catch-up after a jump ==');
  cases.forEach(function (c) {
    A.reset();
    var t = A.catchUp(c[1], Object.assign({ teams: teams }, c[2]));
    if (!c[3](t)) problems.push('catchUp, ' + c[0] + ': ' + JSON.stringify(t));
    if (t && (sentences(t) < 1 || sentences(t) > 2)) problems.push('catchUp, ' + c[0] + ' has ' + sentences(t) + ' sentences: ' + t);
    if (/\{\w+\}|undefined|NaN/.test(t)) problems.push('catchUp, ' + c[0] + ' left a gap: ' + t);
    if (t.length > A.maxLength) problems.push('catchUp, ' + c[0] + ' is ' + t.length + ' characters, over ' + A.maxLength + ': ' + t);
    console.log('  ' + pad(c[0], 30) + (t || '(quiet)'));
  });
  // The skipped plays go into the memory.
  A.reset(); A.catchUp(res.slice(0, 20), { teams: teams });
  if (A.memory().log.length !== 20) problems.push('catchUp should add the 20 skipped plays to memory, it has ' + A.memory().log.length);
})();

// C14: rule explainers and the transcript.
(function () {
  var want = ['first_down', 'downs', 'touchdown', 'extra_point', 'field_goal', 'punt', 'interception', 'fumble', 'sack', 'penalty', 'kickoff', 'halftime'];
  want.forEach(function (k) {
    var t = A.explain(k), n = (t.match(/[.!?](\s|$)/g) || []).length;
    if (!t) problems.push('explain(' + k + ') is empty');
    if (t.length > A.explainMaxLength) problems.push('explain(' + k + ') is ' + t.length + ' characters, over ' + A.explainMaxLength);
    if (n < 1 || n > 2) problems.push('explain(' + k + ') has ' + n + ' sentences');
    if (/\u2014|\b(he|him|his|she|her)\b/i.test(t)) problems.push('explain(' + k + ') has an em dash or a pronoun');
  });
  if (A.explain('no_such_rule') !== '') problems.push('explain() of an unknown kind should be empty');
  if (A.explainKinds.join() !== want.join()) problems.push('explainKinds is ' + A.explainKinds.join());
  // Which rules the sample game shows, and the transcript of it.
  A.reset();
  var teams = data.TEAMS, st = Rules.create(teams), shown = {}, made = 0;
  Rules.flatten(data.SAMPLE_GAME, teams).forEach(function (x) {
    if (x.kind === 'half') { Rules.startHalf(st); A.explainFor({ kind: 'half' }).forEach(function (k) { shown[k] = 1; }); if (A.line({ kind: 'half' }, { teams: teams, score: st.score.slice() })) made++; return; }
    if (x.kind !== 'play') return;
    var res = Rules.apply(st, x.e, x.team);
    A.explainFor(res).forEach(function (k) { shown[k] = (shown[k] || 0) + 1; if (!A.explain(k)) problems.push('explainFor gave a kind with no text: ' + k); });
    if (A.line(res, { teams: teams })) made++;
  });
  var tr = A.transcript();
  if (tr.length !== made) problems.push('transcript has ' + tr.length + ' lines, ' + made + ' were said');
  if (tr.some(function (x) { return typeof x.t !== 'number' || !x.text || !x.kind; })) problems.push('transcript entries need t, text and kind');
  A.reset();
  if (A.transcript().length) problems.push('reset() should empty the transcript');
  console.log('\nRules shown in the sample game: ' + Object.keys(shown).join(', ') + '; transcript held ' + tr.length + ' lines');
  console.log('  e.g. explain(first_down): ' + A.explain('first_down'));
})();

// C27: say it right. Every line a game can produce, in both languages, read through spoken():
// nothing a voice would spell out or read as a symbol may be left.
(function () {
  var fs = require('fs'), path = require('path');
  // Plain ordinals ("the 14th minute") are left alone: voices read them right.
  var LEFT = /[&#@*_~^|<>\[\]{}"()\/]|\b[A-Z]{2,}\b|\bQ[1-4]\b|\b[1-4](st|nd|rd|th) and |\d+-\d+|\d+'|\d:\d|\b(TDs?|FGs?|pts|XP|DST)\b|\bSt\.|[A-Za-z]'[A-Z]/;
  var bad = [], n = 0;
  function test(text, where, lang, S) {
    if (!text) return;
    n++;
    var t = (S || A).spoken(text);
    if (LEFT.test(t) && bad.length < 12) bad.push(where + ': "' + text + '" is read as "' + t + '"');
  }
  var Sstory = null;
  try { Sstory = require(path.join(__dirname, '../../server/story.js')); } catch (err) { /* optional */ }
  var league = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/league.json'), 'utf8')), profiles = {};
  ['GOB', 'PYT'].forEach(function (id) { profiles[id] = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/profiles/' + id + '.json'), 'utf8')); });
  ['week11-football', 'sample-football'].forEach(function (id) {
    var g = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/games/' + id + '.json'), 'utf8')), teams = g.teams;
    ['en'].forEach(function (lang) {
      STYLES.forEach(function (style) {
        A.reset(); A.setStyle(style);
        var st = Rules.create(teams), results = [];
        test(A.intro({ teams: teams, leaders: [] }), id + ' intro', lang);
        Rules.flatten(g.game, teams).forEach(function (x) {
          if (x.kind === 'half') { Rules.startHalf(st); test(A.line({ kind: 'half' }, { teams: teams, score: st.score.slice() }), id + ' half', lang); return; }
          if (x.kind === 'final') { test(A.line({ kind: 'final' }, { teams: teams, score: st.score.slice() }), id + ' final', lang); return; }
          var r = Rules.apply(st, x.e, x.team); results.push(r);
          test(A.line(r, { teams: teams, profiles: profiles }), id + ' ' + lang + ' ' + style + ' play', lang);
          test(A.bigCall(r, { teams: teams }), id + ' big call', lang);
        });
        test(A.wrap({ teams: teams, score: st.score.slice(), leaders: [{ name: teams[0].roster.WR1, points: 12.5 }], plays: results }), id + ' wrap', lang);
        A.reset(); test(A.catchUp(results.slice(0, 30), { teams: teams }), id + ' catch-up', lang);
        if (Sstory) test(A.recap(Sstory.fromGame(g, id), { teams: teams }), id + ' recap', lang);
        A.explainKinds.forEach(function (k) { test(A.explain(k), 'explain ' + k, lang); });
        league.matchups.forEach(function (m) { test(A.preview(m, { league: league, profiles: profiles }), 'preview', lang); });
      });
    });
  });
  A.reset();
  // Soccer, with its own spoken().
  var SC = require('./soccer/index.js'), sdata = require('../../soccer/js/data.js'), SR = require('../../soccer/js/rules.js');
  SC.reset();
  var ss = SR.create(sdata.TEAMS), sres = [];
  SR.flatten(sdata.SAMPLE_GAME, sdata.TEAMS).forEach(function (x) {
    if (x.kind === 'half') { SR.startHalf(ss); return; }
    if (x.kind !== 'play') return;
    var r = SR.apply(ss, x.e, x.team); sres.push(r);
    test(SC.line(r, { teams: sdata.TEAMS }), 'soccer play', 'en', SC);
    test(SC.bigCall(r, { teams: sdata.TEAMS }), 'soccer big call', 'en', SC);
  });
  SC.reset(); test(SC.catchUp(sres.slice(0, 20), { teams: sdata.TEAMS }), 'soccer catch-up', 'en', SC);
  // Every player on both football and both soccer rosters, full name and last name.
  var g11 = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/games/week11-football.json'), 'utf8'));
  data.TEAMS.concat(g11.teams).forEach(function (t) { Object.keys(t.roster).forEach(function (k) { test(t.roster[k], 'name', 'en'); }); });
  sdata.TEAMS.forEach(function (t) { Object.keys(t.roster).forEach(function (k) { test(t.roster[k], 'soccer name', 'en', SC); }); });
  bad.forEach(function (b) { problems.push('spoken form: ' + b); });
  console.log('\nSay it right: ' + n + ' lines and names read through spoken(), ' + bad.length + ' with something a voice would spell out; e.g. "' +
    A.spoken('Q2 12:00, 3rd & 7 at the GOB 45, 17-14. TOUCHDOWN!') + '"');
})();

// C26: the spoken recap, from Ricky's story data only.
(function () {
  var fs = require('fs'), path = require('path'), S;
  try { S = require(path.join(__dirname, '../../server/story.js')); } catch (err) { console.log('\n(server/story.js missing, recap check skipped)'); return; }
  var g = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/games/week11-football.json'), 'utf8'));
  var story = S.fromGame(g, 'week11-football'), teams = g.teams;
  function sentences(t) { return (t.match(/[.!?](\s|$)/g) || []).length; }
  // Every number said must come from the story.
  var known = {};
  JSON.stringify(story).replace(/\d+(\.\d+)?/g, function (n) { known[n] = 1; return n; });
  console.log('\n== Spoken recap ==');
  STYLES.forEach(function (style) {
    var t = A.recap(story, { teams: teams, style: style }), n = sentences(t);
    console.log('  ' + pad(style, 9) + t);
    if (n < 4 || n > 6) problems.push('recap ' + style + ' has ' + n + ' sentences');
    (t.match(/\d+(\.\d+)?/g) || []).forEach(function (x) { if (!known[x]) problems.push('recap ' + style + ' says ' + x + ', which is not in the story: ' + t); });
    if (/\{\w+\}|undefined|NaN|'s:|s's\b|\b(he|him|his|she|her)\b/.test(t)) problems.push('recap gap or grammar: ' + t);
  });
  if (A.recap(story, { teams: teams, hidden: true }) !== '') problems.push('recap must be empty while scores are hidden');
  if (A.recap(null, { teams: teams }) !== '') problems.push('recap without a story must be empty');
  // A tie with lead changes back and forth, and a drive result nobody knows.
  var tie = JSON.parse(JSON.stringify(story));
  tie.final = [14, 14]; tie.winner = null; tie.decidingPlay = null; tie.longestDrive.result = 'something new';
  tie.leadChanges = [{ team: 'GOB' }, { team: 'PYT' }, { team: 'GOB' }];
  var tt = A.recap(tie, { teams: teams });
  if (!/14/.test(tt) || /beat|win it|take this/.test(tt)) problems.push('recap of a tie: ' + tt);
  if (!/3 times|3 lead changes|changed hands 3/.test(tt)) problems.push('recap should count 3 lead changes: ' + tt);
  if (/longest drive|Longest drive|marched|grind/.test(tt)) problems.push('recap said a drive result it does not know: ' + tt);
})();

// The soccer announcer (js/announcer/soccer/) has its own check; run it here too so one
// command covers both sports.
(function () {
  var cp = require('child_process'), path = require('path');
  var f = path.join(__dirname, 'soccer/check.js');
  if (!require('fs').existsSync(f)) return;
  var r = cp.spawnSync(process.execPath, [f], { encoding: 'utf8' });
  var lastLine = (r.stdout || '').trim().split('\n').pop();
  console.log('\nSoccer: ' + lastLine);
  if (r.status !== 0) problems.push('soccer check failed: ' + ((r.stdout || '') + (r.stderr || '')).split('PROBLEMS')[1]);
})();

if (problems.length) {
  console.log('\nPROBLEMS (' + problems.length + '):');
  problems.forEach(function (p) { console.log('  ' + p); });
  process.exit(1);
}
console.log('\nOK: ' + Object.keys(LINES).length + ' kinds, one style, at least 3 variants each, no problems found.');

function pad(s, n) { s = String(s); while (s.length < n) s += ' '; return s + ' '; }
