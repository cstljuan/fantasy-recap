// Pixel art helpers for the design assets. Plain Node, no dependencies.
// A drawing is a list of strings, one character per pixel, '.' is empty.
// A palette maps each character to a color.
'use strict';

// Mirror a left half into a full, symmetric row.
function mirror(half) {
  return half.map(function (r) { return r + r.split('').reverse().join(''); });
}

// Replace rows by index: patch(rows, { 7: '....', 8: '....' }).
function patch(rows, changes) {
  return rows.map(function (r, i) { return changes[i] !== undefined ? changes[i] : r; });
}

// One SVG path per color, horizontal runs merged, so the file stays small.
function paths(rows, palette) {
  var by = {};
  rows.forEach(function (row, y) {
    var x = 0;
    while (x < row.length) {
      var ch = row.charAt(x);
      if (ch === '.' || ch === ' ') { x++; continue; }
      var x0 = x;
      while (x < row.length && row.charAt(x) === ch) x++;
      if (!palette[ch]) throw new Error('No color for "' + ch + '" in row ' + y);
      (by[ch] = by[ch] || []).push('M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z');
    }
  });
  return Object.keys(by).map(function (ch) {
    return '<path fill="' + palette[ch] + '" d="' + by[ch].join('') + '"/>';
  }).join('');
}

function size(rows) {
  var w = 0;
  rows.forEach(function (r) { if (r.length > w) w = r.length; });
  return { w: w, h: rows.length };
}

// A complete SVG. scale is the size of one pixel. bg is an optional background color,
// pad is empty pixels around the drawing.
function svg(rows, palette, opts) {
  opts = opts || {};
  var s = size(rows), scale = opts.scale || 8, pad = opts.pad || 0;
  var W = s.w + pad * 2, H = s.h + pad * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (W * scale) + '" height="' + (H * scale) +
    '" viewBox="' + (-pad) + ' ' + (-pad) + ' ' + W + ' ' + H + '" shape-rendering="crispEdges">' +
    (opts.bg ? '<rect x="' + (-pad) + '" y="' + (-pad) + '" width="' + W + '" height="' + H + '" fill="' + opts.bg + '"/>' : '') +
    paths(rows, palette) + '</svg>';
}

module.exports = { mirror: mirror, patch: patch, paths: paths, size: size, svg: svg };
