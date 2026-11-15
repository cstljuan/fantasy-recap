// Takes screenshots of the real app, opened straight from its files, for the pitch graphics.
// Run from the repository root:  node design/src/capture.js <out dir>
// Nothing here changes the app. The shots show exactly what the app draws.
'use strict';
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const repo = path.join(__dirname, '..', '..');
  const out = process.argv[2] || path.join(repo, 'design', 'pitch', 'shots');
  require('fs').mkdirSync(out, { recursive: true });
  const url = (file, q) => 'file://' + path.join(repo, file) + (q || '');
  const b = await chromium.launch();
  const log = [];
  // The first run walkthrough covers the app. Keep a picture of it, then close it.
  async function skipWalk(page, shot) {
    const skip = await page.$('.walk-skip');
    if (!skip) return;
    await page.screenshot({ path: shot });
    await skip.click();
    await page.waitForTimeout(300);
  }

  // Phone, 390 by 844, at 2x.
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', e => log.push('pageerror ' + e.message));
  await p.goto(url('index.html'));
  await p.waitForTimeout(900);
  await skipWalk(p, path.join(out, 'phone-walkthrough.png'));
  const tabs = await p.$$eval('#tabs a', as => as.map(a => a.getAttribute('data-tab')));
  log.push('tabs: ' + tabs.join(','));
  for (const t of tabs) {
    await p.evaluate(h => { location.hash = '#' + h; }, t);
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, 'phone-' + t + '.png') });
  }
  // The buttons on the matchup screen, so later steps can find them.
  await p.evaluate(() => { location.hash = '#matchup'; });
  await p.waitForTimeout(400);
  log.push('buttons: ' + (await p.$$eval('button, a.cta', els => els.filter(e => e.offsetParent).map(e => e.textContent.trim()).slice(0, 40))).join(' | '));

  // Opt in, then watch the game, and take a frame every few seconds.
  const optin = await p.$('.optin .cta');
  if (optin) { await optin.click(); await p.waitForTimeout(400); await p.screenshot({ path: path.join(out, 'phone-matchup-optedin.png') }); }
  const watch = await p.$('.actions .cta');
  if (watch) {
    await watch.click();
    for (let i = 1; i <= 8; i++) {
      await p.waitForTimeout(3500);
      await p.screenshot({ path: path.join(out, 'phone-game-' + i + '.png') });
    }
    log.push('game mode: ' + (await p.evaluate(() => window.FF_GAME && JSON.stringify({ mode: FF_GAME.mode, score: FF_GAME.score }))));
  } else log.push('no watch button found');
  await ctx.close();

  // Laptop, 1440 by 900, at 1x.
  const d = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  d.on('pageerror', e => log.push('pageerror(d) ' + e.message));
  await d.goto(url('index.html'));
  await d.waitForTimeout(900);
  await skipWalk(d, path.join(out, 'laptop-walkthrough.png'));
  for (const t of tabs) {
    await d.evaluate(h => { location.hash = '#' + h; }, t);
    await d.waitForTimeout(400);
    await d.screenshot({ path: path.join(out, 'laptop-' + t + '.png') });
  }
  await d.close();

  // Soccer by itself, phone size.
  const s = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await s.goto(url('soccer/index.html'));
  for (let i = 1; i <= 4; i++) { await s.waitForTimeout(4000); await s.screenshot({ path: path.join(out, 'phone-soccer-' + i + '.png') }); }
  await s.close();

  await b.close();
  console.log(log.join('\n'));
})();
