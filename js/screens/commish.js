// Commissioner view: ?commish=1. Every matchup of a week with who has opted in, how many
// managers watched to the final, and a "recap released" switch per week (the Tuesday release,
// by hand). With ?api= it reads and writes Ricky's commissioner routes (server/README.md,
// Commissioner); without the service it keeps everything on this device and says so.
// It never shows points. Loaded by js/app.js.
(function () {
  'use strict';
  var A = window.__app;
  if (!A) return;
  var API = (function () {
    var mm = /[?&]api=([^&]+)/.exec(location.search), u = mm ? decodeURIComponent(mm[1]) : '';
    return /^https?:\/\/[^\s"'<>]+$/.test(u) ? u.replace(/\/+$/, '') : '';
  })();
  var KEY = 'fr.commish';
  function tr(s) { return window.FR_I18N ? window.FR_I18N.tr(s) : s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function local() { try { return JSON.parse(window.localStorage.getItem(KEY) || '{}') || {}; } catch (err) { return {}; } }
  function saveLocal(d) { try { window.localStorage.setItem(KEY, JSON.stringify(d)); } catch (err) { /* storage may be off */ } }
  function timed(url, opts) {
    var ctrl = window.AbortController ? new AbortController() : null, o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 2000);
    return fetch(url, o).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }

  var league = null, week = 0, mode = API ? 'service' : 'device', view = null;
  var names = {};
  function teamName(id) { return names[id] || id; }

  // What the device knows by itself: this week's opt-ins from data/league.json, plus this
  // browser's own choice for our matchup; past weeks have no opt-in record in the file.
  // The game id of a matchup: data/league.json keeps gameFile in the weeks list.
  function gameOf(n, ids) {
    var key = ids.slice().sort().join('|'), found = null;
    (league.weeks || []).concat([{ week: league.week, matchups: league.matchups || [] }]).forEach(function (w) {
      if (w.week !== n) return;
      (w.matchups || []).forEach(function (m) {
        var k = (m.teams || []).map(function (t) { return t.id; }).sort().join('|');
        if (k === key && m.gameFile && !found) found = String(m.gameFile).replace(/^.*\//, '').replace(/\.json$/, '');
      });
    });
    return found;
  }
  function deviceWeek(n) {
    var L = league, d = local(), cur = n === L.week;
    var src = cur ? L.matchups : ((L.weeks || []).filter(function (w) { return w.week === n; })[0] || { matchups: [] }).matchups;
    var mine = A.optin === 'in' ? (A.me >= 0 ? window.FF_DATA.TEAMS[A.me].id : window.FF_DATA.TEAMS[0].id) : null;
    return {
      released: !!(d.released && d.released[n]),
      matchups: src.map(function (m) {
        var ids = (m.teams || []).map(function (t) { return t.id; });
        var gid = gameOf(n, ids);
        var opted = cur ? (m.optedIn || []).slice() : null;
        if (cur && mine && ids.indexOf(mine) >= 0 && opted.indexOf(mine) < 0) opted.push(mine);
        return { teams: ids, gameId: gid, optedIn: opted, watched: gid && d.watched && d.watched[gid] ? d.watched[gid].length : 0 };
      })
    };
  }
  function serviceWeek(n) {
    return Promise.all([
      timed(API + '/league/week/' + n + '/optins').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('optins ' + r.status)); }),
      timed(API + '/league/week/' + n + '/release').then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('release ' + r.status)); })
    ]).then(function (both) {
      var o = both[0], rel = both[1];
      return { released: !!rel.released, source: rel.source, matchups: (o.matchups || []).map(function (m) {
        return { teams: m.teams || [], gameId: m.gameId, optedIn: m.from === 'none' ? null : (m.optedIn || []), watched: m.watched || 0 };
      }) };
    });
  }

  function render(data) {
    var weeks = (league.weeks || []).map(function (w) { return w.week; });
    if (weeks.indexOf(league.week) < 0) weeks.push(league.week);
    var note = mode === 'service'
      ? 'Shared with the league through the service. There is no login: anyone who can reach the service can change these.'
      : 'On this device only. Open with ?api= and the service address to share it with the league.';
    view.innerHTML = '<div class="narrow commish">' +
      '<div class="lg-head"><h2>' + esc(tr('Commissioner')) + '</h2><a class="lg-back" href="?">' + esc(tr('Leave')) + '</a></div>' +
      '<p class="commish-note">' + esc(tr(note)) + '</p>' +
      '<div class="lg-weeks" role="group" aria-label="' + esc(tr('Week')) + '">' + weeks.map(function (n) {
        return '<button type="button" data-cweek="' + n + '" aria-pressed="' + (n === week) + '">' + esc(tr('Week ' + n + (n === league.week ? ', now' : ''))) + '</button>';
      }).join('') + '</div>' +
      '<div class="panel commish-release"><div><h3>' + esc(tr('Recap released')) + '</h3><p>' + esc(tr(data.released ? 'Managers can watch this week\'s recap.' : 'Not released: managers wait until it is.')) + '</p></div>' +
        '<button type="button" role="switch" class="commish-switch" aria-checked="' + data.released + '" aria-label="' + esc(tr('Recap released')) + '"><span></span></button></div>' +
      '<ul class="commish-list" role="list">' + data.matchups.map(function (m) {
        var opted = m.optedIn === null ? tr('No opt-in record for this week.')
          : m.optedIn.length ? tr('Opted in: ' + m.optedIn.join(', ')) : tr('Nobody has opted in.');
        return '<li class="panel commish-m"><h3>' + esc(tr(teamName(m.teams[0]) + ' against ' + teamName(m.teams[1]))) + '</h3>' +
          '<p>' + esc(opted) + '</p>' +
          '<p>' + esc(m.gameId ? tr('Watched to the final: ' + m.watched) : tr('No game to watch.')) + '</p></li>';
      }).join('') + '</ul>' +
      '<p class="note is-plain">' + esc(tr('No points are shown here, for any week.')) + '</p></div>';
  }
  function load() {
    if (mode === 'service') {
      serviceWeek(week).then(render, function () {
        mode = 'device';
        render(deviceWeek(week));
      });
    } else render(deviceWeek(week));
  }
  function setRelease(on) {
    if (mode === 'service') {
      timed(API + '/league/week/' + week + '/release', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ released: on }) })
        .then(function (r) { if (!r.ok) throw new Error('release ' + r.status); load(); }, function () { mode = 'device'; setRelease(on); });
      return;
    }
    var d = local();
    d.released = d.released || {};
    d.released[week] = on;
    saveLocal(d);
    load();
  }

  function start() {
    view = document.createElement('section');
    view.className = 'screen commish-screen';
    view.id = 's-commish';
    view.setAttribute('aria-label', tr('Commissioner'));
    var main = document.querySelector('#app main');
    Array.prototype.forEach.call(main.querySelectorAll('.screen'), function (s) { s.hidden = true; });
    main.appendChild(view);
    var tabs = document.getElementById('tabs');
    if (tabs) tabs.hidden = true;
    view.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-cweek], .commish-switch') : null;
      if (!b) return;
      if (b.hasAttribute('data-cweek')) { week = Number(b.getAttribute('data-cweek')); load(); }
      else setRelease(b.getAttribute('aria-checked') !== 'true');
    });
    // The app's own screens stay out of the way while the commissioner view is open.
    window.addEventListener('hashchange', function () { Array.prototype.forEach.call(main.querySelectorAll('.screen'), function (s) { s.hidden = s !== view; }); });
    load();
  }

  fetch('data/league.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (!d || typeof d.week !== 'number') return;
    league = d;
    week = d.week;
    var all = (d.matchups || []).slice();
    (d.weeks || []).forEach(function (w) { all = all.concat(w.matchups || []); });
    all.forEach(function (m) { (m.teams || []).forEach(function (t) { names[t.id] = t.full; }); });
    start();
  }).catch(function () { /* without the league file there is nothing to show */ });

  window.FR_COMMISH = { get mode() { return mode; }, get week() { return week; }, reload: load };
})();
