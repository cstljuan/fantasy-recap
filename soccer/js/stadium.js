// The stadium, drawn once into an offscreen canvas: stands, boards, grass and
// lines. One scale for both directions, so circles stay round. Everything is
// snapped to a 2 pixel grid to match the sprites.
(function (root) {
  'use strict';

  var LEN = 105, WID = 68;
  var RUN = 4;        // grass between the lines and the boards, meters
  var BOARD = 1;      // advertising boards, meters
  var STAND = 7;      // crowd, meters

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function rgb(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  function build(teams, S, Font) {
    var M = RUN + BOARD + STAND;                    // margin around the pitch, meters
    var W = Math.round((WID + 2 * M) * S), H = Math.round((LEN + 2 * M) * S);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var rnd = mulberry32(90210);
    function X(x) { return (x + M) * S; }
    function Y(y) { return (y + M) * S; }
    function snap(v) { return Math.round(v / 2) * 2; }

    // ---- stands and grass are written pixel by pixel into one ImageData, in 2x2 blocks
    var img = g.createImageData(W, H), data = img.data;
    function put(x, y, col) {
      for (var j = 0; j < 2; j++) for (var i = 0; i < 2; i++) {
        var o = ((y + j) * W + (x + i)) * 4;
        data[o] = col[0]; data[o + 1] = col[1]; data[o + 2] = col[2]; data[o + 3] = 255;
      }
    }
    // Stands: rows of fans, home colors on the west side, away on the east.
    var c0 = teams[0].colors, c1 = teams[1].colors;
    var fans0 = [hex(c0.shirt), hex(c0.trim), hex(c0.shirt), [42, 45, 48]], fans1 = [hex(c1.shirt), hex(c1.trim), hex(c1.shirt), [42, 45, 48]];
    var neutral = [[58, 61, 64], [90, 86, 80], [37, 40, 43], [107, 98, 88], [29, 32, 35]];
    var EMPTY = [16, 18, 20], AISLE = [27, 30, 33], SEAT = [22, 25, 27];
    var sx0 = X(-RUN - BOARD), sx1 = X(WID + RUN + BOARD), sy0 = Y(-RUN - BOARD), sy1 = Y(LEN + RUN + BOARD);
    for (var y = 0; y < H; y += 2) {
      for (var x = 0; x < W; x += 2) {
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

    // ---- grass: mowing bands across, faint bands along, fine noise, wear, stand shadow
    var A = [47, 117, 57], B = [41, 106, 50], WEAR = [96, 108, 62];
    var gx0 = X(-RUN), gx1 = X(WID + RUN), gy0 = Y(-RUN), gy1 = Y(LEN + RUN);
    function wear(mx, my) {
      var w = 0;
      // Goalmouths and penalty spots.
      [0, LEN].forEach(function (ey) {
        var dy = Math.abs(my - ey), dx = Math.abs(mx - WID / 2);
        if (dy < 7 && dx < 6) w = Math.max(w, (1 - dy / 7) * (1 - dx / 6));
        var sy = ey === 0 ? 11 : LEN - 11, ds = Math.hypot(mx - WID / 2, my - sy);
        if (ds < 1.6) w = Math.max(w, 1 - ds / 1.6);
      });
      var dc = Math.hypot(mx - WID / 2, my - LEN / 2);
      if (dc < 3) w = Math.max(w, 0.7 * (1 - dc / 3));
      return w;
    }
    for (var py = gy0; py < gy1; py += 2) {
      var my = py / S - M, band = Math.floor((my + 21) / (LEN / 20)) % 2;
      for (var px = gx0; px < gx1; px += 2) {
        var mx = px / S - M;
        var col = band ? B : A;
        if (Math.floor((mx + 17) / (WID / 8)) % 2) col = [col[0] + 3, col[1] + 4, col[2] + 3];
        var n = (rnd() - 0.5) * 6;
        col = [col[0] + n, col[1] + n * 1.4, col[2] + n];
        var w = wear(mx, my);
        if (w > 0 && rnd() < w * 0.9) col = mix(col, WEAR, 0.35 + rnd() * 0.3);
        // Shadow of the west stand, with a dithered edge.
        var sh = 9 + Math.sin(my * 0.05) * 1.5;
        if (mx < sh - 1 || (mx < sh + 1 && rnd() < (sh + 1 - mx) / 2)) col = [col[0] * 0.78, col[1] * 0.8, col[2] * 0.86];
        put(px, py, col);
      }
    }

    g.putImageData(img, 0, 0);

    // ---- boards
    var c0b = teams[0].colors, c1b = teams[1].colors;
    var bx0 = X(-RUN - BOARD), bx1 = X(WID + RUN), by0 = Y(-RUN - BOARD), by1 = Y(LEN + RUN), bt = BOARD * S;
    g.fillStyle = '#0b0c0d';
    g.fillRect(bx0, by0, bx1 + bt - bx0, bt); g.fillRect(bx0, by1, bx1 + bt - bx0, bt);
    g.fillRect(bx0, by0, bt, by1 + bt - by0); g.fillRect(bx1, by0, bt, by1 + bt - by0);
    var words = [[teams[0].name.toUpperCase(), c0b.trim], ['FANTASY RECAP', '#ffc21a'], [teams[1].name.toUpperCase(), c1b.trim]];
    function boardRun(len, drawAt) {
      var pos = 6, i = 0;
      while (pos < len - 10) {
        var w = words[i % words.length], tw = Font.width(w[0], 1, 1);
        if (pos + tw > len - 6) break;
        drawAt(pos, w);
        pos += tw + 22; i++;
      }
    }
    var ty = Math.round((bt - 7) / 2);
    boardRun(bx1 + bt - bx0, function (p, w) {
      Font.draw(g, w[0], bx0 + p, by0 + ty, { color: w[1], track: 1 });
      Font.draw(g, w[0], bx0 + p, by1 + ty, { color: w[1], track: 1 });
    });
    // Side boards read along the touchline, rotated.
    boardRun(by1 - by0, function (p, w) {
      g.save(); g.translate(bx0 + ty, by0 + p); g.rotate(Math.PI / 2); g.translate(0, -7);
      Font.draw(g, w[0], 0, 0, { color: w[1], track: 1 }); g.restore();
      g.save(); g.translate(bx1 + bt - ty, by1 - p); g.rotate(-Math.PI / 2); g.translate(0, -7);
      Font.draw(g, w[0], 0, 0, { color: w[1], track: 1 }); g.restore();
    });

    // ---- lines
    var LINE = 'rgba(238,240,230,0.92)';
    g.fillStyle = LINE;
    function hline(x0, x1, y) { var yy = snap(Y(y)) - 1; g.fillRect(snap(X(x0)) - 1, yy, snap(X(x1)) - snap(X(x0)) + 2, 2); }
    function vline(x, y0, y1) { var xx = snap(X(x)) - 1; g.fillRect(xx, snap(Y(y0)) - 1, 2, snap(Y(y1)) - snap(Y(y0)) + 2); }
    function dot(x, y, r) { g.fillRect(snap(X(x)) - r, snap(Y(y)) - r, 2 * r, 2 * r); }
    function arc(cx, cy, r, a0, a1) {
      var step = 1 / (r * S * 1.5), last = '';
      for (var t = a0; t <= a1 + 1e-9; t += step) {
        var px = snap(X(cx + r * Math.cos(t))) - 1, py = snap(Y(cy + r * Math.sin(t))) - 1, key = px + ',' + py;
        if (key !== last) { g.fillRect(px, py, 2, 2); last = key; }
      }
    }
    hline(0, WID, 0); hline(0, WID, LEN); vline(0, 0, LEN); vline(WID, 0, LEN); hline(0, WID, LEN / 2);
    [0, LEN].forEach(function (ey) {
      var s = ey ? -1 : 1;
      [[40.32, 16.5], [18.32, 5.5]].forEach(function (b) {
        var x0 = WID / 2 - b[0] / 2, x1 = WID / 2 + b[0] / 2, yy = ey + s * b[1];
        vline(x0, Math.min(ey, yy), Math.max(ey, yy)); vline(x1, Math.min(ey, yy), Math.max(ey, yy)); hline(x0, x1, yy);
      });
      dot(WID / 2, ey + s * 11, 2);
    });
    arc(WID / 2, LEN / 2, 9.15, 0, Math.PI * 2);
    dot(WID / 2, LEN / 2, 2);
    var pa = Math.acos(5.5 / 9.15);
    arc(WID / 2, 11, 9.15, Math.PI / 2 - pa, Math.PI / 2 + pa);
    arc(WID / 2, LEN - 11, 9.15, -Math.PI / 2 - pa, -Math.PI / 2 + pa);
    arc(0, 0, 1, 0, Math.PI / 2); arc(WID, 0, 1, Math.PI / 2, Math.PI);
    arc(0, LEN, 1, -Math.PI / 2, 0); arc(WID, LEN, 1, Math.PI, Math.PI * 1.5);

    // ---- goals: net seen from above, posts and crossbar
    [0, LEN].forEach(function (ey) {
      var s = ey ? 1 : -1, x0 = snap(X(WID / 2 - 3.66)), x1 = snap(X(WID / 2 + 3.66));
      var yl = snap(Y(ey)), yb = snap(Y(ey + s * 2.2)), top = Math.min(yl, yb), h = Math.abs(yb - yl);
      g.fillStyle = 'rgba(10,12,12,0.35)'; g.fillRect(x0, top, x1 - x0, h);
      g.fillStyle = 'rgba(235,235,228,0.45)';
      for (var nx = x0; nx <= x1; nx += 4) g.fillRect(nx, top, 1, h);
      for (var ny = top; ny <= top + h; ny += 4) g.fillRect(x0, ny, x1 - x0, 1);
      g.fillStyle = '#f2f2ec';
      g.fillRect(x0 - 2, top, 2, h); g.fillRect(x1, top, 2, h);
      g.fillRect(x0 - 2, yb - (s > 0 ? 2 : 0), x1 - x0 + 4, 2);
      g.fillRect(x0 - 3, yl - 2, 4, 4); g.fillRect(x1 - 1, yl - 2, 4, 4);
    });

    // ---- corner flags
    [[0, 0], [WID, 0], [0, LEN], [WID, LEN]].forEach(function (p) {
      var fx = snap(X(p[0])), fy = snap(Y(p[1]));
      g.fillStyle = '#d8d8d0'; g.fillRect(fx - 1, fy - 10, 2, 10);
      g.fillStyle = '#ffc21a'; g.fillRect(fx + 1, fy - 10, 6, 4);
      g.fillStyle = '#c9201f'; g.fillRect(fx + 1, fy - 10, 2, 2); g.fillRect(fx + 3, fy - 8, 2, 2); g.fillRect(fx + 5, fy - 10, 2, 2);
    });

    return { canvas: c, W: W, H: H, M: M, S: S };
  }

  root.SC_STADIUM = { build: build, LEN: LEN, WID: WID };
})(window);
