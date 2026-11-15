# Render contract

## Project layout

```
project/
  render.mjs  stage2d.js  package.json (playwright-core)
  scenes/<ID>.js            one graphic
  shots/<ID>.js             landing times for SFX (optional)
  assets_shots/<ID>_plate/  plate.png, any other PNG, layers.json
  out/<ID>/                 stills, review, SFX, QA, masters
  tools/                    qrender.sh  qa_sheet.sh  sfx_shot.py  mux_review.py  speech_energy.py
```

`layers.json` is `{"id":"<ID>_plate","W":1672,"H":941}`, with W and H from the real image. Every PNG in the shot folder becomes `st.images.<filename>`.

## Scene contract

```js
window.SCENE = { duration: seconds, draw(st, t) { /* draw frame at time t */ } };
```

`st` gives `ctx`, `canvas`, `W`, `H`, `S` (output pixels per unit of the 1920 grid), `images`, `begin(bg)`. `begin(null)` leaves the frame transparent. Author everything on the 1920x1080 grid and call `setTransform(st.S, 0, 0, st.S, 0, 0)`. `window.ALPHA` is true on an alpha render.

## Commands

| Goal | Command |
|---|---|
| Stills | `tools/qrender.sh ID --shot ID_plate --name ID --stills 1.0,3.0,6.0` |
| Stills with alpha | add `--alpha` |
| 1080p review, silent | `tools/qrender.sh ID --shot ID_plate --name ID` |
| 4K ProRes 422 HQ | add `--master` |
| 4K ProRes 4444 with alpha | add `--master --alpha` |

## How the renderer works

1. Launches Chrome with playwright-core: `--use-angle=metal --enable-gpu --ignore-gpu-blocklist --enable-gpu-rasterization`, headless. The GPU matters: filters, shadows and WebGL fall back to slow paths without it.
2. Loads assets as base64 data URLs, so the page needs no server.
3. Waits for `document.fonts.load` on the fonts the scene needs. A font that is not installed falls back silently: check the stills.
4. Frame loop: `n = round(duration * 30000/1001)`. For each `i`, `SCENE.draw(st, i / fps)`, then `canvas.toBlob('image/png')`, base64 back to Node, write to ffmpeg's stdin, wait for `drain` when the pipe is full.
5. ffmpeg input: `-f image2pipe -framerate 30000/1001 -c:v png -i -`.

| Output | Encoder arguments |
|---|---|
| Review | `-c:v libx264 -crf 17 -preset medium -pix_fmt yuv420p -movflags +faststart` |
| Master | `-c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -vendor apl0` |
| Alpha master | `-c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -vendor apl0` |

The review has no alpha. For an overlay it draws a real frame of the talent behind the type, so the owner judges it in place.

## Timing

- **Frame maths at 29.97 non-drop:** `01:MM:SS:FF = 108000 + (MM*60+SS)*30 + FF`.
- **recFrame0** is the record frame of scene `t=0`.
- **Handles:** a graphic that dissolves has 7 frames of handle at each end. `duration = (end - start + 14) / 29.97`, `recFrame0 = start - 7`. Nothing important happens in the first or last 7 frames. For 30 frame dissolves use 15 frame handles, and keep the first and last 30 frames calm.

## Placement handoff (for whoever builds the timeline)

Adjacent shots A then B on one track: cut at `B.rec0 + 7`, B's source starts at frame 7, A must have 7 frames past the cut, Cross Dissolve 14 frames centered. **A's file must end at `B.rec0 + 14` or later.** When A overlaps B by only 7 frames, Resolve's `AddTransition` fails. Extend A's master instead of re-rendering:

```
ffmpeg -i in.mov -vf tpad=stop_mode=clone:stop=7 -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -vendor apl0 -r 30000/1001 out.mov
```

That took about 2.5 minutes for a 472 frame 4K master. An alpha overlay's media pool item needs `SetClipProperty('Alpha mode','Straight')`.
