// FR_EXTRAS: the jump bar (B22), rule cards (B21) and share card (B23), written so any game
// view can use them, football or soccer. Self-contained: it brings its own styles (class
// names start with frx-) and reads colors from the host's CSS tokens when it has them.
//
//   var x = FR_EXTRAS.attach({
//     game: window.SC_GAME,          // needs on, plays, mode; seek and hold for the jump bar
//     announcer: window.SC_ANNOUNCER, // optional: explain(kind), explainFor(res)
//     stage: document.querySelector('.stage'), // the element around the canvas (positioned)
//     isOpen: function () { ... },   // optional: true while the game view is on screen
//     isMasked: function () { ... }, // optional: true while scores are hidden
//     moments: function () { ... },  // optional: [{ index, scored, tagged }] for "next score"
//     speed: function () { ... },    // optional: the current speed, rule cards hold only at 2x or slower
//     learnKey: 'fr.learn'           // optional: where the Learn the game switch is saved
//   });
//   x.setVisible(true or false)      // call it where the host shows and hides its Close button
//   x.jumpTo(n)                      // jump to play n (from 1)
//   FR_EXTRAS.shareCard({ title, week, teams: [{ name, color }, ...], score: [a, b],
//     play: { text, players: [...], points, label }, footer, fileName })
//
// After a jump the game says the announcer's catch-up line itself; this file never calls catchUp.
(function () {
  'use strict';

  var CSS = [
    '.frx-bar{position:absolute;left:8px;right:8px;bottom:44px;padding:8px;background:rgba(8,14,10,.88);border:1px solid rgba(255,255,255,.6);color:#fff;line-height:1;z-index:3}',
    '.frx-row{display:flex;gap:8px}',
    '.frx-row button,.frx-learn,.frx-rule button{min-height:44px;min-width:44px;padding:0 6px;background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35);border-radius:2px;cursor:pointer;font:700 12px/1.1 "Courier New",ui-monospace,monospace}',
    '.frx-row button{flex:1 1 0;min-width:0}',
    '.frx-row button:disabled{opacity:.4;cursor:default}',
    '.frx-slide{display:flex;align-items:center;gap:8px;margin-top:8px;font:700 12px/1 "Courier New",ui-monospace,monospace}',
    '.frx-slide span{flex:none;min-width:9.5em}',
    '.frx-slide input{flex:1;min-width:0;height:44px;margin:0;accent-color:#ffc21a}',
    '.frx-learn{position:absolute;right:8px;top:164px;background:rgba(8,14,10,.88);border-color:#fff;z-index:3}',
    '.frx-learn[aria-pressed="true"]{background:#fff;color:#111}',
    '.frx-rule{position:absolute;left:8px;right:8px;bottom:44px;display:flex;align-items:center;gap:12px;padding:12px;background:rgba(8,14,10,.88);border:1px solid rgba(255,255,255,.6);border-left:3px solid #ffc21a;color:#fff;z-index:2}',
    '.frx-rule p{margin:0;flex:1;font:600 13px/1.35 -apple-system,"Segoe UI",Roboto,Arial,sans-serif}',
    '.frx-rule b{color:#ffc21a}',
    '.frx-show .frx-rule{bottom:160px}',
    '.frx-sr{position:absolute!important;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}',
    '[hidden].frx-bar,[hidden].frx-learn,[hidden].frx-rule{display:none!important}'
  ].join('\n');
  function addStyle() {
    if (document.getElementById('frx-style')) return;
    var st = document.createElement('style');
    st.id = 'frx-style';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function getStore(k) { try { return window.localStorage.getItem(k); } catch (err) { return null; } }
  function setStore(k, v) { try { window.localStorage.setItem(k, v); } catch (err) { /* storage may be off */ } }

  // The extras need a game that can jump (seek). Until it has one (soccer before SC_GAME.seek),
  // the jump bar, the Learn the game switch, the rule cards and the share card all stay hidden.
  function ready(G) { return !!G && typeof G.seek === 'function'; }

  function attach(o) {
    addStyle();
    var G = o.game, A = o.announcer || null, stage = o.stage;
    if (!G || !stage) throw new Error('FR_EXTRAS.attach needs a game and a stage');
    var isOpen = o.isOpen || function () { return true; };
    var isMasked = o.isMasked || function () { return false; };
    var speed = o.speed || function () { return 1; };
    var learnKey = o.learnKey || 'fr.learn';
    var done = 0, jumping = false, visible = false, quiet = false;

    // ---------------------------------------------------------- jump bar
    var bar = document.createElement('div');
    bar.className = 'frx-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Move around the game');
    bar.hidden = true;
    bar.innerHTML = '<div class="frx-row"><button type="button" data-frx="prev">Previous play</button>' +
      '<button type="button" data-frx="next">Next play</button><button type="button" data-frx="moment"></button></div>' +
      '<label class="frx-slide"><span></span><input type="range" min="1" step="1" aria-label="Jump to any play"></label>';
    stage.appendChild(bar);
    var slider = bar.querySelector('input'), at = bar.querySelector('.frx-slide span'), moment = bar.querySelector('[data-frx=moment]');
    function plays() { return G.plays || 1; }
    function current() { return Math.min(done + 1, plays()); }
    function nextMoment() {
      var list = typeof o.moments === 'function' ? (o.moments() || []) : [];
      var masked = isMasked();
      for (var i = 0; i < list.length; i++) {
        var x = list[i];
        if (x.index > done + 1 && (masked ? x.tagged : x.scored)) return x.index;
      }
      return 0;
    }
    function mark() {
      slider.max = String(plays());
      if (!dragging && document.activeElement !== slider) slider.value = String(current());   // an iPhone never focuses a slider
      at.textContent = 'Play ' + slider.value + ' of ' + plays();
      slider.setAttribute('aria-valuetext', at.textContent);
      bar.querySelector('[data-frx=prev]').disabled = current() <= 1;
      bar.querySelector('[data-frx=next]').disabled = current() >= plays();
      var n = nextMoment();
      moment.textContent = isMasked() ? 'Next big moment' : 'Next score';
      moment.hidden = !n;
      moment.setAttribute('data-to', String(n || ''));
    }
    function jumpTo(n) {
      if (typeof G.seek !== 'function') return false;
      n = Math.max(1, Math.min(plays(), Math.floor(n)));
      jumping = true;
      var ok;
      try { ok = G.seek(n) !== false; } finally { jumping = false; }
      mark();
      return ok;
    }
    bar.addEventListener('click', function (ev) {
      var b = ev.target.closest ? ev.target.closest('[data-frx]') : null;
      if (!b || b.disabled) return;
      var a = b.getAttribute('data-frx');
      if (a === 'prev') jumpTo(current() - 1);
      else if (a === 'next') jumpTo(current() + 1);
      else if (a === 'moment') { var to = Number(b.getAttribute('data-to')); if (to) jumpTo(to); }
    });
    var dragging = false, dragFrom = 0;
    // A swipe that starts on the slider can fire 'input' and never 'change' on a phone: lifting
    // the finger, a cancelled touch or losing focus also releases the hold.
    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (Number(slider.value) !== dragFrom) jumpTo(Number(slider.value));
      if (typeof G.hold === 'function') G.hold(false);
    }
    ['pointerup', 'pointercancel', 'touchend', 'touchcancel', 'blur'].forEach(function (t) { slider.addEventListener(t, function () { setTimeout(endDrag, 0); }); });
    slider.addEventListener('input', function () {
      if (!dragging && typeof G.hold === 'function') { G.hold(true); dragging = true; dragFrom = current(); }
      at.textContent = 'Play ' + slider.value + ' of ' + plays();
      slider.setAttribute('aria-valuetext', at.textContent);
    });
    slider.addEventListener('change', function () {
      var was = dragging;
      dragging = false;
      jumpTo(Number(slider.value));
      if (was && typeof G.hold === 'function') G.hold(false);
    });
    function onKey(ev) {
      if (!isOpen() || document.activeElement === slider || typeof G.seek !== 'function') return;
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      jumpTo(current() + (ev.key === 'ArrowLeft' ? -1 : 1));
    }
    window.addEventListener('keydown', onKey);

    // -------------------------------------------------------- rule cards
    var learn = getStore(learnKey) === '1', seen = {}, queue = [], timer = 0, holding = false;
    var learnBtn = document.createElement('button');
    learnBtn.type = 'button';
    learnBtn.className = 'frx-learn';
    learnBtn.textContent = 'Learn the game';
    learnBtn.hidden = true;
    learnBtn.setAttribute('aria-pressed', String(learn));
    stage.appendChild(learnBtn);
    var card = document.createElement('div');
    card.className = 'frx-rule';
    card.hidden = true;
    stage.appendChild(card);
    var live = document.createElement('div');
    live.className = 'frx-sr';
    live.setAttribute('aria-live', 'polite');
    stage.appendChild(live);
    learnBtn.addEventListener('click', function () {
      learn = !learn;
      setStore(learnKey, learn ? '1' : '0');
      learnBtn.setAttribute('aria-pressed', String(learn));
      if (!learn) hide(true);
    });
    function explain(kind) {
      if (!A || typeof A.explain !== 'function') return '';
      try { return A.explain(kind) || ''; } catch (err) { return ''; }
    }
    function kindsFor(res) {
      if (A && typeof A.explainFor === 'function') { try { var k = A.explainFor(res); if (Array.isArray(k)) return k; } catch (err) { /* none */ } }
      return [];
    }
    function hold(on) {
      if (typeof G.hold !== 'function') return;
      if (on && !holding && speed() <= 2) { G.hold(true); holding = true; }
      else if (!on && holding) { G.hold(false); holding = false; }
    }
    function showNext() {
      var kind = queue.shift();
      // Nothing left to show: release the hold (the game was left held with no card otherwise).
      if (!kind) { if (card.hidden) hold(false); return; }
      var text = explain(kind);
      if (!text || seen[kind]) { showNext(); return; }
      seen[kind] = true;
      var title = kind.replace(/_/g, ' ');
      card.innerHTML = '<p><b>' + esc(title.charAt(0).toUpperCase() + title.slice(1)) + '.</b> ' + esc(text) + '</p>' +
        '<button type="button" aria-label="Close the rule card">OK</button>';
      card.hidden = false;
      live.textContent = 'Rule: ' + text;
      hold(true);
      clearTimeout(timer);
      timer = setTimeout(function () { hide(false); }, speed() > 2 ? 4000 : 7000);
    }
    function hide(all) {
      clearTimeout(timer);
      card.hidden = true;
      if (all) queue = [];
      if (queue.length) showNext(); else hold(false);
    }
    card.addEventListener('click', function (ev) { ev.stopPropagation(); hide(false); });
    card.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

    G.on(function (type, d) {
      // A seek sends reset and then the skipped plays at once; those get no rule cards.
      if (type === 'reset') { done = 0; seen = {}; hide(true); quiet = true; setTimeout(function () { quiet = false; }, 0); }
      else if (type === 'result') done += 1;
      if (visible) mark();
      if (!learn || jumping || quiet || !isOpen() || !ready(G)) return;
      var res = type === 'half' ? { kind: 'half' } : type === 'result' ? d && d.res : null;
      if (!res) return;
      kindsFor(res).forEach(function (k) { if (!seen[k] && queue.indexOf(k) < 0 && explain(k)) queue.push(k); });
      if (card.hidden && queue.length) showNext();
    });

    function setVisible(on) {
      visible = !!on;
      bar.hidden = !on || !ready(G);
      learnBtn.hidden = !on || !ready(G);
      stage.classList.toggle('frx-show', !bar.hidden);
      if (on) mark();
    }
    return {
      setVisible: setVisible, jumpTo: jumpTo,
      get current() { return current(); }, get learn() { return learn; },
      get rule() { return card.hidden ? '' : card.textContent; },
      closeRule: function () { hide(true); }
    };
  }

  // ------------------------------------------------------------ share card
  function token(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function wrap(g, text, maxW) {
    var words = String(text).split(' '), lines = [], cur = '';
    words.forEach(function (w) { var n = cur ? cur + ' ' + w : w; if (cur && g.measureText(n).width > maxW) { lines.push(cur); cur = w; } else cur = n; });
    if (cur) lines.push(cur);
    return lines;
  }
  function drawCard(o) {
    var W = 1080, H = 1350, P = 72, inner = W - 2 * P;
    var FONT = '"Avenir Next Condensed", "DIN Condensed", "Roboto Condensed", "Arial Narrow", sans-serif';
    var BODY = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    var C = { bg: token('--bg', '#0b0d0e'), panel: token('--panel', '#131617'), text: token('--text', '#f3f1ea'), dim: token('--dim', '#8e9597'), amber: token('--amber', '#ffc21a') };
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d'), teams = o.teams || [], score = o.score || [], play = o.play || null;
    var lead = (teams[0] && teams[0].color) || C.amber;
    g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
    g.fillStyle = lead; g.fillRect(0, 0, W, 14);
    g.fillStyle = C.amber; g.fillRect(P, 92, 22, 22);
    g.fillStyle = C.text; g.font = '700 44px ' + FONT; g.textAlign = 'left';
    g.fillText(String(o.title || 'Fantasy Recap').toUpperCase(), P + 38, 114);
    g.fillStyle = C.dim; g.font = '700 28px ' + BODY; g.textAlign = 'right';
    g.fillText(String(o.week || '').toUpperCase(), W - P, 112);
    teams.slice(0, 2).forEach(function (t, i) {
      var y = 190 + i * 84;
      g.fillStyle = t.color || C.dim; g.fillRect(P, y, 10, 62);
      g.fillStyle = C.text; g.font = '700 56px ' + FONT; g.textAlign = 'left';
      g.fillText(String(t.name || '').toUpperCase(), P + 30, y + 52);
      g.textAlign = 'right'; g.fillText(score[i] == null ? '' : String(score[i]), W - P, y + 52);
    });
    g.fillStyle = C.dim; g.font = '700 26px ' + BODY; g.textAlign = 'left';
    g.fillText('FINAL', P, 388);
    if (play) {
      var y0 = 520;
      g.font = '700 76px ' + FONT;
      var lines = wrap(g, play.text || '', inner - 88).slice(0, 4);
      var h = 150 + lines.length * 84 + 150;
      g.fillStyle = C.panel; g.fillRect(P, y0, inner, h);
      g.fillStyle = lead; g.fillRect(P, y0, 10, h);
      g.fillStyle = C.dim; g.font = '700 26px ' + BODY;
      g.fillText(String(play.label || 'TOP PLAY').toUpperCase(), P + 44, y0 + 62);
      g.fillStyle = C.text; g.font = '700 76px ' + FONT;
      lines.forEach(function (l, i) { g.fillText(l, P + 44, y0 + 150 + i * 84); });
      var py = y0 + 150 + lines.length * 84 + 40;
      g.fillStyle = C.dim; g.font = '600 32px ' + BODY;
      g.fillText((play.players || []).join(', '), P + 44, py);
      if (typeof play.points === 'number') {
        g.fillStyle = C.amber; g.font = '700 120px ' + FONT; g.textAlign = 'right';
        g.fillText((Math.round(play.points * 10) / 10).toFixed(1), W - P - 40, py + 20);
        g.fillStyle = C.dim; g.font = '700 24px ' + BODY;
        g.fillText('FANTASY POINTS', W - P - 40, py + 60);
      }
    }
    g.textAlign = 'left'; g.fillStyle = C.dim; g.font = '600 26px ' + BODY;
    g.fillText(o.footer || 'Sample game. Real names, made-up stats.', P, H - 70);
    return c;
  }
  // Share sheet when the browser can share files, a download otherwise. Calls back with
  // 'shared', 'downloaded' or 'failed'.
  function shareCard(o, cb) {
    var c = drawCard(o), name = o.fileName || 'fantasy-recap-top-play.png';
    cb = cb || function () {};
    c.toBlob(function (blob) {
      if (!blob) { cb('failed'); return; }
      function download() {
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        cb('downloaded');
      }
      var file = null;
      try { file = new File([blob], name, { type: 'image/png' }); } catch (err) { file = null; }
      if (file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: o.title || 'Fantasy Recap' }).then(function () { cb('shared'); },
          function (err) { if (err && err.name === 'AbortError') cb('failed'); else download(); });
      } else download();
    }, 'image/png');
    return c;
  }

  window.FR_EXTRAS = { attach: attach, drawCard: drawCard, shareCard: shareCard, ready: ready };
})();
