// Plays the real games in the real app and takes screenshots at the moments the pitch
// graphics need: scores hidden, a touchdown, the final board, the recap, the plays feed
// with a "why this play" card open, and a soccer goal.
// Run from the repository root:  node design/src/capture-game.js <out dir>
// Nothing here changes the app. Speed is raised through the app's own speed setting.
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
  const shot = (page, name) => page.screenshot({ path: path.join(out, name + '.png') });

  async function football(tag, viewport, scale) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', e => log.push(tag + ' pageerror ' + e.message));
    await p.goto(url('index.html', '?intro=0&speed=2'));
    await p.waitForTimeout(900);
    const skip = await p.$('.walk-skip'); if (skip) await skip.click();
    await p.evaluate(() => { location.hash = '#matchup'; });
    await p.waitForTimeout(400);
    const optin = await p.$('.optin .cta'); if (optin) await optin.click();
    await p.waitForTimeout(400);
    await shot(p, tag + '-matchup-sealed');
    // Note every result and the final, so the shots can be timed.
    await p.evaluate(() => {
      window.__cap = { td: 0, results: 0, final: false, last: '' };
      FF_GAME.on(function (type, data) {
        if (type === 'result' && data && data.res) { window.__cap.results++; window.__cap.last = data.res.text || ''; if (data.res.td) window.__cap.td++; }
        if (type === 'final') window.__cap.final = true;
      });
    });
    await (await p.$('.actions .cta')).click();
    await p.waitForTimeout(5000);
    await shot(p, tag + '-game-kickoff');
    // Run fast to the first touchdown, then drop to normal speed to catch the call on screen.
    await p.evaluate(() => { window.__ff.speed = 12; });
    let seen = 0, tdShots = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 240000) {
      const c = await p.evaluate(() => window.__cap);
      if (c.final) break;
      if (c.td > seen) {
        seen = c.td;
        if (tdShots < 2) {
          tdShots++;
          await p.evaluate(() => { window.__ff.speed = 1; });
          await p.waitForTimeout(350); await shot(p, tag + '-game-td' + tdShots + 'a');
          await p.waitForTimeout(900); await shot(p, tag + '-game-td' + tdShots + 'b');
          await p.waitForTimeout(1200); await shot(p, tag + '-game-td' + tdShots + 'c');
          log.push(tag + ' touchdown ' + tdShots + ': ' + c.last);
          await p.evaluate(() => { window.__ff.speed = 12; });
        }
      }
      if (c.results === 30 && tdShots > 0) { await p.evaluate(() => { window.__ff.speed = 1; }); await p.waitForTimeout(2500); await shot(p, tag + '-game-mid'); await p.evaluate(() => { window.__ff.speed = 12; }); }
      await p.waitForTimeout(120);
    }
    const c = await p.evaluate(() => window.__cap);
    log.push(tag + ' final reached: ' + c.final + ', results ' + c.results + ', touchdowns ' + c.td);
    await p.waitForTimeout(2500);
    await shot(p, tag + '-game-final');
    // Leave the game the way a viewer does, then walk the screens.
    const close = await p.$('#closeGame');
    if (close && await close.isVisible()) await close.click(); else await p.mouse.click(viewport.width / 2, viewport.height / 2);
    await p.waitForTimeout(1200);
    for (const t of ['recap', 'matchup', 'lineups', 'plays', 'league']) {
      await p.evaluate(h => { location.hash = '#' + h; }, t);
      await p.waitForTimeout(700);
      if (t === 'plays') {
        const why = await p.$('details.why summary');
        if (why) { await why.click(); await p.waitForTimeout(400); await why.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -140)); await p.waitForTimeout(200); }
        else log.push(tag + ' no why card found');
      }
      await shot(p, tag + '-final-' + t);
    }
    // The recap is long: keep one full-page picture of it too.
    await p.evaluate(() => { location.hash = '#recap'; });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(out, tag + '-final-recap-full.png'), fullPage: true });
    await ctx.close();
  }

  async function soccer(tag, viewport, scale) {
    const ctx = await b.newContext({ viewport, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', e => log.push(tag + ' pageerror ' + e.message));
    await p.goto(url('soccer/index.html'));
    await p.waitForTimeout(900);
    const optin = await p.$('.optin .cta'); if (optin) await optin.click();
    await p.waitForTimeout(300);
    await p.evaluate(() => {
      window.__cap = { goals: 0, results: 0, final: false, last: '' };
      SC_GAME.on(function (type, data) {
        if (type === 'result' && data && data.res) { window.__cap.results++; window.__cap.last = data.res.text || ''; if (data.res.goal) window.__cap.goals++; }
        if (type === 'final') window.__cap.final = true;
      });
    });
    const watch = await p.$('.actions .cta');
    if (!watch) { log.push(tag + ' no watch button'); await ctx.close(); return; }
    await watch.click();
    await p.waitForTimeout(6000);
    await shot(p, tag + '-match-kickoff');
    await p.evaluate(() => { window.__sc.speed = 10; });
    let seen = 0, goalShots = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 200000) {
      const c = await p.evaluate(() => window.__cap);
      if (c.final) break;
      if (c.goals > seen) {
        seen = c.goals;
        if (goalShots < 2) {
          goalShots++;
          await p.evaluate(() => { window.__sc.speed = 1; });
          await p.waitForTimeout(400); await shot(p, tag + '-match-goal' + goalShots + 'a');
          await p.waitForTimeout(1500); await shot(p, tag + '-match-goal' + goalShots + 'b');
          log.push(tag + ' goal ' + goalShots + ': ' + c.last);
          await p.evaluate(() => { window.__sc.speed = 10; });
        }
      }
      await p.waitForTimeout(120);
    }
    const c = await p.evaluate(() => window.__cap);
    log.push(tag + ' final reached: ' + c.final + ', results ' + c.results + ', goals ' + c.goals);
    await p.waitForTimeout(2500);
    await shot(p, tag + '-match-final');
    await ctx.close();
  }

  await football('phone', { width: 390, height: 844 }, 2);
  await football('laptop', { width: 1440, height: 900 }, 1);
  await soccer('phone-soccer', { width: 390, height: 844 }, 2);
  await b.close();
  console.log(log.join('\n'));
})();
