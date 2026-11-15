# Pitch graphics (lane G)

Made by the design session. Every picture is rendered from a page in `design/pitch/` with `node design/src/render-pitch.js`. The app screenshots inside them were taken from the real app with `node design/src/capture.js` and `node design/src/capture-game.js`; nothing in them is mocked except the "why this play" card in gallery 04, which is drawn at poster size with the odds stored for that play in `data/games/week11-football.json`.

| File | Size | What it is |
|---|---|---|
| `thumbnail-a.png` | 3000x2000 (3:2) | Devpost thumbnail, version A: the name and Tusk, the scorekeeper |
| `thumbnail-b.png` | 3000x2000 (3:2) | Devpost thumbnail, version B: the sealed scoreboard, on amber |
| `thumbnail-c.png` | 3000x2000 (3:2) | Devpost thumbnail, version C: the field at a touchdown |
| `gallery-01-sealed.png` | 3000x2000 | Gallery 1: opt in, the score stays hidden |
| `gallery-02-the-game.png` | 3000x2000 | Gallery 2: the football game |
| `gallery-03-soccer.png` | 3000x2000 | Gallery 3: soccer |
| `gallery-04-play-caller.png` | 3000x2000 | Gallery 4: the play caller's odds and the film room |
| `gallery-05-the-reveal.png` | 3000x2000 | Gallery 5: the final board and the recap |
| `gallery-06-real-and-simulated.png` | 3000x2000 | Gallery 6: what is real, what is simulated, what was not checked |
| `video-title-card.png` | 1920x1080 | Title card for the demo video |
| `youtube-thumbnail.png` | 1280x720 (16:9) | YouTube thumbnail for the demo video: the video title card at YouTube's thumbnail size, under 2 MB |
| `figma/` | 14 frames | The frames exported from the Figma file, in the order of the Devpost gallery; also used in the README |
| `architecture.png` | 3840x2160 | The architecture on one page |

The numbers on the pictures come from `pitch/DEVPOST-FINAL.md` as it was on main on 2026-11-15. If that text changes, change the page in `design/pitch/` and render again.

Art: the mascot and every mark are drawn in code. No photos, no real team or league marks.
