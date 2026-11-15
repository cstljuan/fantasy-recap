# Motion

How things move in Fantasy Recap, written so each one can be built in CSS. The same specs are on page `04c Motion` of the Figma file, with storyboards and three prototype flows you can play.

## The rules

1. **Motion is the scoreboard changing, never decoration.** Something moves only when a fact changed: a score, a state, a screen.
2. **Pixel things move in steps.** Banners, the mask, Tusk and anything on the field use `steps()`. They never glide.
3. **Panels move once, fast, and stop.** Fade and rise 8 pixels. Nothing bounces, nothing loops, nothing slides sideways.
4. **Nothing spoils.** While the score is sealed, no animation may show or hint at a number. Point floaters stay off.
5. **Reduced motion turns it all off.** With `prefers-reduced-motion: reduce` every change is instant. `design/tokens.css` sets the durations to 0 for that case, so using the tokens is enough.
6. **A tap always skips.** Any sequence longer than 400 ms can be tapped through to its end state.

## Tokens

They are in `design/tokens.css`.

| Token | Value | Use |
|---|---|---|
| `--dur-1` | 120 ms | a flash, a press, a blink |
| `--dur-2` | 220 ms | a tick, a flip, a banner, a panel arriving |
| `--dur-3` | 400 ms | a bar filling |
| `--dur-4` | 900 ms | the reveal count up |
| `--ease-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | panels, bars, numbers |
| `--ease-step` | `steps(4, end)` | pixel things |
| `--stagger` | 60 ms | between items that arrive in a row |

Already in `css/app.css` and kept as they are: the live lamp blink (`blink`, 1.2 s, `steps(2, jump-none)`), the score tick (`tick`, 220 ms), a new play in the feed (`slide`, 250 ms), the captions scroll (`capscroll`).

## 1. The reveal

The one moment the whole product is for. Three beats: the final board, the masks lifting, the winner.

| Time | What happens | Duration and easing |
|---|---|---|
| 0 | Final whistle. The field dims to 50 percent. The final board rises 8 px and fades in. It shows the field score only. | 220 ms, `--ease-out` |
| tap, or 6 s | The recap opens. Both score windows still show the mask `--.-`. | screen change, 160 ms |
| +300 ms | Window A: the mask flips to digits, left to right. | 220 ms, `--ease-step` |
| +520 ms | Window A counts up from 0.0 to its total. | 900 ms, `--ease-out` |
| +420 ms | Window B starts the same flip, 120 ms after A, then its count. | same |
| +1540 ms | Both totals have landed. The winner's name rises 8 px and fades in. | 220 ms, `--ease-out` |
| +1660 ms | The Win tag appears. Tusk changes to Smirk if you won, Cold if you lost, Smirk if you picked no team. | 120 ms, no easing |
| +1760 ms | The rest of the recap arrives: story, top performers, scoring plays. | 220 ms each, `--stagger` apart |

The count shows one decimal and uses tabular numerals so the width never changes. The mask is the same width as the number it covers.

```css
.window .num.is-lifting { animation: flip var(--dur-2) var(--ease-step); }
@keyframes flip { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
.hero-name.is-in { animation: rise var(--dur-2) var(--ease-out) both; }
.recap-panel.is-in { animation: rise var(--dur-2) var(--ease-out) both; animation-delay: calc(var(--i) * var(--stagger)); }
@keyframes rise { from { opacity: 0; transform: translateY(8px); } }
```

```js
// Count up. Call with the element, the real total, and --dur-4 in milliseconds.
function countUp(el, total, ms) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !ms) { el.textContent = total.toFixed(1); return; }
  var t0 = performance.now();
  (function frame(now) {
    var p = Math.min(1, (now - t0) / ms), eased = 1 - Math.pow(1 - p, 3);
    el.textContent = (total * eased).toFixed(1);
    if (p < 1) requestAnimationFrame(frame);
  })(t0);
}
```

## 2. Touchdown

| Time | What happens | Duration and easing |
|---|---|---|
| 0 | White flash over the field, 60 percent to 0. | `--dur-1`, linear |
| 0 | The camera shakes 3 px. | 240 ms, `steps(6)` |
| 60 ms | The banner drops in under the score bug, in the scoring team's colors. | 240 ms, `--ease-step` |
| 300 ms | The field score in the score bug ticks to the new number. | `tick`, 220 ms |
| 300 ms to 1900 ms | The banner holds. The air horn plays. | 1600 ms |
| 1900 ms | The banner leaves upward. | 160 ms, `--ease-step` |

While the score is sealed no points float up. On the app screens behind the game, Tusk shows Roar for one second, then goes back to Watching.

```css
.banner { animation: drop 240ms var(--ease-step) both, lift 160ms var(--ease-step) 1900ms forwards; }
@keyframes drop { from { transform: translateY(-100%); } }
@keyframes lift { to { transform: translateY(-100%); } }
.flash { animation: flash var(--dur-1) linear both; }
@keyframes flash { from { opacity: 0.6; } to { opacity: 0; } }
```

## 3. Goal

| Time | What happens | Duration and easing |
|---|---|---|
| 0 | The net shakes 2 px, three times. | 240 ms, `steps(6)` |
| 60 ms | The banner drops in: GOAL, the scorer, the minute, the assist. | 240 ms, `--ease-step` |
| 300 ms | The score bug ticks. | `tick`, 220 ms |
| 1900 ms | The banner leaves. A REPLAY tag appears top right. | 160 ms |
| then | The goal plays again in slow motion, at 0.4 of the chosen speed, with the camera on the scorer. | about 8 s at 1x |
| after | The tag goes, the match restarts from the centre. | cut, no fade |

## 4. Odds bars

When a "Why this play" card opens.

| Time | What happens | Duration and easing |
|---|---|---|
| 0 | The card opens. All bars are at zero. | cut |
| 0 + n x 60 ms | Each bar grows from 0 to its percent, top to bottom. The number beside it counts with it. | `--dur-3`, `--ease-out`, `--stagger` apart |
| when its bar ends | The Called tag appears on the chosen option, and its bar turns from grey to amber. | `--dur-1` |

The chosen option is not always the most likely one. The bars are sorted by odds, so the amber bar can sit anywhere in the list.

```css
.why[open] .why-bar i { animation: fill var(--dur-3) var(--ease-out) both; animation-delay: calc(var(--i) * var(--stagger)); transform-origin: left; }
@keyframes fill { from { transform: scaleX(0); } }
.why[open] .is-chosen b { animation: rise var(--dur-1) linear both; animation-delay: calc(var(--i) * var(--stagger) + var(--dur-3)); }
```

## 5. The opt-in lock

When the manager taps Opt in.

| Time | What happens | Duration and easing |
|---|---|---|
| 0 | The button presses down 1 px. | `--dur-1` |
| 120 ms | Both totals flip to the mask, one character at a time, left to right. | `--dur-2`, `--ease-step` |
| 120 ms | The top edge of each score window flashes amber, then goes back to the team color. | `--dur-2` |
| 340 ms | The opt-in card closes down to the quiet strip: "Your score is hidden until the final." | `--dur-2`, `--ease-out`, height only |
| 560 ms | Tusk, on the strip, blinks once. | Shut for `--dur-1` |

Show scores runs the same thing backwards without the blink: the mask flips to digits in `--dur-2`, no count up. The count up belongs to the reveal only.

## 6. Screens

| Change | What happens | Duration and easing |
|---|---|---|
| Tab to tab | The new screen fades in and rises 8 px. The old one is gone at once. No sliding. | 160 ms, `--ease-out` |
| Open the game | The stage fades in from 98 percent size. | `--dur-2`, `--ease-out` |
| Close the game | The stage fades out. The status on the board changes to Paused. | 160 ms |
| A new play in the feed | The row slides down 6 px and fades in (`slide`, already built). | 250 ms |
| A total changes (not sealed) | The number ticks up 7 px (`tick`, already built). | 220 ms |
| Controls in the game | Show on a tap or a mouse move, hide after 3 s without one. | `--dur-1` in, `--dur-2` out |
| Walkthrough card to card | The card content crossfades. Tusk changes expression with a hard cut. | `--dur-1` |

## Tusk

| Motion | Spec |
|---|---|
| Blink | Sealed to Shut and back. Shut lasts 120 ms. Every 4 to 7 seconds, at random. Never while a number is counting. |
| Change of expression | A hard cut. He never morphs. |
| Roar | Holds 1 second, then cuts back. |

All of it stops with reduced motion: he just sits there, which suits him.

## In the Figma file

Page `04c Motion` has the spec table, a storyboard for each of the six motions with the times under each frame, and three prototype flows that play by themselves: **The reveal**, **Odds bars** and **The opt-in lock**. Open the page, press Play, pick the flow. Figma's Smart Animate cannot step or count, so the flows show the order and the timing, and this file has the exact easing.
