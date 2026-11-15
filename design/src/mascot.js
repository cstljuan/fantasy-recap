// Tusk, the scorekeeper. A boar, drawn on a 24 by 21 pixel grid, facing the viewer.
// He knows the score and will not tell you. Tough, not cute: heavy brow, small amber
// eyes, two tusks, no smile.
// Run: node design/src/build.js   (writes design/assets/mascot/*.svg)
'use strict';
var px = require('./pixel');

// K outline, D dark fur, F fur, L light fur, S snout, N nostril, T tusk, A eye (amber),
// R red (mouth), W white, G grey (shut eye), Y amber (bristles)
var PALETTE = {
  K: '#0b0d0e', D: '#2a2522', F: '#463c36', L: '#63564c', S: '#9a8674', N: '#1c1614',
  T: '#f3f1ea', A: '#ffc21a', R: '#ff6a5c', W: '#f3f1ea', G: '#8e9597', Y: '#ffc21a'
};

// Left half of the face. The right half is its mirror image.
var HALF = [
  '.KK.......Y.',
  'KDDK....KKYY',
  'KDLDK.KKDDYY',
  'KDLLDKDDFFFY',
  '.KDLDDFFFFFY',
  '.KDDDFFFFFFF',
  '.KDKKFFFFFFF',
  '.KDFKKKKFFFF',
  '.KDFFAAAKFFF',
  '.KDFFAANFFFF',
  '.KDFFFFFFFLL',
  '.KDFTFFFLLSS',
  '.KDTTFFLSSSS',
  '.KDTTKFLSNNS',
  '.KDTTKFLSNNS',
  '.KDDTTKLSSSS',
  '..KDTTKKLSSS',
  '..KDDTTKKKKK',
  '...KDDDDDDDD',
  '....KKDDDDDD',
  '......KKKKKK'
];

function flip(r) { return r.split('').reverse().join(''); }

// Build a face from changes to the left half and to the right half. Both are written
// as left-half rows; the right one is mirrored. The right ear always carries a notch.
function face(left, right) {
  var l = px.patch(HALF, left || {}), r = px.patch(HALF, right || left || {});
  var rows = l.map(function (row, i) { return row + flip(r[i]); });
  rows[2] = rows[2].slice(0, 22) + 'K.';
  return rows;
}

// Five expressions, plus the shut-eye frame used for a blink and for the paused state.
var EXPRESSIONS = {
  // The default. Stern. The score is sealed and he is not talking.
  sealed: face(),
  // Watching the game: brow down, eyes narrowed to one row.
  watching: face({
    6: '.KDFFFFFFFFF',
    7: '.KDKKFFFFFFF',
    8: '.KDFKKKKKFFF',
    9: '.KDFFAANFFFF'
  }),
  // Touchdown or goal: brow up, eyes wide, mouth open.
  roar: face({
    5: '.KDKKKFFFFFF',
    6: '.KDFFKKKFFFF',
    7: '.KDFFAAAFFFF',
    8: '.KDFFANAFFFF',
    9: '.KDFFAAAFFFF',
    16: '..KDTTKKKKKK',
    17: '..KDDTTKRRRR',
    18: '...KDDKRRRRR',
    19: '....KKDKKKKK'
  }),
  // You won. One brow up. As close to a smile as he gets.
  smirk: face({}, {
    5: '.KDKKFFFFFFF',
    6: '.KDFKKKKFFFF',
    7: '.KDFFAAAFFFF',
    8: '.KDFFAANFFFF',
    9: '.KDFFFFFFFFF'
  }),
  // You lost. Flat brow, lamps off. He saw it coming.
  cold: face({
    6: '.KDFFFFFFFFF',
    7: '.KDFFFFFFFFF',
    8: '.KDKKKKKKFFF',
    9: '.KDFFGGGFFFF'
  }),
  // Blink, and the paused state: eyes shut.
  shut: face({
    6: '.KDFFFFFFFFF',
    7: '.KDFFFFFFFFF',
    8: '.KDKKKKKKFFF',
    9: '.KDFFFFFFFFF'
  })
};

module.exports = { PALETTE: PALETTE, EXPRESSIONS: EXPRESSIONS, W: 24, H: 21 };
