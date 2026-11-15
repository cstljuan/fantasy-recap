// Plays the football game to the final at high speed, then takes pictures of the film room
// (drive chart and the play caller's odds) at phone and laptop size.
// Run from the repository root:  node design/src/capture-film.js <out dir>
'use strict';
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const repo = path.join(__dirname, '..', '..');
  const out = process.argv[2] || path.join(repo, 'design', 'pitch', 'shots');
  require('fs').mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [tag, viewport, scale] of [['phone', { width: 390, height: 844 }, 2], ['laptop', { width: 1440, height: 900 }, 1]]) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    await p.goto('file://' + path.join(repo, 'index.html') + '?intro=0&speed=40');
    await p.waitForTimeout(900);
    const skip = await p.$('.walk-skip'); if (skip) await skip.click();
    await p.evaluate(() => { location.hash = '#matchup'; });
    await p.waitForTimeout(400);
    await p.evaluate(() => { window.__final = false; FF_GAME.on(function (t) { if (t === 'final') window.__final = true; }); });
    await (await p.$('.actions .cta')).click();
    await p.waitForFunction(() => window.__final, null, { timeout: 120000 });
    await p.waitForTimeout(1500);
    const close = await p.$('#closeGame');
    if (close && await close.isVisible()) await close.click(); else await p.mouse.click(viewport.width / 2, viewport.height / 2);
    await p.waitForTimeout(1000);
    await p.evaluate(() => { location.hash = '#film'; });
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(out, tag + '-film.png') });
    await p.screenshot({ path: path.join(out, tag + '-film-full.png'), fullPage: true });
    const why = await p.$('.film-why');
    if (why) { await why.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, 120)); await p.waitForTimeout(300); await p.screenshot({ path: path.join(out, tag + '-film-why.png') }); await why.screenshot({ path: path.join(out, tag + '-why-card.png') }); }
    else console.log(tag + ': no why card in the film room');
    await ctx.close();
  }
  await b.close();
  console.log('done');
})();
