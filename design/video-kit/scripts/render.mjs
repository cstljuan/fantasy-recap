// Code motion graphics renderer: headless Chrome, frame-exact seek, PNG frames piped to ffmpeg.
// usage: node render.mjs <scene> [--shot <id>_plate] [--name x] [--stills 0.5,1.2] [--res 1920] [--master] [--alpha]
//                                [--fps 30000/1001] [--lib engine/a.js,engine/b.js] [--fonts "900 300px Inter,600 40px Inter"]
// Project layout, relative to this file: scenes/<scene>.js, shots/<shot>.js (optional), assets_shots/<shot>/*.png plus layers.json, out/<name>/.
// Review: H.264 at --res (default 1920). --master: 3840 ProRes 422 HQ. --master --alpha: 3840 ProRes 4444 with straight alpha.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const scene = args[0];
const has = n => args.includes('--' + n);
const opt = n => { const i = args.indexOf('--' + n); return i < 0 ? null : (args[i + 1] ?? true); };

const master = has('master'), alpha = has('alpha');
const res = +(opt('res') || (master ? 3840 : 1920));
const W = res, H = Math.round(res * 9 / 16);
const fpsArg = String(opt('fps') || '30000/1001');
const fps = fpsArg.includes('/') ? fpsArg.split('/').reduce((a, b) => +a / +b) : +fpsArg;
const shot = opt('shot');
const name = opt('name') || shot || scene;
const out = path.join(here, 'out', name);
fs.mkdirSync(out, { recursive: true });

// Every PNG in the shot folder becomes st.images.<filename>.
const assets = {};
const dir = path.join(here, shot ? `assets_shots/${shot}` : 'assets');
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.png')) {
  assets[f.replace('.png', '')] = 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', e => { console.error('PAGE ERROR', e.message); process.exit(1); });
await page.setContent('<!doctype html><html><body style="margin:0;background:#000"><canvas id=c></canvas></body></html>');

// Alpha is set before the scene loads, so a scene may read window.ALPHA at load time or at draw time.
if (alpha) await page.addScriptTag({ content: 'window.ALPHA=true;' });
if (shot && fs.existsSync(path.join(here, `assets_shots/${shot}/layers.json`))) {
  await page.addScriptTag({ content: `window.LAYERS=${fs.readFileSync(path.join(here, `assets_shots/${shot}/layers.json`), 'utf8')};` });
}
const libs = opt('lib') ? String(opt('lib')).split(',') : [];
const shotFile = shot && fs.existsSync(path.join(here, `shots/${shot}.js`)) ? [`shots/${shot}.js`] : [];
for (const f of ['stage2d.js', ...libs, ...shotFile, `scenes/${scene}.js`]) await page.addScriptTag({ path: path.join(here, f) });

const fonts = String(opt('fonts') || '900 300px Inter,700 84px Inter,600 40px Inter,500 32px Inter').split(',');
const dur = await page.evaluate(async ([W, H, assets, fonts]) => {
  await Promise.all(fonts.map(f => document.fonts.load(f)));
  window.st = new Stage2D(document.getElementById('c'), W, H);
  await st.load(assets);
  return SCENE.duration;
}, [W, H, assets, fonts]);

// One frame: the scene is a pure function of t, so seeking is exact and any frame can be rendered alone.
const grab = t => page.evaluate(async t => {
  SCENE.draw(st, t);
  const b = await new Promise(r => st.canvas.toBlob(r, 'image/png'));
  const a = new Uint8Array(await b.arrayBuffer());
  let s = '';
  for (let i = 0; i < a.length; i += 32768) s += String.fromCharCode.apply(null, a.subarray(i, i + 32768));
  return btoa(s);
}, t);

const stills = opt('stills');
if (stills) {
  for (const s of String(stills).split(',')) {
    fs.writeFileSync(path.join(out, `still_${(+s).toFixed(2)}.png`), Buffer.from(await grab(+s), 'base64'));
  }
  console.log(out, 'stills', String(stills));
} else {
  const n = Math.round(dur * fps);
  const suffix = master ? (alpha ? '4K_ProRes4444.mov' : '4K_ProRes422HQ.mov') : 'REVIEW_silent.mp4';
  const file = path.join(out, `${name}_${suffix}`);
  const enc = master && alpha
    ? ['-c:v', 'prores_ks', '-profile:v', '4', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0']
    : master
      ? ['-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0']
      : ['-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', fpsArg, '-c:v', 'png', '-i', '-', ...enc, '-r', fpsArg, file], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let i = 0; i < n; i++) {
    const buf = Buffer.from(await grab(i / fps), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log(file, n, 'frames');
}
await browser.close();
