# Motion recipes

All of these are in `scripts/scene-template.js` or in the recipe skills. Copy them into the scene, so a scene stays one self-contained file and one agent can never break another's.

## The damped spring

```js
const SP = (t, k = 170, c = 26) => { if (t <= 0) return 0; const w = Math.sqrt(k), z = c / (2 * w);
  if (z < 1) { const d = w * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w * t) * (Math.cos(d * t) + (z * w / d) * Math.sin(d * t)); }
  return 1 - Math.exp(-w * t) * (1 + w * t); };
```

It is a closed form of `t`, so it obeys the pure function rule. Damping ratio is `c / (2 * sqrt(k))`.

| Use | k, c | Ratio | Feel |
|---|---|---|---|
| Soft settle | 170, 26 | 1.0 | No overshoot |
| Character or glyph slam | 150, 16 to 17 | about 0.67 | Lands with a small overshoot |
| Tile pop | 170, 13 | 0.5 | Visible bounce, on a very small scale change |
| Icon pop | 240, 15 | 0.48 | Quick and lively |
| Banner slide | 110, 15 | 0.71 | Weighted |
| Rising bar | 58, 11.5 | 0.75 | Slow growth |
| Drawn arrow | 15, 7.2 | 0.93 | Long and unhurried |

A serious line gets no bounce: on "That doesn't guarantee you'll make money" the type had none. When the owner says it moves too fast, replace fast springs with eased moves of about 0.6 to 1.0 s, one thing moving at a time.

## Real motion blur, three ways

Blur is what makes it look filmed, not animated. Use the cheapest method that fits.

1. **Whole-frame accumulation (opaque scenes).** Render the whole frame N times across the shutter into an opaque canvas and average with `globalAlpha = 1 / (i + 1)`. Shutter is `.62 * 1001 / 30000`. N is 6 to 8 for slow moves, 16 during slams. Skip it entirely once nothing moves fast (`if (t > 6.1) { frame(x, st, t); return; }`), which saves most of the render time.
2. **Per-sprite additive accumulation (alpha overlays).** Clear one full-frame buffer, set `globalCompositeOperation = 'lighter'`, draw the sprite at real positions across the shutter with `globalAlpha = a / n`, then draw the buffer once. Additive alpha sums to exactly 1, so a smeared body stays solid and the alpha channel stays clean. Averaging would leave the alpha wrong.
3. **Camera-only, adaptive.** Build one oversized world canvas per frame, then draw it N times along the camera path, with `N = clamp(speed / 2.2, 1, 10)` and a 180 degree shutter. A still camera costs one draw.

## Sprites

- Draw each character or word once into a canvas cropped to its glyph box, plus a pad for glow. Never one full-frame canvas per glyph.
- Keep a separate blurred copy, made once at init, for the landing bloom and the soft arrival.
- Fit text to a width by scaling x in the sprite's transform, so the layout matches a reference exactly.

## The vocabulary

- **Fly in from camera:** `s = 1 + inv * 2.6`, `sx = cos(inv * 1.05)`, a skew of `inv * .28`, and an offset away from frame centre by `inv * (cx - 960) * .7`. `inv` is `1 - spring`.
- **Landing bloom:** the blurred copy drawn with `lighter`, alpha `exp(-d * 5.5)`, starting 0.15 s after the spring.
- **Camera kick:** a damped sine, `exp(-d * 11) * amp * sin(d * 71 + i * 2.1)`, for 0.5 s after each landing, amp about 3 to 8 px.
- **Sparks:** 10 to 12 per landing, seeded with `rnd(i * 100 + n)`, drag `(1 - exp(-e * 3.4)) / 3.4`, gravity `300 * e * e`, gone within a second.
- **Light pass:** copy the type to a buffer, mask with a moving diagonal gradient (`destination-in`), add it on top. Once, after everything lands. A second quiet pass only to keep a long hold alive.
- **Colour spill:** a soft radial gradient added with `lighter`, `.5 * exp(-d * 3) + .17`, so a lit thing lights its surroundings and settles.
- **Slow dolly:** keep the plate overscaled so no edge shows. Vary it: a push, a drift to the last element, a lateral slide. Not every shot moves the same way.
- **Layered depth:** panes and background layers travel at their own speed.

## Pacing rules from the owner

- Hold at least 1.2 s after the last word lands on a key-word graphic. A state in a sequence holds at least 1.5 s unless the next word needs the next state.
- Do not rush elements in, and never land the last element just before the shot ends.
- Use silence for holds, not for more motion. If the frame has a long hold, one quiet sweep keeps it alive.
- Elements must not hang over the floor or end abruptly before the number covers them.
