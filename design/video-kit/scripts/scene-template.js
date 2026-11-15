// Copy to scenes/<ID>.js. One scene is one graphic: all text and timing live in DATA, everything is a pure function of t.
// A scene sets window.SCENE = { duration, draw(st, t) }. st gives ctx, canvas, W, H, S (output pixels per grid unit) and images.<filename>.
// Rules this template already follows: draw sharp once and blur once, crop sprites to their box, overscale the plate, keep first and last 7 frames calm.
const DATA = {
  duration: 4.0, // Range length plus 14 frames: 7 frames of handle at each end for dissolves.
  words: [{ w: 'SAMPLE', at: 0.60 }, { w: 'HEADLINE', at: 1.10, accent: true }], // at = spring start, about 0.17 s before the visual hit.
  size: 170, base: 600, gap: 44,
  sweep: { at: 2.1, dur: 0.9, a: 0.6 },
};
// Real damped spring. k stiffness, c damping. Ratio z = c / (2 * sqrt(k)): 1 settles with no overshoot, 0.5 overshoots visibly.
const SP = (t, k = 170, c = 26) => { if (t <= 0) return 0; const w = Math.sqrt(k), z = c / (2 * w); if (z < 1) { const d = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(d * t) + (z * w / d) * Math.sin(d * t)); } return 1 - Math.exp(-w * t) * (1 + w * t); };
const CL = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const SM = x => { x = CL(x); return x * x * (3 - 2 * x); };
const blob = (x, cx, cy, rx, ry, col, a) => { x.save(); x.translate(cx, cy); x.scale(rx, ry); const g = x.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0)); x.fillStyle = g; x.fillRect(-1, -1, 2, 2); x.restore(); };
let G;

// One cropped sprite per word, drawn once from live text. Never allocate a full-frame canvas per glyph.
function wordSprite(st, W) {
  const pad = 80, m = document.createElement('canvas').getContext('2d');
  m.font = `900 ${DATA.size}px Inter`;
  const adv = m.measureText(W.w).width, gw = adv + pad * 2, gh = DATA.size * 1.2 + pad * 2, by = pad + DATA.size * .95;
  const c = document.createElement('canvas'); c.width = Math.ceil(gw * st.S); c.height = Math.ceil(gh * st.S);
  const x = c.getContext('2d'); x.setTransform(st.S, 0, 0, st.S, pad * st.S, 0);
  x.font = `900 ${DATA.size}px Inter`; x.textBaseline = 'alphabetic'; x.lineJoin = 'round';
  x.save(); x.shadowColor = 'rgba(40,150,255,.8)'; x.shadowBlur = 22 * st.S; x.fillStyle = W.accent ? '#2BC8FF' : '#FFFFFF'; x.fillText(W.w, 0, by); x.restore();
  const g = x.createLinearGradient(0, by - DATA.size * .75, 0, by);
  (W.accent ? [[0, '#A8F6FF'], [1, '#27B6F7']] : [[0, '#FFFFFF'], [1, '#C6D8F8']]).forEach(([p, col]) => g.addColorStop(p, col));
  x.fillStyle = g; x.fillText(W.w, 0, by);
  // The soft copy for its landing bloom: blurred once, here, never per frame.
  const b = document.createElement('canvas'); b.width = c.width; b.height = c.height;
  const bx = b.getContext('2d'); bx.filter = `blur(${16 * st.S}px)`; bx.drawImage(c, 0, 0);
  return { c, b, gw, gh, pad, by, adv };
}

function init(st) {
  if (G) return;
  G = {};
  const sprites = DATA.words.map(w => ({ ...w, s: wordSprite(st, w) }));
  const total = sprites.reduce((a, q) => a + q.s.adv, 0) + DATA.gap * (sprites.length - 1);
  let px = 960 - total / 2;
  for (const q of sprites) { q.x = px; q.cx = px + q.s.adv / 2; px += q.s.adv + DATA.gap; }
  G.sprites = sprites;
  G.sub = document.createElement('canvas'); G.sub.width = st.W; G.sub.height = st.H;
  G.subc = G.sub.getContext('2d', { alpha: false });
}

function frame(c, st, t) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#010E2E'; c.fillRect(0, 0, st.W, st.H);
  c.setTransform(st.S, 0, 0, st.S, 0, 0);
  // Slow dolly. The plate stays overscaled so no edge shows during the move.
  const z = 1.06 + .05 * SM(t / DATA.duration);
  c.save(); c.translate(960, 540); c.scale(z, z); c.translate(-960, -540);
  if (st.images.plate) c.drawImage(st.images.plate, 0, 0, 1920, 1080);
  else blob(c, 960, 470, 1200, 760, 'rgba(3,102,240,A)', 1);
  c.restore();
  // Each word flies in from the camera on a spring.
  for (const q of G.sprites) {
    const d = t - q.at; if (d <= 0) continue;
    const p = SP(d, 150, 17), inv = 1 - p, s = 1 + inv * 2.4;
    c.save(); c.globalAlpha = CL(d / .05);
    c.translate(q.cx + inv * (q.cx - 960) * .7, DATA.base - DATA.size * .36 - inv * 80);
    c.scale(s * Math.cos(inv * 1.05), s); c.transform(1, 0, inv * .28, 1, 0, 0);
    c.drawImage(q.s.c, -q.s.adv / 2 - q.s.pad, DATA.size * .36 - q.s.by, q.s.gw, q.s.gh);
    c.restore();
    // Its bloom, gone within a second.
    const h = d - .15;
    if (h > 0 && h < .9) { c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = Math.exp(-h * 5.5); c.drawImage(q.s.b, q.x - q.s.pad, DATA.base - q.s.by, q.s.gw, q.s.gh); c.restore(); }
  }
}

window.SCENE = {
  duration: DATA.duration,
  draw(st, t) {
    init(st);
    const x = st.ctx;
    // Real motion blur: render the whole frame across the shutter and average, while anything moves fast. Opaque scenes only.
    if (t > DATA.sweep.at) { frame(x, st, t); return; }
    const N = 12, shutter = .62 * 1001 / 30000;
    for (let i = 0; i < N; i++) {
      frame(G.subc, st, t + (i / N) * shutter);
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1 / (i + 1);
      x.drawImage(G.sub, 0, 0);
    }
    x.globalAlpha = 1;
  },
};
