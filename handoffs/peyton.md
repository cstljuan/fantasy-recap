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

## Task B11: captions strip and the announcer switch (with Noah)

In the game view, a one-line captions strip at the bottom showing what the announcer just said, and a two-way switch, Straight and Fun, next to the speed control. Build both from JavaScript in your files. The text comes from `FF_ANNOUNCER.onLine` (Noah's task C3) and the switch calls `FF_ANNOUNCER.setStyle`. Before you build, ask Noah what `onLine` passes and how long a line can be: `sh tools/post.sh ASK "noah: ..."`. If C3 is not on main yet, build against `FF_ANNOUNCER.line` and say so. Check at 375 wide that the strip never covers the score or the ball carrier's name.

## Task B12: lineup points from the scoring rules (with Ricky)

The lineups screen computes fantasy points itself today. When Ricky's `data/scoring.json` (task D5) is on main, read the rules from it instead of hard-coded numbers, and show the scoring rules under the lineups from the same file. Ask Ricky for the exact shape first: `sh tools/post.sh ASK "ricky: ..."`. Points must not change for the sample game; say in your DONE post whether they did.

## Task Q1: listen-through for Noah

Run `node js/announcer/check.js` and read every line in both styles. Send Noah, in one or two NOTE posts, the lines that sound wrong, repeat too often, are too long for a phone, or say something the game did not do: `sh tools/post.sh NOTE "noah: <kind>, <style>: <what is wrong and a better line>"`. You do not edit his files.

## Task P1: the two-minute demo script

Create `pitch/DEMO-SCRIPT.md`: what is said and what is on screen, second by second, for exactly two minutes. 15 seconds for the problem, 60 for the demo (opt in, hidden scores, the game, the announcer, a touchdown, the reveal), 25 for how it works (profiles, the play caller choosing each play with real probabilities, the rules engine), 20 for what is next. Only claim what `README.md` and the board say is built. Mark anything not built yet as "if ready".

## Task B13: the why card from the real game file

The app now plays a game built by the game maker, and 40 of its plays carry a real `why` (see `docs/CONTRACT.md` section 1). Make the card read `e.why.picked` for the chosen option, name each option by the player it means (`pass_WR1` is "Pass to" plus the WR1 on that team's roster, `run_RB` is "Run by" plus the RB), sort the bars highest first, and add one line under the card: "Chosen by the play caller from these odds". Keep `?whydemo=1` working. Check at 375 wide with the default game (not `?game=sample`).

## Task B14: the film room

A new screen after the final, "Film room", reached from the recap. Three parts, all built from the game the app is playing. A drive chart: one row per drive, drawn as a bar on a field from 0 to 100 with each play as a segment, the team's color, and a marker for how the drive ended (touchdown, field goal, punt, turnover). A play caller panel for the plays that carry `why`: how many plays it chose, its most confident call, its biggest surprise (the picked option with the lowest probability), and the average odds of the option it picked. A tap on any play in the chart opens that play's why card. Check at 375 and 1280 wide with the default game.

## Task B15: first run and install

A three-card walkthrough the first time the app opens (what it is, opt in, watch the game), skippable, remembered in `localStorage` under `fr.seen`. An "Add to Home Screen" hint for iPhone Safari. The app needs a web app manifest and icons at the root, which are the boss's files: build `js/screens/install.js`, draw the icon in code on a canvas and save it as a data address you can hand over, then post `ASK "boss: add manifest.webmanifest with ..."` with the exact contents you need.

## Task B16: the season

Using `data/league.json`: a standings table for the sample league (wins, losses, points for), a week picker, and for past weeks a finished matchup card with the final score and a "Watch the recap" button that is disabled with the reason when there is no game file for that week. Ask Ricky to add two finished past weeks to `data/league.json` if they are not there: `sh tools/post.sh ASK "ricky: ..."`.

## Task B17: one look for the whole app

Write the app's design rules into `docs/` through an ASK to the boss (colors, type scale, spacing, the three button kinds, the two card kinds), then make every screen follow them: the same spacing steps, the same heading sizes, the same card edges, no one-off colors. The look is a dark scoreboard: modern, tough, not cute. List every screen you changed in your DONE post.

## Task B18: this week in the league (with Ricky)

A screen reached from the League home: for each matchup of the week that has a game file, its three biggest plays as cards (quarter and clock, the sentence for the play, the players, the points), each with a "Watch this play" button that opens the game view at that play. Ricky's task D18 gives the list: `topPlays(gameFile, n)` in `server/top-plays.js` and `GET /games/:id/top-plays`; ask him for the exact shape and for a way to get it in the browser without the service (`sh tools/post.sh ASK "ricky: ..."`). While the manager is opted in and the game is not final, the cards stay masked like every other score, with one line that says why. Matchups without a game file show a card that says so. Check at 375 wide and with the keyboard.

## Task B19: the opt-in reaches the service (with Ricky)

Today the opt-in lives only in `localStorage`. When the page is opened with `?api=http://localhost:<port>`, call the service: `GET /health` once at start, `POST /games/:id/optin` when the manager opts in, `GET /games/:id/optins` to show who opted in. Ricky's D14 built those routes: ask him for the request and reply bodies. Without `?api`, or when the service or the database does not answer, everything works exactly as now, and a small line under the opt-in says which is true: "Saved on this device" or "Saved to the league". Never block the screen on the network: two second timeout, then fall back. Check both ways with `node server/index.js` running without a database (it answers 503) and not running at all.

## Task B20: screen reader and reduced motion

Every screen: headings in order, every control with a name, the tab bar as tabs, the plays feed as a list, masked points read as "hidden" and not as dashes. In the game view: one polite live region that receives each play's caption text (the captions strip may already be it: then make sure it is announced once and not twice), and the score when it changes and scores are not hidden. Honor `prefers-reduced-motion`: no sliding or pulsing in the screens, and ask the boss (`ASK "boss: ..."`) for what the canvas should do. Check by reading the accessibility tree in headless Chromium for each screen and list what you verified in DONE.

## Task B21: rule cards (with Noah)

A "Learn the game" switch in the game view, off by default. When on, the first time each rule comes up in the game (first down, turnover on downs, touchdown, extra point, field goal, punt, interception, fumble, sack, penalty, kickoff, halftime) a small card shows the rule in one or two plain sentences, for a few seconds or until tapped, without pausing the game above 2x speed. Each rule shows once per game. Noah's task C14 writes the sentences and gives you `FF_ANNOUNCER.explain(kind)`: ask him for the list of kinds; until it is on main, use your own short text behind the same function name. The switch is remembered in `localStorage` as `fr.learn`.


## Task B22: the jump bar (with Noah)

A small bar in the game view to move around the recap: previous play, next play, next score, and a slider or list to jump to any play. It uses `FF_GAME.seek(index)` (from 1) and `FF_GAME.plays`. The game says Noah's catch-up line by itself after a jump, so only make sure it shows in the captions strip; do not call `catchUp` yourself. While the manager is opted in, "next score" must not give away that a score is coming: label it "next big moment" and jump to the next play tagged `highlight`, or hide it. Use `FF_GAME.hold(true)` while the slider is being dragged and release it after. Keyboard: left and right arrows for previous and next play. Check at 375 wide and with a screen reader name on every control. Tell Noah with a NOTE if the catch-up line is too long for the strip.

## Task B23: the top play as a picture (with Ricky)

On the recap, after the final, a "Share the top play" button. It draws a card on a canvas (1080 by 1350): the app's look from `css/app.css`, both team names and the final score, the top play's text, the player's name and the fantasy points it earned, and "Sample game. Real names, made-up stats." in small type. Then `navigator.share` with the picture where the browser can, else a download link. Top plays come from Ricky's module (D18): ask him with `ASK "ricky: ..."` which function to call in the browser and its shape; fall back to the play with the most fantasy points from the results you already collect. Never offer the button while scores are hidden. Check: the picture is made in headless Chromium and is not blank.

## Task B24: demo mode

`?demo=1` plays the two-minute demo in `pitch/DEMO-SCRIPT.md` by itself, so the video can be recorded in one take: it opens each screen in the script's order with the script's timings, opts in, starts the game, jumps with `FF_GAME.seek` to the plays the script names, shows a why card, runs to the final at high speed, and lands on the recap reveal. A small "demo" tag in a corner, and any tap or key stops it. No new content: only drive what exists. If the script names something the app cannot do, leave that step out and list it in your DONE post. Check: a full run in headless Chromium ends on the recap with no errors.

## Task B25: hot and cold on the lineup (with Ricky and Noah)

Ricky's D24 put recent form in `data/profiles/<team>.json` (`players.<slot>.form`, shape in `docs/CONTRACT.md` section 4). On the lineups screen show, next to each player who has it, a small hot, cold or steady mark with one line of why ("deep ball rate 0.81 over the last three weeks, 0.62 on the season"), and the weeks it covers. Use the same thresholds as Noah's hot and cold lines (C16): ask him with `ASK "noah: ..."` so the screen and the voice never disagree. It is real data about real players, so label its source and date as the file gives them. Nothing shows when `form` is missing or null. Works when the page is opened from a file (the fetch fails): then show nothing.

## Task B26: soccer gets the same extras (with Juan and Noah)

The soccer app is Juan's (`soccer/`), so this is a hand-over, not an edit: write the jump bar (B22), the rule cards (B21) and the share card (B23) so they work for any game object with the contract's members (`on`, `seek`, `hold`, `plays`, `mode`) and any announcer with `explain`, `explainFor` and `catchUp`, in a file of yours under `js/screens/`. Then post `ASK "juan: ..."` with the exact script tag and the two or three calls his `soccer/index.html` needs, and `ASK "boss: ..."` if `SC_GAME` lacks `seek` or `hold`. Noah's C20 gives the soccer sentences. Check with a fake game object in headless Chromium.

## Task B27: the story of the game (with Ricky and Noah)

On the recap screen, after the reveal, a written recap a person can read in thirty seconds: a headline, three or four short paragraphs (how it started, the turning point, who won it for which fantasy team, the final), and the three top plays as links that jump to the play (`FF_GAME.seek`). Build it from what exists: Ricky's story data (D30; until it is on main use drives D19, momentum D21 and top plays D18 directly), and Noah's `FF_ANNOUNCER.bigCall` text for the top plays. Never shown while scores are hidden. No invented facts: every sentence must come from a number in the game. Check: the text for both football game files reads right and names the right winner.

## Task B28: Spanish for the screens (with Noah)

A language switch (English, Spanish) remembered as `fr.lang`. Every word the screens show goes through one table in a file of yours, with the Spanish next to the English; nothing is left in English when Spanish is on, including button names for screen readers and the share card. Noah's C24 makes the announcer and captions speak Spanish: set `FF_ANNOUNCER.lang` from the switch (ask him for the exact name). Player and team names stay as they are. Check: a headless run in Spanish finds no English word from the table on any screen.

## Task B29: watch party (with Ricky)

One game on a laptop or television, phones as remotes. The laptop opens `?party=host` and shows a four letter room code; a phone opens the app, taps "Join a watch party", types the code and gets a remote: play, hold, previous play, next play, next big moment, speed, and its own private view of its fantasy points if it is not opted in to hidden scores. The laptop obeys the commands through `FF_GAME` (`start`, `hold`, `seek`, speed). The relay is Ricky's task D31 in the service (`?api=` gives its address): ask him for the routes. When there is no service, fall back to `BroadcastChannel` so two tabs on one machine work, and say on screen that phones need the service. Check: two pages in headless Chromium, one hosts, one sends each command, the host does it.

## Task B30: every screen at four widths

Open every screen and state (league, matchup before and after opt-in, lineups, plays, film room, this week, recap before and after the reveal, the game view with the jump bar, a rule card, a why card, the share card dialog, demo mode, watch party when it exists) at 320, 375, 768 and 1280 wide in headless Chromium, in English and in Spanish when B28 is in. Fix everything that overlaps, is cut, scrolls sideways, or has a tap target under 44 pixels. Say in the DONE post what you found and fixed per screen, and what only a real phone can show.

## Task B31: league home from the service (with Ricky)

When the app is opened with `?api=<address>`, the league home reads Ricky's `GET /league` (D33): standings, each week's results, and who has opted in this week, in place of `data/league.json`. Never show anyone's points for a game that is not final. When the service does not answer within two seconds, or there is no `?api`, use the file as today and show nothing about it. Ask Ricky for the shape if his NOTE is not enough. Check: with `node server/index.js` running without a database, and with no service at all.

## Task B32: one command for the reveal flow

`node js/screens/flow-test.js` (it may use the Chromium that `tools/smoke.sh` finds; no new dependency): opens the app, opts in, checks that no fantasy point shows anywhere (screens, canvas floaters off, captions, halftime line, share button absent), watches to the final at high speed, checks the reveal shows the right winner and points for both game files, then the same not opted in. Prints one line per step and OK or the failures. Post `NOTE "boss: ..."` with the command so it joins the review round, and `NOTE "ricky: ..."` so it joins `data/checks/all.js`.

## Task B33: commissioner view (with Ricky)

`?commish=1` opens a screen for the league's commissioner: every matchup of the week with who has opted in, a "release the recap" switch per week (the Tuesday release, by hand), and a count of who has watched to the final. It reads and writes Ricky's commissioner routes (D35) when `?api=` is set; without the service it works on this device only and says so. No points for unfinished recaps, even here. Ask Ricky for the routes.
