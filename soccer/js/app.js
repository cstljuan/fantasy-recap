// Soccer app shell: matchup, lineups, play-by-play and recap screens around the
// match view, built the same way as js/app.js for football so the two feel like
// one app. It listens to SC_GAME and keeps fantasy points, stat lines and the
// feed up to date. Opt in hides every fantasy number until full time; the choice
// is shared with football through localStorage (fr.optin).
(function () {
  'use strict';

  var G = window.SC_GAME, D = window.SC_DATA, Rules = window.SC_RULES, Spr = window.SC_SPRITES, Fantasy = window.SC_FANTASY;
  var TEAMS = D.TEAMS;
  var WEEK = 'Week 11';
  var TABS = ['matchup', 'lineups', 'plays', 'recap'];
  var SLOTS = Fantasy.LINEUP;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function f1(n) { var v = Math.round(n * 10) / 10; return (v === 0 ? 0 : v).toFixed(1); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function fullName(t, role) { return TEAMS[t].roster[role]; }
  function shortName(t, role) { return Rules.lastName(TEAMS[t].roster[role]); }
  function initials(t, role) { return TEAMS[t].roster[role].split(' ').map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase(); }
  function posOf(role) { for (var i = 0; i < SLOTS.length; i++) if (SLOTS[i].role === role) return SLOTS[i].pos; return role; }
  function sentence(s) { s = String(s).replace(/^\d+' /, ''); return s.charAt(0).toUpperCase() + s.slice(1) + '.'; }

  // Team colors and the pixel player from the match, reused as each team's mark.
  var root = document.documentElement;
  root.style.setProperty('--t0', TEAMS[0].colors.trim);
  root.style.setProperty('--t1', TEAMS[1].colors.shirt);
  var marks = [0, 1].map(function (t) {
    try { return Spr.get(t, TEAMS[t].colors, false, 'f', 'stand', t ? 1 : 0, t ? 1 : 0).toDataURL(); } catch (err) { return ''; }
  });

  // ------------------------------------------------------------- model

  var m, tab = 'matchup', filter = 'all', inGame = false, fresh = false, prevTotals = ['0.0', '0.0'];

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
  // My team: ?me=<team id> or the choice on the matchup screen, saved under fr.me.soccer.
  var ME_KEY = 'fr.me.soccer';
  function teamByName(id) {
    id = String(id || '').toUpperCase();
    for (var i = 0; i < 2; i++) if (TEAMS[i].id.toUpperCase() === id) return i;
    return -1;
  }
  var me = (function () {
    var fromUrl = /[?&]me=([^&]*)/.exec(location.search), saved = null;
    if (fromUrl) return teamByName(decodeURIComponent(fromUrl[1]));
    try { saved = window.localStorage.getItem(ME_KEY); } catch (err) { saved = null; }
    return teamByName(saved);
  })();
  function setMe(t) {
    me = t === 0 || t === 1 ? t : -1;
    try { if (me >= 0) window.localStorage.setItem(ME_KEY, TEAMS[me].id); else window.localStorage.removeItem(ME_KEY); } catch (err) { /* storage may be off */ }
  }
  function ord() { return me === 1 ? [1, 0] : [0, 1]; }

  function masked() { return optin === 'in' && m.status !== 'final'; }
  function pts1(n) { return masked() ? MASK : f1(n); }
  function syncFloaters() { if (G.setFloaters) G.setFloaters(!masked()); }
  function paused() { return m.status === 'live' && !inGame && !G.background; }

  function blankTeam() { return { shots: 0, sot: 0, corners: 0, fouls: 0, offsides: 0, yellow: 0, red: 0 }; }
  function blank() {
    var o = { status: 'pre', pts: [{}, {}], st: [{}, {}], team: [blankTeam(), blankTeam()], field: [0, 0], feed: [], done: 0, now: '', flash: {} };
    Rules.SLOTS.forEach(function (k) { for (var t = 0; t < 2; t++) o.st[t][k] = { goals: 0, assists: 0, shots: 0, sot: 0, saves: 0, yellow: 0, red: 0 }; });
    SLOTS.forEach(function (s) { o.pts[0][s.role] = 0; o.pts[1][s.role] = 0; });
    return o;
  }

  function total(t) { var sum = 0; SLOTS.forEach(function (s) { sum += m.pts[t][s.role]; }); return sum; }

  function applyResult(res) {
    var e = res.e, t = res.team, tags = [];
    if (e.t === 'shot' || e.t === 'pen') {
      var s = m.st[t][e.by], onT = (e.out === 'in' && !res.disallowed) || e.out === 'saved';
      s.shots++; m.team[t].shots++;
      if (onT) { s.sot++; m.team[t].sot++; }
      if (res.goal) { s.goals++; if (res.assist) m.st[t][res.assist].assists++; tags.push(['score', e.t === 'pen' ? 'Penalty goal' : 'Goal']); }
      if (res.disallowed) tags.push(['flag', 'No goal']);
      if (res.saver) { m.st[1 - t].GK.saves++; tags.push(['save', 'Save']); }
    } else if (e.t === 'corner') m.team[t].corners++;
    else if (e.t === 'offside') { m.team[t].offsides++; tags.push(['flag', 'Offside']); }
    else if (e.t === 'foul') {
      m.team[t].fouls++;
      if (e.box) tags.push(['flag', 'Penalty']);
      if (res.card) { m.st[t][e.by][res.card]++; m.team[t][res.card]++; tags.push([res.card === 'red' ? 'red' : 'card', res.card === 'red' ? 'Red card' : 'Yellow card']); }
    }
    var now = Date.now();
    res.fp.forEach(function (f) { m.pts[f.team][f.role] += f.pts; m.flash[f.team + f.role] = now; });
    if (e.t === 'ft') {
      res.fp.forEach(function (f) { m.st[f.team][f.role].clean = true; });
      if (res.fp.length) m.feed.push({ n: m.feed.length + 1, team: res.fp[0].team, where: "90'", desc: 'Full time. Clean sheet points for ' + TEAMS[res.fp[0].team].name + '.',
        tags: [['score', 'Clean sheet']], scoring: false, cards: false, score: res.post.score.slice(), fp: fpList(res.fp) });
      return;
    }
    m.field = res.post.score.slice();
    m.done += 1;
    m.feed.push({
      n: m.feed.length + 1, team: t >= 0 ? t : 0, where: res.min + "'", desc: sentence(res.text), tags: tags,
      scoring: !!res.goal, cards: !!res.card || e.t === 'offside' || !!res.disallowed, score: res.post.score.slice(), fp: fpList(res.fp)
    });
  }
  function fpList(fp) { return fp.map(function (f) { return { pts: f.pts, who: shortName(f.team, f.role), team: f.team, why: f.why }; }); }

  function statLine(t, role) {
    var s = m.st[t][role], out = [];
    if (role === 'GK') { if (s.saves) out.push(plural(s.saves, 'save', 'saves')); }
    else {
      if (s.goals) out.push(plural(s.goals, 'goal', 'goals'));
      if (s.assists) out.push(plural(s.assists, 'assist', 'assists'));
      if (s.shots) out.push(plural(s.shots, 'shot', 'shots') + ' (' + s.sot + ' on target)');
    }
    if (s.clean) out.push('clean sheet');
    if (s.yellow) out.push('yellow card');
    if (s.red) out.push('red card');
    var line = out.join(', ');
    return line ? line.charAt(0).toUpperCase() + line.slice(1) : (m.status === 'pre' ? 'Yet to play' : 'No stats yet');
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
    return '<div class="side' + (t === me ? ' is-mine' : '') + '" style="--c: var(--t' + t + ')">' +
      (t === me ? '<span class="mine-tag">Your team</span>' : me >= 0 ? '<span class="mine-tag is-blank" aria-hidden="true">Your team</span>' : '') +
      '<div class="side-id"><img class="sprite" src="' + marks[t] + '" alt=""><div class="team-name">' + esc(TEAMS[t].full) + '</div></div>' +
      '<div class="window"><span class="num' + tick + '">' + tot + '</span><span class="unit">Fantasy pts' + win + '</span></div>' +
      '</div>';
  }

  function fieldScore() { return ord().map(function (t) { return '<span class="fs">' + TEAMS[t].id + '<b>' + m.field[t] + '</b></span>'; }).join(''); }

  function meCard() {
    function btn(t, label) { return '<button type="button" data-act="me" data-v="' + t + '" aria-pressed="' + (me === t) + '">' + esc(label) + '</button>'; }
    return '<div class="panel me-pick"><span class="eyebrow">Your team</span>' +
      '<div class="me-btns">' + btn(0, TEAMS[0].id) + btn(1, TEAMS[1].id) + btn(-1, 'Neither') + '</div></div>';
  }

  function board(actions, label) {
    var sit = m.status === 'pre' ? 'Kicks off when you start watching' : m.status === 'final' ? 'Full time'
            : paused() ? 'Paused' + (m.now ? ', ' + esc(m.now) : '') : esc(m.now);
    return '<div class="board">' +
      '<div class="board-top"><span class="eyebrow">' + esc(label) + '</span>' + statusChip() + '</div>' +
      '<div class="sides">' + ord().map(function (t) { return side(t, m.status === 'final'); }).join('') + '</div>' +
      '<div class="field"><span class="eyebrow">On the pitch</span>' + fieldScore() + '<span class="sit">' + sit + '</span></div>' +
      '<div class="actions">' + actions + '</div>' +
      '</div>';
  }

  function playerRow(t, role, rank) {
    var pts = m.pts[t][role], hot = !masked() && m.flash[t + role] && Date.now() - m.flash[t + role] < 1500;
    return '<div class="row' + (hot ? ' flash' : '') + (t === me ? ' is-mine' : '') + '">' +
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
      '</li>';
  }

  function watchButton(cls) {
    return '<button type="button" class="cta' + (cls || '') + '" data-act="' + (m.status === 'final' ? 'again' : 'watch') + '">' +
      (m.status === 'final' ? 'Watch again' : m.status === 'live' ? 'Keep watching' : 'Watch the match') + '</button>';
  }

  function optinCard() {
    if (m.status !== 'pre') return '';
    if (optin === null) {
      return '<div class="panel optin">' +
        '<div class="optin-text"><h2>Hide my score until the recap</h2>' +
        '<p>Fantasy points and stat lines stay hidden while you watch. Everything shows at full time.</p></div>' +
        '<div class="optin-btns">' +
          '<button type="button" class="cta" data-act="optin" data-v="in">Opt in</button>' +
          '<button type="button" class="cta ghost" data-act="optin" data-v="out">No thanks</button>' +
        '</div></div>';
    }
    if (optin === 'in') {
      return '<div class="panel optin is-on"><div class="optin-text"><p>Your score is hidden until full time.</p></div>' +
        '<button type="button" class="optin-undo" data-act="optin" data-v="out">Show scores</button></div>';
    }
    return '';
  }

  // ----------------------------------------------------------- screens

  function renderMatchup() {
    var actions = m.status === 'final' ? '<a class="cta" href="#recap">See the recap</a>' + watchButton(' ghost') : watchButton();
    var plays = m.feed.filter(function (p) { return !p.divider; }).slice(-3).reverse();
    var top = masked() ? [] : leaders(3);
    var noLeaders = masked() ? 'Leaders are hidden until full time.' : 'No fantasy points yet.';
    return optinCard() + board(actions, WEEK + ' matchup') + meCard() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Latest plays</h2><a href="#plays">All plays</a></div>' +
          (plays.length ? '<ul class="feed">' + plays.map(function (p, i) { return playItem(p, fresh && i === 0); }).join('') + '</ul>'
                        : '<div class="empty">Plays show up here once the match kicks off.</div>') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Leaders</h2><a href="#lineups">Lineups</a></div>' +
          (top.length ? top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('') : '<div class="empty">' + noLeaders + '</div>') + '</div>' +
      '</div>';
  }

  function rulesNote() {
    var S = Fantasy.SCORING;
    return 'Scoring: goal ' + S.goal.FWD + ' for a forward, ' + S.goal.MID + ' for a midfielder, ' + S.goal.DEF + ' for a defender or keeper. ' +
      'Assist ' + S.assist + '. Save ' + S.save + '. Clean sheet ' + S.clean_sheet.GK + ' for a keeper or defender, ' + S.clean_sheet.MID + ' for a midfielder. ' +
      'Yellow card ' + S.yellow + ', red card ' + S.red + '.';
  }

  function renderLineups() {
    function team(t) {
      return '<div class="panel">' +
        '<div class="lineup-head" style="--c: var(--t' + t + ')"><img class="sprite" src="' + marks[t] + '" alt="">' +
        '<div class="team-name">' + esc(TEAMS[t].full) + '</div><span class="num">' + pts1(total(t)) + '</span></div>' +
        SLOTS.map(function (s) { return playerRow(t, s.role, 0); }).join('') +
        '</div>';
    }
    return '<div class="grid two" style="margin-top:0">' + ord().map(team).join('') + '</div>' +
      '<p class="note" style="border:0;margin-top:14px">' + esc(rulesNote()) + '</p>';
  }

  function renderPlays() {
    var list = m.feed.filter(function (p) {
      if (filter === 'goals') return p.scoring;
      if (filter === 'cards') return p.cards;
      return true;
    }).slice().reverse();
    function btn(id, label) { return '<button type="button" data-act="filter" data-f="' + id + '" aria-pressed="' + (filter === id) + '">' + label + '</button>'; }
    var none = m.status === 'pre' ? 'Plays show up here once the match kicks off.'
             : filter === 'goals' ? 'No goals yet.' : filter === 'cards' ? 'No cards or flags yet.' : paused() ? 'Paused before the first play. Keep watching to see it.' : 'Waiting for the first play.';
    return '<div class="narrow">' +
      '<div class="filters">' + btn('all', 'All') + btn('goals', 'Goals') + btn('cards', 'Cards and flags') +
        '<span class="count">' + m.done + ' of ' + G.plays + ' plays</span></div>' +
      '<div class="panel">' +
        (list.length ? '<ul class="feed">' + list.map(function (p, i) { return playItem(p, fresh && i === 0 && filter === 'all'); }).join('') + '</ul>'
                     : '<div class="empty">' + none + '</div>') +
      '</div></div>';
  }

  function winnerHero() {
    var p0 = Number(f1(total(0))), p1 = Number(f1(total(1)));
    var w = p0 === p1 ? -1 : p0 > p1 ? 0 : 1;
    var head = w < 0 ? '<div class="hero-id"><div class="hero-name">It is a tie</div></div>'
      : '<div class="hero-id"><img class="sprite" src="' + marks[w] + '" alt=""><div class="hero-name">' + esc(TEAMS[w].full) + '<span>win</span></div></div>';
    var keep = optin === 'in' ? '<p class="hero-keep">Your score stays hidden again on the replay.</p>' : '';
    return '<div class="board hero" style="--c: var(--t' + (w < 0 ? 0 : w) + ')">' +
      '<div class="board-top"><span class="eyebrow">' + esc(WEEK) + ' result</span>' + statusChip() + '</div>' + head +
      '<div class="hero-score">' + ord().map(function (t) {
        return '<div style="--c: var(--t' + t + ')"><span class="num">' + f1(total(t)) + '</span><span class="eyebrow">' + esc(TEAMS[t].name) + (t === me ? ', yours' : '') + '</span></div>';
      }).join('') + '</div>' +
      '<div class="field"><span class="eyebrow">On the pitch</span>' + fieldScore() + '<span class="sit">Full time</span></div>' +
      '<div class="actions">' + watchButton() + keep + '</div>' +
      '</div>';
  }

  function renderRecap() {
    if (m.status !== 'final') {
      return '<div class="narrow"><div class="panel">' +
        '<div class="panel-head"><h2>Recap</h2>' + statusChip() + '</div>' +
        '<div class="empty">' + (masked() ? 'Scores are hidden. Watch the match to find out.'
                                         : 'The recap is ready at the final whistle: final score, top performers and every goal.') +
        (paused() ? ' The match is paused while you are away, so you will not miss a play.' : '') +
        '<div class="progress"><i style="width:' + Math.round(100 * m.done / G.plays) + '%"></i></div>' +
        '<div style="margin-top:8px;font-size:12px">' + m.done + ' of ' + G.plays + ' plays so far</div></div>' +
        '<div class="actions">' + watchButton() + '</div>' +
        '</div></div>';
    }
    var top = leaders(5), goals = m.feed.filter(function (p) { return p.scoring; }), a = m.team[0], b = m.team[1];
    function line(x, label, y) { if (me === 1) { var z = x; x = y; y = z; } return '<tr><td>' + x + '</td><td>' + label + '</td><td>' + y + '</td></tr>'; }
    return winnerHero() +
      '<div class="grid two">' +
        '<div class="panel"><div class="panel-head"><h2>Top performers</h2></div>' + top.map(function (p, i) { return playerRow(p.t, p.role, i + 1); }).join('') + '</div>' +
        '<div class="panel"><div class="panel-head"><h2>Goals</h2><a href="#plays">All plays</a></div>' +
          (goals.length ? '<ul class="feed">' + goals.map(function (p) { return playItem(p, false); }).join('') + '</ul>' : '<div class="empty">No goals in this one.</div>') + '</div>' +
      '</div>' +
      '<div class="grid"><div class="panel"><div class="panel-head"><h2>' + TEAMS[ord()[0]].name + ' against ' + TEAMS[ord()[1]].name + '</h2></div>' +
        '<table class="compare">' +
          line(f1(total(0)), 'Fantasy points', f1(total(1))) +
          line(m.field[0], 'Score on the pitch', m.field[1]) +
          line(a.shots, 'Shots', b.shots) +
          line(a.sot, 'On target', b.sot) +
          line(a.corners, 'Corners', b.corners) +
          line(a.fouls, 'Fouls', b.fouls) +
          line(a.offsides, 'Offsides', b.offsides) +
          line(a.yellow + ' / ' + a.red, 'Yellow / red cards', b.yellow + ' / ' + b.red) +
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

  // Speed control next to Close, same as football. Sets window.__sc.speed, saved under fr.speed.
  var SPEED_KEY = 'fr.speed', SPEEDS = [0.5, 1, 2, 4];
  var speedEl = document.createElement('div');
  speedEl.className = 'speed'; speedEl.setAttribute('role', 'group'); speedEl.setAttribute('aria-label', 'Match speed'); speedEl.hidden = true;
  speedEl.innerHTML = SPEEDS.map(function (v) { return '<button type="button" data-speed="' + v + '">' + v + 'x</button>'; }).join('');
  $('closeGame').parentNode.appendChild(speedEl);
  function markSpeed() {
    var cur = window.__sc ? Number(window.__sc.speed) : 1;
    Array.prototype.forEach.call(speedEl.children, function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed')) === cur)); });
  }
  function setSpeed(v, save) {
    if (window.__sc) window.__sc.speed = v;
    if (save) { try { window.localStorage.setItem(SPEED_KEY, String(v)); } catch (err) { /* storage may be off */ } }
    markSpeed();
  }
  (function loadSpeed() {
    var saved = null;
    try { saved = Number(window.localStorage.getItem(SPEED_KEY)); } catch (err) { saved = null; }
    if (!/[?&]speed=/.test(location.search) && SPEEDS.indexOf(saved) >= 0) setSpeed(saved, false); else markSpeed();
  })();
  speedEl.addEventListener('click', function (ev) {
    var b = ev.target.closest ? ev.target.closest('[data-speed]') : null;
    if (!b) return;
    setSpeed(Number(b.getAttribute('data-speed')), true);
    revealClose();
  });

  function setControls(on) { $('closeGame').hidden = !on; speedEl.hidden = !on; }

  var closeTimer = 0;
  function showGame(on) {
    inGame = on;
    $('gameView').hidden = !on;
    setControls(false);
    document.body.classList.toggle('in-game', on);
    $('app').inert = on;
    G.setActive(on);
  }
  function focusInControls() { var a = document.activeElement; return !!(a && a !== document.body && $('closeGame').parentNode.contains(a)); }
  function leaveGame(to) { location.replace('#' + (to || tab)); }
  function revealClose() {
    setControls(true); markSpeed();
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function hide() {
      if (focusInControls()) { closeTimer = setTimeout(hide, 2600); return; }
      setControls(false);
    }, 2600);
  }

  function route() {
    var h = (location.hash || '#matchup').slice(1);
    if (h === 'game') {
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
    else if (act === 'me') { setMe(Number(el.getAttribute('data-v'))); render(false); }
  });

  $('closeGame').addEventListener('click', function () { leaveGame(tab); });
  $('gameView').addEventListener('pointermove', function (ev) { if (ev.pointerType === 'mouse') revealClose(); });
  window.addEventListener('keydown', function (ev) {
    if (!inGame) return;
    if (ev.key === 'Escape') { leaveGame(tab); return; }
    if (ev.key === 'Tab') {
      if (!focusInControls()) { ev.preventDefault(); revealClose(); $('closeGame').focus(); return; }
      revealClose();
      var list = Array.prototype.filter.call($('closeGame').parentNode.querySelectorAll('button'), function (x) { return !x.closest('[hidden]'); });
      var i = list.indexOf(document.activeElement);
      if (!ev.shiftKey && i === list.length - 1) { ev.preventDefault(); list[0].focus(); }
      else if (ev.shiftKey && i === 0) { ev.preventDefault(); list[list.length - 1].focus(); }
    }
  });
  window.addEventListener('hashchange', route);

  // A tap on the match shows Close. After full time it leads to the recap.
  // A second tap on the match puts the controls away again (Juan, on his phone: there was no way out of the menu).
  function hideControls() {
    clearTimeout(closeTimer);
    var a = document.activeElement;
    if (a && a !== document.body && a.blur && $('closeGame').parentNode.contains(a)) a.blur();
    setControls(false);
  }
  G.ontap = function (mode) { if (mode === 'final') leaveGame('recap'); else if (!$('closeGame').hidden) hideControls(); else revealClose(); };

  G.on(function (type, d) {
    if (type === 'reset') m = blank();
    else if (type === 'start') m.status = 'live';
    else if (type === 'snap') m.now = d.res.min + "'";
    else if (type === 'result') {
      applyResult(d.res);
      setTimeout(function () { if (!inGame) render(false); }, 1600);
    }
    else if (type === 'half') { m.feed.push({ divider: 'Half time' }); m.now = 'Half time'; }
    else if (type === 'final') { m.status = 'final'; m.now = ''; m.feed.push({ divider: 'Full time' }); }
    syncFloaters();
    if (!inGame) render(type === 'result');
  });

  // Small read-only hook so a headless browser can check the app.
  window.__app = {
    get model() { return m; }, get tab() { return tab; }, get inGame() { return inGame; },
    get optin() { return optin; }, get masked() { return masked(); }, get paused() { return paused(); }, get me() { return me; },
    totals: function () { return [f1(total(0)), f1(total(1))]; }
  };

  m = blank();
  syncFloaters();
  if (location.hash === '#game') location.replace('#matchup');
  route();
})();
