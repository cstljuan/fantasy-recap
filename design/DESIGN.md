# Fantasy Recap design: the single source of truth for the builders

Lane G, Juan's design session. If this file and the Figma file disagree, this file wins for anything that is code (names, numbers), and the Figma file wins for how a screen is laid out.

- Figma: https://www.figma.com/design/JY7bLNHcuiDyEBLCpwWiba (private, Juan shares it). Node ids of every page, component and screen: `design/figma-ledger.json`.
- Tokens as CSS: `design/tokens.css`. Motion: `design/MOTION.md`. Fonts: `design/fonts/`. Mascot and drawings: `design/assets/`, built by `node design/src/build.js`.
- Nothing here changes the app. Each change below is a proposal for the owner of that file. Peyton owns `css/` and `js/app.js`, the boss owns `js/main.js`, `js/sprites.js` and `index.html`.

## 1. The idea in one paragraph

A dark scoreboard. Flat panels, hairline rules, square corners, one signal color (amber), condensed numerals, 8-bit players. Tough, not cute. The one thing nobody else has is the **sealed score**: while a manager is opted in, every number that could spoil the result is replaced by the mask `--.-`. The mascot is **Tusk**, a boar who keeps the score and does not talk. Tagline: "Don't check the score. Watch it."

## 2. Tokens

Load `design/tokens.css` before `css/app.css`. Every name `css/app.css` already uses (`--bg`, `--panel`, `--inset`, `--rule`, `--text`, `--dim`, `--amber`, `--flag`, `--alert`, `--t0`, `--t1`, `--display`, `--body`, `--mono`, `--tabs-h`) keeps its value, so loading it changes nothing by itself.

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0b0d0e` | `#f3f1ea` | page |
| `--panel` | `#131617` | `#ffffff` | panels |
| `--inset` | `#1b1f21` | `#e8e5db` | score windows, bar tracks, dividers |
| `--rule` | `#2b3033` | `#c9c5b8` | hairlines |
| `--text` | `#f3f1ea` | `#0b0d0e` | main text |
| `--dim` | `#8e9597` | `#5d6466` | labels, secondary text |
| `--amber` | `#ffc21a` | `#ffc21a` | live, chosen, the one main action |
| `--on-amber` NEW | `#111111` | `#111111` | text on amber (today a literal `#111`) |
| `--signal-text` NEW | `#ffc21a` | `#8a6200` | amber used as text, readable on light |
| `--flag` | `#ffd400` | `#8a6f00` | penalty |
| `--alert` | `#ff6a5c` | `#c8352a` | turnover, negative points |
| `--t0`, `--t1` | from the game file | same | team edges and tiles |
| `--mine` NEW | `#212017` | `#fffbf1` | behind your own rows (today `rgba(255,194,26,.06)`) |
| `--turf`, `--turf-dark`, `--game-bg`, `--overlay` NEW names | | | the field, and the plate under controls on the field |

Space: 4, 8, 12, 14, 16, 24, 40 (`--space-1` to `--space-7`). Corners: 0 everywhere, 2 px on buttons and toggles only. Lines: 1 px rules, 3 px colored edges. Tap targets 44 px, primary button 50 px, tab bar 54 px, content at most 1040 px wide.

Light mode is tokens only for now: set `data-theme="light"` on `<html>`. No light screens were drawn, so check contrast before shipping it.

## 3. Type

| Role | Face | Size | Where |
|---|---|---|---|
| Names, buttons, tabs, every number | Barlow Condensed 700 and 800, caps | see `--type-*` | `.brand`, `.team-name`, `.cta`, `.tabs a`, `.num` |
| Reading | Barlow 400, 600 | 15, 13, 12 | body, play text, notes |
| Labels | Barlow 700, caps, letter-spacing 0.14em | 11 and 10 | `.eyebrow`, `h2`, `.tag`, `.status` |
| The mask and big pixel numerals | Jersey 15 | as the number it covers | the hidden score `--.-` |
| Stamps, the game overlay | Silkscreen | 9 to 18 | score bug, name tags, pixel labels |

The fonts are open license and in `design/fonts`. The `@font-face` rules are at the bottom of `design/tokens.css`. The stacks fall back to what the app uses today, so the app still works without the files.

Numbers always show one decimal and use tabular numerals.

## 4. Components

Each is a component in Figma (page `04 UI`) with the CSS it maps to. "Same" means build it exactly as the app has it today.

