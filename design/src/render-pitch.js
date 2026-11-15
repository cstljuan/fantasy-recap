// Renders the pitch pages in design/pitch/ to PNG files in pitch/assets/.
// Run from the repository root:  node design/src/render-pitch.js [name ...]
// With no names it renders every page in the list. The size of each picture is set here.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// name (html file in design/pitch and png in pitch/assets), width, height, pixel ratio
const PAGES = [
  ['thumbnail-a', 1500, 1000, 2],
  ['thumbnail-b', 1500, 1000, 2],
  ['thumbnail-c', 1500, 1000, 2],
  ['gallery-01-sealed', 1500, 1000, 2],
  ['gallery-02-the-game', 1500, 1000, 2],
  ['gallery-03-soccer', 1500, 1000, 2],
  ['gallery-04-play-caller', 1500, 1000, 2],
  ['gallery-05-the-reveal', 1500, 1000, 2],
  ['gallery-06-real-and-simulated', 1500, 1000, 2],
  ['video-title-card', 1920, 1080, 1],
  ['architecture', 1920, 1080, 2]
];

(async () => {
  const root = path.join(__dirname, '..', '..');
  const src = path.join(root, 'design', 'pitch');
  const out = path.join(root, 'pitch', 'assets');
  fs.mkdirSync(out, { recursive: true });
  const want = process.argv.slice(2);
  const b = await chromium.launch();
  for (const [name, w, h, ratio] of PAGES) {
    if (want.length && want.indexOf(name) < 0) continue;
    const file = path.join(src, name + '.html');
    if (!fs.existsSync(file)) { console.log('skip (no page yet): ' + name); continue; }
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: ratio });
    const bad = [];
    p.on('requestfailed', r => bad.push(r.url()));
    await p.goto('file://' + file);
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(250);
    const png = path.join(out, name + '.png');
    await p.screenshot({ path: png, clip: { x: 0, y: 0, width: w, height: h } });
    await p.close();
    console.log(name + '.png  ' + (w * ratio) + 'x' + (h * ratio) + '  ' + Math.round(fs.statSync(png).size / 1024) + ' KB' + (bad.length ? '  MISSING: ' + bad.join(', ') : ''));
  }
  await b.close();
})();
