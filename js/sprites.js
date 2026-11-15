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

  // Arms raised for celebrations, the same pose as the soccer players.
  function armsUp(rows) {
    return rows.map(function (r, y) {
      if (y >= 1 && y <= 4) return 'k' + r.slice(1, 7) + 'k';
      if (y === 5 || y === 6) return '.' + r.slice(1, 7) + '.';
      return r;
    });
  }

  function make(colors, view, frame, tone, pose) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var pal = {
      h: colors.helmet, s: colors.stripe, f: TONES[tone], m: '#2b2b33', j: colors.jersey,
      n: '#ffffff', p: colors.pants, b: '#1c1c22', k: TONES[tone]
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
  function get(teamIndex, colors, view, frame, tone, pose) {
    var key = teamIndex + view + frame + tone + (pose || '');
    if (!cache[key]) cache[key] = make(colors, view, frame, tone, pose);
    return cache[key];
  }

  root.FF_SPRITES = { get: get, W: W, H: H };
})(window);

// Pixel font for the football view, the same glyphs as the soccer view (soccer/js/font.js),
// so both sports read as one broadcast. Glyphs are 5 by 7 (some narrower); one font pixel is
// `unit` canvas pixels. Rendered strings are cached as small canvases.
(function (root) {
  'use strict';

  var G = {
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
    '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    '1': ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
    '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    '6': ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
    '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    '9': ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
    "'": ['#', '#', '.', '.', '.', '.', '.'],
    '.': ['.', '.', '.', '.', '.', '.', '#'],
    ',': ['..', '..', '..', '..', '..', '.#', '#.'],
    ':': ['.', '#', '.', '.', '.', '#', '.'],
    '-': ['...', '...', '...', '###', '...', '...', '...'],
    '!': ['#', '#', '#', '#', '#', '.', '#'],
    '¡': ['#', '.', '#', '#', '#', '#', '#'],
    '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
    '¿': ['..#..', '.....', '..#..', '.#...', '#....', '#...#', '.###.'],
    '\u00ba': ['###', '#.#', '###', '...', '###', '...', '...'],
    '\u00aa': ['##.', '.##', '###', '...', '###', '...', '...'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    '(': ['.#', '#.', '#.', '#.', '#.', '#.', '.#'],
    ')': ['#.', '.#', '.#', '.#', '.#', '.#', '#.'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
    ' ': ['..', '..', '..', '..', '..', '..', '..']
  };
  var HGT = 7, GAP = 1;
  var cache = {};

  // Accents are dropped (Peña draws as PENA), so any real name renders.
  function clean(str) { return String(str).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase(); }
  function glyph(ch) { return G[ch] || G[ch.toUpperCase()] || G['?']; }

  // Width in canvas pixels of `str` at `unit`, with `track` extra font pixels between letters.
  function width(str, unit, track) {
    var w = 0, s = clean(str);
    for (var i = 0; i < s.length; i++) w += glyph(s.charAt(i))[0].length + (i ? GAP + (track || 0) : 0);
    return w * (unit || 1);
  }

  function render(str, unit, color, track) {
    var key = str + '|' + unit + '|' + color + '|' + (track || 0);
    if (cache[key]) return cache[key];
    var s = clean(str), c = document.createElement('canvas');
    c.width = Math.max(1, width(s, unit, track)); c.height = HGT * unit;
    var g = c.getContext('2d'), x = 0;
    g.fillStyle = color;
    for (var i = 0; i < s.length; i++) {
      var rows = glyph(s.charAt(i));
      for (var y = 0; y < HGT; y++) {
        for (var k = 0; k < rows[y].length; k++) if (rows[y].charAt(k) === '#') g.fillRect((x + k) * unit, y * unit, unit, unit);
      }
      x += rows[0].length + GAP + (track || 0);
    }
    cache[key] = c;
    return c;
  }

  // Draw text with its top at y. align: 'left' | 'center' | 'right'.
  // shadow: a color drawn one unit down and right, for text over the field.
  function draw(g, str, x, y, opt) {
    opt = opt || {};
    var unit = opt.unit || 1, img = render(str, unit, opt.color || '#ffffff', opt.track);
    var dx = opt.align === 'center' ? Math.round(x - img.width / 2) : opt.align === 'right' ? Math.round(x - img.width) : Math.round(x);
    var dy = Math.round(y);
    if (opt.shadow) g.drawImage(render(str, unit, opt.shadow, opt.track), dx + unit, dy + unit);
    g.drawImage(img, dx, dy);
    return img.width;
  }

  root.FF_FONT = { draw: draw, width: width, H: HGT, render: render };
})(window);

// The football stadium, drawn once into an offscreen canvas in the soccer view's style
// (soccer/js/stadium.js): stands full of fans, advertising boards, mown grass and pixel lines,
// all on a 2 pixel grid to match the sprites. The geometry lives here so js/main.js and the
// crowd layer (js/screens/crowd.js) agree on where the field and the stands are.
(function (root) {
  'use strict';

  var W = 390;                  // logical canvas width
  var FIELD_W = 53.3;           // yards across
  var PXX = 5.4, PXY = 12;      // pixels per yard across and along
  var MX = (W - FIELD_W * PXX) / 2;   // field edge from the canvas edge
  var RUN = 14;                 // grass between the sideline and the boards, pixels
  var BOARD = 10;               // advertising boards, pixels
  var PAD = 80;                 // beyond each end line: grass, boards and the end stands
  var END_RUN = 14;
  var LEN = 120 * PXY;          // end line to end line, pixels
  var H = LEN + 2 * PAD;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function snap(v) { return Math.round(v / 2) * 2; }

  // teams: FF_DATA.TEAMS. CX: the middle of the field across, in yards. Font: FF_FONT.
  function build(teams, CX, Font) {
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var rnd = mulberry32(90210);
    function X(yx) { return MX + yx * PXX; }          // yards across -> pixels
    function Y(yd) { return PAD + (yd + 10) * PXY; }  // yards from the top goal line -> pixels (end zone from -10)

    var img = g.createImageData(W, H), data = img.data;
    function put(x, y, col) {
      for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) {
        if (x + i >= W || y + j >= H) continue;
        var o = ((y + j) * W + (x + i)) * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }

    // ---- stands: rows of fans, home colors on the left, away on the right, neutral at the ends
    var c0 = teams[0].colors, c1 = teams[1].colors;
    var fans0 = [hex(c0.jersey), hex(c0.helmet), hex(c0.jersey), [42, 45, 48]];
    var fans1 = [hex(c1.jersey), hex(c1.helmet), hex(c1.jersey), [42, 45, 48]];
    var neutral = [[58, 61, 64], [90, 86, 80], [37, 40, 43], [107, 98, 88], [29, 32, 35]];
    var EMPTY = [16, 18, 20], AISLE = [27, 30, 33], SEAT = [22, 25, 27];
    var sx0 = snap(X(0) - RUN - BOARD), sx1 = snap(X(FIELD_W) + RUN + BOARD), sy0 = PAD - END_RUN - BOARD, sy1 = H - PAD + END_RUN + BOARD;
    var depthSide = Math.max(8, sx0), depthEnd = sy0, y, x;
    for (y = 0; y < H; y += 2) {
      for (x = 0; x < W; x += 2) {
        if (x >= sx0 && x < sx1 && y >= sy0 && y < sy1) continue;
        var west = x < sx0, east = x >= sx1;
        var across = west ? sx0 - x : east ? x - sx1 : y < sy0 ? sy0 - y : y - sy1;
        var along = west || east ? y : x, col;
        if (Math.floor(along / 96) !== Math.floor((along + 4) / 96)) col = AISLE;
        else if (across % 6 === 4) col = SEAT;
        else {
          var r = rnd(), pal = west ? fans0 : east ? fans1 : neutral;
          col = r < 0.28 ? EMPTY : r < 0.72 ? pal[Math.floor(rnd() * pal.length)] : neutral[Math.floor(rnd() * neutral.length)];
        }
        // The far rows fall away into the dark.
        var f = 1 - 0.55 * Math.min(1, across / (west || east ? depthSide : depthEnd));
        put(x, y, [col[0] * f + 8 * (1 - f), col[1] * f + 9 * (1 - f), col[2] * f + 10 * (1 - f)]);
      }
    }

    // ---- grass: mowing bands every five yards, faint bands along, fine noise, wear between
    // the hashes, the end zones in the home team's zone colors, the shadow of the left stand
    var A = [47, 117, 57], B = [41, 106, 50], WEAR = [96, 108, 62];
    var z0 = hex(c0.zone), z1 = hex(c1.zone);
    var gx0 = snap(X(0) - RUN), gx1 = snap(X(FIELD_W) + RUN), gy0 = PAD - END_RUN, gy1 = H - PAD + END_RUN;
    for (y = gy0; y < gy1; y += 2) {
      var yd = (y - PAD) / PXY - 10, band = Math.floor((yd + 100) / 5) % 2;
      for (x = gx0; x < gx1; x += 2) {
        var yx = (x - MX) / PXX, inField = yx >= 0 && yx < FIELD_W && yd >= -10 && yd < 110;
        var colr = band ? B : A;
        if (inField && (yd < 0 || yd >= 100)) colr = mix(yd < 0 ? z0 : z1, A, 0.18);
        if (Math.floor((yx + 40) / (FIELD_W / 6)) % 2) colr = [colr[0] + 3, colr[1] + 4, colr[2] + 3];
        var n = (rnd() - 0.5) * 6;
        colr = [colr[0] + n, colr[1] + n * 1.4, colr[2] + n];
        // Worn turf between the hashes, where the ball is snapped most.
        if (inField && yd >= 0 && yd < 100) {
          var dx = Math.abs(yx - CX), w = dx < 5 ? (1 - dx / 5) * 0.45 : 0;
          if (w > 0 && rnd() < w) colr = mix(colr, WEAR, 0.3 + rnd() * 0.25);
        }
        // Shadow of the left stand, with a dithered edge.
        var sh = 18 + Math.sin(yd * 0.08) * 3, px = x - gx0;
        if (px < sh - 1 || (px < sh + 1 && rnd() < (sh + 1 - px) / 2)) colr = [colr[0] * 0.78, colr[1] * 0.8, colr[2] * 0.86];
        put(x, y, colr);
      }
    }
    g.putImageData(img, 0, 0);

    // ---- boards around the field
    var bx0 = gx0 - BOARD, bx1 = gx1, by0 = gy0 - BOARD, by1 = gy1;
    g.fillStyle = '#0b0c0d';
    g.fillRect(bx0, by0, bx1 + BOARD - bx0, BOARD); g.fillRect(bx0, by1, bx1 + BOARD - bx0, BOARD);
    g.fillRect(bx0, by0, BOARD, by1 + BOARD - by0); g.fillRect(bx1, by0, BOARD, by1 + BOARD - by0);
    var words = [[teams[0].name.toUpperCase(), c0.helmet], ['FANTASY RECAP', '#ffc21a'], [teams[1].name.toUpperCase(), c1.helmet]];
    function boardRun(len, drawAt) {
      var pos = 8, i = 0;
      while (pos < len - 10) {
        var wd = words[i % words.length], tw = Font.width(wd[0], 1, 1);
        if (pos + tw > len - 8) break;
        drawAt(pos, wd);
        pos += tw + 22; i++;
      }
    }
    var ty = Math.round((BOARD - 7) / 2);
    boardRun(bx1 + BOARD - bx0, function (p, wd) {
      Font.draw(g, wd[0], bx0 + p, by0 + ty, { color: wd[1], track: 1 });
      Font.draw(g, wd[0], bx0 + p, by1 + ty, { color: wd[1], track: 1 });
    });
    boardRun(by1 - by0, function (p, wd) {
      g.save(); g.translate(bx0 + ty, by0 + p); g.rotate(Math.PI / 2); g.translate(0, -7);
      Font.draw(g, wd[0], 0, 0, { color: wd[1], track: 1 }); g.restore();
      g.save(); g.translate(bx1 + BOARD - ty, by1 - p); g.rotate(-Math.PI / 2); g.translate(0, -7);
      Font.draw(g, wd[0], 0, 0, { color: wd[1], track: 1 }); g.restore();
    });

    // ---- lines, 2 pixels, snapped to the grid
    var LINE = 'rgba(238,240,230,0.92)';
    var fl = snap(X(0)), fr = snap(X(FIELD_W)), ft = snap(Y(-10)), fb = snap(Y(110));
    g.fillStyle = LINE;
    // The white border around the whole field, end zones included.
    g.fillRect(fl - 4, ft - 4, fr - fl + 8, 4); g.fillRect(fl - 4, fb, fr - fl + 8, 4);
    g.fillRect(fl - 4, ft, 4, fb - ft); g.fillRect(fr, ft, 4, fb - ft);
    var yl;
    for (yl = 0; yl <= 100; yl += 5) {
      var yy = snap(Y(yl));
      g.fillRect(fl, yy - (yl % 100 === 0 ? 2 : 1), fr - fl, yl % 100 === 0 ? 4 : 2);
    }
    // One-yard ticks at the sidelines and on the hashes.
    var hl = snap(X(CX - 6)), hr = snap(X(CX + 6));
    for (yl = 1; yl < 100; yl++) {
      if (yl % 5 === 0) continue;
      var ty2 = snap(Y(yl)) - 1;
      g.fillRect(fl + 2, ty2, 6, 2); g.fillRect(fr - 8, ty2, 6, 2);
      g.fillRect(hl - 3, ty2, 6, 2); g.fillRect(hr - 3, ty2, 6, 2);
    }
    // The two-point tries' short line.
    g.fillRect(snap(X(CX)) - 1, snap(Y(2)) - 1, 2, 2); g.fillRect(snap(X(CX)) - 1, snap(Y(98)) - 1, 2, 2);

    // ---- yard numbers, read along the sidelines like a real field, with the arrows
    var NUM = 'rgba(238,240,230,0.85)';
    for (yl = 10; yl <= 90; yl += 10) {
      var label = String(50 - Math.abs(50 - yl)), yc = snap(Y(yl)), nx = [snap(X(9)), snap(X(FIELD_W - 9))];
      [0, 1].forEach(function (side) {
        g.save(); g.translate(nx[side], yc); g.rotate(side ? Math.PI / 2 : -Math.PI / 2);
        var tw = Font.width(label, 3, 1);
        Font.draw(g, label, -tw / 2, -10, { unit: 3, color: NUM, track: 1 });
        // The arrow points to the nearer goal line.
        if (yl !== 50) {
          var toward = (yl < 50) === (side === 0) ? 1 : -1, ax = toward > 0 ? tw / 2 + 6 : -tw / 2 - 8;
          g.fillStyle = NUM;
          for (var k = 0; k < 3; k++) g.fillRect(ax + (toward > 0 ? k * 2 : -k * 2 + 4), -10 + 3 + k * 2, 2, 10 - k * 4 > 0 ? 10 - k * 4 : 2);
        }
        g.restore();
      });
    }

    // ---- end zones: the team name in big pixel letters
    [0, 1].forEach(function (t) {
      var name = teams[t].name.toUpperCase(), room = fr - fl - 24, unit = 5;
      while (unit > 2 && Font.width(name, unit, 1) > room) unit--;
      var yc = snap(Y(t === 0 ? -5 : 105)) - Math.round(7 * unit / 2);
      Font.draw(g, name, (fl + fr) / 2, yc, { unit: unit, color: teams[t].colors.pants, align: 'center', track: 1, shadow: 'rgba(0,0,0,0.35)' });
    });

    // ---- midfield: a small pixel badge of the app
    var mx = snap(X(CX)), my = snap(Y(50));
    g.fillStyle = 'rgba(11,13,14,0.55)'; g.fillRect(mx - 14, my + 6, 28, 14);
    g.fillStyle = '#ffc21a'; g.fillRect(mx - 14, my + 6, 28, 2);
    Font.draw(g, 'FR', mx, my + 10, { color: '#ffc21a', align: 'center', track: 1 });

    // ---- goalposts on the end lines, seen from above, and the orange pylons
    [-10, 110].forEach(function (ey) {
      var yy = snap(Y(ey)), out = ey < 0 ? -1 : 1, l = snap(X(CX - 3.1)), r = snap(X(CX + 3.1));
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(l + 2, yy + 2, r - l, 2);
      g.fillStyle = '#ffd21a';
      g.fillRect(l, yy - 1, r - l, 2);
      g.fillRect(l - 2, yy - 3, 4, 6); g.fillRect(r - 2, yy - 3, 4, 6);
      g.fillRect(snap(X(CX)) - 1, yy + (out > 0 ? 0 : -8), 2, 8);   // the gooseneck into the end
      [0, 10].forEach(function (d) {
        var py = snap(Y(ey < 0 ? ey + d : ey - d));
        g.fillStyle = '#ff7a1a';
        g.fillRect(fl - 4, py - 2, 4, 4); g.fillRect(fr, py - 2, 4, 4);
      });
    });

    return { canvas: c, W: W, H: H };
  }

  root.FF_STADIUM = { build: build, W: W, H: H, FIELD_W: FIELD_W, PXX: PXX, PXY: PXY, MX: MX, PAD: PAD, RUN: RUN, BOARD: BOARD, END_RUN: END_RUN };
})(window);
