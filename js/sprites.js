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

// The football stadium: the soccer stadium (soccer/js/stadium.js) with a football field in it.
// The same build, line for line: one scale for both directions (8 pixels per yard, as soccer has
// 8 per meter), 4 yards of grass, a 1 yard band of advertising boards and 7 yards of stands on
// all four sides, the same fans, aisles and seat rows, the far rows falling into the dark, the
// same mown grass with fine noise and wear, the same shadow of the west stand, the same boards and
// 2 pixel lines. Only the markings are football's: yard lines, hashes, numbers, end zones, posts.
// js/main.js follows the ball with a camera on both axes, as soccer does.
(function (root) {
  'use strict';

  var W = 390;                  // logical canvas width (the same as soccer's)
  var FIELD_W = 53.3;           // yards across
  var LEN = 120;                // end line to end line, yards (end zones included)
  var S = 8;                    // pixels per yard, both directions
  var RUN = 4;                  // grass between the lines and the boards, yards
  var BOARD = 1;                // advertising boards, yards
  var STAND = 7;                // crowd, yards
  var M = RUN + BOARD + STAND;  // margin around the field, yards

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

  // Field coordinates: x in yards across from the left sideline, y in yards from the top goal
  // line (the top end zone runs from -10 to 0, the bottom one from 100 to 110).
  function wx(x) { return (x + M) * S; }
  function wy(y) { return (y + 10 + M) * S; }

  // teams: FF_DATA.TEAMS. CX: the middle of the field across, in yards. Font: FF_FONT.
  function build(teams, CX, Font) {
    var SW = Math.round((FIELD_W + 2 * M) * S), SH = Math.round((LEN + 2 * M) * S);
    SW -= SW % 2; SH -= SH % 2;
    var c = document.createElement('canvas');
    c.width = SW; c.height = SH;
    var g = c.getContext('2d');
    var rnd = mulberry32(90210);
    function X(x) { return wx(x); }
    function Y(y) { return wy(y); }
    function snap(v) { return Math.round(v / 2) * 2; }

    // ---- stands and grass are written pixel by pixel into one ImageData, in 2x2 blocks
    var img = g.createImageData(SW, SH), data = img.data;
    function put(x, y, col) {
      for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) {
        var o = ((y + j) * SW + (x + i)) * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }
    // Stands: rows of fans, home colors on the west side, away on the east.
    var c0 = teams[0].colors, c1 = teams[1].colors;
    var fans0 = [hex(c0.jersey), hex(c0.helmet), hex(c0.jersey), [42, 45, 48]], fans1 = [hex(c1.jersey), hex(c1.helmet), hex(c1.jersey), [42, 45, 48]];
    var neutral = [[58, 61, 64], [90, 86, 80], [37, 40, 43], [107, 98, 88], [29, 32, 35]];
    var EMPTY = [16, 18, 20], AISLE = [27, 30, 33], SEAT = [22, 25, 27];
    var sx0 = X(-RUN - BOARD), sx1 = X(FIELD_W + RUN + BOARD), sy0 = Y(-10 - RUN - BOARD), sy1 = Y(110 + RUN + BOARD);
    var x, y;
    for (y = 0; y < SH; y += 2) {
      for (x = 0; x < SW; x += 2) {
        if (x >= sx0 && x < sx1 && y >= sy0 && y < sy1) continue;
        var west = x < sx0, east = x >= sx1;
        var across = west ? sx0 - x : east ? x - sx1 : y < sy0 ? sy0 - y : y - sy1;
        var along = west || east ? y : x, col;
        if (Math.floor(along / (12 * S)) !== Math.floor((along + 4) / (12 * S))) col = AISLE;
        else if (across % 6 === 4) col = SEAT;
        else {
          var r = rnd(), pal = west ? fans0 : east ? fans1 : neutral;
          col = r < 0.28 ? EMPTY : r < 0.72 ? pal[Math.floor(rnd() * pal.length)] : neutral[Math.floor(rnd() * neutral.length)];
        }
        // The far rows fall away into the dark.
        var f = 1 - 0.55 * Math.min(1, across / (STAND * S));
        put(x, y, [col[0] * f + 8 * (1 - f), col[1] * f + 9 * (1 - f), col[2] * f + 10 * (1 - f)]);
      }
    }

    // ---- grass: mowing bands across (every 5 yards), faint bands along, fine noise, wear, stand shadow
    var A = [47, 117, 57], B = [41, 106, 50], WEAR = [96, 108, 62];
    var z0 = hex(c0.zone), z1 = hex(c1.zone);
    var gx0 = X(-RUN), gx1 = X(FIELD_W + RUN), gy0 = Y(-10 - RUN), gy1 = Y(110 + RUN);
    function wear(mx, my) {
      // Between the hashes, where the ball is snapped most, and worst in the middle of the field.
      if (my < 0 || my >= 100) return 0;
      var dx = Math.abs(mx - CX);
      return dx < 5 ? (1 - dx / 5) * (0.5 + 0.35 * (1 - Math.abs(my - 50) / 50)) : 0;
    }
    for (var py = gy0; py < gy1; py += 2) {
      var my = py / S - M - 10, band = Math.floor((my + 100) / 5) % 2;
      for (var px = gx0; px < gx1; px += 2) {
        var mx = px / S - M;
        var colr = band ? B : A;
        var inField = mx >= 0 && mx < FIELD_W && my >= -10 && my < 110;
        if (inField && (my < 0 || my >= 100)) colr = mix(my < 0 ? z0 : z1, A, 0.18);
        if (Math.floor((mx + 17) / (FIELD_W / 8)) % 2) colr = [colr[0] + 3, colr[1] + 4, colr[2] + 3];
        var n = (rnd() - 0.5) * 6;
        colr = [colr[0] + n, colr[1] + n * 1.4, colr[2] + n];
        var w = wear(mx, my);
        if (w > 0 && rnd() < w * 0.9) colr = mix(colr, WEAR, 0.35 + rnd() * 0.3);
        // Shadow of the west stand, with a dithered edge.
        var sh = 9 + Math.sin(my * 0.05) * 1.5;
        if (mx < sh - 1 || (mx < sh + 1 && rnd() < (sh + 1 - mx) / 2)) colr = [colr[0] * 0.78, colr[1] * 0.8, colr[2] * 0.86];
        put(px, py, colr);
      }
    }

    g.putImageData(img, 0, 0);

    // ---- boards
    var bx0 = X(-RUN - BOARD), bx1 = X(FIELD_W + RUN), by0 = Y(-10 - RUN - BOARD), by1 = Y(110 + RUN), bt = BOARD * S;
    g.fillStyle = '#0b0c0d';
    g.fillRect(bx0, by0, bx1 + bt - bx0, bt); g.fillRect(bx0, by1, bx1 + bt - bx0, bt);
    g.fillRect(bx0, by0, bt, by1 + bt - by0); g.fillRect(bx1, by0, bt, by1 + bt - by0);
    var words = [[teams[0].name.toUpperCase(), c0.helmet], ['FANTASY RECAP', '#ffc21a'], [teams[1].name.toUpperCase(), c1.helmet]];
    function boardRun(len, drawAt) {
      var pos = 6, i = 0;
      while (pos < len - 10) {
        var wd = words[i % words.length], tw = Font.width(wd[0], 1, 1);
        if (pos + tw > len - 6) break;
        drawAt(pos, wd);
        pos += tw + 22; i++;
      }
    }
    var ty = Math.round((bt - 7) / 2);
    boardRun(bx1 + bt - bx0, function (p, wd) {
      Font.draw(g, wd[0], bx0 + p, by0 + ty, { color: wd[1], track: 1 });
      Font.draw(g, wd[0], bx0 + p, by1 + ty, { color: wd[1], track: 1 });
    });
    // Side boards read along the sideline, rotated.
    boardRun(by1 - by0, function (p, wd) {
      g.save(); g.translate(bx0 + ty, by0 + p); g.rotate(Math.PI / 2); g.translate(0, -7);
      Font.draw(g, wd[0], 0, 0, { color: wd[1], track: 1 }); g.restore();
      g.save(); g.translate(bx1 + bt - ty, by1 - p); g.rotate(-Math.PI / 2); g.translate(0, -7);
      Font.draw(g, wd[0], 0, 0, { color: wd[1], track: 1 }); g.restore();
    });

    // ---- lines, 2 pixels, snapped to the grid (soccer's line color)
    var LINE = 'rgba(238,240,230,0.92)';
    g.fillStyle = LINE;
    function hline(x0, x1, yy) { var y2 = snap(Y(yy)) - 1; g.fillRect(snap(X(x0)) - 1, y2, snap(X(x1)) - snap(X(x0)) + 2, 2); }
    function vline(xx, y0, y1) { var x2 = snap(X(xx)) - 1; g.fillRect(x2, snap(Y(y0)) - 1, 2, snap(Y(y1)) - snap(Y(y0)) + 2); }
    // Sidelines and end lines around the whole field, end zones included.
    hline(0, FIELD_W, -10); hline(0, FIELD_W, 110); vline(0, -10, 110); vline(FIELD_W, -10, 110);
    var yl;
    for (yl = 0; yl <= 100; yl += 5) hline(0, FIELD_W, yl);
    // One-yard ticks along the sidelines and the hashes.
    for (yl = 1; yl < 100; yl++) {
      if (yl % 5 === 0) continue;
      var ty2 = snap(Y(yl)) - 1, fl = snap(X(0)), fr = snap(X(FIELD_W)), hl = snap(X(CX - 6)), hr = snap(X(CX + 6));
      g.fillRect(fl, ty2, 6, 2); g.fillRect(fr - 6, ty2, 6, 2);
      g.fillRect(hl - 3, ty2, 6, 2); g.fillRect(hr - 3, ty2, 6, 2);
    }
    // The tries' short marks.
    g.fillRect(snap(X(CX)) - 1, snap(Y(3)) - 1, 2, 2); g.fillRect(snap(X(CX)) - 1, snap(Y(97)) - 1, 2, 2);

    // ---- yard numbers, read along the sidelines, with the arrows toward the nearer goal
    var NUM = 'rgba(238,240,230,0.85)';
    for (yl = 10; yl <= 90; yl += 10) {
      var label = String(50 - Math.abs(50 - yl)), yc = snap(Y(yl)), nx = [snap(X(9)), snap(X(FIELD_W - 9))];
      [0, 1].forEach(function (side) {
        g.save(); g.translate(nx[side], yc); g.rotate(side ? Math.PI / 2 : -Math.PI / 2);
        var tw = Font.width(label, 3, 1);
        Font.draw(g, label, -tw / 2, -10, { unit: 3, color: NUM, track: 1 });
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
      var name = teams[t].name.toUpperCase(), fl2 = snap(X(0)), fr2 = snap(X(FIELD_W)), room = fr2 - fl2 - 24, unit = 6;
      while (unit > 2 && Font.width(name, unit, 1) > room) unit--;
      var yc2 = snap(Y(t === 0 ? -5 : 105)) - Math.round(7 * unit / 2);
      Font.draw(g, name, (fl2 + fr2) / 2, yc2, { unit: unit, color: teams[t].colors.pants, align: 'center', track: 1, shadow: 'rgba(0,0,0,0.35)' });
    });

    // ---- goalposts on the end lines, seen from above, and the orange pylons
    [-10, 110].forEach(function (ey) {
      var yy = snap(Y(ey)), out = ey < 0 ? -1 : 1, l = snap(X(CX - 3.1)), r = snap(X(CX + 3.1));
      g.fillStyle = 'rgba(10,12,12,0.35)'; g.fillRect(l + 2, yy + 2, r - l, 2);
      g.fillStyle = '#f2d21a';
      g.fillRect(l, yy - 1, r - l, 2);
      g.fillRect(l - 2, yy - 3, 4, 6); g.fillRect(r - 2, yy - 3, 4, 6);
      g.fillRect(snap(X(CX)) - 1, yy + (out > 0 ? 0 : -10), 2, 10);   // the gooseneck into the end
      [0, 10].forEach(function (d) {
        var py2 = snap(Y(ey < 0 ? ey + d : ey - d)), fl3 = snap(X(0)), fr3 = snap(X(FIELD_W));
        g.fillStyle = '#ff7a1a';
        g.fillRect(fl3 - 3, py2 - 2, 4, 4); g.fillRect(fr3 - 1, py2 - 2, 4, 4);
      });
    });

    return { canvas: c, W: SW, H: SH, M: M, S: S };
  }

  root.FF_STADIUM = { build: build, W: W, S: S, M: M, FIELD_W: FIELD_W, LEN: LEN, RUN: RUN, BOARD: BOARD, STAND: STAND, wx: wx, wy: wy };
})(window);
