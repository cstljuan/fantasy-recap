// Builds the drawn assets into design/assets/. Run from the repository root:
//   node design/src/build.js
// Everything here is drawn in code. No photos, no outside images.
'use strict';
var fs = require('fs');
var path = require('path');
var px = require('./pixel');
var mascot = require('./mascot');

var OUT = path.join(__dirname, '..', 'assets');
function write(rel, text) {
  var f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, text);
  return rel;
}

var made = [];
Object.keys(mascot.EXPRESSIONS).forEach(function (name) {
  made.push(write('mascot/tusk-' + name + '.svg', px.svg(mascot.EXPRESSIONS[name], mascot.PALETTE, { scale: 8 }) + '\n'));
});

// Optional parts are loaded only when they exist, so this file works while the set grows.
['logo', 'sprites'].forEach(function (part) {
  var f = path.join(__dirname, part + '.js');
  if (fs.existsSync(f)) require(f).build(write).forEach(function (r) { made.push(r); });
});

console.log(made.length + ' files written to design/assets/');
made.forEach(function (r) { console.log('  ' + r); });
