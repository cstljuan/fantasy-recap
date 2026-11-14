// App shell: matchup, lineups, play-by-play and recap screens around the game
// view. It listens to the game for plays as they happen and keeps fantasy
// points, stat lines and the feed up to date. Everything shown is mock data.
(function () {
  'use strict';

  var G = window.FF_GAME, D = window.FF_DATA, Rules = window.FF_RULES, Spr = window.FF_SPRITES;
  var TEAMS = D.TEAMS;
  var WEEK = 'Week 11';
  var TABS = ['league', 'matchup', 'lineups', 'plays', 'recap', 'film', 'week'];
  var SLOTS = [
    { role: 'QB', pos: 'QB' }, { role: 'RB', pos: 'RB' }, { role: 'WR1', pos: 'WR' }, { role: 'WR2', pos: 'WR' },
    { role: 'WR3', pos: 'FLEX' }, { role: 'TE', pos: 'TE' }, { role: 'K', pos: 'K' }, { role: 'DST', pos: 'D/ST' }
  ];

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function f1(n) { var v = Math.round(n * 10) / 10; return (v === 0 ? 0 : v).toFixed(1); }
  function yards(n) { return n + (Math.abs(n) === 1 ? ' yard' : ' yards'); }
  function titleCase(s) { return s.charAt(0) + s.slice(1).toLowerCase(); }

  function fullName(t, role) { return role === 'DST' ? TEAMS[t].name + ' D/ST' : TEAMS[t].roster[role]; }
  function shortName(t, role) { return role === 'DST' ? TEAMS[t].name + ' D' : Rules.lastName(TEAMS[t].roster[role]); }
  function initials(t, role) {
    if (role === 'DST') return 'D';
    return TEAMS[t].roster[role].split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
  }
  function posOf(role) { for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].role === role) return SLOTS[i].pos; return role; }

  // Team colors and the 8-bit player from the game, reused as each team's mark.
  var root = document.documentElement;
  root.style.setProperty('--t0', TEAMS[0].colors.jersey);
  root.style.setProperty('--t1', TEAMS[1].colors.jersey);
  var marks = [0, 1].map(function (t) {
    try { return Spr.get(t, TEAMS[t].colors, 'f', 'stand', t ? 1 : 0).toDataURL(); } catch (err) { return ''; }
  });

  // ------------------------------------------------------------- model

  var m, tab = 'matchup', filter = 'all', inGame = false, fresh = false, prevTotals = ['0.0', '0.0'];

  // Hidden scores. 'in' means the manager opted in, 'out' means no thanks,
  // null means no choice yet. Saved in localStorage under fr.optin.
  var OPTIN_KEY = 'fr.optin', MASK = '--.-';
  function readOptin() {
    try { var v = window.localStorage.getItem(OPTIN_KEY); return v === 'in' || v === 'out' ? v : null; }
    catch (err) { return null; }
  }
  var optin = readOptin();
  function setOptin(v) {
    optin = v;
    try { window.localStorage.setItem(OPTIN_KEY, v); } catch (err) { /* storage may be off */ }
    syncFloaters();
    if (v === 'in') saveOptinToLeague();
  }
  // My team: ?me=<team id> or the choice on the matchup screen, saved under fr.me.
  // -1 means no team chosen, and then the app looks as it always did.
  var ME_KEY = 'fr.me';
  function teamByName(id) {
    id = String(id || '').toUpperCase();
    for (var i = 0; i < 2; i++) if (TEAMS[i].id.toUpperCase() === id) return i;
    return -1;
  }
  var me = (function () {
    var fromUrl = /[?&]me=([^&]*)/.exec(location.search), saved = null;
    if (fromUrl) {
      var t = teamByName(decodeURIComponent(fromUrl[1]));
      try { if (t >= 0) window.localStorage.setItem(ME_KEY, TEAMS[t].id); else window.localStorage.removeItem(ME_KEY); } catch (err) { /* storage may be off */ }
      return t;
    }
    try { saved = window.localStorage.getItem(ME_KEY); } catch (err) { saved = null; }
    return teamByName(saved);
  })();
  function setMe(t) {
    me = t === 0 || t === 1 ? t : -1;
    try { if (me >= 0) window.localStorage.setItem(ME_KEY, TEAMS[me].id); else window.localStorage.removeItem(ME_KEY); } catch (err) { /* storage may be off */ }
  }
  // Team order on screen: my team first when I have one.
  function ord() { return me === 1 ? [1, 0] : [0, 1]; }

  // True while every fantasy number and stat line must stay masked.
  function masked() { return optin === 'in' && m.status !== 'final'; }
  function pts1(n) { return masked() ? MASK : f1(n); }
  // The point numbers that float up on the field follow the same rule.
  function syncFloaters() { if (G.setFloaters) G.setFloaters(!masked()); }
  // The game only advances while its view is open, unless it was told to run in the background.
  function paused() { return m.status === 'live' && !inGame && !G.background; }

  function blank() {
    var o = {
      status: 'pre',           // pre | live | final
      pts: [{}, {}], st: [{}, {}],
      team: [{ pass: 0, rush: 0, to: 0, pens: 0, penYds: 0 }, { pass: 0, rush: 0, to: 0, pens: 0, penYds: 0 }],
      field: [0, 0], feed: [], done: 0, now: '', flash: {},
      drives: []               // the film room: one entry per drive, built as the plays come in
    };
    SLOTS.forEach(function (s) { for (var t = 0; t < 2; t++) { o.pts[t][s.role] = 0; o.st[t][s.role] = {}; } });
    return o;
  }

  // ------------------------------------------------- scoring rules file
  // Points normally come from the game (js/rules.js, res.fp). ?scoring=file reads
  // data/scoring.json instead and scores each player's stat line with it. The two
  // rule sets differ today (receptions, field goal distance, fumbles, defense), so
  // the file is a preview until the boss picks one.
  var SCORING_FILE = /[?&]scoring=file(&|$)/.test(location.search);
  var scoringRules = null;
  // Stat line keys in data/scoring.json, and where the app keeps each one.
  var RULE_STATS = {
    pass_yards: function (s) { return s.paYds || 0; }, pass_td: function (s) { return s.paTd || 0; },
    interceptions: function (s, role) { return role === 'QB' ? s.int || 0 : 0; },
    rush_yards: function (s) { return s.ruYds || 0; }, rush_td: function (s) { return s.ruTd || 0; },
    receptions: function (s) { return s.rec || 0; }, rec_yards: function (s) { return s.reYds || 0; },
    rec_td: function (s) { return s.reTd || 0; },
    fg_made: function (s) { return s.fgm || 0; }, fg_missed: function (s) { return (s.fga || 0) - (s.fgm || 0); },
    xp_made: function (s) { return s.xpm || 0; }
  };
  function useFile() { return !!(SCORING_FILE && scoringRules); }
  function filePoints(t, role) {
    if (!scoringRules || role === 'DST') return 0;
    var st = m.st[t][role], per = scoringRules.per, sum = 0;
    Object.keys(per).forEach(function (k) { if (RULE_STATS[k]) sum += RULE_STATS[k](st, role) * per[k]; });
    return Math.round(sum * 100) / 100;
  }
  function allFilePoints() {
    var o = {};
    for (var t = 0; t < 2; t++) SLOTS.forEach(function (sl) { o[t + sl.role] = filePoints(t, sl.role); });
    return o;
  }
  function filePointsDelta(before) {
    var out = [], now = Date.now();
    for (var t = 0; t < 2; t++) SLOTS.forEach(function (sl) {
      var d = Math.round((filePoints(t, sl.role) - before[t + sl.role]) * 100) / 100;
      if (d) { out.push({ pts: d, who: shortName(t, sl.role), team: t }); m.flash[t + sl.role] = now; }
    });
    return out;
  }
  function playerPts(t, role) { return useFile() ? filePoints(t, role) : m.pts[t][role]; }
  function validRules(r) {
    if (!r || typeof r.per !== 'object') return false;
    return Object.keys(r.per).every(function (k) { return typeof r.per[k] === 'number' && isFinite(r.per[k]); });
  }
  if (SCORING_FILE && window.fetch) {
    fetch('data/scoring.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (r) {
      if (!validRules(r)) return;
      scoringRules = r;
      if (!inGame) render(false);
    }).catch(function () { /* without the file the game's points stay */ });
  }
  var RULE_WORDS = {
    pass_yards: 'per passing yard', pass_td: 'per passing touchdown', interceptions: 'per interception thrown',
    rush_yards: 'per rushing yard', rush_td: 'per rushing touchdown', receptions: 'per reception',
    rec_yards: 'per receiving yard', rec_td: 'per receiving touchdown', fg_made: 'per field goal made',
    fg_missed: 'per field goal missed', xp_made: 'per extra point made'
  };
  function rulesNote() {
    if (!useFile()) {
      return 'Scoring in this sample league: 0.1 per rushing or receiving yard, 0.04 per passing yard, ' +
        '6 for a rushing or receiving touchdown, 4 for a passing touchdown, minus 2 for an interception or lost fumble. ' +
        'Kickers get 1 for an extra point and 3 to 5 for a field goal. A defense gets 1 for a sack and 2 for a takeaway.';
    }
    var per = scoringRules.per;
    var parts = Object.keys(per).filter(function (k) { return per[k] !== 0; }).map(function (k) {
      return (per[k] < 0 ? 'minus ' + (-per[k]) : per[k]) + ' ' + (RULE_WORDS[k] || esc(k.replace(/_/g, ' ')));
    });
    return 'Scoring from data/scoring.json' + (scoringRules.name ? ' (' + esc(scoringRules.name) + ')' : '') + ': ' + parts.join(', ') + '.' +
      (per.fg_missed === 0 ? ' A missed field goal costs nothing.' : '') + ' Defenses are not scored.';
  }

  function total(t) {
    var sum = 0;
    SLOTS.forEach(function (s) { sum += playerPts(t, s.role); });
    return sum;
  }

  function add(o, k, v) { o[k] = (o[k] || 0) + (v === undefined ? 1 : v); }

  function describe(res) {
    var e = res.e, off = res.pre.poss, def = 1 - off, T = TEAMS, text;
    function nm(t, role) { return Rules.lastName(T[t].roster[role]); }
    switch (e.t) {
      case 'kickoff': text = T[res.kickTeam].name + ' kick off. ' + nm(off, 'WR3') + ' returns it to the ' + T[off].id + ' ' + e.to + '.'; break;
      case 'run': text = nm(off, e.by) + (e.yds < 0 ? ' loses ' + yards(-e.yds) : e.yds === 0 ? ' is stopped for no gain' : ' runs for ' + yards(e.yds)) + '.'; break;
      case 'pass': text = nm(off, 'QB') + ' to ' + nm(off, e.to) + ' for ' + yards(e.yds) + '.'; break;
      case 'inc': text = nm(off, 'QB') + ' pass to ' + nm(off, e.to) + ' falls incomplete.'; break;
      case 'sack': text = nm(off, 'QB') + ' sacked by the ' + T[def].name + ' defense, loss of ' + (-e.yds) + '.'; break;
      case 'kneel': text = nm(off, 'QB') + ' kneels to run out the game.'; break;
      case 'pen': text = titleCase(res.pen.title) + ' on the ' + T[res.pen.on].name + ', ' + yards(res.pen.yds) + '.' + (e.kind === 'holding' ? ' The gain is wiped out.' : ''); break;
      case 'punt': text = T[off].name + ' punt, ' + e.net + ' yards net.'; break;
      case 'fg': text = nm(off, 'K') + ' ' + res.fgDist + ' yard field goal ' + (e.good ? 'is good.' : 'is no good.'); break;
      case 'xp': text = nm(off, 'K') + ' extra point ' + (e.good ? 'is good.' : 'is no good.'); break;
      case 'int': text = nm(off, 'QB') + ' intercepted by the ' + T[def].name + ' defense, returned ' + yards(e.ret) + '.'; break;
      case 'fumble': text = nm(off, e.by) + ' runs for ' + yards(e.yds) + ' and fumbles. ' + T[def].name + ' recover.'; break;
      default: text = res.desc || '';
    }
    if (res.first && !res.td) text += ' First down.';
    return text;
  }

  function applyResult(res) {
    var e = res.e, off = res.pre.poss, def = 1 - off, s, before = useFile() ? allFilePoints() : null;
    function S(t, role) { return m.st[t][role]; }
    switch (e.t) {
      case 'run': s = S(off, e.by); add(s, 'car'); add(s, 'ruYds', e.yds); if (res.td) { add(s, 'td'); add(s, 'ruTd'); } m.team[off].rush += e.yds; break;
      case 'pass':
        s = S(off, 'QB'); add(s, 'att'); add(s, 'cmp'); add(s, 'paYds', e.yds); if (res.td) add(s, 'paTd');
        s = S(off, e.to); add(s, 'rec'); add(s, 'reYds', e.yds); if (res.td) { add(s, 'td'); add(s, 'reTd'); }
        m.team[off].pass += e.yds; break;
      case 'inc': add(S(off, 'QB'), 'att'); break;
      case 'int': s = S(off, 'QB'); add(s, 'att'); add(s, 'int'); add(S(def, 'DST'), 'int'); m.team[off].to += 1; break;
      case 'sack': add(S(def, 'DST'), 'sack'); m.team[off].pass += e.yds; break;
      case 'fumble': s = S(off, e.by); add(s, 'car'); add(s, 'ruYds', e.yds); add(s, 'fum'); add(S(def, 'DST'), 'fr'); m.team[off].rush += e.yds; m.team[off].to += 1; break;
      case 'kneel': m.team[off].rush += res.yds; break;
      case 'fg': s = S(off, 'K'); add(s, 'fga'); if (e.good) add(s, 'fgm'); break;
      case 'xp': s = S(off, 'K'); add(s, 'xpa'); if (e.good) add(s, 'xpm'); break;
      case 'pen': m.team[res.pen.on].pens += 1; m.team[res.pen.on].penYds += res.pen.yds; break;
    }
    var now = Date.now();
    res.fp.forEach(function (f) { m.pts[f.team][f.role] += f.pts; m.flash[f.team + f.role] = now; });

    var tags = [];
    if (res.td) tags.push(['score', 'Touchdown']);
    if (e.t === 'fg' && e.good) tags.push(['score', 'Field goal']);
    if (e.t === 'xp' && e.good) tags.push(['score', 'Extra point']);
    if (e.t === 'pen') tags.push(['flag', 'Flag']);
    if (e.t === 'int' || e.t === 'fumble') tags.push(['turnover', 'Turnover']);
    if (res.downs) tags.push(['turnover', 'Turnover on downs']);
    var changed = res.post.score[0] !== res.pre.score[0] || res.post.score[1] !== res.pre.score[1];
    m.field = res.post.score.slice();
    m.done += 1;
    m.feed.push({
      n: m.done, team: off, where: res.where || '', desc: describe(res), tags: tags, why: whyFor(e, res),
      scoring: changed, flag: e.t === 'pen', score: res.post.score.slice(),
      fp: before ? filePointsDelta(before) : res.fp.map(function (f) { return { pts: f.pts, who: shortName(f.team, f.role), team: f.team }; })
    });
    filmRecord(res);
  }

  // ------------------------------------------------------------- film room
  // Drives from the plays as they happened. Field positions are yards from the
  // offense's own goal line (ballOn, 0 to 100), as js/rules.js keeps them.
  function openDrive() { var d = m.drives[m.drives.length - 1]; return d && !d.end ? d : null; }
  function closeDrive(end) { var d = openDrive(); if (d) d.end = end; }
  function filmRecord(res) {
    var e = res.e, off = res.pre.poss;
    if (e.t === 'xp') return;
    if (e.t === 'kickoff') {
      closeDrive('');
      m.drives.push({ team: off, start: res.post.ballOn, plays: [], end: '' });
      return;
    }
    var d = openDrive();
    if (!d || d.team !== off) { closeDrive(''); d = { team: off, start: res.pre.ballOn, plays: [], end: '' }; m.drives.push(d); }
    var from = res.pre.ballOn, to;
    if (res.td) to = 100;
    else if (res.post.poss === off) to = res.post.ballOn;
    else to = Math.max(0, Math.min(100, from + (res.yds || 0)));
    d.plays.push({ n: m.done, from: from, to: to, flag: e.t === 'pen', why: !!(m.feed[m.feed.length - 1] || {}).why });
    if (res.td) d.end = 'Touchdown';
    else if (e.t === 'fg') d.end = e.good ? 'Field goal' : 'Missed field goal';
    else if (e.t === 'punt') d.end = 'Punt';
    else if (e.t === 'int' || e.t === 'fumble') d.end = 'Turnover';
    else if (res.downs) d.end = 'Downs';
  }


  function statLine(t, role) {
    var s = m.st[t][role], out = [];
    if (role === 'QB') {
      if (s.att) out.push((s.cmp || 0) + ' of ' + s.att, (s.paYds || 0) + ' yds');
      if (s.paTd) out.push(s.paTd + ' TD');
      if (s.int) out.push(s.int + ' INT');
    } else if (role === 'K') {
      if (s.fga) out.push((s.fgm || 0) + ' of ' + s.fga + ' FG');
      if (s.xpa) out.push((s.xpm || 0) + ' of ' + s.xpa + ' XP');
    } else if (role === 'DST') {
      if (s.sack) out.push(s.sack + (s.sack === 1 ? ' sack' : ' sacks'));
      if (s.int) out.push(s.int + ' INT');
      if (s.fr) out.push(s.fr + ' fumble rec');
    } else {
      if (s.car) out.push(s.car + ' car, ' + (s.ruYds || 0) + ' yds');
      if (s.rec) out.push(s.rec + ' rec, ' + (s.reYds || 0) + ' yds');
      if (s.td) out.push(s.td + ' TD');
      if (s.fum) out.push(s.fum + ' FUM');
    }
    return out.join(', ') || (m.status === 'pre' ? 'Yet to play' : 'No stats yet');
  }

  function leaders(n) {
    var list = [];
    for (var t = 0; t < 2; t++) SLOTS.forEach(function (s) { list.push({ t: t, role: s.role, pts: playerPts(t, s.role) }); });
    list.sort(function (a, b) { return b.pts - a.pts; });
    return list.filter(function (p) { return p.pts > 0; }).slice(0, n);
  }

  // ------------------------------------------------------------ pieces

  function statusChip() {
    if (paused()) return '<span class="status is-paused"><i></i>Paused</span>';
    if (m.status === 'live') return '<span class="status is-live"><i></i>Live</span>';
    if (m.status === 'final') return '<span class="status is-final"><i></i>Final</span>';
    return '<span class="status"><i></i>Pregame</span>';
  }

  function side(t, withWin) {
    var tot = pts1(total(t)), tick = fresh && tot !== prevTotals[t] ? ' tick' : '';
    var win = withWin && !masked() && total(t) > total(1 - t) ? '<span class="won">Win</span>' : '';
    return '<div class="side' + (t === me ? ' is-mine' : '') + '" style="--c: var(--t' + t + ')">' +
      (t === me ? '<span class="mine-tag">Your team</span>' : me >= 0 ? '<span class="mine-tag is-blank" aria-hidden="true">Your team</span>' : '') +
      '<div class="side-id"><img class="sprite" src="' + marks[t] + '" alt=""><div class="team-name">' + esc(TEAMS[t].full) + '</div></div>' +
      '<div class="window"><span class="num' + tick + '">' + tot + '</span><span class="unit">Fantasy pts' + win + '</span></div>' +
      '</div>';
  }

  function fieldScore() {
    return ord().map(function (t) { return '<span class="fs">' + TEAMS[t].id + '<b>' + m.field[t] + '</b></span>'; }).join('');
  }

  // The choice of my team, a slim row under the scoreboard on the matchup screen.
  function meCard() {
    function btn(t, label) {
      return '<button type="button" data-act="me" data-v="' + t + '" aria-pressed="' + (me === t) + '">' + esc(label) + '</button>';
    }
    return '<div class="panel me-pick"><span class="eyebrow">Your team</span>' +
      '<div class="me-btns">' + btn(0, TEAMS[0].id) + btn(1, TEAMS[1].id) + btn(-1, 'Neither') + '</div></div>';
  }

  function board(actions, label) {
    var sit = m.status === 'pre' ? 'Kicks off when you start watching' : m.status === 'final' ? 'Full time'
            : paused() ? 'Paused' + (m.now ? ', ' + esc(m.now) : '') : esc(m.now);
    return '<div class="board">' +
      '<div class="board-top"><span class="eyebrow">' + esc(label) + '</span>' + statusChip() + '</div>' +
      '<div class="sides">' + ord().map(function (t) { return side(t, m.status === 'final'); }).join('') + '</div>' +
      '<div class="field"><span class="eyebrow">On the field</span>' + fieldScore() +
        '<span class="sit">' + sit + '</span></div>' +
      '<div class="actions">' + actions + '</div>' +
      '</div>';
  }

  function playerRow(t, role, rank) {
    var pts = playerPts(t, role), hot = !masked() && m.flash[t + role] && Date.now() - m.flash[t + role] < 1500;
    return '<div class="row' + (hot ? ' flash' : '') + (t === me ? ' is-mine' : '') + '">' +
      (rank ? '<span class="rank">' + rank + '</span>' : '') +
      '<span class="tile" style="--c: ' + TEAMS[t].colors.tile + '">' + initials(t, role) + '</span>' +
      '<div class="who"><div class="name">' + esc(fullName(t, role)) + '</div>' +
      '<div class="sub"><span class="pos">' + posOf(role) + '</span>' +
        (masked() ? (rank ? TEAMS[t].id : '') : (rank ? TEAMS[t].id + ', ' : '') + esc(statLine(t, role))) + '</div></div>' +
      '<span class="pts num' + (pts === 0 || masked() ? ' zero' : '') + '">' + pts1(pts) + '</span>' +
      '</div>';
  }

  // "Why this play": the play caller's probabilities for a play, from the event's
  // optional why field (contract v1). ?whydemo=1 attaches a sample to the first
  // three plays from scrimmage so the card can be seen before real data exists.
  var WHY_DEMO = /[?&]whydemo=1(&|$)/.test(location.search);
  var WHY_SAMPLE = { play: { deep_pass: 0.46, run: 0.31, short_pass: 0.17, screen: 0.06 } };
  var WHY_QUESTIONS = { play: 'Which play to call' };
  var SCRIMMAGE = ['run', 'pass', 'inc', 'sack', 'int', 'fumble'];
  var whyDemoUsed = 0, whyOpen = {};

  function isProbMap(o) {
    if (!o || typeof o !== 'object') return false;
    var ks = Object.keys(o);
    return ks.length > 0 && ks.every(function (k) { return typeof o[k] === 'number' && isFinite(o[k]); });
  }
  // Which option was called: why.picked from the game file (contract v1), else, for the
  // ?whydemo=1 sample, read from what happened on the play.
  function chosenFor(q, opts, e, res, why) {
    if (q === 'play' && typeof why.picked === 'string') return why.picked in opts ? why.picked : '';
    if (q !== 'play') return '';
    var guess = '';
    if (e.t === 'run' || e.t === 'fumble') guess = 'run';
    else if (e.t === 'pass') guess = e.yds >= 15 ? 'deep_pass' : 'short_pass';
    return guess && guess in opts ? guess : '';
  }
  function whyFor(e, res) {
    var why = e.why;
    if (!why && WHY_DEMO && SCRIMMAGE.indexOf(e.t) >= 0 && whyDemoUsed < 3) { whyDemoUsed += 1; why = WHY_SAMPLE; }
    if (!why || typeof why !== 'object') return null;
    var out = [];
    Object.keys(why).forEach(function (q) {
      if (!isProbMap(why[q])) return;
      var opts = why[q], sum = 0;
      Object.keys(opts).forEach(function (k) { sum += Math.max(0, opts[k]); });
      if (!(sum > 0)) return;
      var chosen = chosenFor(q, opts, e, res, why);
      out.push({
        q: q, chosen: chosen, team: res.pre.poss,
        opts: Object.keys(opts).map(function (k) { return { k: k, p: Math.max(0, opts[k]) / sum }; })
                .sort(function (a, b) { return b.p - a.p; })
      });
    });
    return out.length ? out : null;
  }
  function humanize(k) { var t = String(k).replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); }
  // pass_WR1 is "Pass to" the WR1 on that team's roster, run_RB is "Run by" the RB.
  function optionName(k, t) {
    var mm = /^(pass|run)_([A-Z]+[0-9]*)$/.exec(String(k));
    var name = mm && TEAMS[t] && TEAMS[t].roster && TEAMS[t].roster[mm[2]];
    if (!name) return humanize(k);
    return (mm[1] === 'pass' ? 'Pass to ' : 'Run by ') + Rules.lastName(name);
  }
  function whyCard(p, forceOpen) {
    if (!p.why) return '';
    var body = p.why.map(function (w) {
      return '<div class="why-q">' + esc(WHY_QUESTIONS[w.q] || humanize(w.q)) + '?</div>' +
        '<ul class="why-bars">' + w.opts.map(function (o) {
          var pct = Math.round(o.p * 100), on = o.k === w.chosen;
          return '<li' + (on ? ' class="is-chosen"' : '') + '>' +
            '<span class="why-name"><span>' + esc(optionName(o.k, w.team)) + '</span>' + (on ? '<b>Called</b>' : '') + '</span>' +
            '<span class="why-bar"><i style="width:' + pct + '%"></i></span>' +
            '<span class="why-pct">' + pct + '%</span></li>';
        }).join('') + '</ul>';
    }).join('');
    return '<details class="why" data-n="' + p.n + '"' + (forceOpen || whyOpen[p.n] ? ' open' : '') + '>' +
      '<summary>Why this play</summary>' + body + '<p class="why-note">Chosen by the play caller from these odds</p></details>';
  }

  function playItem(p, isNew) {
    if (p.divider) return '<li class="divider">' + esc(p.divider) + '</li>';
    var tags = p.tags.map(function (t) { return '<span class="tag t-' + t[0] + '">' + t[1] + '</span>'; }).join('');
    if (p.scoring) tags += '<span class="play-score">' + TEAMS[0].id + ' ' + p.score[0] + ', ' + TEAMS[1].id + ' ' + p.score[1] + '</span>';
    var fp = p.fp.map(function (f) {
      var cls = (f.team === me ? ' mine' : '') + (!masked() && f.pts < 0 ? ' neg' : '');
      var open = cls ? '<div class="' + cls.slice(1) + '">' : '<div>';
      if (masked()) return open + '<b>' + MASK + '</b> ' + esc(f.who) + '</div>';
      return open + '<b>' + (f.pts > 0 ? '+' : '') + f1(f.pts) + '</b> ' + esc(f.who) + '</div>';
    }).join('');
    return '<li class="play' + (isNew ? ' is-new' : '') + (p.team === me ? ' is-mine' : '') + '" style="--c: var(--t' + p.team + ')">' +
      '<div class="play-main">' +
        '<div class="play-meta"><b>' + TEAMS[p.team].id + '</b>' + esc(p.where) + '</div>' +
        '<div class="play-desc">' + esc(p.desc) + '</div>' +
        (tags ? '<div class="play-tags">' + tags + '</div>' : '') +
      '</div>' +
      (fp ? '<div class="play-fp">' + fp + '</div>' : '') +
      whyCard(p) +
      '</li>';
  }

  function watchButton(cls) {
    return '<button type="button" class="cta' + (cls || '') + '" data-act="' + (m.status === 'final' ? 'again' : 'watch') + '">' +
      (m.status === 'final' ? 'Watch again' : m.status === 'live' ? 'Keep watching' : 'Watch the game') + '</button>';
  }

  // ------------------------------------------------ the opt-in and the service
  // With ?api=http://localhost:<port> the opt-in also goes to Ricky's service
  // (server/index.js): GET /health once at start, POST /games/:id/optin, GET /games/:id/optins.
  // Without it, or when the service or its database does not answer within two seconds,
  // nothing changes: the choice stays on this device and the screen says so.
  var API = (function () {
    var mm = /[?&]api=([^&]+)/.exec(location.search), u = mm ? decodeURIComponent(mm[1]) : '';
    return /^https?:\/\/[^\s"'<>]+$/.test(u) ? u.replace(/\/+$/, '') : '';
  })();
  var league$ = { state: API ? 'checking' : 'off', saved: '', optins: null };
  function apiFetch(path, opts) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2000);
    var o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    return fetch(API + path, o).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function gameId() {
    var useFile = window.FF_GAME_FILE && window.FF_GAME_FILE.id && !/[?&]game=sample/.test(location.search);
    return useFile ? window.FF_GAME_FILE.id : 'sample-football';
  }
  function managerName() { return me >= 0 ? TEAMS[me].id : TEAMS[0].id; }
  function leagueChanged() { if (!inGame) render(false); }
  function loadOptins() {
    return apiFetch('/games/' + encodeURIComponent(gameId()) + '/optins').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && Array.isArray(j.optins)) { league$.optins = j.optins.map(function (x) { return String(x.manager); }); leagueChanged(); }
    }).catch(function () { /* the list is optional */ });
  }
  function saveOptinToLeague() {
    if (league$.state !== 'up') { league$.saved = 'device'; return; }
    league$.saved = 'saving';
    apiFetch('/games/' + encodeURIComponent(gameId()) + '/optin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager: managerName() })
    }).then(function (r) {
      league$.saved = r.status === 201 || r.status === 200 ? 'league' : 'device';
      if (league$.saved === 'league') loadOptins();
      leagueChanged();
    }).catch(function () { league$.saved = 'device'; leagueChanged(); });
  }
  if (API && window.fetch) {
    apiFetch('/health').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      league$.state = j && j.ok ? 'up' : 'down';
      if (league$.state === 'up') { loadOptins(); if (optin === 'in') saveOptinToLeague(); } else league$.saved = 'device';
      leagueChanged();
    }).catch(function () { league$.state = 'down'; league$.saved = 'device'; leagueChanged(); });
  } else if (API) { league$.state = 'down'; }
  function savedLine() {
    var t;
    if (league$.saved === 'league') {
      t = 'Saved to the league.' + (league$.optins && league$.optins.length ? ' Opted in: ' + league$.optins.join(', ') + '.' : '');
    } else if (league$.saved === 'saving' || league$.state === 'checking') t = 'Saving to the league\u2026';
    else t = 'Saved on this device.';
    return '<p class="optin-saved">' + esc(t) + '</p>';
  }

  // The opt in card shows on the matchup screen before kickoff, until a choice is made.
  // Once opted in, a short line says so and lets the manager take it back.
  function optinCard() {
    if (m.status !== 'pre') return '';
    if (optin === null) {
      return '<div class="panel optin">' +
        '<div class="optin-text"><h2>Hide my score until the recap</h2>' +
        '<p>Fantasy points and stat lines stay hidden while you watch. Everything shows at the final.</p></div>' +
        '<div class="optin-btns">' +
          '<button type="button" class="cta" data-act="optin" data-v="in">Opt in</button>' +
          '<button type="button" class="cta ghost" data-act="optin" data-v="out">No thanks</button>' +
        '</div></div>';
    }
    if (optin === 'in') {
      return '<div class="panel optin is-on"><div class="optin-text"><p>Your score is hidden until the final.</p>' + savedLine() + '</div>' +
        '<button type="button" class="optin-undo" data-act="optin" data-v="out">Show scores</button></div>';
    }
    return '';
  }

  // ----------------------------------------------------------- screens

  function renderMatchup() {
    var actions = m.status === 'final'
      ? '<a class="cta" href="#recap">See the recap</a>' + watchButton(' ghost')
      : watchButton();
    var plays = m.feed.filter(function (p) { return !p.divider; }).slice(-3).reverse();
    var top = masked() ? [] : leaders(3);
    var noLeaders = masked() ? 'Leaders are hidden until the final.' : 'No fantasy points yet.';
    return optinCard() + board(actions, WEEK + ' matchup') + meCard() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Latest plays</h2><a href="#plays">All plays</a></div>' +
          (plays.length ? '<ul class="feed">' + plays.map(function (p, i) { return playItem(p, fresh && i === 0); }).join('') + '</ul>'
                        : '<div class="empty">Plays show up here once the game kicks off.</div>') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Leaders</h2><a href="#lineups">Lineups</a></div>' +
          (top.length ? top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('')
                      : '<div class="empty">' + noLeaders + '</div>') + '</div>' +
      '</div>';
  }

  function renderLineups() {
    function team(t) {
      return '<div class="panel">' +
        '<div class="lineup-head" style="--c: var(--t' + t + ')"><img class="sprite" src="' + marks[t] + '" alt="">' +
        '<div class="team-name">' + esc(TEAMS[t].full) + '</div><span class="num">' + pts1(total(t)) + '</span></div>' +
        SLOTS.map(function (s) { return playerRow(t, s.role, 0); }).join('') +
        '</div>';
    }
    return '<div class="grid two is-first">' + ord().map(team).join('') + '</div>' +
      '<p class="note is-plain">' + rulesNote() + '</p>';
  }

  function renderPlays() {
    var list = m.feed.filter(function (p) {
      if (filter === 'scoring') return p.scoring;
      if (filter === 'flags') return p.flag;
      return true;
    }).slice().reverse();
    function btn(id, label) {
      return '<button type="button" data-act="filter" data-f="' + id + '" aria-pressed="' + (filter === id) + '">' + label + '</button>';
    }
    var none = m.status === 'pre' ? 'Plays show up here once the game kicks off.'
             : filter === 'scoring' ? 'No scoring plays yet.' : filter === 'flags' ? 'No penalties yet.' : paused() ? 'Paused before the first play. Keep watching to see it.' : 'Waiting for the first play.';
    return '<div class="narrow">' +
      '<div class="filters">' + btn('all', 'All') + btn('scoring', 'Scoring') + btn('flags', 'Penalties') +
        '<span class="count">' + m.done + ' of ' + G.plays + ' plays</span></div>' +
      '<div class="panel">' +
        (list.length ? '<ul class="feed">' + list.map(function (p, i) { return playItem(p, fresh && i === 0 && filter === 'all'); }).join('') + '</ul>'
                     : '<div class="empty">' + none + '</div>') +
      '</div></div>';
  }

  // The reveal: the winner, shown large, opens the recap after the final.
  // Fantasy points decide the winner. Watch again replays the game and keeps the opt in choice.
  // ------------------------------------------------------- result card
  // A picture of the result, drawn on a canvas in the page: no network requests.
  var CARD_W = 1080, CARD_H = 1350, CARD_FONT = '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
  var CARD_BODY = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  function wrapText(g, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) {
      var next = cur ? cur + ' ' + w : w;
      if (cur && g.measureText(next).width > maxW) { lines.push(cur); cur = w; } else cur = next;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawResultCard() {
    var c = document.createElement('canvas');
    c.width = CARD_W; c.height = CARD_H;
    var g = c.getContext('2d'), P = 72, inner = CARD_W - 2 * P;
    var p0 = Number(f1(total(0))), p1 = Number(f1(total(1)));
    var w = p0 === p1 ? -1 : p0 > p1 ? 0 : 1;
    var order = ord(), top = leaders(1)[0];
    // Colors come from the tokens on :root, so the card has the app's one look.
    var styles = getComputedStyle(document.documentElement);
    function tokenColor(name, fallback) { return styles.getPropertyValue(name).trim() || fallback; }
    var amber = tokenColor('--amber', '#ffc21a'), C = {
      bg: tokenColor('--bg', '#0b0d0e'), panel: tokenColor('--panel', '#131617'), inset: tokenColor('--inset', '#1b1f21'),
      rule: tokenColor('--rule', '#2b3033'), text: tokenColor('--text', '#f3f1ea'), dim: tokenColor('--dim', '#8e9597')
    };

    g.fillStyle = C.bg; g.fillRect(0, 0, CARD_W, CARD_H);
    g.fillStyle = w < 0 ? amber : TEAMS[w].colors.jersey; g.fillRect(0, 0, CARD_W, 14);

    // Header: the project name and the week.
    g.textBaseline = 'alphabetic';
    g.fillStyle = amber; g.fillRect(P, 92, 22, 22);
    g.fillStyle = C.text; g.font = '700 44px ' + CARD_FONT; g.textAlign = 'left';
    g.fillText('FANTASY RECAP', P + 38, 114);
    g.fillStyle = C.dim; g.font = '700 28px ' + CARD_BODY; g.textAlign = 'right';
    g.fillText((WEEK + ' result').toUpperCase(), CARD_W - P, 112);

    // The winner, large, with the team's player.
    var y = 210;
    if (w >= 0) {
      try {
        var spr = Spr.get(w, TEAMS[w].colors, 'f', 'stand', w ? 1 : 0);
        g.imageSmoothingEnabled = false;
        g.drawImage(spr, P, y, 120, 120 * spr.height / spr.width);
      } catch (err) { /* the card works without the player */ }
    }
    var tx = w >= 0 ? P + 156 : P;
    g.textAlign = 'left'; g.fillStyle = C.text; g.font = '700 112px ' + CARD_FONT;
    var lines = wrapText(g, (w < 0 ? 'It is a tie' : TEAMS[w].full).toUpperCase(), CARD_W - P - tx);
    lines.slice(0, 2).forEach(function (l, i) { g.fillText(l, tx, y + 92 + i * 104); });
    var after = y + 92 + (Math.min(lines.length, 2) - 1) * 104;
    if (w >= 0) { g.fillStyle = amber; g.font = '700 72px ' + CARD_FONT; g.fillText('WIN', tx, after + 86); after += 86; }

    // Both fantasy totals, my team first when I have one.
    y = Math.max(after + 70, 560);
    var boxW = (inner - 24) / 2, boxH = 230;
    order.forEach(function (t, i) {
      var x = P + i * (boxW + 24);
      g.fillStyle = C.inset; g.fillRect(x, y, boxW, boxH);
      g.fillStyle = TEAMS[t].colors.jersey; g.fillRect(x, y, boxW, 10);
      g.fillStyle = C.text; g.font = '700 128px ' + CARD_FONT; g.textAlign = 'left';
      g.fillText(f1(total(t)), x + 28, y + 150);
      g.fillStyle = C.dim;
      var label = (TEAMS[t].name + (t === me ? ' (you)' : '') + ', fantasy pts').toUpperCase(), fs = 26;
      g.font = '700 ' + fs + 'px ' + CARD_BODY;
      while (fs > 18 && g.measureText(label).width > boxW - 56) { fs -= 1; g.font = '700 ' + fs + 'px ' + CARD_BODY; }
      g.fillText(label, x + 28, y + 200);
    });

    // The score on the field.
    y += boxH + 70;
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY; g.textAlign = 'left';
    g.fillText('ON THE FIELD', P, y);
    g.fillStyle = C.text; g.font = '700 54px ' + CARD_FONT;
    g.fillText(order.map(function (t) { return TEAMS[t].id + ' ' + m.field[t]; }).join('   '), P + 250, y + 6);

    // The top performer.
    y += 60;
    g.fillStyle = C.panel; g.fillRect(P, y, inner, 190);
    g.strokeStyle = C.rule; g.lineWidth = 2; g.strokeRect(P + 1, y + 1, inner - 2, 188);
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY;
    g.fillText('TOP PERFORMER', P + 32, y + 50);
    if (top) {
      g.fillStyle = C.text; g.font = '700 64px ' + CARD_FONT;
      var nm = fullName(top.t, top.role);
      while (g.measureText(nm).width > inner - 300 && nm.length > 4) nm = nm.slice(0, -2);
      g.fillText(nm, P + 32, y + 122);
      g.fillStyle = C.dim; g.font = '600 28px ' + CARD_BODY;
      g.fillText(TEAMS[top.t].id + ', ' + posOf(top.role), P + 32, y + 166);
      g.fillStyle = amber; g.font = '700 96px ' + CARD_FONT; g.textAlign = 'right';
      g.fillText(f1(top.pts), CARD_W - P - 32, y + 136);
    }

    // Footer.
    g.textAlign = 'left'; g.fillStyle = C.dim; g.font = '600 26px ' + CARD_BODY;
    g.fillText('Sample league with mock data. Made with Fantasy Recap.', P, CARD_H - 70);
    return c;
  }

  function cardFileName() {
    return 'fantasy-recap-' + WEEK.toLowerCase().replace(/\s+/g, '-') + '.png';
  }

  // Share sheet when the browser has one for files, a download otherwise.
  function shareResult(btn) {
    var c = drawResultCard();
    if (btn) btn.disabled = true;
    function done() { if (btn) btn.disabled = false; }
    function download(blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = cardFileName();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
    c.toBlob(function (blob) {
      if (!blob) { done(); return; }
      var file = null;
      try { file = new File([blob], cardFileName(), { type: 'image/png' }); } catch (err) { file = null; }
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Fantasy Recap, ' + WEEK })
          .catch(function (err) { if (!err || err.name !== 'AbortError') download(blob); })
          .then(done, done);
      } else {
        download(blob);
        done();
      }
    }, 'image/png');
  }

  function winnerHero() {
    var p0 = Number(f1(total(0))), p1 = Number(f1(total(1)));
    var w = p0 === p1 ? -1 : p0 > p1 ? 0 : 1;
    var head = w < 0
      ? '<div class="hero-id"><div class="hero-name">It is a tie</div></div>'
      : '<div class="hero-id"><img class="sprite" src="' + marks[w] + '" alt="">' +
          '<div class="hero-name">' + esc(TEAMS[w].full) + '<span>win</span></div></div>';
    var keep = optin === 'in' ? '<p class="hero-keep">Your score stays hidden again on the replay.</p>' : '';
    return '<div class="board hero" style="--c: var(--t' + (w < 0 ? 0 : w) + ')">' +
      '<div class="board-top"><span class="eyebrow">' + esc(WEEK) + ' result</span>' + statusChip() + '</div>' +
      head +
      '<div class="hero-score">' +
        ord().map(function (t) {
          return '<div style="--c: var(--t' + t + ')"><span class="num">' + f1(total(t)) + '</span><span class="eyebrow">' +
            esc(TEAMS[t].name) + (t === me ? ', yours' : '') + '</span></div>';
        }).join('') +
      '</div>' +
      '<div class="field"><span class="eyebrow">On the field</span>' +
        fieldScore() +
        '<span class="sit">Full time</span></div>' +
      '<div class="actions">' + watchButton() + '<button type="button" class="cta ghost" data-act="share">Share result</button>' +
        '<a class="cta ghost" href="#film">Film room</a>' + keep + '</div>' +
      '</div>';
  }

  function renderRecap() {
    if (m.status !== 'final') {
      return '<div class="narrow"><div class="panel">' +
        '<div class="panel-head"><h2>Recap</h2>' + statusChip() + '</div>' +
        '<div class="empty">' + (masked() ? 'Scores are hidden. Watch the game to find out.'
                                         : 'The recap is ready at the final whistle: final score, top performers and every scoring play.') +
        (paused() ? ' The game is paused while you are away, so you will not miss a play.' : '') +
        '<div class="progress"><i style="width:' + Math.round(100 * m.done / G.plays) + '%"></i></div>' +
        '<div class="progress-text">' + m.done + ' of ' + G.plays + ' plays so far</div></div>' +
        '<div class="actions">' + watchButton() + '</div>' +
        '</div></div>';
    }
    var top = leaders(5);
    var scores = m.feed.filter(function (p) { return p.scoring; });
    var a = m.team[0], b = m.team[1];
    function line(x, label, y) {
      if (me === 1) { var z = x; x = y; y = z; }
      return '<tr><td>' + x + '</td><td>' + label + '</td><td>' + y + '</td></tr>';
    }
    return winnerHero() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Top performers</h2></div>' +
          top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Scoring plays</h2><a href="#plays">All plays</a></div>' +
          '<ul class="feed">' + scores.map(function (p) { return playItem(p, false); }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="grid"><div class="panel"><div class="panel-head"><h2>' + TEAMS[ord()[0]].name + ' against ' + TEAMS[ord()[1]].name + '</h2></div>' +
        '<table class="compare">' +
          line(f1(total(0)), 'Fantasy points', f1(total(1))) +
          line(m.field[0], 'Score on the field', m.field[1]) +
          line(a.pass + a.rush, 'Total yards', b.pass + b.rush) +
          line(a.pass, 'Net passing', b.pass) +
          line(a.rush, 'Rushing', b.rush) +
          line(a.to, 'Turnovers', b.to) +
          line(a.pens + ' for ' + a.penYds, 'Penalties', b.pens + ' for ' + b.penYds) +
        '</table></div></div>';
  }

  // League home: this week's matchups in a small sample league, ours first.
  // The other teams are invented for the demo; only our matchup has a game to watch.
  // League home and the season. data/league.json (Ricky) has the sample league: this
  // week's matchups, finished past weeks and the standings. Without it (opened from a
  // file, or the fetch fails) the screen shows this week from the built-in sample.
  var leagueData = null, weekSel = 0;
  var FALLBACK_LEAGUE = {
    week: 11, release: { text: 'Recap drops Tuesday' },
    matchups: [
      { ours: true },
      { ours: false, teams: [{ id: 'TUR', full: 'Turbo Turtles', tile: '#2f8f6b' }, { id: 'OWL', full: 'Midnight Owls', tile: '#4a5bd0' }], optedIn: ['TUR', 'OWL'] }
    ]
  };
  function validLeague(d) {
    return !!(d && typeof d.week === 'number' && Array.isArray(d.matchups) && d.matchups.every(function (x) { return x.ours || (Array.isArray(x.teams) && x.teams.length === 2); }));
  }
  if (window.fetch) {
    fetch('data/league.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!validLeague(d)) return;
      leagueData = d;
      if (tab === 'league' && !inGame) render(false);
    }).catch(function () { /* the built-in sample stays */ });
  }
  function league() { return leagueData || FALLBACK_LEAGUE; }
  function releaseText() { var L = league(); return (L.release && L.release.text) || 'Recap drops Tuesday'; }
  function pastWeeks() {
    return ((leagueData && leagueData.weeks) || []).filter(function (w) { return w.finished && Array.isArray(w.matchups); });
  }

  function leagueTeam(name, tile, sprite) {
    return '<div class="lg-team">' +
      (sprite ? '<img class="sprite" src="' + sprite + '" alt="">' : '<span class="tile" style="--c: ' + esc(tile || '#444') + '">' + esc(String(name).charAt(0)) + '</span>') +
      '<span class="team-name">' + esc(name) + '</span></div>';
  }
  function optMark(on) {
    return on ? '<span class="lg-mark is-on">Opted in</span>' : '<span class="lg-mark">Not opted in</span>';
  }
  function myLeagueId() { return me >= 0 ? TEAMS[me].id : ''; }

  function oursCard() {
    return '<a class="panel lg-match is-ours" href="#matchup">' +
      '<div class="lg-top"><span class="eyebrow">Your matchup</span>' + statusChip() + '</div>' +
      '<div class="lg-teams">' + ord().map(function (t) { return leagueTeam(TEAMS[t].full + (t === me ? ' (you)' : ''), '', marks[t]); }).join('<span class="lg-vs">vs</span>') + '</div>' +
      '<div class="lg-foot">' + optMark(optin === 'in') + '<span class="lg-drop">' + esc(releaseText()) + '</span><span class="lg-go">Open</span></div>' +
      '</a>';
  }
  function otherCard(x) {
    var all = Array.isArray(x.optedIn) && x.teams.every(function (t) { return x.optedIn.indexOf(t.id) >= 0; });
    return '<div class="panel lg-match">' +
      '<div class="lg-teams">' + leagueTeam(x.teams[0].full, x.teams[0].tile) + '<span class="lg-vs">vs</span>' + leagueTeam(x.teams[1].full, x.teams[1].tile) + '</div>' +
      '<div class="lg-foot">' + optMark(all) + '<span class="lg-drop">' + esc(releaseText()) + '</span></div>' +
      '</div>';
  }
  // A finished week: final scores, the winner, and Watch the recap when there is a game for it.
  function finishedCard(x, wk) {
    var f = Array.isArray(x.final) ? x.final : null;
    var win = f ? (f[0] === f[1] ? -1 : f[0] > f[1] ? 0 : 1) : -1;
    var mine = myLeagueId();
    var rows = x.teams.map(function (t, i) {
      return '<div class="lg-final' + (i === win ? ' is-win' : '') + (t.id === mine ? ' is-mine' : '') + '">' +
        leagueTeam(t.full, t.tile) +
        '<span class="num">' + (f ? f1(f[i]) : '--') + '</span>' + (i === win ? '<span class="won">Win</span>' : '') + '</div>';
    }).join('');
    var playable = x.gameFile && /week11-football\.json$/.test(x.gameFile);
    var why = x.gameFile ? 'The app plays one game file at a time, and it is not this one.' : 'No game file for week ' + wk + '. Only the final scores were kept.';
    var btn = playable
      ? '<a class="cta ghost" href="#recap">Watch the recap</a>'
      : '<button type="button" class="cta ghost" disabled aria-describedby="why-' + wk + '-' + esc(x.teams[0].id) + '">Watch the recap</button>' +
        '<p class="lg-why" id="why-' + wk + '-' + esc(x.teams[0].id) + '">' + esc(why) + '</p>';
    return '<div class="panel lg-match is-final">' +
      '<div class="lg-top"><span class="eyebrow">Week ' + wk + ', final</span></div>' +
      '<div class="lg-finals">' + rows + '</div>' +
      '<div class="lg-foot lg-watch">' + btn + '</div></div>';
  }

  function standingsTable() {
    var rows = (leagueData && leagueData.standings) || [];
    if (!rows.length) return '';
    var mine = myLeagueId();
    return '<div class="panel lg-standings"><div class="panel-head"><h2>Standings</h2><span class="lg-count">after ' + pastWeeks().length + ' weeks</span></div>' +
      '<table class="standings"><thead><tr><th scope="col">Team</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Points for</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr' + (r.id === mine ? ' class="is-mine"' : '') + '><th scope="row"><span class="rank">' + (i + 1) + '</span>' + esc(r.full) + (r.id === mine ? ' (you)' : '') + '</th>' +
          '<td class="num">' + r.wins + '</td><td class="num">' + r.losses + '</td><td class="num">' + f1(r.pointsFor) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function weekPicker() {
    var weeks = pastWeeks().map(function (w) { return w.week; });
    var cur = league().week;
    if (weeks.indexOf(cur) < 0) weeks.push(cur);
    if (weeks.length < 2) return '';
    return '<div class="lg-weeks" role="group" aria-label="Week">' + weeks.map(function (n) {
      return '<button type="button" data-act="week" data-w="' + n + '" aria-pressed="' + (n === weekSel) + '">Week ' + n + (n === cur ? ', now' : '') + '</button>';
    }).join('') + '</div>';
  }

  function renderLeague() {
    var L = league();
    if (!weekSel) weekSel = L.week;
    var body, count;
    if (weekSel === L.week) {
      var others = L.matchups.filter(function (x) { return !x.ours; });
      body = oursCard() + others.map(otherCard).join('') +
        '<a class="cta ghost lg-top-link" href="#week">This week\'s biggest plays</a>';
      count = (1 + others.length) + ' matchups, 4 teams';
    } else {
      var wk = pastWeeks().filter(function (w) { return w.week === weekSel; })[0];
      body = wk ? wk.matchups.map(function (x) { return finishedCard(x, wk.week); }).join('') : '<div class="empty">Nothing for this week.</div>';
      count = 'Finished';
    }
    return '<div class="narrow">' +
      weekPicker() +
      '<div class="lg-head"><h2>Week ' + weekSel + ' matchups</h2><span class="lg-count">' + count + '</span></div>' +
      body + standingsTable() +
      '<p class="note is-plain">Sample league, made up for the demo: the other teams, past scores and standings are invented. ' +
      'Each recap is released on Tuesday, after the week is over. Only your week ' + L.week + ' matchup has a game to watch.</p>' +
      '</div>';
  }

  // ------------------------------------------------- this week in the league
  // The biggest plays of each matchup this week. Same list as Ricky's server/top-plays.js
  // (replayed as in server/replay.js, ranked by points, then highlight, then the earlier
  // play), worked out here from the game the app plays, so it needs no service.
  var topCache = null;
  function topPlaysLocal(n) {
    if (topCache) return topCache.slice(0, n);
    var list = [], half = 1;
    try {
      var state = Rules.create(TEAMS);
      Rules.flatten(D.SAMPLE_GAME, TEAMS).forEach(function (st) {
        if (st.kind === 'half') { Rules.startHalf(state); half = 2; return; }
        if (st.kind === 'final') return;
        list.push({ st: st, r: Rules.apply(state, st.e, st.team), half: half });
      });
    } catch (err) { return []; }
    [1, 2].forEach(function (h) {
      var inHalf = list.filter(function (x) { return x.half === h; }), cut = Math.ceil(inHalf.length / 2);
      inHalf.forEach(function (x, i) { x.quarter = (h - 1) * 2 + (i < cut ? 1 : 2); });
    });
    [1, 2, 3, 4].forEach(function (q) {
      var inQ = list.filter(function (x) { return x.quarter === q; });
      inQ.forEach(function (x, k) { var left = Math.round(900 * (1 - k / inQ.length)); x.clock = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2); });
    });
    topCache = list.map(function (x, i) {
      var fp = x.r.fp || [], main = null, names = [];
      fp.forEach(function (f) {
        if (!main || Math.abs(f.pts) > Math.abs(main.pts)) main = f;
        var nm = f.role === 'DST' ? TEAMS[f.team].id + ' defense' : TEAMS[f.team].roster[f.role];
        if (nm && names.indexOf(nm) < 0) names.push(nm);
      });
      var text = String(x.r.text || x.st.e.t);
      if (x.r.td && !/touchdown/i.test(text)) text += ', touchdown';
      var why = x.st.e.why;
      return { index: i + 1, quarter: x.quarter, clock: x.clock, team: TEAMS[main ? main.team : x.st.team].id, kind: x.st.e.t,
        players: names, points: Math.round(fp.reduce(function (a, f) { return a + Math.abs(f.pts); }, 0) * 10) / 10,
        highlight: why && typeof why.highlight === 'number' ? why.highlight : 0, text: text };
    }).filter(function (x) { return x.points > 0; }).sort(function (a, b) {
      return b.points - a.points || b.highlight - a.highlight || a.index - b.index;
    });
    return topCache.slice(0, n);
  }

  // Watch this play: FF_GAME.seek when the game has it; otherwise run the game silently in
  // the background at top speed until that play is next, then open the view at the chosen speed.
  var seeking = 0;
  function watchPlay(index, btn) {
    if (G.seek) { try { G.seek(index); location.hash = 'game'; return; } catch (err) { /* fall back below */ } }
    if (seeking) return;
    var ff = window.__ff, speed0 = ff ? ff.speed : 1;
    seeking = index;
    if (btn) { btn.disabled = true; btn.textContent = 'Finding the play'; }
    if (m.status === 'final' || m.done > index - 1) G.restart(); else G.start();
    function arrive() {
      if (!seeking || m.done < seeking - 1) return false;
      seeking = 0;
      if (ff) ff.speed = speed0;
      if (G.setBackground) G.setBackground(false);
      location.hash = 'game';
      return true;
    }
    if (arrive()) return;
    if (G.setBackground) G.setBackground(true);
    if (ff) ff.speed = 40;
    var timer = setInterval(function () { if (arrive() || !seeking) clearInterval(timer); }, 50);
  }

  function topCard(x) {
    var where = '', text = x.text, mm = /^(.+? at (?:the )?[A-Z0-9 ]+|1st and goal[^:]*): (.*)$/.exec(x.text);
    if (mm) { where = mm[1]; text = mm[2]; }
    text = text.charAt(0).toUpperCase() + text.slice(1).replace(/TOUCHDOWN/g, 'touchdown') + '.';
    var t = teamByName(x.team);
    return '<li class="panel top-play" style="--c: var(--t' + (t < 0 ? 0 : t) + ')">' +
      '<div class="top-meta"><span class="eyebrow">Q' + x.quarter + ' ' + esc(x.clock) + '</span><b>' + esc(x.team) + '</b>' + (where ? '<span>' + esc(where) + '</span>' : '') + '</div>' +
      '<p class="top-text">' + esc(text) + '</p>' +
      '<div class="top-foot"><span class="top-who">' + esc(x.players.join(', ')) + '</span><span class="num">' + f1(x.points) + '</span><span class="unit">pts</span></div>' +
      '<button type="button" class="cta ghost" data-act="seek" data-i="' + x.index + '">Watch this play</button></li>';
  }
  function hiddenCard(i) {
    return '<li class="panel top-play is-hidden"><div class="top-meta"><span class="eyebrow">Play ' + i + '</span></div>' +
      '<p class="top-text">Hidden until the final.</p>' +
      '<div class="top-foot"><span class="top-who"></span><span class="num">' + MASK + '</span><span class="unit">pts</span></div></li>';
  }

  function renderWeek() {
    var L = league(), hide = masked();
    var groups = L.matchups.map(function (x) {
      if (x.ours) {
        var title = TEAMS[ord()[0]].full + ' against ' + TEAMS[ord()[1]].full;
        var cards = hide ? [1, 2, 3].map(hiddenCard).join('') : topPlaysLocal(3).map(topCard).join('');
        return '<section class="top-group" aria-label="' + esc(title) + '"><h3 class="top-title">' + esc(title) + '</h3>' +
          (hide ? '<p class="top-why">Your score is hidden, so this game\'s biggest plays stay hidden until the final. ' +
                  'Watch the game to see them.</p><div class="actions top-actions">' + watchButton() + '</div>' : '') +
          '<ol class="top-list">' + cards + '</ol></section>';
      }
      var t2 = x.teams[0].full + ' against ' + x.teams[1].full;
      return '<section class="top-group" aria-label="' + esc(t2) + '"><h3 class="top-title">' + esc(t2) + '</h3>' +
        '<div class="panel"><div class="empty">No game file for this matchup, so there are no plays to show. Only the score will be kept.</div></div></section>';
    }).join('');
    return '<div class="narrow">' +
      '<div class="lg-head"><h2>Week ' + L.week + ', biggest plays</h2><a class="lg-back" href="#league">League</a></div>' +
      groups +
      '<p class="note is-plain">The three plays that moved the most fantasy points in each game, from the game file. ' +
      'Quarters and clock times are worked out from the order of the plays, since the game file has none.</p></div>';
  }

  var filmSel = 0; // the play number open in the film room

  var END_MARK = { 'Touchdown': 'TD', 'Field goal': 'FG', 'Missed field goal': 'FG miss', 'Punt': 'Punt', 'Turnover': 'TO', 'Downs': 'Downs', 'End of half': 'Half', 'End of game': 'End' };
  // Field position across the page: the Goblins attack to the right, the Pythons to the left.
  function absX(team, ballOn) { return team === 0 ? ballOn : 100 - ballOn; }

  function filmStats() {
    var picked = [];
    m.feed.forEach(function (p) {
      if (!p.why) return;
      p.why.forEach(function (w) {
        if (!w.chosen) return;
        var o = w.opts.filter(function (x) { return x.k === w.chosen; })[0];
        if (o) picked.push({ p: p, team: w.team, k: o.k, pr: o.p });
      });
    });
    if (!picked.length) return null;
    var best = picked[0], worst = picked[0], sum = 0;
    picked.forEach(function (x) { if (x.pr > best.pr) best = x; if (x.pr < worst.pr) worst = x; sum += x.pr; });
    return { count: picked.length, best: best, worst: worst, avg: sum / picked.length };
  }

  function filmPlayDetail() {
    var plays = m.feed.filter(function (p) { return !p.divider; });
    var i = -1;
    for (var k = 0; k < plays.length; k++) if (plays[k].n === filmSel) i = k;
    if (i < 0) return '<div class="empty">Tap a play in the chart to see it here, with the play caller\'s odds when it chose the play.</div>';
    var p = plays[i];
    var nav = '<div class="film-nav">' +
      '<button type="button" data-act="film" data-n="' + (i > 0 ? plays[i - 1].n : p.n) + '"' + (i > 0 ? '' : ' disabled') + '>Previous play</button>' +
      '<span>Play ' + p.n + ' of ' + plays.length + '</span>' +
      '<button type="button" data-act="film" data-n="' + (i < plays.length - 1 ? plays[i + 1].n : p.n) + '"' + (i < plays.length - 1 ? '' : ' disabled') + '>Next play</button></div>';
    return nav + '<ul class="feed">' + playItem(p, false).replace(/<details class="why"[\s\S]*<\/details>/, '') + '</ul>' +
      (p.why ? '<div class="film-why">' + whyCard(p, true) + '</div>'
             : '<p class="film-none">No play caller odds for this play. The game decided it by itself (kicks, penalties, sacks, turnovers and forced plays).</p>');
  }

  function renderFilm() {
    if (m.status !== 'final') {
      return '<div class="narrow"><div class="panel"><div class="panel-head"><h2>Film room</h2>' + statusChip() + '</div>' +
        '<div class="empty">The film room opens after the final: every drive on the field and what the play caller chose.</div>' +
        '<div class="actions">' + watchButton() + '</div></div></div>';
    }
    var rows = m.drives.filter(function (d) { return d.plays.length; }).map(function (d, i) {
      var segs = d.plays.map(function (pl) {
        var a = absX(d.team, pl.from), b = absX(d.team, pl.to), lo = Math.min(a, b), w = Math.abs(b - a);
        return '<button type="button" class="seg' + (pl.flag ? ' is-flag' : '') + (b < a === (d.team === 0) && w ? ' is-loss' : '') +
          (pl.n === filmSel ? ' is-on' : '') + '" data-act="film" data-n="' + pl.n + '" style="left:' + lo + '%;width:' + Math.max(w, 1.2) + '%"' +
          ' aria-label="Play ' + pl.n + (pl.why ? ', play caller odds' : '') + '"><i></i></button>';
      }).join('');
      var endAt = absX(d.team, d.plays[d.plays.length - 1].to);
      var mark = END_MARK[d.end] || '';
      return '<li class="drive" style="--c: var(--t' + d.team + ')">' +
        '<span class="drive-id">' + TEAMS[d.team].id + '<b>' + (i + 1) + '</b></span>' +
        '<div class="drive-field">' + segs +
          (mark ? '<span class="drive-end' + (d.end === 'Touchdown' || d.end === 'Field goal' ? ' is-score' : d.end === 'Turnover' || d.end === 'Downs' ? ' is-to' : '') +
            '" style="left:' + endAt + '%"></span>' : '') + '</div>' +
        '<span class="drive-res">' + esc(mark) + '</span></li>';
    }).join('');
    var st = filmStats();
    function pct(x) { return Math.round(x * 100) + '%'; }
    var caller = st
      ? '<dl class="caller">' +
          '<div><dt>Plays it chose</dt><dd class="num">' + st.count + '</dd><span>of ' + m.feed.filter(function (p) { return !p.divider; }).length + ' plays</span></div>' +
          '<div><dt>Average odds of its pick</dt><dd class="num">' + pct(st.avg) + '</dd></div>' +
          '<div><dt>Most confident call</dt><dd><button type="button" data-act="film" data-n="' + st.best.p.n + '">' + esc(optionName(st.best.k, st.best.team)) + ', ' + pct(st.best.pr) + '</button></dd><span>' + esc(st.best.p.desc) + '</span></div>' +
          '<div><dt>Biggest surprise</dt><dd><button type="button" data-act="film" data-n="' + st.worst.p.n + '">' + esc(optionName(st.worst.k, st.worst.team)) + ', ' + pct(st.worst.pr) + '</button></dd><span>' + esc(st.worst.p.desc) + '</span></div>' +
        '</dl>'
      : '<div class="empty">No play in this game carries the play caller\'s odds.</div>';
    return '<div class="film">' +
      '<div class="panel"><div class="panel-head"><h2>Drive chart</h2><a href="#recap">Recap</a></div>' +
        '<div class="film-key"><span>' + esc(TEAMS[0].name) + ' attack this way &#8594;</span><span>&#8592; ' + esc(TEAMS[1].name) + '</span></div>' +
        '<ol class="drives">' + rows + '</ol>' +
        '<p class="film-legend"><i class="k-score"></i>Score <i class="k-to"></i>Turnover <i class="k-flag"></i>Penalty <i class="k-loss"></i>Lost yards</p></div>' +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>The play caller</h2></div>' + caller + '</div>' +
        '<div class="panel film-detail" id="filmDetail"><div class="panel-head"><h2>The play</h2></div>' + filmPlayDetail() + '</div>' +
      '</div></div>';
  }

  var RENDER = { week: renderWeek, film: renderFilm, league: renderLeague, matchup: renderMatchup, lineups: renderLineups, plays: renderPlays, recap: renderRecap };

  function render(isFresh) {
    fresh = !!isFresh;
    $('s-' + tab).innerHTML = RENDER[tab]();
    prevTotals = [pts1(total(0)), pts1(total(1))];
    fresh = false;
  }

  // ------------------------------------------------------- navigation

  // Speed control. It lives next to Close and shows and hides with it.
  // The choice sets window.__ff.speed and is saved under fr.speed.
  var SPEED_KEY = 'fr.speed', SPEEDS = [0.5, 1, 2, 4];
  var speedEl = document.createElement('div');
  speedEl.className = 'speed';
  speedEl.setAttribute('role', 'group');
  speedEl.setAttribute('aria-label', 'Game speed');
  speedEl.hidden = true;
  speedEl.innerHTML = SPEEDS.map(function (v) {
    return '<button type="button" data-speed="' + v + '">' + v + 'x</button>';
  }).join('');
  $('closeGame').parentNode.appendChild(speedEl);

  function markSpeed() {
    var cur = window.__ff ? Number(window.__ff.speed) : 1;
    Array.prototype.forEach.call(speedEl.children, function (b) {
      b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === cur));
    });
  }
  function setSpeed(v, save) {
    if (window.__ff) window.__ff.speed = v;
    if (save) { try { window.localStorage.setItem(SPEED_KEY, String(v)); } catch (err) { /* storage may be off */ } }
    markSpeed();
  }
  (function loadSpeed() {
    var saved = null;
    try { saved = Number(window.localStorage.getItem(SPEED_KEY)); } catch (err) { saved = null; }
    // A ?speed= in the address wins over the saved choice, so test links keep working.
    var fromUrl = /[?&]speed=/.test(location.search);
    if (!fromUrl && SPEEDS.indexOf(saved) >= 0) setSpeed(saved, false); else markSpeed();
  })();
  speedEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-speed]') : null;
    if (!b) return;
    setSpeed(Number(b.getAttribute('data-speed')), true);
    revealClose();
  });

  // Announcer style switch, Straight or Fun, under the speed control. It calls
  // FF_ANNOUNCER.setStyle and is saved under fr.style. Only built when the announcer is loaded.
  var ANN = window.FF_ANNOUNCER, STYLE_KEY = 'fr.style';
  var STYLE_NAMES = [['straight', 'Straight'], ['fun', 'Fun']];
  var styleEl = null;
  function markStyle() {
    if (!styleEl) return;
    Array.prototype.forEach.call(styleEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-style') === ANN.style));
    });
  }
  if (ANN && ANN.setStyle) {
    styleEl = document.createElement('div');
    styleEl.className = 'speed voice';
    styleEl.setAttribute('role', 'group');
    styleEl.setAttribute('aria-label', 'Announcer style');
    styleEl.hidden = true;
    styleEl.innerHTML = STYLE_NAMES.map(function (n) {
      return '<button type="button" data-style="' + n[0] + '">' + n[1] + '</button>';
    }).join('');
    $('closeGame').parentNode.appendChild(styleEl);
    try { var savedStyle = window.localStorage.getItem(STYLE_KEY); if (savedStyle) ANN.setStyle(savedStyle); } catch (err) { /* storage may be off */ }
    markStyle();
    styleEl.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-style]') : null;
      if (!b) return;
      ANN.setStyle(b.getAttribute('data-style'));
      try { window.localStorage.setItem(STYLE_KEY, ANN.style); } catch (err) { /* storage may be off */ }
      markStyle();
      revealClose();
    });
  }

  // Captions: one line at the bottom of the game view with what the announcer just said.
  // It sits in the band past the end line, so it stays clear of the players and their names.
  var capEl = document.createElement('div');
  capEl.className = 'captions';
  capEl.setAttribute('aria-live', 'polite');
  capEl.hidden = true;
  $('closeGame').parentNode.appendChild(capEl);
  function showCaption(text) {
    if (text && typeof text === 'object') text = text.text || text.line || '';
    if (!text) return;
    var span = document.createElement('span');
    span.textContent = String(text);
    capEl.textContent = '';
    capEl.appendChild(span);
    capEl.title = span.textContent;
    capEl.hidden = false;
    // A line longer than the strip scrolls sideways once so it can be read to the end.
    var over = span.scrollWidth - (capEl.clientWidth - 20);
    if (over > 0) {
      span.style.setProperty('--shift', -over + 'px');
      span.style.animationDuration = Math.max(2.5, over / 45 + 1.5) + 's';
      span.className = 'scroll';
    }
  }
  function clearCaption() { capEl.textContent = ''; capEl.hidden = true; }
  // FF_ANNOUNCER.onLine (task C3) hands over the exact line that was said. Until it is on
  // main, the app asks FF_ANNOUNCER.line itself, which can pick a different wording than the voice.
  var hasOnLine = !!(ANN && typeof ANN.onLine === 'function');
  if (hasOnLine) ANN.onLine(showCaption);
  function captionFor(type, d) {
    if (type === 'reset') { clearCaption(); return; }
    if (hasOnLine || !ANN || !ANN.line) return;
    try {
      if (type === 'result') showCaption(ANN.line(d.res, { teams: TEAMS, score: d.res.post.score, style: ANN.style }));
      else if (type === 'half' || type === 'final') showCaption(ANN.line({ kind: type }, { teams: TEAMS, score: m.field.slice(), style: ANN.style }));
    } catch (err) { /* captions are optional */ }
  }

  function setControls(on) {
    $('closeGame').hidden = !on;
    speedEl.hidden = !on;
    if (styleEl) styleEl.hidden = !on;
    markStyle();
  }

  var closeTimer = 0;
  function showGame(on) {
    inGame = on;
    $('gameView').hidden = !on;
    setControls(false);
    document.body.classList.toggle('in-game', on);
    // The screens behind the game view take no focus or taps while it is open.
    $('app').inert = on;
    G.setActive(on);
  }

  // Controls stay up while the keyboard is on one of them.
  function focusInControls() {
    var a = document.activeElement;
    return !!(a && a !== document.body && $('closeGame').parentNode.contains(a));
  }

  function leaveGame(to) { location.replace('#' + (to || tab)); }

  function revealClose() {
    setControls(true);
    markSpeed();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function hide() {
      if (focusInControls()) { closeTimer = setTimeout(hide, 2600); return; }
      setControls(false);
    }, 2600);
  }

  // The League tab and screen are made here, so index.html stays as it is.
  (function addLeague() {
    var link = document.createElement('a');
    link.href = '#league'; link.setAttribute('data-tab', 'league'); link.textContent = 'League';
    $('tabs').insertBefore(link, $('tabs').firstChild);
    var sec = document.createElement('section');
    sec.className = 'screen'; sec.id = 's-league'; sec.setAttribute('aria-label', 'League'); sec.hidden = true;
    var first = $('s-matchup');
    first.parentNode.insertBefore(sec, first);
    var wk = document.createElement('section');
    wk.className = 'screen'; wk.id = 's-week'; wk.setAttribute('aria-label', 'This week in the league'); wk.hidden = true;
    sec.parentNode.insertBefore(wk, sec.nextSibling);
    // The film room has no tab: it is reached from the recap after the final.
    var film = document.createElement('section');
    film.className = 'screen'; film.id = 's-film'; film.setAttribute('aria-label', 'Film room'); film.hidden = true;
    $('s-recap').parentNode.insertBefore(film, $('s-recap').nextSibling);
    var brand = document.querySelector('.brand');
    if (brand) brand.setAttribute('href', '#league');
  })();

  // Sport switch in the header: Football or Soccer, saved under fr.sport. It calls
  // window.FR_SPORT_CHANGE(name) when the boss has connected soccer; until then
  // Soccer shows a plain panel with a link to the soccer game on its own.
  var SPORT_KEY = 'fr.sport', SPORTS = [['football', 'Football'], ['soccer', 'Soccer']];
  var sport = 'football';
  try { if (window.localStorage.getItem(SPORT_KEY) === 'soccer') sport = 'soccer'; } catch (err) { /* storage may be off */ }
  var sportEl = document.createElement('div');
  sportEl.className = 'sport';
  sportEl.setAttribute('role', 'group');
  sportEl.setAttribute('aria-label', 'Sport');
  sportEl.innerHTML = SPORTS.map(function (x) { return '<button type="button" data-sport="' + x[0] + '">' + x[1] + '</button>'; }).join('');
  (function () {
    var bar = document.querySelector('.bar'), mock = bar && bar.querySelector('.mock');
    if (bar) bar.insertBefore(sportEl, mock || null);
  })();
  var soccerEl = document.createElement('section');
  soccerEl.className = 'screen'; soccerEl.id = 's-soccer'; soccerEl.setAttribute('aria-label', 'Soccer'); soccerEl.hidden = true;
  soccerEl.innerHTML = '<div class="narrow"><div class="panel soccer-wait">' +
    '<div class="panel-head"><h2>Soccer</h2></div>' +
    '<p>Soccer is being built. It is not part of this app yet, but the match plays on its own page.</p>' +
    '<div class="actions"><a class="cta" href="soccer/index.html">Open soccer</a>' +
    '<button type="button" class="cta ghost" data-sport="football">Back to football</button></div>' +
    '</div></div>';
  $('s-league').parentNode.appendChild(soccerEl);

  function soccerConnected() { return typeof window.FR_SPORT_CHANGE === 'function'; }
  function markSport() {
    Array.prototype.forEach.call(sportEl.children, function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-sport') === sport));
    });
    var waiting = sport === 'soccer' && !soccerConnected();
    soccerEl.hidden = !waiting;
    $('tabs').hidden = waiting;
    if (waiting) TABS.forEach(function (t) { $('s-' + t).hidden = true; });
  }
  function setSport(name, tell) {
    sport = name === 'soccer' ? 'soccer' : 'football';
    try { window.localStorage.setItem(SPORT_KEY, sport); } catch (err) { /* storage may be off */ }
    if (tell && soccerConnected()) { try { window.FR_SPORT_CHANGE(sport); } catch (err) { console.error(err); } }
    if (sport === 'football') route(); else { markSport(); window.scrollTo(0, 0); }
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-sport]') : null;
    if (b) setSport(b.getAttribute('data-sport'), true);
  });

  function route() {
    var h = (location.hash || '#league').slice(1);
    if (h === 'game') {
      // The game can only be opened from a button, because sound needs a tap.
      if (G.mode === 'ready') { location.replace('#matchup'); return; }
      showGame(true);
      return;
    }
    if (inGame) showGame(false);
    if (TABS.indexOf(h) < 0) h = 'league';
    var changed = h !== tab;
    tab = h;
    TABS.forEach(function (t) { $('s-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call($('tabs').children, function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    render(false);
    markSport();
    if (changed) window.scrollTo(0, 0);
  }

  // Keep a why card open when the feed is drawn again after the next play.
  document.addEventListener('toggle', function (ev) {
    var el = ev.target;
    if (el && el.classList && el.classList.contains('why')) whyOpen[el.getAttribute('data-n')] = el.open;
  }, true);

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'watch') { G.start(); location.hash = 'game'; }
    else if (act === 'again') { G.restart(); location.hash = 'game'; }
    else if (act === 'filter') { filter = el.getAttribute('data-f'); render(false); }
    else if (act === 'optin') { setOptin(el.getAttribute('data-v') === 'in' ? 'in' : 'out'); render(false); }
    else if (act === 'share') { shareResult(el); }
    else if (act === 'seek') { watchPlay(Number(el.getAttribute('data-i')), el); }
    else if (act === 'week') { weekSel = Number(el.getAttribute('data-w')); render(false); }
    else if (act === 'film') {
      filmSel = Number(el.getAttribute('data-n'));
      render(false);
      var det = $('filmDetail');
      if (det && det.getBoundingClientRect().top > window.innerHeight - 120) det.scrollIntoView({ block: 'start' });
      var again = document.querySelector('#s-film [data-act=film][data-n="' + filmSel + '"].seg');
      if (el.classList.contains('seg') && again) again.focus();
    }
    else if (act === 'me') { setMe(Number(el.getAttribute('data-v'))); render(false); }
  });

  $('closeGame').addEventListener('click', function () { leaveGame(tab); });
  $('gameView').addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse') revealClose(); });
  window.addEventListener('keydown', function (ev) {
    if (!inGame) return;
    if (ev.key === 'Escape') { leaveGame(tab); return; }
    // Tab in the game view shows the controls and starts on Close.
    if (ev.key === 'Tab') {
      if (!focusInControls()) { ev.preventDefault(); revealClose(); $('closeGame').focus(); return; }
      revealClose();
      // Keep the keyboard inside the game view: wrap from the last control to the first.
      var list = Array.prototype.filter.call($('closeGame').parentNode.querySelectorAll('button'), function (x) { return !x.closest('[hidden]'); });
      var i = list.indexOf(document.activeElement);
      if (!ev.shiftKey && i === list.length - 1) { ev.preventDefault(); list[0].focus(); }
      else if (ev.shiftKey && i === 0) { ev.preventDefault(); list[list.length - 1].focus(); }
    }
  });
  window.addEventListener('hashchange', route);

  // A tap on the game shows the close control. After the final it leads to the recap.
  G.ontap = function (mode) {
    if (mode === 'final') leaveGame('recap'); else revealClose();
  };

  G.on(function (type, d) {
    if (type === 'reset') { m = blank(); whyDemoUsed = 0; whyOpen = {}; filmSel = 0; }
    else if (type === 'start') m.status = 'live';
    else if (type === 'snap') m.now = d.res.e.t === 'kickoff' ? 'Kickoff' : d.res.e.t === 'xp' ? 'Extra point try' : d.res.where;
    else if (type === 'result') {
      applyResult(d.res);
      setTimeout(function () { if (!inGame) render(false); }, 1600); // lets the highlight on new points fade
    }
    else if (type === 'half') { m.feed.push({ divider: 'Halftime' }); m.now = 'Halftime'; closeDrive('End of half'); }
    else if (type === 'final') { m.status = 'final'; m.now = ''; closeDrive('End of game'); }
    syncFloaters();
    captionFor(type, d);
    if (!inGame) render(type === 'result');
  });

  // Small read-only hook so a headless browser can check the app.
  window.__app = {
    get model() { return m; },
    get tab() { return tab; },
    get inGame() { return inGame; },
    get optin() { return optin; },
    get masked() { return masked(); },
    get paused() { return paused(); },
    get me() { return me; },
    get sport() { return sport; },
    get drives() { return m.drives; },
    topPlays: function (n) { return topPlaysLocal(n || 3); },
    get seeking() { return seeking; },
    get league() { return { state: league$.state, saved: league$.saved, optins: league$.optins }; },
    get scoringFromFile() { return useFile(); },
    // Each player's points from the game and, when the file is loaded, from data/scoring.json.
    comparePoints: function () {
      var out = [];
      for (var t = 0; t < 2; t++) SLOTS.forEach(function (sl) {
        out.push({ team: TEAMS[t].id, slot: sl.role, game: Math.round(m.pts[t][sl.role] * 100) / 100, file: scoringRules ? filePoints(t, sl.role) : null });
      });
      return out;
    },
    resultCard: function () { return drawResultCard().toDataURL('image/png'); },
    get caption() { return capEl.hidden ? '' : capEl.textContent; },
    totals: function () { return [f1(total(0)), f1(total(1))]; }
  };

  m = blank();
  syncFloaters();
  if (sport === 'soccer' && soccerConnected()) { try { window.FR_SPORT_CHANGE(sport); } catch (err) { console.error(err); } }
  if (location.hash === '#game') location.replace('#matchup');
  route();

  // First run walkthrough and the install hint live in their own file. index.html is
  // not ours, so the app loads it.
  var installScript = document.createElement('script');
  installScript.src = 'js/screens/install.js';
  document.body.appendChild(installScript);
})();
