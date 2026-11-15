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
  // Spanish for the screens (js/screens/i18n.js). Until the table has loaded, text stays English;
  // with Spanish saved the page waits for it (at most 1.5 s) so English does not flash.
  function lang() { return window.FR_I18N ? window.FR_I18N.lang : 'en'; }
  function tr(s) { return window.FR_I18N ? window.FR_I18N.tr(s) : s; }
  (function () {
    var saved = null;
    try { saved = window.localStorage.getItem('fr.lang'); } catch (err) { saved = null; }
    if (saved === 'es') {
      document.documentElement.classList.add('i18n-wait');
      setTimeout(function () { document.documentElement.classList.remove('i18n-wait'); }, 1500);
    }
  })();

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
  // Masked points look like --.- and are read as "hidden" by screen readers.
  var MASK_HTML = '<span aria-hidden="true">' + MASK + '</span><span class="sr-only">hidden</span>';
  function pts1(n) { return masked() ? MASK_HTML : f1(n); }
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
      drives: [],              // the film room: one entry per drive, built as the plays come in
      results: [], halfScore: null  // the story of the game
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
    m.results.push(res);
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
    if (m.status === 'live') return '<span class="status is-live"><i></i>Playing</span>';
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
      '<div class="board-top"><h2 class="eyebrow">' + esc(label) + '</h2>' + statusChip() + '</div>' +
      '<div class="sides">' + ord().map(function (t) { return side(t, m.status === 'final'); }).join('') + '</div>' +
      '<div class="field"><span class="eyebrow">On the field</span>' + fieldScore() +
        '<span class="sit">' + sit + '</span></div>' +
      '<div class="actions">' + actions + '</div>' +
      '</div>';
  }

  // ------------------------------------------------------- hot and cold
  // Recent form from data/profiles/<team>.json (Ricky, D24). The same rule as Noah's hot and
  // cold lines (C16): recent 0.15 or more above the season number is hot, 0.15 or more below
  // is cold, otherwise steady; the tendency with the biggest gap decides. Nothing shows when
  // form is missing or null, or when the files cannot be read (opened from a file).
  var FORM_DIFF = 0.15, profiles = {};
  var TENDENCY_WORDS = { deep_ball: 'deep ball rate', short_pass: 'short pass rate', scramble: 'scramble rate', run_share: 'run share',
    pass_catching: 'pass catching', red_zone_use: 'red zone use', catch_rate: 'catch rate', kicker_range: 'long kick share', accuracy: 'accuracy' };
  if (window.fetch) {
    TEAMS.forEach(function (T) {
      fetch('data/profiles/' + encodeURIComponent(T.id) + '.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.players && typeof d.players === 'object') { profiles[T.id] = d; if (tab === 'lineups' && !inGame) render(false); }
      }).catch(function () { /* no form then */ });
    });
  }
  function num01(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 1 ? v : null; }
  function formFor(t, role) {
    var prof = profiles[TEAMS[t].id], pl = prof && prof.players && prof.players[role], f = pl && pl.form;
    if (!f || !pl.tendencies) return null;
    var best = null;
    Object.keys(pl.tendencies).forEach(function (k) {
      var season = num01(pl.tendencies[k]), recent = num01(f.tendencies && typeof f.tendencies === 'object' ? f.tendencies[k] : f[k]);
      if (season === null || recent === null) return;
      if (!best || Math.abs(recent - season) > Math.abs(best.recent - best.season)) best = { key: k, season: season, recent: recent };
    });
    if (!best) return null;
    var d = best.recent - best.season;
    best.mark = d >= FORM_DIFF - 1e-9 ? 'hot' : d <= -FORM_DIFF + 1e-9 ? 'cold' : 'steady';
    best.weeks = Array.isArray(f.weeks) ? f.weeks : [];
    best.date = f.date || '';
    return best;
  }
  function formLine(t, role) {
    var f = formFor(t, role);
    if (!f) return '';
    var what = TENDENCY_WORDS[f.key] || f.key.replace(/_/g, ' ');
    var weeks = f.weeks.length ? 'weeks ' + f.weeks.join(', ') : 'recent weeks';
    var why = what + ' ' + f.recent.toFixed(2) + ' over ' + weeks + ', ' + f.season.toFixed(2) + ' on the season';
    return '<div class="form is-' + f.mark + '"><span class="form-mark">' + f.mark + '</span><span class="form-why">' + esc(why) + '</span></div>';
  }
  function formSource(t) {
    var prof = profiles[TEAMS[t].id];
    if (!prof || !prof.source) return '';
    var any = SLOTS.some(function (s) { return !!formFor(t, s.role); });
    return any ? '<p class="form-source">Recent form: ' + esc(prof.source) + '</p>' : '';
  }

  function playerRow(t, role, rank) {
    var pts = playerPts(t, role), hot = !masked() && m.flash[t + role] && Date.now() - m.flash[t + role] < 1500;
    return '<div class="row' + (hot ? ' flash' : '') + (t === me ? ' is-mine' : '') + '">' +
      (rank ? '<span class="rank">' + rank + '</span>' : '') +
      '<span class="tile" style="--c: ' + TEAMS[t].colors.tile + '">' + initials(t, role) + '</span>' +
      '<div class="who"><div class="name">' + esc(fullName(t, role)) + '</div>' +
      '<div class="sub"><span class="pos">' + posOf(role) + '</span>' +
        (masked() ? (rank ? TEAMS[t].id : '') : (rank ? TEAMS[t].id + ', ' : '') + esc(statLine(t, role))) + '</div>' +
        (rank ? '' : formLine(t, role) + trendLine(t, role)) + '</div>' +
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
  // "Why this play" was removed (Noah's call): no play carries a why card any more.
  function whyFor(e, res) {
    return null;
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
        '<ul class="why-bars" role="list">' + w.opts.map(function (o) {
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
      if (masked()) return open + '<b>' + MASK_HTML + '</b> ' + esc(f.who) + '</div>';
      return open + '<b>' + (f.pts > 0 ? '+' : '') + f1(f.pts) + '</b> ' + esc(f.who) + '</div>';
    }).join('');
    return '<li class="play' + (isNew ? ' is-new' : '') + (p.team === me ? ' is-mine' : '') + '" style="--c: var(--t' + p.team + ')">' +
      '<div class="play-main">' +
        '<div class="play-meta"><b>' + TEAMS[p.team].id + '</b>' + esc(p.where) + '</div>' +
        '<div class="play-desc">' + esc(p.desc) + '</div>' +
        (tags ? '<div class="play-tags">' + tags + '</div>' : '') +
      '</div>' +
      (fp ? '<div class="play-fp">' + fp + '</div>' : '') +
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
  // Reaching the final counts as watched, for the commissioner: to the service with ?api=, and
  // on this device either way (once per manager and game).
  function recordWatched() {
    var gid = gameId(), who = managerName();
    try {
      var d = JSON.parse(window.localStorage.getItem('fr.commish') || '{}') || {};
      d.watched = d.watched || {};
      d.watched[gid] = d.watched[gid] || [];
      if (d.watched[gid].indexOf(who) < 0) d.watched[gid].push(who);
      window.localStorage.setItem('fr.commish', JSON.stringify(d));
    } catch (err) { /* storage may be off */ }
    // The service keeps this count in memory when its database does not answer, so send it whenever there is one.
    if (API) {
      apiFetch('/games/' + encodeURIComponent(gid) + '/watched', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manager: who }) })
        .catch(function () { /* the count is optional */ });
    }
  }
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
          (plays.length ? '<ul class="feed" role="list">' + plays.map(function (p, i) { return playItem(p, fresh && i === 0); }).join('') + '</ul>'
                        : '<div class="empty">Plays show up here once the game kicks off.</div>') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Leaders</h2><a href="#lineups">Lineups</a></div>' +
          (top.length ? top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('')
                      : '<div class="empty">' + noLeaders + '</div>') + '</div>' +
      '</div>';
  }

  // ------------------------------------------- momentum and trends (B39)
  // With ?api= and the service up, Ricky's D44 routes: GET /games/:id/momentum?bucket= for the
  // film room and GET /players/TEAM.SLOT/trend for the lineups (server/README.md). Without them,
  // momentum comes from the game file through Ricky's own server/replay.js and server/momentum.js,
  // loaded into the page, so the numbers are the same; trends need every week's file, which only
  // the service can list, so the lineups keep the recent form line alone.
  var MOM_BUCKET = 360;   // seconds of game time per bar: 30 bars over the three hours
  var mom$ = { state: 'idle', data: null, from: '' }, trend$ = { state: 'idle', by: {} };
  function loadScript(src) {
    return new Promise(function (ok, no) {
      var have = document.querySelector('script[src="' + src + '"]');
      if (have) { if (have.dataset.ready) ok(); else { have.addEventListener('load', ok); have.addEventListener('error', no); } return; }
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { s.dataset.ready = '1'; ok(); };
      s.onerror = no;
      document.body.appendChild(s);
    });
  }
  function apiReady() {
    // The /health check answers within two seconds; until then, wait for it.
    return new Promise(function (ok) {
      (function wait() { if (league$.state === 'checking') setTimeout(wait, 200); else ok(league$.state === 'up'); })();
    });
  }
  function filmChanged() { if (tab === 'film' && !inGame) render(false); }
  function momentumFromFile() {
    var file = window.FF_GAME_FILE;
    if (!file || /[?&]game=sample/.test(location.search)) return Promise.resolve(null);
    var need = window.FR_REPLAY && window.FR_MOMENTUM ? Promise.resolve() :
      loadScript('server/replay.js').then(function () { return loadScript('server/momentum.js'); });
    return need.then(function () {
      var g = window.FR_REPLAY.buildFromGame(file, gameId());
      return window.FR_MOMENTUM.fromRecords(g.plays, g.home, g.away, MOM_BUCKET);
    });
  }
  function loadMomentum() {
    if (mom$.state !== 'idle') return;
    mom$.state = 'loading';
    apiReady().then(function (up) {
      if (!up) return null;
      return apiFetch('/games/' + encodeURIComponent(gameId()) + '/momentum?bucket=' + MOM_BUCKET)
        .then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }).then(function (j) {
      if (j && Array.isArray(j.buckets) && j.buckets.length) {
        mom$.from = 'From the plays service (' + (j.source === 'database' ? 'the database' + (j.engine ? ', ' + j.engine : '') : 'its copy of the game file') + ').';
        return j;
      }
      return momentumFromFile().then(function (d) { if (d) mom$.from = 'Worked out in this page from the game file, the same way as the plays service.'; return d; });
    }).then(function (d) {
      mom$.data = d && d.buckets && d.buckets.length ? d : null;
      mom$.state = 'done';
      filmChanged();
    }).catch(function () { mom$.state = 'done'; filmChanged(); });
  }
  // The fantasy margin over the game, one bar per slice of game time: up for the first team,
  // down for the second. Shown only after the final, like the film room itself.
  function momentumPanel() {
    if (mom$.state !== 'done') { loadMomentum(); return '<div class="panel"><div class="panel-head"><h2>Momentum</h2></div><div class="empty">Working out the momentum.</div></div>'; }
    var d = mom$.data;
    if (!d) return '';
    var B = d.buckets, n = B.length, W = 600, H = 160, mid = H / 2, bw = W / n, peak = 1, i;
    var margins = B.map(function (b) { return Math.round((b.fpTotal[0] - b.fpTotal[1]) * 10) / 10; });
    margins.forEach(function (v) { peak = Math.max(peak, Math.abs(v)); });
    var bars = '', marks = '', qs = '<span style="left:0%">Q1</span>', lead = [{ v: 0, i: 0 }, { v: 0, i: 0 }];
    for (i = 0; i < n; i++) {
      var v = margins[i], h = Math.max(1, Math.round(Math.abs(v) / peak * (mid - 6))), side = v >= 0 ? 0 : 1;
      if (v !== 0) bars += '<rect class="mom-' + side + '" x="' + (i * bw + 1).toFixed(1) + '" y="' + (v >= 0 ? mid - h : mid) + '" width="' + Math.max(1, bw - 2).toFixed(1) + '" height="' + h + '"/>';
      if (Math.abs(v) > lead[side].v) lead[side] = { v: Math.abs(v), i: i };
      // Quarter lines in the drawing, their names as text under it (text in a stretched drawing would stretch too).
      if (i && B[i].quarter !== B[i - 1].quarter) {
        marks += '<line class="mom-q" x1="' + (i * bw).toFixed(1) + '" x2="' + (i * bw).toFixed(1) + '" y1="0" y2="' + H + '"/>';
        qs += '<span style="left:' + (i / n * 100).toFixed(2) + '%">Q' + B[i].quarter + '</span>';
      }
    }
    var last = B[n - 1], fin = margins[n - 1];
    function leadText(t) {
      var L = lead[t];
      return L.v ? TEAMS[t].name + ' by ' + f1(L.v) + ' in Q' + B[L.i].quarter : TEAMS[t].name + ' never led';
    }
    var label = 'Fantasy point margin over the game. Biggest leads: ' + leadText(0) + '; ' + leadText(1) + '. Final: ' +
      TEAMS[0].name + ' ' + f1(last.fpTotal[0]) + ', ' + TEAMS[1].name + ' ' + f1(last.fpTotal[1]) + '.';
    return '<div class="panel momentum"><div class="panel-head"><h2>Momentum</h2></div>' +
      '<div class="mom-key"><span style="--c: var(--t0)">' + esc(TEAMS[0].name) + ' ahead</span><span style="--c: var(--t1)">' + esc(TEAMS[1].name) + ' ahead</span></div>' +
      '<svg class="mom-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(label) + '">' +
        marks + bars +
        '<line class="mom-zero" x1="0" x2="' + W + '" y1="' + mid + '" y2="' + mid + '"/></svg>' +
      '<div class="mom-qs" aria-hidden="true">' + qs + '</div>' +
      '<dl class="mom-facts">' +
        '<div><dt>Biggest ' + esc(TEAMS[0].id) + ' lead</dt><dd class="num">' + (lead[0].v ? f1(lead[0].v) : '0.0') + '</dd>' + (lead[0].v ? '<span>Q' + B[lead[0].i].quarter + '</span>' : '') + '</div>' +
        '<div><dt>Biggest ' + esc(TEAMS[1].id) + ' lead</dt><dd class="num">' + (lead[1].v ? f1(lead[1].v) : '0.0') + '</dd>' + (lead[1].v ? '<span>Q' + B[lead[1].i].quarter + '</span>' : '') + '</div>' +
        '<div><dt>Final margin</dt><dd class="num">' + f1(Math.abs(fin)) + '</dd><span>' + esc(fin > 0 ? TEAMS[0].id : fin < 0 ? TEAMS[1].id : 'Even') + '</span></div>' +
      '</dl>' +
      '<p class="mom-from">' + esc(mom$.from) + ' One bar is ' + (d.bucketSeconds / 60) + ' minutes of game time; the game file has no clock, so time is spread evenly over the plays.</p></div>';
  }

  // Week by week for each player, from GET /players/TEAM.SLOT/trend. This game's own week stays
  // out until the final and while scores are hidden, so the trend never gives the score away.
  function thisWeek() { var mm = /week(\d+)/.exec(gameId()); return mm ? parseInt(mm[1], 10) : league().week; }
  function r1(x) { return Math.round(x * 10) / 10; }
  function trendSummary(weeks) {   // the same rules as Ricky's summarize in server/trend.js
    var s = { average: null, last: null, previous: null, change: null, direction: 'none', hotStreak: 0 };
    if (!weeks.length) return s;
    var total = 0;
    weeks.forEach(function (w) { total += w.points; });
    s.average = r1(total / weeks.length);
    s.last = weeks[weeks.length - 1].points;
    if (weeks.length > 1) {
      s.previous = weeks[weeks.length - 2].points;
      s.change = r1(s.last - s.previous);
      s.direction = s.change > 0.5 ? 'up' : s.change < -0.5 ? 'down' : 'flat';
      var mean = total / weeks.length;
      for (var i = weeks.length - 1; i >= 0 && weeks[i].points > mean; i--) s.hotStreak++;
    }
    return s;
  }
  function loadTrends() {
    if (trend$.state !== 'idle') return;
    trend$.state = 'loading';
    apiReady().then(function (up) {
      if (!up) { trend$.state = 'off'; return; }
      var jobs = [];
      [0, 1].forEach(function (t) {
        SLOTS.forEach(function (s) {
          var key = TEAMS[t].id + '.' + s.role;
          jobs.push(apiFetch('/players/' + encodeURIComponent(key) + '/trend').then(function (r) { return r.ok ? r.json() : null; })
            .then(function (j) { trend$.by[key] = j && Array.isArray(j.weeks) ? j : null; }, function () { trend$.by[key] = null; }));
        });
      });
      return Promise.all(jobs).then(function () { trend$.state = 'done'; if (tab === 'lineups' && !inGame) render(false); });
    }).catch(function () { trend$.state = 'off'; });
  }
  function trendLine(t, role) {
    var j = trend$.by[TEAMS[t].id + '.' + role];
    if (!j) return '';
    var open = m.status === 'final' && !masked(), wk = thisWeek();
    var weeks = j.weeks.filter(function (w) { return open || w.week < wk; });
    if (!weeks.length) return '';
    var s = trendSummary(weeks);
    var list = weeks.map(function (w) { return 'wk ' + w.week + ' ' + f1(w.points); }).join(', ');
    var how = s.direction === 'none' ? 'one week so far' :
      (s.direction === 'flat' ? 'flat' : s.direction + ' ' + f1(Math.abs(s.change))) + (s.hotStreak ? ', ' + s.hotStreak + (s.hotStreak === 1 ? ' week' : ' weeks') + ' above average' : '');
    return '<div class="trend is-' + s.direction + '"><span class="trend-mark">' + (s.direction === 'none' ? 'trend' : s.direction) + '</span>' +
      '<span class="trend-why">' + esc(list + '; ' + how) + (open ? '' : esc('. Week ' + wk + ' shows after the final.')) + '</span></div>';
  }
  function trendSource() {
    if (trend$.state !== 'done') return '';
    var srcs = Object.keys(trend$.by).map(function (k) { return trend$.by[k] && trend$.by[k].source; }).filter(Boolean);
    if (!srcs.length) return '';
    return '<p class="form-source">Week by week: the plays service, from ' + (srcs.indexOf('database') >= 0 ? 'the database' : 'the game files') + '.</p>';
  }

  function renderLineups() {
    if (API) loadTrends();
    function team(t) {
      return '<div class="panel">' +
        '<div class="lineup-head" style="--c: var(--t' + t + ')"><img class="sprite" src="' + marks[t] + '" alt="">' +
        '<h2 class="team-name">' + esc(TEAMS[t].full) + '</h2><span class="num">' + pts1(total(t)) + '</span></div>' +
        SLOTS.map(function (s) { return playerRow(t, s.role, 0); }).join('') +
        formSource(t) + trendSource() + '</div>';
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
        (list.length ? '<ul class="feed" role="list">' + list.map(function (p, i) { return playItem(p, fresh && i === 0 && filter === 'all'); }).join('') + '</ul>'
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
    g.fillText(tr((WEEK + ' result').toUpperCase()), CARD_W - P, 112);

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
    var lines = wrapText(g, (w < 0 ? tr('It is a tie') : TEAMS[w].full).toUpperCase(), CARD_W - P - tx);
    lines.slice(0, 2).forEach(function (l, i) { g.fillText(l, tx, y + 92 + i * 104); });
    var after = y + 92 + (Math.min(lines.length, 2) - 1) * 104;
    if (w >= 0) { g.fillStyle = amber; g.font = '700 72px ' + CARD_FONT; g.fillText(tr('WIN'), tx, after + 86); after += 86; }

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
      g.fillText(tr(label), x + 28, y + 200);
    });

    // The score on the field.
    y += boxH + 70;
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY; g.textAlign = 'left';
    g.fillText(tr('ON THE FIELD'), P, y);
    g.fillStyle = C.text; g.font = '700 54px ' + CARD_FONT;
    g.fillText(order.map(function (t) { return TEAMS[t].id + ' ' + m.field[t]; }).join('   '), P + 250, y + 6);

    // The top performer.
    y += 60;
    g.fillStyle = C.panel; g.fillRect(P, y, inner, 190);
    g.strokeStyle = C.rule; g.lineWidth = 2; g.strokeRect(P + 1, y + 1, inner - 2, 188);
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY;
    g.fillText(tr('TOP PERFORMER'), P + 32, y + 50);
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
    g.fillText(tr('Sample league with mock data. Made with Fantasy Recap.'), P, CARD_H - 70);
    return c;
  }

  function cardFileName() {
    return 'fantasy-recap-' + WEEK.toLowerCase().replace(/\s+/g, '-') + '.png';
  }

  // Share sheet when the browser has one for files, a download otherwise.
  // Share a picture: the share sheet when the browser can share files, a download otherwise.
  function sharePicture(c, name, title, btn) {
    if (btn) btn.disabled = true;
    function done() { if (btn) btn.disabled = false; }
    function download(blob) {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    }
    c.toBlob(function (blob) {
      if (!blob) { done(); return; }
      var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (err) { file = null; }
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: title })
          .catch(function (err) { if (!err || err.name !== 'AbortError') download(blob); })
          .then(done, done);
      } else {
        download(blob);
        done();
      }
    }, 'image/png');
  }
  function shareResult(btn) { sharePicture(drawResultCard(), cardFileName(), 'Fantasy Recap, ' + WEEK, btn); }

  // The top play as a picture: the first of the same list as server/top-plays.js (B18),
  // or, if that cannot be worked out, the play in the feed that moved the most points.
  function topPlayForCard() {
    var t = topPlaysLocal(1)[0];
    if (t) return { text: t.text, players: t.players, points: t.points, quarter: t.quarter, clock: t.clock, team: t.team };
    var best = null;
    m.feed.forEach(function (p) {
      if (p.divider) return;
      var pts = p.fp.reduce(function (a, f) { return a + Math.abs(f.pts); }, 0);
      if (!best || pts > best.points) best = { text: p.desc, players: p.fp.map(function (f) { return f.who; }), points: Math.round(pts * 10) / 10, team: TEAMS[p.team].id };
    });
    return best;
  }
  function drawTopPlayCard() {
    var top = topPlayForCard();
    var c = document.createElement('canvas');
    c.width = CARD_W; c.height = CARD_H;
    var g = c.getContext('2d'), P = 72, inner = CARD_W - 2 * P;
    var styles = getComputedStyle(document.documentElement);
    function tc(n, f) { return styles.getPropertyValue(n).trim() || f; }
    var C = { bg: tc('--bg', '#0b0d0e'), panel: tc('--panel', '#131617'), inset: tc('--inset', '#1b1f21'), rule: tc('--rule', '#2b3033'),
              text: tc('--text', '#f3f1ea'), dim: tc('--dim', '#8e9597'), amber: tc('--amber', '#ffc21a') };
    var ti = top ? Math.max(0, teamByName(top.team)) : 0;
    g.fillStyle = C.bg; g.fillRect(0, 0, CARD_W, CARD_H);
    g.fillStyle = TEAMS[ti].colors.jersey; g.fillRect(0, 0, CARD_W, 14);
    g.textBaseline = 'alphabetic';
    g.fillStyle = C.amber; g.fillRect(P, 92, 22, 22);
    g.fillStyle = C.text; g.font = '700 44px ' + CARD_FONT; g.textAlign = 'left';
    g.fillText('FANTASY RECAP', P + 38, 114);
    g.fillStyle = C.dim; g.font = '700 28px ' + CARD_BODY; g.textAlign = 'right';
    g.fillText(tr((WEEK + ', top play').toUpperCase()), CARD_W - P, 112);

    // Both teams and the final score.
    var y = 190;
    ord().forEach(function (t, i) {
      var yy = y + i * 84;
      g.fillStyle = TEAMS[t].colors.jersey; g.fillRect(P, yy, 10, 62);
      g.fillStyle = C.text; g.font = '700 56px ' + CARD_FONT; g.textAlign = 'left';
      g.fillText(TEAMS[t].full.toUpperCase(), P + 30, yy + 52);
      g.textAlign = 'right'; g.fillText(String(m.field[t]), CARD_W - P, yy + 52);
    });
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY; g.textAlign = 'left';
    g.fillText(tr('FINAL'), P, y + 84 * 2 + 30);

    // The play.
    y = 520;
    g.font = '700 76px ' + CARD_FONT;
    var pre = top ? String(top.text) : '', mm0 = /^(?:.+? at (?:the )?[A-Z0-9 ]+|1st and goal[^:]*): (.*)$/.exec(pre);
    var nLines = Math.min(4, wrapText(g, mm0 ? mm0[1] : pre || 'No play moved any points.', inner - 88).length);
    var panelH = 150 + nLines * 84 + (top ? 150 : 20);
    g.fillStyle = C.panel; g.fillRect(P, y, inner, panelH);
    g.fillStyle = TEAMS[ti].colors.jersey; g.fillRect(P, y, 10, panelH);
    g.fillStyle = C.dim; g.font = '700 26px ' + CARD_BODY;
    g.fillText(tr(top && top.quarter ? ('TOP PLAY, Q' + top.quarter + ' ' + top.clock + ', ' + top.team) : 'TOP PLAY'), P + 44, y + 62);
    var text = top ? String(top.text) : tr('No play moved any points.');
    var mm = /^(?:.+? at (?:the )?[A-Z0-9 ]+|1st and goal[^:]*): (.*)$/.exec(text);
    if (mm) text = mm[1];
    text = text.charAt(0).toUpperCase() + text.slice(1).replace(/TOUCHDOWN/g, 'touchdown');
    if (!/[.!]$/.test(text)) text += '.';
    text = tr(text);
    g.fillStyle = C.text; g.font = '700 76px ' + CARD_FONT;
    var lines = wrapText(g, text, inner - 88).slice(0, 4);
    lines.forEach(function (l, i) { g.fillText(l, P + 44, y + 150 + i * 84); });
    if (top) {
      var py = y + 150 + lines.length * 84 + 40;
      g.fillStyle = C.dim; g.font = '600 32px ' + CARD_BODY;
      var who = top.players.join(', ');
      while (g.measureText(who).width > inner - 380 && who.length > 4) who = who.slice(0, -2);
      g.fillText(who, P + 44, py);
      g.fillStyle = C.amber; g.font = '700 120px ' + CARD_FONT; g.textAlign = 'right';
      g.fillText(f1(top.points), CARD_W - P - 40, py + 20);
      g.fillStyle = C.dim; g.font = '700 24px ' + CARD_BODY;
      g.fillText(tr('FANTASY POINTS'), CARD_W - P - 40, py + 60);
    }
    g.textAlign = 'left'; g.fillStyle = C.dim; g.font = '600 26px ' + CARD_BODY;
    g.fillText(tr('Sample game. Real names, made-up stats.'), P, CARD_H - 70);
    return c;
  }
  function shareTopPlay(btn) {
    if (masked()) return; // never while scores are hidden
    sharePicture(drawTopPlayCard(), 'fantasy-recap-' + WEEK.toLowerCase().replace(/\s+/g, '-') + '-top-play.png', 'Top play, ' + WEEK, btn);
  }

  // ------------------------------------------------------- story of the game
  // A short written recap after the reveal. Every sentence is filled from numbers the game
  // produced: scores before and after each play, the drives, each player's points, and the
  // quarter and clock worked out as in server/replay.js. Noah's bigCall gives the top plays' text.
  var QWORD = ['', 'first', 'second', 'third', 'fourth'];
  function whenOf(index) { topPlaysLocal(1); var c = playClock[index]; return c ? 'the ' + QWORD[c.quarter] + ' quarter' : ''; }
  function scoreSay(sc) { return TEAMS[0].name + ' ' + sc[0] + ', ' + TEAMS[1].name + ' ' + sc[1]; }
  function playSay(res) { return describe(res).replace(/ First down\.$/, '').replace(/\.$/, ''); }
  var storyCache = null;
  function storyOf() {
    var R = m.results, n = R.length;
    if (!n) return null;
    // One story per finished game, so the announcer's wording does not change on every redraw.
    var lng = lang();
    if (storyCache && storyCache.results === R && storyCache.n === n && storyCache.me === me && storyCache.lang === lng) return storyCache.story;
    var story = lng === 'es' ? buildStoryEs(R, n) : buildStory(R, n);
    storyCache = { results: R, n: n, me: me, lang: lng, story: story };
    return story;
  }
  function buildStory(R, n) {
    var fin = R[n - 1].post.score, f0 = Number(f1(total(0))), f1v = Number(f1(total(1)));
    var fw = f0 === f1v ? -1 : f0 > f1v ? 0 : 1;
    var out = { paras: [] };
    out.headline = fw < 0 ? TEAMS[0].full + ' and ' + TEAMS[1].full + ' tie at ' + f1(total(0))
      : TEAMS[fw].full + ' beat ' + TEAMS[1 - fw].full + ', ' + f1(total(fw)) + ' to ' + f1(total(1 - fw));
    // How it started: the first score, and the score at the half.
    var first = -1;
    for (var i = 0; i < n; i++) { var a = R[i].pre.score, b = R[i].post.score; if (a[0] !== b[0] || a[1] !== b[1]) { first = i; break; } }
    if (first >= 0) {
      var r1 = R[first], who = r1.post.score[0] > r1.pre.score[0] ? 0 : 1;
      var start = 'The ' + TEAMS[who].name + ' scored first, in ' + whenOf(first + 1) + ': ' + playSay(r1) + '.';
      if (m.halfScore) start += ' At the half it was ' + scoreSay(m.halfScore) + '.';
      out.paras.push(start);
    } else out.paras.push('Neither team scored.');
    // The turning point: the last time the lead changed hands, or a lead kept all game.
    var lead = 0, lastChange = -1, changes = 0;
    for (var j = 0; j < n; j++) {
      var d = R[j].post.score[0] - R[j].post.score[1], l = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (l !== 0 && l !== lead) { if (lead !== 0) changes += 1; lastChange = j; }
      if (l !== 0) lead = l;
    }
    var finalLead = fin[0] > fin[1] ? 0 : fin[1] > fin[0] ? 1 : -1;
    if (finalLead >= 0 && lastChange >= 0) {
      var rt = R[lastChange];
      out.paras.push(changes
        ? 'The lead changed hands ' + changes + (changes === 1 ? ' time' : ' times') + '. The turning point came in ' + whenOf(lastChange + 1) + ': ' + playSay(rt) + ', and the ' + TEAMS[finalLead].name + ' led ' + scoreSay(rt.post.score) + ' and never trailed again.'
        : lastChange === first
          ? 'The ' + TEAMS[finalLead].name + ' never trailed.'
          : 'The ' + TEAMS[finalLead].name + ' went ahead in ' + whenOf(lastChange + 1) + ' (' + playSay(rt) + ') and never trailed after that.');
      out.turn = lastChange + 1;
    } else if (finalLead < 0) out.paras.push('Neither team could pull away, and it ended level.');
    var longest = null;
    m.drives.forEach(function (dv) { if (dv.plays.length && (!longest || dv.plays.length > longest.plays.length)) longest = dv; });
    if (longest) {
      var yds = longest.plays[longest.plays.length - 1].to - longest.start;
      var nm = TEAMS[longest.team].name, poss = /s$/.test(nm) ? nm + '\'' : nm + '\'s';
      out.paras[out.paras.length - 1] += ' The longest drive was the ' + poss + ' ' + longest.plays.length + ' plays and ' +
        yds + (Math.abs(yds) === 1 ? ' yard' : ' yards') + (longest.end ? ', ending in ' + (longest.end === 'Touchdown' ? 'a touchdown' : longest.end === 'Field goal' ? 'a field goal' : longest.end.toLowerCase()) : '') + '.';
    }
    // Who won it for which fantasy team.
    var best = [0, 1].map(function (t) {
      var b = null;
      SLOTS.forEach(function (sl) { var v = playerPts(t, sl.role); if (!b || v > b.pts) b = { role: sl.role, pts: v }; });
      return b;
    });
    out.paras.push('For ' + TEAMS[0].full + ', ' + fullName(0, best[0].role) + ' led with ' + f1(best[0].pts) + ' fantasy points. For ' +
      TEAMS[1].full + ', ' + fullName(1, best[1].role) + ' led with ' + f1(best[1].pts) + '.');
    // The final.
    out.paras.push('Final on the field: ' + scoreSay(fin) + '. In fantasy points, ' +
      (fw < 0 ? 'a tie at ' + f1(total(0)) + '.' : TEAMS[fw].full + ' win the matchup, ' + f1(total(fw)) + ' to ' + f1(total(1 - fw)) + '.'));
    // The three top plays, with the announcer's big call when it has one.
    var A = window.FF_ANNOUNCER;
    out.top = topPlaysLocal(3).map(function (x) {
      var res = R[x.index - 1], call = '';
      if (res && A && typeof A.bigCall === 'function') {
        try { call = A.bigCall(res, { teams: TEAMS, score: res.post.score, style: A.style, hidden: false }) || ''; } catch (err) { call = ''; }
        // The third sentence is a fact from the announcer's memory, which after the final holds the
        // whole game, not the game up to this play. Keep the call and what it did to the score.
        var cut = /(That makes it|That ties it|The [A-Z][a-z]+ take over|That puts the|That flips the field)[^.]*\./.exec(call);
        if (cut) call = call.slice(0, cut.index + cut[0].length);
      }
      return { index: x.index, when: 'Q' + x.quarter + ' ' + x.clock, text: call || (res ? playSay(res) + '.' : x.text), points: x.points };
    });
    return out;
  }
  // The same story in Spanish, from the same numbers. Play sentences go through the i18n table.
  var QWORD_ES = ['', 'el primer cuarto', 'el segundo cuarto', 'el tercer cuarto', 'el último cuarto'];
  var END_ES = { 'Touchdown': 'un touchdown', 'Field goal': 'un gol de campo', 'Missed field goal': 'un gol de campo fallado', 'Punt': 'un despeje',
    'Turnover': 'una pérdida', 'Downs': 'una pérdida en downs', 'End of half': 'el medio tiempo', 'End of game': 'el final' };
  function whenEs(index) { topPlaysLocal(1); var c = playClock[index]; return c ? QWORD_ES[c.quarter] : ''; }
  function playEs(res) { return tr(describe(res).replace(/ First down\.$/, '')).replace(/\.$/, ''); }
  function buildStoryEs(R, n) {
    var fin = R[n - 1].post.score, f0 = Number(f1(total(0))), f1v = Number(f1(total(1)));
    var fw = f0 === f1v ? -1 : f0 > f1v ? 0 : 1, out = { paras: [] };
    out.headline = fw < 0 ? TEAMS[0].full + ' y ' + TEAMS[1].full + ' empatan a ' + f1(total(0))
      : TEAMS[fw].full + ' vence a ' + TEAMS[1 - fw].full + ', ' + f1(total(fw)) + ' a ' + f1(total(1 - fw));
    var first = -1;
    for (var i = 0; i < n; i++) { var a = R[i].pre.score, b = R[i].post.score; if (a[0] !== b[0] || a[1] !== b[1]) { first = i; break; } }
    if (first >= 0) {
      var r1 = R[first], who = r1.post.score[0] > r1.pre.score[0] ? 0 : 1;
      var start = 'Los ' + TEAMS[who].name + ' anotaron primero, en ' + whenEs(first + 1) + ': ' + playEs(r1) + '.';
      if (m.halfScore) start += ' Al medio tiempo iba ' + scoreSay(m.halfScore) + '.';
      out.paras.push(start);
    } else out.paras.push('Ningún equipo anotó.');
    var lead = 0, lastChange = -1, changes = 0;
    for (var j = 0; j < n; j++) {
      var d = R[j].post.score[0] - R[j].post.score[1], l = d > 0 ? 1 : d < 0 ? -1 : 0;
      if (l !== 0 && l !== lead) { if (lead !== 0) changes += 1; lastChange = j; }
      if (l !== 0) lead = l;
    }
    var finalLead = fin[0] > fin[1] ? 0 : fin[1] > fin[0] ? 1 : -1;
    if (finalLead >= 0 && lastChange >= 0) {
      var rt = R[lastChange], tn = TEAMS[finalLead].name;
      out.paras.push(changes
        ? 'La ventaja cambió de manos ' + changes + (changes === 1 ? ' vez' : ' veces') + '. El momento clave llegó en ' + whenEs(lastChange + 1) + ': ' + playEs(rt) + ', y los ' + tn + ' se pusieron ' + scoreSay(rt.post.score) + ' y ya no fueron por detrás.'
        : lastChange === first ? 'Los ' + tn + ' nunca fueron por detrás.'
          : 'Los ' + tn + ' se adelantaron en ' + whenEs(lastChange + 1) + ' (' + playEs(rt) + ') y ya no fueron por detrás.');
    } else if (finalLead < 0) out.paras.push('Ningún equipo logró escaparse, y terminó en empate.');
    var longest = null;
    m.drives.forEach(function (dv) { if (dv.plays.length && (!longest || dv.plays.length > longest.plays.length)) longest = dv; });
    if (longest) {
      var yds = longest.plays[longest.plays.length - 1].to - longest.start;
      out.paras[out.paras.length - 1] += ' La serie más larga fue de los ' + TEAMS[longest.team].name + ': ' + longest.plays.length + ' jugadas y ' +
        yds + (Math.abs(yds) === 1 ? ' yarda' : ' yardas') + (END_ES[longest.end] ? ', terminada en ' + END_ES[longest.end] : '') + '.';
    }
    var best = [0, 1].map(function (t) {
      var bb = null;
      SLOTS.forEach(function (sl) { var v = playerPts(t, sl.role); if (!bb || v > bb.pts) bb = { role: sl.role, pts: v }; });
      return bb;
    });
    out.paras.push('En ' + TEAMS[0].full + ', ' + fullName(0, best[0].role) + ' lideró con ' + f1(best[0].pts) + ' puntos de fantasía. En ' +
      TEAMS[1].full + ', ' + fullName(1, best[1].role) + ' lideró con ' + f1(best[1].pts) + '.');
    out.paras.push('Final en el campo: ' + scoreSay(fin) + '. En puntos de fantasía, ' +
      (fw < 0 ? 'empate a ' + f1(total(0)) + '.' : TEAMS[fw].full + ' gana el enfrentamiento, ' + f1(total(fw)) + ' a ' + f1(total(1 - fw)) + '.'));
    // Noah's big calls are English for now, so the top plays use the play sentence and the score.
    out.top = topPlaysLocal(3).map(function (x) {
      var res = R[x.index - 1];
      return { index: x.index, when: 'C' + x.quarter + ' ' + x.clock,
        text: res ? playEs(res) + '. Marcador: ' + scoreSay(res.post.score) + '.' : tr(x.text), points: x.points };
    });
    return out;
  }

  function storyPanel() {
    if (masked() || m.status !== 'final') return '';
    var st = storyOf();
    if (!st) return '';
    return '<div class="panel story"><div class="panel-head"><h2>The story of the game</h2></div>' +
      '<div class="story-body"><h3 class="story-head">' + esc(st.headline) + '</h3>' +
      st.paras.map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') +
      '<h4 class="story-sub">The plays that mattered</h4><ol class="story-top" role="list">' +
      st.top.map(function (x) {
        return '<li><p><span class="eyebrow">' + esc(x.when) + ', ' + f1(x.points) + ' pts</span> ' + esc(x.text) + '</p>' +
          '<button type="button" class="cta ghost" data-act="seek" data-i="' + x.index + '">Watch this play</button></li>';
      }).join('') + '</ol></div></div>';
  }

  function winnerHero() {
    var p0 = Number(f1(total(0))), p1 = Number(f1(total(1)));
    var w = p0 === p1 ? -1 : p0 > p1 ? 0 : 1;
    var head = w < 0
      ? '<div class="hero-id"><h2 class="hero-name">It is a tie</h2></div>'
      : '<div class="hero-id"><img class="sprite" src="' + marks[w] + '" alt="">' +
          '<h2 class="hero-name">' + esc(TEAMS[w].full) + ' <span>win</span></h2></div>';
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
        (masked() ? '' : '<button type="button" class="cta ghost" data-act="share-top">Share the top play</button>') +
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
    return winnerHero() + '<div class="grid">' + storyPanel() + '</div>' +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Top performers</h2></div>' +
          top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Scoring plays</h2><a href="#plays">All plays</a></div>' +
          '<ul class="feed" role="list">' + scores.map(function (p) { return playItem(p, false); }).join('') + '</ul></div>' +
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
  function loadLeagueFile() {
    fetch('data/league.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!validLeague(d)) return;
      leagueData = d;
      if (tab === 'league' && !inGame) render(false);
    }).catch(function () { /* the built-in sample stays */ });
  }
  // With ?api=, Ricky's GET /league (server/league.js) gives the same league with the opt-ins
  // from the database. It is turned into the shape data/league.json has, and points are kept
  // only for finished weeks. No answer in two seconds: the file, and nothing is said about it.
  function fromService(j) {
    if (!j || typeof j.week !== 'number' || !j.current || !Array.isArray(j.current.matchups) || !Array.isArray(j.weeks)) return null;
    var ours = TEAMS.map(function (T) { return T.id; }).sort().join('|');
    function gameFile(id) { return typeof id === 'string' && id ? id + '.json' : null; }
    return {
      fromService: true, name: j.name, week: j.week, release: j.release, invented: j.invented,
      matchups: j.current.matchups.map(function (m) {
        var ids = (m.teams || []).map(function (t) { return t.id; }).sort().join('|');
        return { ours: ids === ours, teams: m.teams, optedIn: Array.isArray(m.optedIn) ? m.optedIn : [], gameFile: gameFile(m.gameId) };
      }),
      weeks: j.weeks.map(function (w) {
        return { week: w.week, finished: !!w.finished, matchups: (w.matchups || []).map(function (m) {
          return { teams: m.teams, final: w.finished && Array.isArray(m.final) ? m.final : null, gameFile: gameFile(m.gameId) };
        }) };
      }),
      standings: (j.standings || []).map(function (r) { return { id: r.id, full: r.full, wins: r.wins, losses: r.losses, ties: r.ties || 0, pointsFor: r.pointsFor }; })
    };
  }
  if (window.fetch) {
    if (API) {
      apiFetch('/league').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        var L = fromService(j);
        if (!L || !validLeague(L)) { loadLeagueFile(); return; }
        leagueData = L;
        if (tab === 'league' && !inGame) render(false);
      }).catch(loadLeagueFile);
    } else loadLeagueFile();
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
      leagueOptins() +
      '</a>';
  }
  // From the service: who in our matchup has opted in, as the league's database has it.
  function leagueOptins() {
    if (!leagueData || !leagueData.fromService) return '';
    var ours = leagueData.matchups.filter(function (x) { return x.ours; })[0];
    if (!ours) return '';
    var who = ours.optedIn || [];
    return '<p class="lg-optins">' + esc(who.length ? 'Opted in, in the league: ' + who.join(', ') : 'Nobody in this matchup has opted in yet.') + '</p>';
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
        '<a class="cta ghost lg-top-link" href="#week">This week\'s biggest plays</a>' +
        '<button type="button" class="cta ghost lg-top-link" data-act="party-join">Join a watch party</button>';
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
  var topCache = null, playClock = {};
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
    list.forEach(function (x, i) { playClock[i + 1] = { quarter: x.quarter, clock: x.clock }; });
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
      '<div class="top-foot"><span class="top-who"></span><span class="num">' + MASK_HTML + '</span><span class="unit">pts</span></div></li>';
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
          '<ol class="top-list" role="list">' + cards + '</ol></section>';
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
    return nav + '<ul class="feed" role="list">' + playItem(p, false).replace(/<details class="why"[\s\S]*<\/details>/, '') + '</ul>' +
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
        '<ol class="drives" role="list">' + rows + '</ol>' +
        '<p class="film-legend"><i class="k-score"></i>Score <i class="k-to"></i>Turnover <i class="k-flag"></i>Penalty <i class="k-loss"></i>Lost yards</p></div>' +
      momentumPanel() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>The play caller</h2></div>' + caller + '</div>' +
        '<div class="panel film-detail" id="filmDetail"><div class="panel-head"><h2>The play</h2></div>' + filmPlayDetail() + '</div>' +
      '</div></div>';
  }

  var RENDER = { week: renderWeek, film: renderFilm, league: renderLeague, matchup: renderMatchup, lineups: renderLineups, plays: renderPlays, recap: renderRecap };

  var SCREEN_TITLES = { league: 'League', matchup: 'Matchup', lineups: 'Lineups', plays: 'Play by play', recap: 'Recap', film: 'Film room', week: 'This week in the league' };
  function render(isFresh) {
    fresh = !!isFresh;
    $('s-' + tab).innerHTML = '<h1 class="sr-only">' + SCREEN_TITLES[tab] + '</h1>' + RENDER[tab]();
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

  var ANN = window.FF_ANNOUNCER;

  // Captions: one line at the bottom of the game view with what the announcer just said.
  // It sits in the band past the end line, so it stays clear of the players and their names.
  var capEl = document.createElement('div');
  capEl.className = 'captions';
  capEl.setAttribute('aria-hidden', 'true'); // seen here, read from the live region below
  var liveEl = document.createElement('div');
  liveEl.className = 'sr-only';
  liveEl.setAttribute('aria-live', 'polite');
  liveEl.setAttribute('role', 'status');
  liveEl.setAttribute('data-i18n-skip', ''); // announcer lines, in the announcer's language
  $('closeGame').parentNode.appendChild(liveEl);
  var livePending = { text: '', score: '', rule: '' }, liveTimer = 0;
  function liveSay(part, value) {
    livePending[part] = value;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      var t = [livePending.text, livePending.score, livePending.rule].filter(Boolean).join(' ');
      livePending = { text: '', score: '', rule: '' };
      if (t && inGame) liveEl.textContent = t;
    }, 60);
  }
  capEl.hidden = true;
  $('closeGame').parentNode.appendChild(capEl);
  // Sound captions left out, at Peyton's request: the boos and the crowd rising.
  var HIDDEN_CAPTIONS = /\bcrowd boos\b|\bcrowd rises\b|^\[boos\]$/i;
  function showCaption(text) {
    if (text && typeof text === 'object') text = text.text || text.line || '';
    if (!text || HIDDEN_CAPTIONS.test(String(text).trim())) return;
    var span = document.createElement('span');
    span.textContent = String(text);
    capEl.textContent = '';
    capEl.appendChild(span);
    capEl.title = span.textContent;
    capEl.hidden = false;
    liveSay('text', span.textContent);
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

  // ------------------------------------------------------------ rule cards
  // "Learn the game": the first time each rule comes up in a game, a small card explains
  // it. Off by default, saved under fr.learn. The text comes from FF_ANNOUNCER.explain
  // (Noah, C14) when it is there, otherwise from the short text below, by the same kinds.
  var LEARN_KEY = 'fr.learn', learn = false;
  try { learn = window.localStorage.getItem(LEARN_KEY) === '1'; } catch (err) { learn = false; }
  var RULES_TEXT = {
    kickoff: 'Play starts with a kickoff: one team kicks the ball deep and the other runs it back.',
    first_down: 'The offense has four tries, called downs, to gain 10 yards. Make it and they get four new tries.',
    downs: 'Four tries and no 10 yards: the other team takes the ball where it stopped. A turnover on downs.',
    touchdown: 'Get the ball into the other end zone: 6 points, then a try for 1 more.',
    extra_point: 'After a touchdown, a short kick through the posts adds 1 point.',
    field_goal: 'A kick through the posts from the field is worth 3 points.',
    punt: 'On fourth down far from the goal, teams kick the ball away so the other team starts far back.',
    interception: 'A defender catches the pass, and the defense takes the ball.',
    fumble: 'The ball carrier drops the ball. Whoever falls on it keeps it.',
    sack: 'The quarterback is tackled before he can throw. The offense loses yards and a down.',
    penalty: 'A player broke a rule. A yellow flag, and the ball moves 5 to 15 yards.',
    halftime: 'The game has two halves. At halftime the teams switch who kicks off.'
  };
  function explainText(kind) {
    var A = window.FF_ANNOUNCER, t = '';
    if (A && typeof A.explain === 'function') { try { t = A.explain(kind) || ''; } catch (err) { t = ''; } }
    return t || RULES_TEXT[kind] || '';
  }
  function kindsFor(res) {
    var A = window.FF_ANNOUNCER;
    if (A && typeof A.explainFor === 'function') { try { var k = A.explainFor(res); if (Array.isArray(k)) return k; } catch (err) { /* own list below */ } }
    if (res.kind === 'half') return ['halftime'];
    var e = res.e || {}, out = [];
    if (e.t === 'kickoff') out.push('kickoff');
    if (res.td) out.push('touchdown');
    if (e.t === 'xp') out.push('extra_point');
    if (e.t === 'fg') out.push('field_goal');
    if (e.t === 'punt') out.push('punt');
    if (e.t === 'int') out.push('interception');
    if (e.t === 'fumble') out.push('fumble');
    if (e.t === 'sack') out.push('sack');
    if (e.t === 'pen') out.push('penalty');
    if (res.downs) out.push('downs');
    if (res.first && !res.td) out.push('first_down');
    return out;
  }
  var ruleSeen = {}, ruleQueue = [], ruleTimer = 0, ruleSlowed = null;
  var learnEl = document.createElement('div');
  learnEl.className = 'speed learn';
  learnEl.hidden = true;
  learnEl.innerHTML = '<button type="button" data-learn="1" aria-pressed="false">Learn the game</button>';
  $('closeGame').parentNode.appendChild(learnEl);
  var ruleEl = document.createElement('div');
  ruleEl.className = 'rule-card';
  ruleEl.hidden = true;
  $('closeGame').parentNode.appendChild(ruleEl);
  function markLearn() { learnEl.firstChild.setAttribute('aria-pressed', String(learn)); }
  markLearn();
  learnEl.addEventListener('click', function () {
    learn = !learn;
    try { window.localStorage.setItem(LEARN_KEY, learn ? '1' : '0'); } catch (err) { /* storage may be off */ }
    markLearn();
    if (!learn) hideRule(true);
    revealClose();
  });
  // At 2x or slower the game nearly stops while a card is up (0.25x, the slowest it goes),
  // so there is time to read; faster than 2x it keeps going. FF_GAME.hold is used if it appears.
  function slowFor(on) {
    var ff = window.__ff;
    if (G.hold) {
      try {
        if (on && ruleSlowed === null && (!ff || ff.speed <= 2)) { G.hold(true); ruleSlowed = 'hold'; }
        else if (!on && ruleSlowed === 'hold') { G.hold(false); ruleSlowed = null; }
        return;
      } catch (err) { /* slow down instead */ }
    }
    if (!ff) return;
    if (on && ruleSlowed === null && ff.speed <= 2) { ruleSlowed = ff.speed; ff.speed = 0.25; }
    else if (!on && ruleSlowed !== null) { ff.speed = ruleSlowed; ruleSlowed = null; }
  }
  function showNextRule() {
    var kind = ruleQueue.shift();
    if (!kind) return;
    var text = explainText(kind);
    if (!text || ruleSeen[kind]) { showNextRule(); return; }
    ruleSeen[kind] = true;
    var title = kind.replace(/_/g, ' ');
    ruleEl.innerHTML = '<p><b>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '.</b> ' + esc(text) + '</p>' +
      '<button type="button" data-rule="close" aria-label="Close the rule card">OK</button>';
    ruleEl.hidden = false;
    liveSay('rule', (lang() === 'es' ? 'Regla: ' : 'Rule: ') + tr(text));
    slowFor(true);
    clearTimeout(ruleTimer);
    var fast = window.__ff && window.__ff.speed > 2;
    ruleTimer = setTimeout(function () { hideRule(false); }, fast ? 4000 : 7000);
  }
  function hideRule(all) {
    clearTimeout(ruleTimer);
    ruleEl.hidden = true;
    if (all) ruleQueue = [];
    if (ruleQueue.length) showNextRule(); else slowFor(false);
  }
  ruleEl.addEventListener('click', function (ev) { ev.stopPropagation(); hideRule(false); });
  ruleEl.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
  function ruleFor(type, d) {
    if (type === 'reset') { ruleSeen = {}; hideRule(true); return; }
    if (!learn || !inGame || jumping) return;
    var res = type === 'half' ? { kind: 'half' } : type === 'result' ? d.res : null;
    if (!res) return;
    kindsFor(res).forEach(function (k) {
      if (ruleSeen[k] || ruleQueue.indexOf(k) >= 0 || !explainText(k)) return;
      ruleQueue.push(k);
    });
    if (ruleEl.hidden && ruleQueue.length) showNextRule();
  }

  // -------------------------------------------------------------- jump bar
  // Previous play, next play, next score and any play, on FF_GAME.seek (from 1) and hold.
  // While opted in, "next score" would give away that a score is coming, so it becomes
  // "next big moment" (the next play tagged highlight) and is hidden when there is none.
  var jumping = false, gameInfo = null;
  function playsInfo() {
    if (gameInfo) return gameInfo;
    var list = [];
    try {
      var state = Rules.create(TEAMS);
      Rules.flatten(D.SAMPLE_GAME, TEAMS).forEach(function (st) {
        if (st.kind === 'half') { Rules.startHalf(state); return; }
        if (st.kind !== 'play') return;
        var pre = state.score.slice(), r = Rules.apply(state, st.e, st.team);
        list.push({ index: list.length + 1, scored: state.score[0] !== pre[0] || state.score[1] !== pre[1],
          tagged: Array.isArray(st.e.tags) && st.e.tags.indexOf('highlight') >= 0, text: String(r.text || '') });
      });
    } catch (err) { list = []; }
    gameInfo = list;
    return list;
  }
  function currentPlay() { return Math.min(m.done + 1, G.plays); }
  function nextWhere(test) {
    var info = playsInfo(), from = m.done + 1;
    for (var i = from; i < info.length; i++) if (test(info[i])) return info[i].index;
    return 0;
  }
  function nextMoment() { return masked() ? nextWhere(function (x) { return x.tagged; }) : nextWhere(function (x) { return x.scored; }); }
  function jumpTo(index) {
    index = Math.max(1, Math.min(G.plays, index));
    if (!G.seek) return false;
    jumping = true;
    var ok = false;
    try { ok = G.seek(index) !== false; } finally { jumping = false; }
    markJump();
    revealClose();
    return ok;
  }
  var jumpEl = document.createElement('div');
  jumpEl.className = 'jump';
  jumpEl.setAttribute('role', 'group');
  jumpEl.setAttribute('aria-label', 'Move around the game');
  jumpEl.hidden = true;
  jumpEl.innerHTML =
    '<div class="jump-row">' +
      '<button type="button" data-jump="prev">Previous play</button>' +
      '<button type="button" data-jump="next">Next play</button>' +
      '<button type="button" data-jump="moment"></button>' +
    '</div>' +
    '<label class="jump-slide"><span class="jump-at"></span>' +
      '<input type="range" min="1" step="1" aria-label="Jump to any play"></label>';
  $('closeGame').parentNode.appendChild(jumpEl);
  var slider = jumpEl.querySelector('input'), atEl = jumpEl.querySelector('.jump-at'), momentBtn = jumpEl.querySelector('[data-jump=moment]');
  function playLabel(n) {
    var info = playsInfo()[n - 1];
    // A play's text tells what happens, so it is left out while the score is hidden.
    return 'Play ' + n + ' of ' + G.plays + (info && !masked() && n <= m.done + 1 ? ': ' + info.text : '');
  }
  function markJump() {
    var cur = currentPlay();
    slider.max = String(G.plays);
    if (!jumpEl.contains(document.activeElement) || document.activeElement !== slider) slider.value = String(cur);
    slider.setAttribute('aria-valuetext', playLabel(Number(slider.value)));
    atEl.textContent = 'Play ' + slider.value + ' of ' + G.plays;
    jumpEl.querySelector('[data-jump=prev]').disabled = cur <= 1;
    jumpEl.querySelector('[data-jump=next]').disabled = cur >= G.plays;
    var nm = nextMoment();
    momentBtn.textContent = masked() ? 'Next big moment' : 'Next score';
    momentBtn.hidden = !nm;
    momentBtn.setAttribute('data-to', String(nm || ''));
  }
  jumpEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-jump]') : null;
    if (!b || b.disabled) return;
    var a = b.getAttribute('data-jump'), cur = currentPlay();
    if (a === 'prev') jumpTo(cur - 1);
    else if (a === 'next') jumpTo(cur + 1);
    else if (a === 'moment') { var to = Number(b.getAttribute('data-to')); if (to) jumpTo(to); }
  });
  // Dragging holds the game; letting go jumps and releases it.
  var dragging = false;
  slider.addEventListener('input', function () {
    if (!dragging && G.hold) { G.hold(true); dragging = true; }
    atEl.textContent = 'Play ' + slider.value + ' of ' + G.plays;
    slider.setAttribute('aria-valuetext', playLabel(Number(slider.value)));
    revealClose();
  });
  slider.addEventListener('change', function () {
    jumpTo(Number(slider.value));
    if (dragging && G.hold) { G.hold(false); }
    dragging = false;
  });

  function setControls(on) {
    $('closeGame').hidden = !on;
    jumpEl.hidden = !on || !G.seek;
    $('closeGame').parentNode.classList.toggle('show-controls', on && !!G.seek);
    if (on) markJump();
    speedEl.hidden = !on;
    learnEl.hidden = !on;
  }

  var closeTimer = 0;
  function showGame(on) {
    inGame = on;
    $('gameView').hidden = !on;
    setControls(false);
    if (!on && typeof hideRule === 'function') hideRule(true);
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

  // The tab bar is a tablist: one tab in the Tab order, arrow keys, Home and End move between
  // tabs and open them. Screens without a tab (film room, this week) leave every tab reachable.
  function tabInList() { return Array.prototype.some.call($('tabs').children, function (a) { return a.getAttribute('data-tab') === tab; }); }
  (function tablist() {
    var bar = $('tabs');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Screens');
    Array.prototype.forEach.call(bar.children, function (a) {
      var name = a.getAttribute('data-tab');
      a.setAttribute('role', 'tab');
      a.id = 'tab-' + name;
      a.setAttribute('aria-controls', 's-' + name);
      var panel = $('s-' + name);
      if (panel) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-' + name); panel.removeAttribute('aria-label'); }
    });
    bar.addEventListener('keydown', function (ev) {
      var tabs = Array.prototype.slice.call(bar.children), i = tabs.indexOf(document.activeElement), j = -1;
      if (i < 0) return;
      if (ev.key === 'ArrowRight') j = (i + 1) % tabs.length;
      else if (ev.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      else if (ev.key === 'Home') j = 0;
      else if (ev.key === 'End') j = tabs.length - 1;
      if (j < 0) return;
      ev.preventDefault();
      tabs[j].focus();
      goTab(tabs[j].getAttribute('data-tab'));
    });
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
  // Language switch, next to the sport switch. Its two names stay as they are in both languages.
  var langEl = document.createElement('div');
  langEl.className = 'sport lang';
  langEl.setAttribute('role', 'group');
  langEl.setAttribute('aria-label', 'Language');
  langEl.innerHTML = '<button type="button" data-lang="en" lang="en" aria-label="English" data-i18n-skip>EN</button>' +
    '<button type="button" data-lang="es" lang="es" aria-label="Español" data-i18n-skip>ES</button>';
  sportEl.parentNode.insertBefore(langEl, sportEl.nextSibling);
  function markLang() {
    Array.prototype.forEach.call(langEl.children, function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === lang())); });
  }
  markLang();
  langEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-lang]') : null;
    if (b && window.FR_I18N) window.FR_I18N.setLang(b.getAttribute('data-lang'));
  });

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
    soccerTabs();
  }

  // One tab bar for both sports. Soccer is its own page in a frame (js/sport.js) with its own
  // header and tabs; while soccer is on, that header is hidden and this app's tabs drive the
  // frame instead: Matchup, Lineups, Plays and Recap open the soccer screens of the same name.
  // League is football's only, so it is hidden for soccer. While the soccer match plays, the
  // frame fills the screen like the football game view and the tab bar steps aside.
  function soccerOn() { return sport === 'soccer' && soccerConnected(); }
  function soccerFrame() { return document.querySelector('#soccerView iframe'); }
  function soccerWin() { var f = soccerFrame(); try { return f && f.contentWindow && f.contentWindow.document ? f.contentWindow : null; } catch (err) { return null; } }
  var SOCCER_TABS = ['matchup', 'lineups', 'plays', 'recap'];
  function soccerTab() {
    var w = soccerWin(), h = w ? (w.location.hash || '#matchup').slice(1) : 'matchup';
    return h;
  }
  function soccerTabs() {
    var on = soccerOn(), view = $('soccerView'), w = soccerWin(), h = soccerTab(), playing = on && h === 'game';
    Array.prototype.forEach.call($('tabs').children, function (a) {
      var name = a.getAttribute('data-tab');
      if (name === 'league') a.hidden = on;
      if (!on) return;
      var cur = name === (SOCCER_TABS.indexOf(h) >= 0 ? h : 'matchup');
      if (cur) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      a.setAttribute('aria-selected', String(cur));
      a.tabIndex = cur ? 0 : -1;
      a.setAttribute('aria-controls', 'soccerView');
    });
    if (!on) Array.prototype.forEach.call($('tabs').children, function (a) { a.setAttribute('aria-controls', 's-' + a.getAttribute('data-tab')); });
    $('tabs').hidden = playing || (sport === 'soccer' && !soccerConnected());
    if (view) view.classList.toggle('playing', playing);
    document.documentElement.classList.toggle('soccer-on', on);
    if (on && w) {
      // Hide the soccer page's own header (brand, tabs, sample tag) once per page load.
      if (!w.document.getElementById('fr-one-bar')) {
        var st = w.document.createElement('style');
        st.id = 'fr-one-bar';
        st.textContent = '#app > header.bar { display: none !important; } #app { padding-bottom: 24px !important; }';
        (w.document.head || w.document.documentElement).appendChild(st);
      }
      if (!w.__frTabsHooked) { w.__frTabsHooked = true; w.addEventListener('hashchange', soccerTabs); }
      // The soccer crowd: background noise at all times, a loud cheer for goals, boos for fouls.
      if (!w.document.getElementById('fr-stadium-sound')) {
        var sc = w.document.createElement('script');
        sc.id = 'fr-stadium-sound'; sc.src = '../js/screens/stadium-sound.js';
        (w.document.body || w.document.documentElement).appendChild(sc);
      }
    }
    fitSoccer();
  }
  // The frame ends above the tab bar on a phone, so its last card is never under the bar.
  function fitSoccer() {
    var view = $('soccerView');
    if (!view) return;
    if (!soccerOn() || view.classList.contains('playing')) { view.style.height = ''; return; }
    var bar = $('tabs'), top = view.getBoundingClientRect().top + window.scrollY;
    var fixed = bar && !bar.hidden && getComputedStyle(bar).position === 'fixed' ? bar.offsetHeight : 0;
    view.style.height = Math.max(420, Math.round(window.innerHeight - top - fixed)) + 'px';
  }
  window.addEventListener('resize', fitSoccer);
  (function hookFrame() {
    // js/sport.js makes the frame the first time Soccer is chosen; hook it when it appears.
    var view = $('soccerView');
    if (!view || !window.MutationObserver) return;
    new MutationObserver(function () {
      var f = soccerFrame();
      if (f && !f.__frHooked) { f.__frHooked = true; f.addEventListener('load', soccerTabs); }
    }).observe(view, { childList: true });
  })();
  // A tab: the football screen, or with soccer on, the soccer screen in the frame.
  function goTab(name) {
    if (soccerOn()) {
      var w = soccerWin();
      if (w && SOCCER_TABS.indexOf(name) >= 0) w.location.hash = name;
      soccerTabs();
      return;
    }
    location.hash = name;
  }
  $('tabs').addEventListener('click', function (ev) {
    var a = ev.target.closest ? ev.target.closest('a[data-tab]') : null;
    if (!a || !soccerOn()) return;
    ev.preventDefault();
    goTab(a.getAttribute('data-tab'));
  });
  function setSport(name, tell) {
    sport = name === 'soccer' ? 'soccer' : 'football';
    try { window.localStorage.setItem(SPORT_KEY, sport); } catch (err) { /* storage may be off */ }
    if (tell && soccerConnected()) { try { window.FR_SPORT_CHANGE(sport); } catch (err) { console.error(err); } }
    if (sport === 'football') { route(); soccerTabs(); } else { markSport(); window.scrollTo(0, 0); }
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
      var on = a.getAttribute('data-tab') === tab;
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      a.setAttribute('aria-selected', String(on));
      a.tabIndex = on || !tabInList() ? 0 : -1;
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
    else if (act === 'share-top') { shareTopPlay(el); }
    else if (act === 'party-join') { if (window.FR_PARTY) window.FR_PARTY.openJoin(); }
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
    if ((ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') && G.seek && document.activeElement !== slider) {
      ev.preventDefault();
      jumpTo(currentPlay() + (ev.key === 'ArrowLeft' ? -1 : 1));
      return;
    }
    // Tab in the game view shows the controls and starts on Close.
    if (ev.key === 'Tab') {
      if (!focusInControls()) { ev.preventDefault(); revealClose(); $('closeGame').focus(); return; }
      revealClose();
      // Keep the keyboard inside the game view: wrap from the last control to the first.
      var list = Array.prototype.filter.call($('closeGame').parentNode.querySelectorAll('button, input'), function (x) { return !x.closest('[hidden]') && !x.hidden; });
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
    // A seek resets the game without a new start event, so the first play after it marks it live.
    if ((type === 'snap' || type === 'result') && m.status === 'pre') m.status = 'live';
    if (type === 'snap') m.now = d.res.e.t === 'kickoff' ? 'Kickoff' : d.res.e.t === 'xp' ? 'Extra point try' : d.res.where;
    else if (type === 'result') {
      applyResult(d.res);
      setTimeout(function () { if (!inGame) render(false); }, 1600); // lets the highlight on new points fade
    }
    else if (type === 'half') { m.feed.push({ divider: 'Halftime' }); m.now = 'Halftime'; closeDrive('End of half'); m.halfScore = m.field.slice(); }
    else if (type === 'final') { m.status = 'final'; m.now = ''; closeDrive('End of game'); recordWatched(); }
    syncFloaters();
    captionFor(type, d);
    ruleFor(type, d);
    if (type === 'result' && !masked()) {
      var sc = d.res.post.score, pr = d.res.pre.score;
      if (sc[0] !== pr[0] || sc[1] !== pr[1]) liveSay('score', TEAMS[0].name + ' ' + sc[0] + ', ' + TEAMS[1].name + ' ' + sc[1] + '.');
    }
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
    topPlayCard: function () { return drawTopPlayCard().toDataURL('image/png'); },
    get live() { return liveEl.textContent; },
    get learn() { return learn; },
    get lang() { return lang(); },
    get leagueFromService() { return !!(leagueData && leagueData.fromService); },
    story: function () { return storyOf(); },
    formFor: function (team, slot) { return formFor(teamByName(team), slot); },
    setOptin: function (v) { setOptin(v === 'in' ? 'in' : 'out'); if (!inGame) render(false); },
    jumpTo: function (n) { return jumpTo(n); },
    get currentPlay() { return currentPlay(); },
    get rule() { return ruleEl.hidden ? '' : ruleEl.textContent; },
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
  var i18nScript = document.createElement('script');
  i18nScript.src = 'js/screens/i18n.js';
  i18nScript.onload = function () {
    markLang();
    window.FR_I18N.onchange = function () { markLang(); storyCache = null; if (!inGame) render(false); };
  };
  document.body.appendChild(i18nScript);

  // Commissioner view (?commish=1): opt-ins, who watched, and the weekly release switch.
  if (/[?&]commish=1(&|$)/.test(location.search)) {
    var commishScript = document.createElement('script');
    commishScript.src = 'js/screens/commish.js';
    document.body.appendChild(commishScript);
  }

  // The stadium: fans around the field and a louder crowd (js/screens/crowd.js).
  var crowdScript = document.createElement('script');
  crowdScript.src = 'js/screens/crowd.js';
  document.body.appendChild(crowdScript);
  // The stadium sound for football: background noise at all times, a loud cheer and claps for
  // touchdowns and field goals, boos for incomplete passes and penalties (js/screens/stadium-sound.js).
  var stadiumSound = document.createElement('script');
  stadiumSound.src = 'js/screens/stadium-sound.js';
  document.body.appendChild(stadiumSound);

  // Watch party: ?party=host makes this screen the host; any screen can join as a remote.
  var partyScript = document.createElement('script');
  partyScript.src = 'js/screens/party.js';
  document.body.appendChild(partyScript);

  var installScript = document.createElement('script');
  installScript.src = 'js/screens/install.js';
  document.body.appendChild(installScript);
  // ?demo=1 plays the two-minute demo by itself (js/screens/demo.js).
  if (/[?&]demo=1(&|$)/.test(location.search)) {
    var demoScript = document.createElement('script');
    demoScript.src = 'js/screens/demo.js';
    document.body.appendChild(demoScript);
  }
})();
