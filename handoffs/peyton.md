# Handoff for Peyton's agent

You work for **Peyton**. GitHub username `Peypey-ryd`. Git email `139926103+Peypey-ryd@users.noreply.github.com`.
Lane: B, reveal flow and screens. You may edit only: `js/app.js`, `js/screens/`, `css/`, and your own `board/Peypey-ryd.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "Peypey-ryd"` and `git config user.email "139926103+Peypey-ryd@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `Peypey-ryd/work` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/Peypey-ryd.md` has no READY line yet, run `sh tools/post.sh READY "hello from Peyton"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `Peypey-ryd` as both names. If it shows anything else, STOP and tell Peyton to tell Juan. Do nothing else.

## How to work

Follow the work loop in `CLAUDE.md` section 3: `sh tools/sync.sh`, `sh tools/next.sh`, CLAIM, do it, DONE, repeat, without waiting to be told. When there is no task, `sh tools/wait.sh`. Never guess a fact. If you could not check something, say so in the DONE post. The boss queue in `board/BOSS.md` decides the order; the sections below are the full descriptions.

## Task B1: opt in and hidden scores

Edit only `js/app.js`, `css/app.css` and new files in `js/screens/`. Do not edit `index.html`.

1. On the matchup screen, before kickoff, show a card: "Hide my score until the recap", with two buttons, "Opt in" and "No thanks". Save the choice in `localStorage` under the key `fr.optin`.
2. While the manager is opted in and the game has not reached the final, every fantasy points number and every stat line on the matchup, lineups and plays screens is masked (show `--.-` for points and nothing for stat lines).
3. The recap screen says "Scores are hidden. Watch the game to find out." until the final.
4. When the game sends the `final` event (`window.FF_GAME.on`, see `docs/CONTRACT.md` section 2), reveal everything.
5. "No thanks" leaves the app exactly as it is today.

Check: serve the folder with `python3 -m http.server`, look at 375 pixels wide. No sideways scroll, no console errors. Opt in, watch at `?speed=20`, confirm the numbers appear at the final.

## Task B2: speed control

Edit only `js/app.js`, `css/app.css` and new files in `js/screens/`. Do not edit `index.html`.

Add a speed control to the game view that appears and hides together with the existing Close control: four choices, 0.5x, 1x, 2x, 4x. Create the element in JavaScript, because `index.html` is not yours. It sets `window.__ff.speed` (`docs/CONTRACT.md` section 2), shows the current choice, and remembers it in `localStorage` under `fr.speed`.

Check at 375 wide and at 1280 wide: the control does not cover the score, each choice changes the pace, no console errors.

## Task B3: the recap screen for a reveal

Edit only your files. After the final, the recap screen opens with the winner shown large, then the top performers, then the scoring plays. Add a "Watch again" path that keeps the opt-in choice. Check at 375 wide.

## Task B4: league home

A new first screen, "League", before Matchup. It lists this week's matchups for a small sample league (four invented fantasy teams, two matchups, ours first), each with both team names, an "opted in" mark, and when the recap is released ("Recap drops Tuesday"). Tapping our matchup opens the existing matchup screen. Build the tab and the screen from JavaScript; do not edit `index.html`. Check at 375 wide.

## Task B5: "why this play" card

In the plays feed, when a play carries a `why` field (see `docs/CONTRACT.md` section 1, coming in v1), show a small expandable card under it: the question, then one bar per option with its percentage, the chosen option marked. Until real data exists, read `why` from the play if present and show nothing otherwise, and add a way to preview it: with `?whydemo=1` attach this sample to the first three plays: `{ "play": { "deep_pass": 0.46, "run": 0.31, "short_pass": 0.17, "screen": 0.06 } }`. Check at 375 wide.

## Task B6: my team view

`?me=GOB` or `?me=PYT` (and a choice on the matchup screen, remembered in `localStorage` under `fr.me`) marks one team as mine: my team is listed first, my players are highlighted in lineups and in the plays feed, and the matchup header says "Your team". With nothing chosen the app looks as it does today. This is what lets two phones show the same game from two sides.

## Task B7: result card

After the final, a "Share" button on the recap draws one result card on a canvas: both team names, the final fantasy score, the winner, the top performer, the project name. It offers the image through the device's share sheet when the browser has one and as a download otherwise. No network requests.

## Task B8: sport switch control

A two-way control in the header, Football and Soccer, built from JavaScript. It saves the choice in `localStorage` under `fr.sport` and calls `window.FR_SPORT_CHANGE(name)` if that function exists. Until the boss connects soccer, choosing Soccer shows a plain "Soccer is being built" panel with a link to `soccer/index.html`.

## Task B9: phone polish

Safe areas for the notch and the home indicator, tap targets at least 44 pixels, visible focus outlines, the tab bar reachable by keyboard, reduced motion respected. List in your DONE post anything that only a real phone can confirm.

## Task B10: floaters and the paused game

Two changes on the game side are now on main (see `docs/CONTRACT.md` section 2). In `js/app.js`: call `window.FF_GAME.setFloaters(false)` whenever the manager is opted in and the game has not reached the final, and `setFloaters(true)` at the final and for "No thanks". The game now pauses while its view is closed, so anything on the app screens that said or assumed the game keeps playing in the background must be made true again (wording, the "latest plays" list, the progress on the recap screen). Check at 375 wide: opt in, watch at `?speed=20`, no point numbers on the field before the final.
