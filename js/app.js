// App shell: matchup, lineups, play-by-play and recap screens around the game
// view. It listens to the game for plays as they happen and keeps fantasy
// points, stat lines and the feed up to date. Everything shown is mock data.
(function () {
  'use strict';

  var G = window.FF_GAME, D = window.FF_DATA, Rules = window.FF_RULES, Spr = window.FF_SPRITES;
  var TEAMS = D.TEAMS;
  var WEEK = 'Week 11';
  var TABS = ['matchup', 'lineups', 'plays', 'recap'];
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
  }
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
      field: [0, 0], feed: [], done: 0, now: '', flash: {}
    };
    SLOTS.forEach(function (s) { for (var t = 0; t < 2; t++) { o.pts[t][s.role] = 0; o.st[t][s.role] = {}; } });
    return o;
  }

  function total(t) {
    var sum = 0;
    SLOTS.forEach(function (s) { sum += m.pts[t][s.role]; });
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
    var e = res.e, off = res.pre.poss, def = 1 - off, s;
    function S(t, role) { return m.st[t][role]; }
    switch (e.t) {
      case 'run': s = S(off, e.by); add(s, 'car'); add(s, 'ruYds', e.yds); if (res.td) add(s, 'td'); m.team[off].rush += e.yds; break;
      case 'pass':
        s = S(off, 'QB'); add(s, 'att'); add(s, 'cmp'); add(s, 'paYds', e.yds); if (res.td) add(s, 'paTd');
        s = S(off, e.to); add(s, 'rec'); add(s, 'reYds', e.yds); if (res.td) add(s, 'td');
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
      n: m.done, team: off, where: res.where || '', desc: describe(res), tags: tags,
      scoring: changed, flag: e.t === 'pen', score: res.post.score.slice(),
      fp: res.fp.map(function (f) { return { pts: f.pts, who: shortName(f.team, f.role) }; })
    });
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
    for (var t = 0; t < 2; t++) SLOTS.forEach(function (s) { list.push({ t: t, role: s.role, pts: m.pts[t][s.role] }); });
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
    return '<div class="side" style="--c: var(--t' + t + ')">' +
      '<div class="side-id"><img class="sprite" src="' + marks[t] + '" alt=""><div class="team-name">' + esc(TEAMS[t].full) + '</div></div>' +
      '<div class="window"><span class="num' + tick + '">' + tot + '</span><span class="unit">Fantasy pts' + win + '</span></div>' +
      '</div>';
  }

  function board(actions, label) {
    var sit = m.status === 'pre' ? 'Kicks off when you start watching' : m.status === 'final' ? 'Full time'
            : paused() ? 'Paused' + (m.now ? ', ' + esc(m.now) : '') : esc(m.now);
    return '<div class="board">' +
      '<div class="board-top"><span class="eyebrow">' + esc(label) + '</span>' + statusChip() + '</div>' +
      '<div class="sides">' + side(0, m.status === 'final') + side(1, m.status === 'final') + '</div>' +
      '<div class="field"><span class="eyebrow">On the field</span>' +
        '<span class="fs">' + TEAMS[0].id + '<b>' + m.field[0] + '</b></span>' +
        '<span class="fs">' + TEAMS[1].id + '<b>' + m.field[1] + '</b></span>' +
        '<span class="sit">' + sit + '</span></div>' +
      '<div class="actions">' + actions + '</div>' +
      '</div>';
  }

  function playerRow(t, role, rank) {
    var pts = m.pts[t][role], hot = !masked() && m.flash[t + role] && Date.now() - m.flash[t + role] < 1500;
    return '<div class="row' + (hot ? ' flash' : '') + '">' +
      (rank ? '<span class="rank">' + rank + '</span>' : '') +
      '<span class="tile" style="--c: ' + TEAMS[t].colors.tile + '">' + initials(t, role) + '</span>' +
      '<div class="who"><div class="name">' + esc(fullName(t, role)) + '</div>' +
      '<div class="sub"><span class="pos">' + posOf(role) + '</span>' +
        (masked() ? (rank ? TEAMS[t].id : '') : (rank ? TEAMS[t].id + ', ' : '') + esc(statLine(t, role))) + '</div></div>' +
      '<span class="pts num' + (pts === 0 || masked() ? ' zero' : '') + '">' + pts1(pts) + '</span>' +
      '</div>';
  }

  function playItem(p, isNew) {
    if (p.divider) return '<li class="divider">' + esc(p.divider) + '</li>';
    var tags = p.tags.map(function (t) { return '<span class="tag t-' + t[0] + '">' + t[1] + '</span>'; }).join('');
    if (p.scoring) tags += '<span class="play-score">' + TEAMS[0].id + ' ' + p.score[0] + ', ' + TEAMS[1].id + ' ' + p.score[1] + '</span>';
    var fp = p.fp.map(function (f) {
      if (masked()) return '<div><b>' + MASK + '</b> ' + esc(f.who) + '</div>';
      return '<div' + (f.pts < 0 ? ' class="neg"' : '') + '><b>' + (f.pts > 0 ? '+' : '') + f1(f.pts) + '</b> ' + esc(f.who) + '</div>';
    }).join('');
    return '<li class="play' + (isNew ? ' is-new' : '') + '" style="--c: var(--t' + p.team + ')">' +
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
      return '<div class="panel optin is-on"><div class="optin-text"><p>Your score is hidden until the final.</p></div>' +
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
    return optinCard() + board(actions, WEEK + ' matchup') +
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
    return '<div class="grid two" style="margin-top:0">' + team(0) + team(1) + '</div>' +
      '<p class="note" style="border:0;margin-top:14px">Scoring in this sample league: 0.1 per rushing or receiving yard, 0.04 per passing yard, ' +
      '6 for a rushing or receiving touchdown, 4 for a passing touchdown, minus 2 for an interception or lost fumble. ' +
      'Kickers get 1 for an extra point and 3 to 5 for a field goal. A defense gets 1 for a sack and 2 for a takeaway.</p>';
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
        '<div style="--c: var(--t0)"><span class="num">' + f1(total(0)) + '</span><span class="eyebrow">' + esc(TEAMS[0].name) + '</span></div>' +
        '<div style="--c: var(--t1)"><span class="num">' + f1(total(1)) + '</span><span class="eyebrow">' + esc(TEAMS[1].name) + '</span></div>' +
      '</div>' +
      '<div class="field"><span class="eyebrow">On the field</span>' +
        '<span class="fs">' + TEAMS[0].id + '<b>' + m.field[0] + '</b></span>' +
        '<span class="fs">' + TEAMS[1].id + '<b>' + m.field[1] + '</b></span>' +
        '<span class="sit">Full time</span></div>' +
      '<div class="actions">' + watchButton() + keep + '</div>' +
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
        '<div style="margin-top:8px;font-size:12px">' + m.done + ' of ' + G.plays + ' plays so far</div></div>' +
        '<div class="actions">' + watchButton() + '</div>' +
        '</div></div>';
    }
    var top = leaders(5);
    var scores = m.feed.filter(function (p) { return p.scoring; });
    var a = m.team[0], b = m.team[1];
    function line(x, label, y) { return '<tr><td>' + x + '</td><td>' + label + '</td><td>' + y + '</td></tr>'; }
    return winnerHero() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Top performers</h2></div>' +
          top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Scoring plays</h2><a href="#plays">All plays</a></div>' +
          '<ul class="feed">' + scores.map(function (p) { return playItem(p, false); }).join('') + '</ul></div>' +
      '</div>' +
      '<div class="grid"><div class="panel"><div class="panel-head"><h2>' + TEAMS[0].name + ' against ' + TEAMS[1].name + '</h2></div>' +
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

  var RENDER = { matchup: renderMatchup, lineups: renderLineups, plays: renderPlays, recap: renderRecap };

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

  function setControls(on) {
    $('closeGame').hidden = !on;
    speedEl.hidden = !on;
  }

  var closeTimer = 0;
  function showGame(on) {
    inGame = on;
    $('gameView').hidden = !on;
    setControls(false);
    document.body.classList.toggle('in-game', on);
    G.setActive(on);
  }

  function leaveGame(to) { location.replace('#' + (to || tab)); }

  function revealClose() {
    setControls(true);
    markSpeed();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () { setControls(false); }, 2600);
  }

  function route() {
    var h = (location.hash || '#matchup').slice(1);
    if (h === 'game') {
      // The game can only be opened from a button, because sound needs a tap.
      if (G.mode === 'ready') { location.replace('#matchup'); return; }
      showGame(true);
      return;
    }
    if (inGame) showGame(false);
    if (TABS.indexOf(h) < 0) h = 'matchup';
    var changed = h !== tab;
    tab = h;
    TABS.forEach(function (t) { $('s-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call($('tabs').children, function (a) {
      if (a.getAttribute('data-tab') === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    render(false);
    if (changed) window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');
    if (act === 'watch') { G.start(); location.hash = 'game'; }
    else if (act === 'again') { G.restart(); location.hash = 'game'; }
    else if (act === 'filter') { filter = el.getAttribute('data-f'); render(false); }
    else if (act === 'optin') { setOptin(el.getAttribute('data-v') === 'in' ? 'in' : 'out'); render(false); }
  });

  $('closeGame').addEventListener('click', function () { leaveGame(tab); });
  $('gameView').addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse') revealClose(); });
  window.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && inGame) leaveGame(tab); });
  window.addEventListener('hashchange', route);

  // A tap on the game shows the close control. After the final it leads to the recap.
  G.ontap = function (mode) {
    if (mode === 'final') leaveGame('recap'); else revealClose();
  };

  G.on(function (type, d) {
    if (type === 'reset') m = blank();
    else if (type === 'start') m.status = 'live';
    else if (type === 'snap') m.now = d.res.e.t === 'kickoff' ? 'Kickoff' : d.res.e.t === 'xp' ? 'Extra point try' : d.res.where;
    else if (type === 'result') {
      applyResult(d.res);
      setTimeout(function () { if (!inGame) render(false); }, 1600); // lets the highlight on new points fade
    }
    else if (type === 'half') { m.feed.push({ divider: 'Halftime' }); m.now = 'Halftime'; }
    else if (type === 'final') { m.status = 'final'; m.now = ''; }
    syncFloaters();
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
    totals: function () { return [f1(total(0)), f1(total(1))]; }
  };

  m = blank();
  syncFloaters();
  if (location.hash === '#game') location.replace('#matchup');
  route();
})();
