// Watch party: one game on a laptop or TV, phones as remotes. Loaded by js/app.js.
//   Host:   open the app with ?party=host. It shows a four letter room code and does what the
//           remotes ask through FF_GAME (start, hold, seek, speed).
//   Remote: League screen, "Join a watch party", type the code. Play, hold, previous and next
//           play, next big moment, speed, and its own fantasy points if it is not opted in.
// The relay is Ricky's service (server/party.js, ?api=<address>). Without it, BroadcastChannel
// links tabs on the same computer only, and the screen says that phones need the service.
(function () {
  'use strict';
  var G = window.FF_GAME, A = window.__app, D = window.FF_DATA, Rules = window.FF_RULES;
  if (!G || !A) return;
  var TEAMS = D.TEAMS;
  var API = (function () {
    var mm = /[?&]api=([^&]+)/.exec(location.search), u = mm ? decodeURIComponent(mm[1]) : '';
    return /^https?:\/\/[^\s"'<>]+$/.test(u) ? u.replace(/\/+$/, '') : '';
  })();
  var LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  function tr(s) { return window.FR_I18N ? window.FR_I18N.tr(s) : s; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(n) { var v = Math.round(n * 10) / 10; return (v === 0 ? 0 : v).toFixed(1); }
  function timed(url, opts, ms) {
    var ctrl = window.AbortController ? new AbortController() : null, o = opts || {};
    if (ctrl) o.signal = ctrl.signal;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms || 3000);
    return fetch(url, o).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function postJson(url, body, ms) {
    return timed(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }, ms);
  }

  // The game, replayed from the file the app plays: which plays score, which are tagged
  // highlight, and the fantasy points after each play (for a remote's private view).
  var info = null;
  function plays() {
    if (info) return info;
    info = [];
    try {
      var state = Rules.create(TEAMS), pts = [0, 0];
      Rules.flatten(D.SAMPLE_GAME, TEAMS).forEach(function (st) {
        if (st.kind === 'half') { Rules.startHalf(state); return; }
        if (st.kind !== 'play') return;
        var pre = state.score.slice(), r = Rules.apply(state, st.e, st.team);
        (r.fp || []).forEach(function (f) { pts[f.team] += f.pts; });
        info.push({ index: info.length + 1, scored: state.score[0] !== pre[0] || state.score[1] !== pre[1],
          tagged: Array.isArray(st.e.tags) && st.e.tags.indexOf('highlight') >= 0, pts: pts.slice() });
      });
    } catch (err) { info = []; }
    return info;
  }

  // ------------------------------------------------------------- transport
  function newCode() { var c = ''; for (var i = 0; i < 4; i++) c += LETTERS[Math.floor(Math.random() * LETTERS.length)]; return c; }
  function channel(code) { return window.BroadcastChannel ? new BroadcastChannel('fr-party-' + code) : null; }

  // ------------------------------------------------------------------ host
  function host() {
    var code = '', key = '', kind = '', last = 0, bc = null, stopped = false;
    var chip = document.createElement('div');
    chip.className = 'party-chip';
    chip.setAttribute('role', 'status');
    chip.innerHTML = '<b>' + esc(tr('Watch party')) + '</b> <span class="party-code">…</span><span class="party-note"></span>';
    document.body.appendChild(chip);
    function show(note) {
      chip.querySelector('.party-code').textContent = code;
      chip.querySelector('.party-note').textContent = note ? ' ' + tr(note) : '';
    }
    function state() {
      var s = { index: A.model.done, mode: G.held ? 'held' : String(G.mode || 'ready'), speed: window.__ff ? window.__ff.speed : 1 };
      s.speed = Math.max(0.25, Math.min(8, s.speed));
      return s;
    }
    var pending = 0;
    function sendState() {
      clearTimeout(pending);
      pending = setTimeout(function () {
        var s = state();
        if (kind === 'service') postJson(API + '/party/' + code + '/state', { host: key, index: s.index, mode: s.mode, speed: s.speed }).catch(function () { /* next time */ });
        else if (bc) bc.postMessage({ type: 'state', state: s, plays: G.plays });
      }, 150);
    }
    function openGame() { if (!A.inGame) location.hash = 'game'; }
    function run(c) {
      var cmd = c.cmd, v = c.value;
      if (cmd === 'start') {
        if (G.mode === 'ready') G.start();
        if (G.hold) G.hold(false);
        openGame();
      } else if (cmd === 'hold') { if (G.hold) G.hold(true); }
      else if (cmd === 'release') { if (G.hold) G.hold(false); }
      else if (cmd === 'seek' && typeof v === 'number') {
        if (G.seek) { G.seek(v); openGame(); }
      } else if (cmd === 'speed' && typeof v === 'number' && window.__ff) window.__ff.speed = v;
      window.FR_PARTY.lastCommand = c;
      sendState();
    }
    function pollService() {
      if (stopped) return;
      timed(API + '/party/' + code + '/commands?after=' + last + '&wait=20', {}, 25000).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && Array.isArray(j.commands)) j.commands.forEach(function (c) { if (c.n > last) { last = c.n; run(c); } });
        pollService();
      }).catch(function () { setTimeout(pollService, 2000); });
    }
    function useChannel() {
      kind = 'channel';
      code = newCode();
      bc = channel(code);
      if (!bc) { show('No relay: this browser cannot link tabs, and there is no service.'); return; }
      bc.onmessage = function (ev) {
        var d = ev.data || {};
        if (d.type === 'cmd') run(d);
        else if (d.type === 'hello') sendState();
      };
      show('Tabs on this computer only. Phones need the service (?api=).');
    }
    if (API && window.fetch) {
      postJson(API + '/party', {}).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (!j || !j.code) { useChannel(); return; }
        kind = 'service'; code = j.code; key = j.host;
        show('Open the app on a phone and join with this code.');
        pollService(); sendState();
      }).catch(useChannel);
    } else useChannel();
    G.on(function (type) { if (type === 'snap' || type === 'result' || type === 'start' || type === 'reset' || type === 'final') sendState(); });
    setInterval(sendState, 3000);
    return { get code() { return code; }, get kind() { return kind; }, stop: function () { stopped = true; } };
  }

  // ---------------------------------------------------------------- remote
  var panel = null, link = null, hostState = null, hostPlays = 0;
  function openJoin() {
    if (panel) { panel.hidden = false; return; }
    panel = document.createElement('div');
    panel.className = 'party-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-labelledby', 'partyTitle');
    panel.innerHTML = '<div class="party-card">' +
      '<div class="party-top"><h2 id="partyTitle">' + esc(tr('Join a watch party')) + '</h2>' +
        '<button type="button" class="party-x" data-party="close">' + esc(tr('Close')) + '</button></div>' +
      '<form class="party-join"><label for="partyCode">' + esc(tr('Room code')) + '</label>' +
        '<input id="partyCode" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" inputmode="text" pattern="[A-Za-z]{4}">' +
        '<button type="submit" class="cta">' + esc(tr('Join')) + '</button></form>' +
      '<p class="party-msg" role="status"></p>' +
      '<div class="party-remote" hidden>' +
        '<p class="party-now"></p>' +
        '<div class="party-grid">' +
          '<button type="button" class="cta" data-party="start">' + esc(tr('Play')) + '</button>' +
          '<button type="button" class="cta ghost" data-party="hold">' + esc(tr('Hold')) + '</button>' +
          '<button type="button" data-party="prev">' + esc(tr('Previous play')) + '</button>' +
          '<button type="button" data-party="next">' + esc(tr('Next play')) + '</button>' +
          '<button type="button" data-party="moment"></button>' +
        '</div>' +
        '<div class="party-speed" role="group" aria-label="' + esc(tr('Game speed')) + '">' +
          [0.5, 1, 2, 4].map(function (v) { return '<button type="button" data-speed-to="' + v + '">' + v + 'x</button>'; }).join('') + '</div>' +
        '<div class="party-mine"></div>' +
      '</div></div>';
    document.body.appendChild(panel);
    var input = panel.querySelector('#partyCode');
    input.focus();
    panel.querySelector('form').addEventListener('submit', function (ev) { ev.preventDefault(); join(input.value); });
    panel.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-party],[data-speed-to]') : null;
      if (!b) return;
      if (b.getAttribute('data-party') === 'close') { panel.hidden = true; return; }
      if (b.hasAttribute('data-speed-to')) { send('speed', Number(b.getAttribute('data-speed-to'))); return; }
      var a = b.getAttribute('data-party'), done = hostState ? hostState.index : 0, total = hostPlays || plays().length;
      if (a === 'start') send('start');
      else if (a === 'hold') send(hostState && hostState.mode === 'held' ? 'release' : 'hold');
      else if (a === 'prev') send('seek', Math.max(1, done));
      else if (a === 'next') send('seek', Math.min(total, done + 2));
      else if (a === 'moment') { var to = Number(b.getAttribute('data-to')); if (to) send('seek', to); }
    });
    panel.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') panel.hidden = true; });
  }
  function msg(t) { panel.querySelector('.party-msg').textContent = tr(t); }
  function join(raw) {
    var code = String(raw || '').trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) { msg('A room code is four letters.'); return; }
    if (link && link.close) link.close();
    if (API && window.fetch) {
      link = { kind: 'service', code: code, timer: 0 };
      var poll = function () {
        timed(API + '/party/' + code + '/state', {}, 3000).then(function (r) {
          if (r.status === 404) { msg('No room with that code. Check it on the big screen.'); return null; }
          return r.ok ? r.json() : null;
        }).then(function (j) { if (j && j.code) { connected(); if (j.state) update(j.state, 0); } }).catch(function () { msg('The service does not answer.'); });
      };
      poll();
      link.timer = setInterval(poll, 1000);
      link.close = function () { clearInterval(link.timer); };
    } else {
      var bc = channel(code);
      if (!bc) { msg('This browser cannot join without the service.'); return; }
      link = { kind: 'channel', code: code, bc: bc, close: function () { bc.close(); } };
      bc.onmessage = function (ev) { var d = ev.data || {}; if (d.type === 'state') { connected(); update(d.state, d.plays); } };
      bc.postMessage({ type: 'hello' });
      msg('Looking for the room on this computer. Phones need the service (?api=).');
    }
  }
  function connected() {
    if (!panel.querySelector('.party-remote').hidden) return;
    panel.querySelector('.party-remote').hidden = false;
    msg(link.kind === 'service' ? 'Connected to room ' + link.code + '.' : 'Connected to room ' + link.code + ' on this computer.');
  }
  function send(cmd, value) {
    if (!link) return;
    var body = { cmd: cmd, value: value == null ? null : value };
    if (link.kind === 'service') postJson(API + '/party/' + link.code + '/command', body).catch(function () { msg('The service does not answer.'); });
    else link.bc.postMessage({ type: 'cmd', cmd: cmd, value: body.value });
  }
  function update(s, total) {
    hostState = s; if (total) hostPlays = total;
    var all = plays(), n = hostPlays || all.length, done = Math.max(0, Math.min(n, s.index | 0)), masked = A.optin === 'in' && s.mode !== 'final';
    var modeWord = { ready: 'Not started', play: 'Playing', inter: 'Between plays', held: 'Held', final: 'Final' }[s.mode] || s.mode;
    panel.querySelector('.party-now').textContent = tr('Play ' + Math.min(n, done + 1) + ' of ' + n) + ', ' + tr(modeWord) + ', ' + s.speed + 'x';
    panel.querySelector('[data-party=hold]').textContent = tr(s.mode === 'held' ? 'Release' : 'Hold');
    Array.prototype.forEach.call(panel.querySelectorAll('[data-speed-to]'), function (b) { b.setAttribute('aria-pressed', String(Number(b.getAttribute('data-speed-to')) === s.speed)); });
    var m = panel.querySelector('[data-party=moment]'), to = 0;
    for (var i = done + 1; i < all.length; i++) if (masked ? all[i].tagged : all[i].scored) { to = all[i].index; break; }
    m.textContent = tr(masked ? 'Next big moment' : 'Next score');
    m.hidden = !to; m.setAttribute('data-to', String(to || ''));
    // My own fantasy points up to the host's play, unless I opted in to hidden scores.
    var mine = panel.querySelector('.party-mine');
    if (masked) mine.innerHTML = '<p>' + esc(tr('Your score is hidden until the final.')) + '</p>';
    else {
      var p = done > 0 && all[done - 1] ? all[done - 1].pts : [0, 0];
      mine.innerHTML = '<p class="party-pts"><span>' + esc(TEAMS[0].name) + ' <b class="num">' + f1(p[0]) + '</b></span>' +
        '<span>' + esc(TEAMS[1].name) + ' <b class="num">' + f1(p[1]) + '</b></span></p>' +
        '<p class="party-small">' + esc(tr('Fantasy points so far, on this phone only.')) + '</p>';
    }
  }

  var role = /[?&]party=host(&|$)/.test(location.search) ? host() : null;
  window.FR_PARTY = { openJoin: openJoin, join: function (c) { openJoin(); join(c); }, get host() { return role; }, lastCommand: null };
})();