| Component | CSS today | What to build |
|---|---|---|
| Status | `.status` | Same. Pregame, Live (blinks), Paused, Final |
| Tag | `.tag`, `.t-score`, `.t-flag`, `.t-turnover` | Same |
| Mark | `.lg-mark` | Same |
| Tile | `.tile` | Same |
| Button | `.cta`, `.cta.ghost` | Same. One primary per panel |
| Sport switch, Language switch | `.sport` | Same |
| Header | `.bar` | CHANGE: the name reads "Fantasy Recap" (today "Match Viewer"), lamp unchanged |
| Tab bar | `.tabs` | Same |
| Side, Scoreboard | `.side`, `.window`, `.board` | CHANGE: when sealed the total is the mask `--.-` in Jersey 15, the same width as the number, and the unit reads "Fantasy pts, hidden" |
| Opt-in card | `.optin`, `.optin.is-on` | CHANGE: the On strip shows Tusk (sealed, 44 px) on the left |
| Lineup head, Player row | `.lineup-head`, `.row` | CHANGE: sealed rows show the mask for points and "Stat line hidden" for the line. `.row.is-mine` uses `--mine` |
| Play row, Why card | `.play`, `.why` | Same layout. Bars animate (see MOTION.md, 4) |
| League match | `.lg-match` | Same |
| Top performer, Compare, Standing, Drive rows | `.row`, `.compare`, film room | Same |
| Score bug, Banner, Final board | drawn in `js/main.js` and `soccer/js/main.js` | Same as drawn today. The final board never shows fantasy points |
| Captions strip, Speed, Close | `.captions`, `.speed`, `.close` | Same |
| Sound control | new | NEW: Sound and Mute, under the speed control, same look as `.speed` |
| Walkthrough card | `.walk-card` | CHANGE: Tusk beside the title: sealed, eyes shut, roar for steps 1, 2, 3 |
| Empty state | `.empty` | CHANGE: Tusk (96 px) above a title, one sentence, at most one button |
| Paused bar | status only today | NEW: a strip with Tusk (eyes shut), "Paused" and a Resume button |
| Recap hero | `.hero` | CHANGE: Tusk beside the winner: Smirk if your team won, Cold if it lost, Smirk if you picked no team |

## 5. Screens

Page `04b Screens`: 18 at phone size (390 by 844) and 16 at laptop size (1440 by 900). Frame names read `Size / Screen / State`.

Before the game: first run walkthrough, league, matchup before opt-in, matchup opted in and sealed, lineups sealed, sport switch to soccer. The game: football, touchdown, soccer goal, paused, final board. After the final: who won, recap, lineups revealed, plays with the why card open, film room, season and standings, empty.

Laptop rules: content at most 1040 wide and centered, tabs in the header bar, panels in two columns from 760 px (as `css/app.css` does), both lineups side by side, the feed with the play caller beside it, the league with the season beside it, the game on a dark stage with its portrait field.

## 6. The sealed score: rules

1. Hidden while opted in: fantasy totals, player points, stat lines, point floaters, the points on a play, any number in a halftime report.
2. Always shown: the game itself, the field score, the announcer and captions.
3. The mask is always the four characters `--.-`, the same width as the number it covers. Nothing moves when it lifts.
4. No screen, tag, caption or animation may hint at a sealed number.
5. The count up happens once, at the reveal. "Show scores" just shows them.

## 7. Tusk, the mascot

A boar on a 24 by 21 pixel grid. Source: `design/src/mascot.js`. SVG files: `design/assets/mascot/tusk-<expression>.svg`. Component set `Tusk` in Figma (page `01 Mascot`).

| Expression | When |
|---|---|
| sealed | default. Opted in. Empty states |
| watching | a game is playing |
| roar | touchdown or goal, for one second |
| smirk | you won |
| cold | you lost. Something failed to load |
| shut | a blink (120 ms every 4 to 7 s). Paused |

Rules: he never smiles, never speaks, never tells the score. Scale by whole numbers only, never below 24 px wide, no rotation, no blur, no outline. In CSS use `image-rendering: pixelated`.

## 8. Pixel art for players

Players stay as they are in `js/sprites.js` and `soccer/js/sprites.js`: 8 by 11 pixels, drawn in code, shown at 2x in the game. Team colors from the game file. A name under a player only when a fantasy manager owns him. Posters use 4x, 8x or more, always a whole number. Do not blur, rotate, stretch or outline a sprite.

## 9. Voice

Short, plain, like a scoreboard. The announcer gets the excitement; the app stays calm. No exclamation marks outside the announcer, no emoji, no long dashes. Say what is sample data where it is shown ("Sample games" in the header, the footer line).

## 10. What would change in the app, by owner

Small, separate changes. None is required for the demo.

Peyton (`css/app.css`, `js/app.js`, `js/screens/`):
1. Load `design/tokens.css` (or copy its `:root` block) and use `--on-amber`, `--mine`, `--signal-text` where literals are today.
2. The mask in the score windows and rows in Jersey 15 (`font: var(--type-mask)`), with the unit "Fantasy pts, hidden".
3. Tusk on the opted-in strip, the walkthrough cards, the empty states, the recap hero, and a paused strip.
4. The reveal count up and the odds bars (MOTION.md 1 and 4).
5. Header name "Fantasy Recap", if Juan keeps the name.

Boss (`index.html`, `js/main.js`): load the font files if Peyton takes them; a Sound and Mute control beside speed; nothing else.

Noah (`js/audio.js`, announcer): the Sound control needs one call that mutes voice, crowd and jingles together; the reveal has three beats (final board, masks lift, winner) if a sting should land on the winner at about 1.6 s after the recap opens.

## 11. Pitch graphics

In `pitch/assets/` (see its README): the Devpost thumbnail in three versions, six gallery pictures, the video title card, the architecture picture. Sources in `design/pitch/`, rendered with `node design/src/render-pitch.js`.
