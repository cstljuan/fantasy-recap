# Design and brand (lane G)

Everything in this folder and in `pitch/assets/` belongs to Juan's design session.

## The Figma file

"Fantasy Recap | Brand and UI", in Juan's drafts (team: El Team). Private. Only Juan shares it.

https://www.figma.com/design/JY7bLNHcuiDyEBLCpwWiba

Pages, in the order of Juan's earlier files (see `REFERENCE-LAYOUT.md`):

| Page | What is on it |
|---|---|
| 00 Reference | Cover, About this file |
| 01 Mascot | Tusk, the scorekeeper: expressions, sizes, spec |
| 02 Logo | Name and wordmark directions, lockups, app icon |
| 03 Color | Color tokens dark and light, type, space, corner and line rules, pixel-art rules |
| 04 UI | Components |
| 04b Screens | Every screen at 390x844 and 1440x900 |
| 04c Motion | Motion spec and storyboards |
| 05 Handoff | Token map, component map, rules for the coding agents |
| 06 Brand guide | 16 frames 1920x1080 |
| 07 Devpost | Thumbnail, gallery, video title card, architecture picture |
| 99 Archive | Explorations that were not chosen |

## In this folder

| Path | What it is |
|---|---|
| `REFERENCE-LAYOUT.md` | How Juan's three earlier Figma files are organized, and the page list this file follows |
| `src/` | The drawings as code. `node design/src/build.js` writes `assets/` |
| `assets/mascot/` | Tusk as SVG, one file per expression |
| `pitch/` | The Devpost thumbnail, gallery, title card and architecture picture as pages. `node design/src/render-pitch.js` renders them to `pitch/assets/` |
| `pitch/shots/` | Screenshots of the real app used in those pages (`node design/src/capture.js`, `capture-game.js`, `capture-film.js`) |
| `fonts/` | The open-license fonts the pages use |

All art is drawn in code or in Figma. No photos, no real team or league marks.
