// The stadium crowd for both sports, on top of the broadcast sound in js/audio.js (Noah's),
// asked by Peyton:
//   - background noise at all times: while the game view is open the crowd bed is kept going
//     between plays, through half time and after the final, not only at each snap;
//   - a score (touchdown, field goal, goal) gets a loud cheer and hard clapping;
//   - an incomplete pass or a penalty (football), a foul, a penalty given away or an offside
//     (soccer) gets boos.
// It only calls FF_AUDIO.play with sound names js/audio.js already has, so mute, volume, captions
// and the voice ducking stay Noah's. FF_AUDIO.claim keeps it from booing on top of js/audio.js.
// Loaded by js/app.js: into the app for football, into the soccer frame for soccer.
(function () {
  'use strict';
  var soccer = !window.FF_GAME && !!window.SC_GAME;
  var G = window.FF_GAME || window.SC_GAME;
  if (!G || typeof G.on !== 'function' || window.FR_STADIUM_SOUND) return;

  function A() { var a = window.FF_AUDIO; return a && typeof a.play === 'function' ? a : null; }
  function open() { return G.active !== false && G.mode !== 'ready' && !G.seeking; }
  var played = [];
  function play(name) {
    var a = A();
    if (!a || !open()) return;
    played.push(name);
    try { a.play(name); } catch (err) { /* sound is optional */ }
  }
  function later(name, ms) { setTimeout(function () { play(name); }, ms); }
  // True when this module may play a sound of that kind now; js/audio.js then skips its own.
  function claim(kind, secs) { var a = A(); return !a || typeof a.claim !== 'function' || a.claim(kind, secs); }

  // Background: the bed fades out by itself after 40 quiet seconds and stops at half time and at
  // the final; asking for it every 10 seconds, and again after those breaks, keeps it going.
  function keepCrowd() { if (open()) play('crowd_murmur'); }
  setInterval(keepCrowd, 10000);

  function cheer(loud) {
    // js/audio.js already roars (and claps later); this adds a cheer and claps right away.
    if (loud) play('crowd_roar');
    later('crowd_cheer', 300);
    later('crowd_clap', 900);
    later('crowd_clap', 2600);
  }
  function boo() { if (claim('boo', 1.5)) later('crowd_boo', 250); }

  G.on(function (type, d) {
    if (type === 'start') { later('crowd_murmur', 3500); return; }
    if (type === 'half' || type === 'final') { later('crowd_murmur', 2500); return; }
    if (type !== 'result' || !d || !d.res || G.seeking) return;
    var res = d.res, e = res.e || {};
    if (soccer) {
      if (res.goal && !res.disallowed) cheer(false);
      else if (!res.card && (res.kind === 'foul' || res.kind === 'offside')) boo();
      return;
    }
    if (res.td) cheer(false);
    else if (e.t === 'fg' && e.good) cheer(true);
    else if (e.t === 'inc' || e.t === 'pen') boo();
  });

  window.FR_STADIUM_SOUND = { get sounds() { return played.slice(); } };
})();
