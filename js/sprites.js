// Original pixel-art players, drawn in code. No image files.
// Each sprite is 8 by 11 pixels and is drawn at twice that size.
(function (root) {
  'use strict';

  // h helmet, s helmet stripe, f face, m face mask, j jersey, n number patch,
  // p pants, b boots, k hands
  var FRONT = [
    '..hhhh..',
    '.hhsshh.',
    '.hhsshh.',
    '.hffffh.',
    '..mmmm..',
    'kjjjjjjk',
    'kjjnnjjk',
    '.jjnnjj.',
    '.pppppp.'
  ];
  var BACK = [
    '..hhhh..',
    '.hhsshh.',
    '.hhsshh.',
    '.hhsshh.',
    '..hhhh..',
    'kjjjjjjk',
    'kjnnnnjk',
    '.jjjjjj.',
    '.pppppp.'
  ];
  var LEGS = {
    stand: ['.pp..pp.', '.bb..bb.'],
    a: ['.pp..pp.', '.bb.....'],
    b: ['.pp..pp.', '.....bb.']
  };
  var TONES = ['#f1c9a5', '#c68f62', '#8a5a3c'];
  var W = 8, H = 11;
  var cache = {};

  function make(colors, view, frame, tone) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var pal = {
      h: colors.helmet, s: colors.stripe, f: TONES[tone], m: '#2b2b33', j: colors.jersey,
      n: '#ffffff', p: colors.pants, b: '#1c1c22', k: TONES[tone]
    };
    var rows = (view === 'b' ? BACK : FRONT).concat(LEGS[frame]);
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
  function get(teamIndex, colors, view, frame, tone) {
    var key = teamIndex + view + frame + tone;
    if (!cache[key]) cache[key] = make(colors, view, frame, tone);
    return cache[key];
  }

  root.FF_SPRITES = { get: get, W: W, H: H };
})(window);
