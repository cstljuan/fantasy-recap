// Original pixel-art soccer players, drawn in code. No image files.
// Same grid as the football sprites: 8 by 11 pixels, drawn at twice that size.
(function (root) {
  'use strict';

  // h hair, f face and neck, k arms (gloves on keepers), j shirt, c collar and
  // number in the trim color, p shorts, s socks, b boots
  var FRONT = [
    '..hhhh..',
    '.hhhhhh.',
    '.hffffh.',
    '..ffff..',
    'jjjccjjj',
    'kjjjjjjk',
    'kjjccjjk',
    '.jjjjjj.',
    '.pppppp.'
  ];
  var BACK = [
    '..hhhh..',
    '.hhhhhh.',
    '.hhhhhh.',
    '..ffff..',
    'jjjjjjjj',
    'kjccccjk',
    'kjjccjjk',
    '.jjccjj.',
    '.pppppp.'
  ];
  var LEGS = {
    stand: ['.ss..ss.', '.bb..bb.'],
    a: ['.ss..ss.', '.bb...s.'],
    b: ['.ss..ss.', '.s...bb.']
  };
  var TONES = ['#f1c9a5', '#c68f62', '#8a5a3c'];
  var HAIR = ['#141110', '#3b2416', '#6e4424', '#cfa25a', '#141110'];
  var W = 8, H = 11;
  var cache = {};

  // Arms raised: hands beside the head, nothing at the hips. Used for celebrations.
  function armsUp(rows) {
    return rows.map(function (r, y) {
      if (y <= 3) return 'k' + r.slice(1, 7) + 'k';
      if (y === 5 || y === 6) return '.' + r.slice(1, 7) + '.';
      return r;
    });
  }

  function make(colors, keeper, view, frame, tone, hair, pose) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var shirt = keeper ? colors.keeper : colors.shirt;
    var pal = {
      h: HAIR[hair], f: TONES[tone], k: keeper ? '#eeeeee' : TONES[tone], j: shirt,
      c: keeper ? '#111111' : colors.trim, p: keeper ? '#111111' : colors.shorts,
      s: keeper ? shirt : colors.socks, b: '#0e0e10'
    };
    var top = view === 'b' ? BACK : FRONT;
    if (pose === 'up') top = armsUp(top);
    var rows = top.concat(LEGS[frame]);
    for (var y = 0; y < rows.length; y++) {
      for (var x = 0; x < W; x++) {
        var ch = rows[y].charAt(x);
        if (ch === '.') continue;
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  // view: 'f' facing the camera, 'b' facing away. frame: 'stand', 'a' or 'b'.
  // pose: undefined, or 'up' for arms raised.
  function get(teamIndex, colors, keeper, view, frame, tone, hair, pose) {
    var key = teamIndex + (keeper ? 'k' : 'o') + view + frame + tone + hair + (pose || '');
    if (!cache[key]) cache[key] = make(colors, keeper, view, frame, tone, hair, pose);
    return cache[key];
  }

  root.SC_SPRITES = { get: get, W: W, H: H, HAIRS: HAIR.length };
})(window);
