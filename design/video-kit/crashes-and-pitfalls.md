# Crashes and pitfalls

## What crashes the GPU

- **Thousands of draws with `ctx.filter` set crash the GPU context and every canvas comes back blank.** There is no error, the frames are just empty. Draw sharp once, then blur once as a whole. Make blurred copies at init, never in the frame loop.
- **Dozens of full-frame canvases.** Crop sprites to their glyph box. The first blue figure used full-frame layers per glyph and survived at seven glyphs; do not scale that up.
- **A blur filter per frame for bloom.** Use a small pyramid instead: draw the source down to 1/8, 1/16, 1/32, 1/64 with `imageSmoothingQuality = 'high'`, then add those levels back with `lighter`. The device screens scene does this with no filter at all.
- **Many agents rendering at once.** Ten agents shared one MacBook Air with Resolve open. The render lock is what made that possible.

A blank frame in a still means the context died. Reduce filter draws, then re-render. `tools/dbg.mjs` on the first job printed pixels from inside the page, which is the fastest way to tell an empty canvas from a bad composite.

## Render faults

- Gaps at frame edges during camera moves: keep the plate overscaled.
- `page.on('pageerror')` exits the render. A silent exception would otherwise write hundreds of identical frames.
- The review mp4 has no alpha. To test an alpha scene, use `--alpha` with stills and check that the corner pixel is fully transparent.
- A font that is not installed falls back silently. Inter weights need Inter installed. The gold recipe needs Impact.
- `--master --alpha` on the first job still named the file `_4K_ProRes422HQ.mov`, which caused confusion on the timeline. The renderer here names it `_ProRes4444`.

## Shell and browser gotchas

- zsh: a line like `echo =====` fails with `=====: not found`. Use `printf '%s\n' "--"`.
- zsh does not word-split `set -- $x`. Drive such loops with Python.
- The shell resets between agent commands: `cd` to the project in every command.
- Chrome `file_upload` only accepts files in the session folder. Copy the reference in, delete it after.
- Close ChatGPT tabs when done. The owner: "also bro close the chatgpt tabs you arent using, please".

## Do not cut up a client's image

Splitting a reference into layers by inpainting was tried and rejected. The owner: "you can see the sillhouette and the erasure of the numbers." Rebuild in code on a text-free plate instead. See the recipe in `broadcast-stat-graphics`.
