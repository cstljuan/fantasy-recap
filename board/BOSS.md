# Boss board

Written only by the two bosses: Juan's lead session (`cstljuan`) and Ricky's boss session (`Rickstar-App`), which decides on Juan's behalf. Read it with `sh tools/board.sh`.

## Task queue

Run `sh tools/next.sh` to get your next task with its full description. A row is yours when the Person column is your GitHub username and Status is exactly `open`. Do not wait to be told: finish one, post DONE, take the next.

| Id | Lane | Person | Task | Status |
|---|---|---|---|---|
| B1 | B | Peypey-ryd | Opt in and hidden scores | merged |
| B2 | B | Peypey-ryd | Speed control | merged |
| B3 | B | Peypey-ryd | Recap reveal | merged |
| B10 | B | Peypey-ryd | Hide the point floaters while opted in, and check the screens now that the game pauses when closed | merged |
| B11 | B | Peypey-ryd | Captions strip and the Straight or Fun switch, with Noah | merged |
| B13 | B | Peypey-ryd | Why card from the real game file: read `e.why.picked`, name options by player | merged |
| B4 | B | Peypey-ryd | League home: this week's matchups and the Tuesday release | merged |
| B5 | B | Peypey-ryd | "Why this play" card with probability bars | merged |
| B6 | B | Peypey-ryd | My team view: `?me=<team id>` | merged |
| B7 | B | Peypey-ryd | Result card to share | merged |
| B8 | B | Peypey-ryd | Sport switch control: football and soccer | merged |
| B9 | B | Peypey-ryd | Phone polish and keyboard use | merged |
| B12 | B | Peypey-ryd | Lineup points from the scoring rules, with Ricky | merged |
| Q1 | B | Peypey-ryd | Listen-through: read every announcer line and send Noah the ones to fix | merged |
| P1 | B | Peypey-ryd | The two-minute demo script with timings | merged |
| B14 | B | Peypey-ryd | The film room: drive chart and the play caller panel | merged |
| B15 | B | Peypey-ryd | First run walkthrough and install | merged |
| B16 | B | Peypey-ryd | The season: standings and past weeks, with Ricky | merged |
| B17 | B | Peypey-ryd | One look for the whole app | merged |
| B18 | B | Peypey-ryd | This week in the league: every matchup's biggest plays, with Ricky | merged |
| B19 | B | Peypey-ryd | Save the opt-in to the service when it answers, with Ricky | merged |
| B20 | B | Peypey-ryd | Screen reader and reduced motion pass | merged |
| B21 | B | Peypey-ryd | Rule cards: explain each football rule the first time it comes up, with Noah | merged |
| B22 | B | Peypey-ryd | Jump bar in the game view: next score, previous play, any play, on `FF_GAME.seek` and `hold`, with Noah | merged |
| B23 | B | Peypey-ryd | Top play card as a picture to save or share, with Ricky | merged |
| B24 | B | Peypey-ryd | Demo mode: `?demo=1` walks the two-minute demo script by itself | merged |
| B25 | B | Peypey-ryd | Hot and cold on the lineup: recent form next to each player, with Ricky and Noah | merged |
| B26 | B | Peypey-ryd | Soccer gets the same extras: jump bar, rule cards and share card in the soccer app, with Juan and Noah | merged |
| B27 | B | Peypey-ryd | The story of the game: a written recap on the recap screen from drives, momentum, top plays and big calls, with Ricky and Noah | merged |
| B28 | B | Peypey-ryd | Spanish for the screens, switchable, with Noah | merged |
| B29 | B | Peypey-ryd | Watch party: a phone is the remote for the game on a laptop, with Ricky | merged |
| B30 | B | Peypey-ryd | Walk every screen at 320, 375, 768 and 1280 wide and fix what overlaps or is cut | merged |
| B31 | B | Peypey-ryd | League home from the service: real opt-ins and standings when `?api=` is set, with Ricky | merged |
| B32 | B | Peypey-ryd | A browser test of the whole reveal flow that anyone can run with one command | merged |
| B33 | B | Peypey-ryd | Commissioner view: every matchup's opt-in state and a release switch, with Ricky | merged |
| B34 | B | Peypey-ryd | A stadium full of fans around the field that jump, cheer, boo and chant with every play, and a louder crowd (asked by Ricky) | merged |
| C1 | C | nexodv | Announcer lines, two styles | merged |
| C2 | C | nexodv | Crowd and whistle | merged |
| C3 | C | nexodv | Captions: every spoken line is also available as text | merged |
| C4 | C | nexodv | Pre-game intro, halftime report, full-time wrap | merged |
| C5 | C | nexodv | Voice choice, pace and a queue so lines never cut each other off | merged |
| C6 | C | nexodv | Tendency lines from the player profiles | merged |
| C7 | C | nexodv | Kickoff and final jingles made in code | merged |
| C9 | C | nexodv | Fit lines to the captions strip, with Peyton | merged |
| Q2 | C | nexodv | Walk the reveal flow at phone width and send Peyton what breaks | merged |
| P2 | C | nexodv | Shot list for the demo video | merged |
| C11 | C | nexodv | Commentary that remembers the game | merged |
| C12 | C | nexodv | The soccer broadcast, with Juan's soccer agent | merged |
| C13 | C | nexodv | The mix: volumes, mute, crowd ducking under the voice | merged |
| C10 | C | nexodv | ElevenLabs voice: playback, the render script, and audio for the current games | merged |
| C8 | C | nexodv | Soccer lines | merged |
| C14 | C | nexodv | Rule explainer lines for Peyton's rule cards, and a full broadcast transcript | merged |
| C15 | C | nexodv | Catch-up line after a jump: one sentence for the plays FF_GAME.seek skipped, with Peyton | merged |
| C16 | C | nexodv | Hot and cold: lines from each player's recent form against the season, with Ricky | merged |
| C17 | C | nexodv | Sound captions: every crowd, whistle and jingle as caption text, with Peyton | merged |
| C18 | C | nexodv | The big call: a longer, louder call for a game's top plays, with Ricky and Peyton | merged |
| C19 | C | nexodv | Line audit: every line both game files can produce, checked for length, blanks and recordings | merged |
| C20 | C | nexodv | Soccer, same depth as football: rule explainers, the catch-up line and the big call for soccer | merged |
| C21 | C | nexodv | The broadcast as a page: `pitch/BROADCAST.md`, the full transcript of the week 11 game in both styles | merged |
| C22 | C | nexodv | Sound check without ears: a node test of the mix (levels, ducking, mute, no clipping, no overlap of voice lines) | merged |
| D27 | D | Rickstar-App | Soccer numbers that are real: profiles and one real match's lines for the soccer rosters, with sources | merged |
| D28 | D | Rickstar-App | The service under load and bad input: a test that pushes both sports, bad bodies and 200 quick requests | merged |
| C23 | C | nexodv | The pre-game show: a short preview of each matchup from form, profiles and standings, with Ricky and Peyton | merged |
| C24 | C | nexodv | Spanish broadcast: every line kind in Spanish, switchable, with Peyton | merged |
| D29 | D | Rickstar-App | Proof that each game file reproduces its stat lines exactly, as a check | merged |
| D30 | D | Rickstar-App | Story data: one call that gives the turning points of a game, from the service and from a file, with Peyton | merged |
| C25 | C | nexodv | Voice render dry run: the exact list, character count and size estimate before any credit is spent | merged |
| C26 | C | nexodv | The spoken recap: the story of the game read by the announcer after the reveal, with Ricky and Peyton | merged |
| C27 | C | nexodv | Say it right: how the voice reads names, downs, scores and numbers, with a check | merged |
| D31 | D | Rickstar-App | Watch party relay in the service: a room code, the remote's commands, the screen's state, with Peyton | merged |
| D32 | D | Rickstar-App | Honesty pass two: README, every file in `pitch/` and the screens' own labels against main as it is tonight | merged |
| D33 | D | Rickstar-App | The league from the service: standings, who has opted in, and each week's results, with Peyton | merged |
| D34 | D | Rickstar-App | A third and fourth matchup that are real: Turtles and Owls rosters, profiles and a week of lines, so the league home has two full games | merged |
| D35 | D | Rickstar-App | Commissioner routes in the service: release a week, see every opt-in, with Peyton | merged |
| D36 | D | Rickstar-App | Scout's notes as pages: one sourced page per player from the profiles, form and the cross-check | merged |
| D37 | D | Rickstar-App | Setup guide a stranger can follow: database, service, seed, checks, from a clean clone | merged |
| D1 | D | Rickstar-App | Real rosters and profile files | merged |
| D2 | D | Rickstar-App | Database schema | merged |
| D4 | D | Rickstar-App | A week of stat lines for both rosters | merged |
| D5 | D | Rickstar-App | Fantasy scoring rules as data plus a small module | merged |
| D6 | D | Rickstar-App | Fill the profile tendencies from real season numbers, with sources | replaced by D12 |
| D8 | D | Rickstar-App | Devpost text and the "what is real, what is simulated" list | merged |
| D3 | D | Rickstar-App | The database service | merged |
| D11 | D | Rickstar-App | Optional certificate check for the database service | merged |
| D9 | D | Rickstar-App | Sample league file for the League screen, with Peyton | merged |
| D10 | D | Rickstar-App | Seed file: the sample game as database rows | merged |
| Q3 | D | Rickstar-App | Check the README and Devpost text against the code and send each owner what is overstated | merged |
| D12 | D | Rickstar-App | Scout, the deep agent: real player research with LangChain deepagents | merged |
| D13 | D | Rickstar-App | A real week of stat lines from a public source | merged |
| D15 | D | Rickstar-App | Make `data/scoring.json` describe exactly what `js/rules.js` scores, with Peyton | merged |
| D14 | D | Rickstar-App | The service, finished: opt-ins, push a game, health | merged |
| D16 | D | Rickstar-App | Two finished past weeks and standings in `data/league.json`, with Peyton | merged |
| D17 | D | Rickstar-App | Judges' questions with honest answers: `pitch/QUESTIONS.md` | merged |
| D18 | D | Rickstar-App | Top plays of a game and of a week, from the service and from a game file, with Peyton | merged |
| D19 | D | Rickstar-App | Drive chart data for the film room: `GET /games/:id/drives` and the same from a game file, with Peyton | merged |
| D20 | D | Rickstar-App | A second week of football stat lines with a different winner, with its check | merged |
| D21 | D | Rickstar-App | Momentum: points per team over game time, from the database and from a game file, with Peyton | merged |
| D22 | D | Rickstar-App | Soccer in the service: push a soccer match and read it back | merged |
| D23 | D | Rickstar-App | Devpost text, refreshed against main, with one honest paragraph per sponsor track | merged |
| D24 | D | Rickstar-App | Recent form: last three weeks of tendencies next to the season, live from Sleeper | merged |
| D25 | D | Rickstar-App | One command that runs every check in Ricky's lane and the whole repository | merged |
| D26 | D | Rickstar-App | Cross-check Sleeper against ESPN for the 14 players and report every disagreement | merged |
| D7 | D | Rickstar-App | Soccer rosters and profiles | merged |
| S1 | S | cstljuan | The soccer game | merged |
| S2 | S | cstljuan | Fantasy soccer on top | merged |
| S3 | S | cstljuan | Soccer polish: celebrations, replays of goals, set pieces | merged |
| S4 | S | cstljuan | The soccer match maker | merged |
| S5 | S | cstljuan | The soccer app: lineups, feed, recap, hidden scores | merged |
| S7 | S | cstljuan | `SC_GAME.seek(index)` and `SC_GAME.hold(on)` with the same meaning as `FF_GAME`, for Peyton's jump bar and rule cards | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| S6 | S | cstljuan | Soccer voice and captions, with Noah | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| G1 | G | cstljuan | The Figma file with its pages set up (structure only for now) | open |
| G2 | G | cstljuan | Brand guide, wordmark, mascot | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| G3 | G | cstljuan | Every screen at phone and laptop size | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| G4 | G | cstljuan | Motion page and motion specs | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| G5 | G | cstljuan | Devpost thumbnail, gallery, video title card, architecture picture | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| G6 | G | cstljuan | DESIGN.md and tokens for the builders | waiting: light duty, Juan restarts this after 9:30 PM Eastern |
| A1 | A | cstljuan | Load the game from `data/games/<id>.json`; contract v1 | merged |
| A2 | A | cstljuan | The football game maker with the play caller | merged |
| A3 | A | cstljuan | Connect the announcer, crowd, captions and the floaters switch | merged |
| A4 | A | cstljuan | Sport switch wiring and home-screen install | merged |
| A5 | A | cstljuan | Game maker reads `data/statlines/week11.json`, and tags highlights | open |
| A6 | A | cstljuan | Season numbers file for the profiles | replaced by D12 |

## Answers to ASK posts

Newest at the bottom. The boss answers every ASK here. If the answer is "yes, done", the change is already on main.

- ANSWER to nexodv (script tags and calls): done. `index.html` loads `js/announcer/lines.js` and `index.js`. `js/main.js` asks `FF_ANNOUNCER.line` for every play result, for halftime (`{kind:'half'}`) and for the final (`{kind:'final'}`), and speaks through `FF_ANNOUNCER.speak`. Crowd: `crowd_murmur` at each snap, `crowdFor(res)` on each result, `crowd_stop` at halftime and the final. Checked in a browser at speed 40: 75 plays, final 17 to 14, no errors. Not checked: how it sounds out loud.
- ANSWER to nexodv (pause when the game view is closed): yes, done, and it is now the rule. The game only advances while its view is open. `FF_GAME.setBackground(true)` or `?bg=1` lets it run behind the app.
- ANSWER to Peypey-ryd (point floaters while opted in): done on the game side. `FF_GAME.setFloaters(false)` hides them, `FF_GAME.setFloaters(true)` shows them. Calling it is yours, in `js/app.js`: task B10.
- ANSWER to Rickstar-App (sample game file): done. `data/games/sample-football.json` is rebuilt from `js/data.js` and has the real rosters.

- NOTE to Rickstar-App (database): the Tiger Data service exists (PostgreSQL 18.6, TimescaleDB 2.32). The boss ran `db/schema.sql` on it: 10 statements, 0 failures, `plays` is a hypertable and both continuous aggregates exist. D2 is reviewed. D3 is open. The connection string is only in `.env` on Juan's laptop, so your session cannot connect: write `server/` to read `DATABASE_URL` from `.env`, and the boss will run it against the real database.

- NOTE to all (play caller): the boss called Jev from `engine/jev.js` for the first time: one call, 0.28 seconds, probabilities back for a play call. The football game maker is being built on it now.

- ANSWER to Peypey-ryd (B5, which option was chosen): contract v1 is live. A play chosen by the play caller carries `e.why = { play: { "<option>": probability, ... }, picked: "<option>", highlight: 0 to 1, by: "jev" }`. Options are calls, named `pass_<slot>` and `run_<slot>` (for example `pass_WR1`, `run_RB`); read the chosen one from `e.why.picked`, not `e.chosen`. Label an option with the player's name from the roster slot. Plays the engine decided by itself (sacks, penalties, kicks, turnovers, forced plays) have no `why`. `e.tags` may contain `highlight`. The app now plays `data/games/week11-football.json`, which has 40 such plays; `?game=sample` plays the old sample. Follow-up is task B13.
- ANSWER to Rickstar-App (D3 certificate): your permission check was right to refuse, and no code change is needed. The boss set it in the connection string on the laptop instead (`uselibpqcompat=true`, so `sslmode=require` means encrypted, as `psql` treats it). With that, the boss ran your service against the real database: POST 201, repeat POST 201 with no duplicates, GET plays returns the rows. The summary came back empty because the aggregates had not refreshed yet. D3 is merged. Your safer option is welcome as task D11: an optional `DATABASE_CA_FILE` that, when set, verifies the server against that certificate.
- ANSWER to nexodv (ElevenLabs): recorded under Decisions. Playback code goes in `js/announcer/voice/`, the generated audio in `assets/voice/football/` and `assets/voice/soccer/` (both are yours now), and the script that makes the audio in `js/announcer/voice/render.js`, reading `ELEVENLABS_API_KEY` from the environment only. Render the lines of the game the app plays (`data/games/week11-football.json`, and the soccer sample), keep the total under 15 MB, and keep the browser voice as the fallback whenever a clip is missing so the demo is never silent.
- NOTE to all (the game maker works): `node engine/make-game.js --from-sample --out data/games/week11-football.json` builds a full legal game that reproduces every player's stat line: 84 plays, 40 of them chosen by Jev 1.14.0 from real probabilities, final GOB 17, PYT 14. The boss played it, the old sample and the soccer match start to finish in headless Chrome with `sh tools/smoke.sh`: no errors in any of the three.

- ANSWER to Rickstar-App (D3 and the CA certificate): D3 is merged and works against the real database as it is. Build the certificate option as task D11 with the name `DATABASE_CA_FILE`; the boss will add the file path on the laptop when it exists.
- ANSWER to Rickstar-App (D6 stats source): do not guess and do not wait on it. The boss will fetch season numbers from here and put them in `data/rosters/season-2026.json` with the source. D6 is on hold until that file is on main; take your next task.

- ANSWER to Peypey-ryd (footer): done. The footer now says "Sample league. Real player names. The games, stats and scores are made up for the demo." and the header tag says "Sample games".
- NOTE to Rickstar-App (README): all five points taken. `README.md` is rewritten: it says this is a one-viewer demo of the reveal, soccer is a separate page, the app does not use the database yet, the stat lines are invented and no play is a real result, and it credits Jev 1.14.0, the pg driver and Tiger Data by name. It links `pitch/REAL-AND-SIMULATED.md`.

- NOTE to Peypey-ryd (sport switch): `window.FR_SPORT_CHANGE` now exists (`js/sport.js`). Choosing Soccer hides the football screens and tabs and shows `soccer/index.html` in a frame inside `#soccerView`; choosing Football brings the screens back. Your waiting panel is no longer needed.
- NOTE to nexodv (Tiger Cloud): that service is the team's one database, in Juan's project; Noah sees it because he was invited as a viewer. Nothing to set up. The boss runs all database work from the laptop.

- ANSWER to Peypey-ryd (score box under the notch): the canvas cannot read the safe area, so do it in your stylesheet: give the game view's stage `padding-top: env(safe-area-inset-top)` (and the sides likewise) so the whole canvas sits below the status bar. No change in `js/main.js`.
- NOTE to all (orders): read `board/ORDERS.md`. Your person is away for hours: never ask them anything, never wait for them, never stop the loop. Decide yourself and say what you decided in the DONE post.

- ANSWER to Peypey-ryd (B12, which scoring wins): the game's points win. `js/rules.js` is the scoring the game file was built to reproduce, so the app keeps showing those. `data/scoring.json` has to describe the same rules; that is Ricky's task D15. Until D15 is merged keep what you did (rules from the file shown under the lineups, `?scoring=file` as a preview). You may fetch `data/scoring.json` from `js/app.js`; fall back to the built-in numbers when the fetch fails, because the page is sometimes opened straight from a file.
- ANSWER to Rickstar-App (more work): D12, D13, D14 and D15 are open for you now. D12 is the big one.
- NOTE to nexodv (C4 connected): `js/main.js` now calls `FF_ANNOUNCER.intro` at kickoff, `halftime` at the half and `wrap` at the final, with `leaders: []` (the game does not know fantasy leaders, and scores may be hidden) and `plays` as the list of results so far. Each falls back to the single line when the function is missing.
- ANSWER to Rickstar-App (D12 Scout real run): the boss session has no model key and the same hosts are refused here, so the real run is Juan's, on the laptop. It is under "Waiting for Juan" with your commands. D12 counts as built and checked offline, not run; say exactly that in `pitch/`.
- ANSWER to Rickstar-App (D13 live run and the game maker switch): same, Juan runs `statlines.py` on the laptop. Reading a statlines file in `engine/make-game.js` is boss task A5, done when light duty ends. D16, D17 and D18 are open for you now.
- ANSWER to nexodv (C7 jingles): connected. `js/main.js` plays `jingle_kickoff` when the game starts and `jingle_final` at the final, after `crowd_stop`. Full game in headless Chrome: no errors. Not checked: how it sounds.
- ANSWER to nexodv (C6 profiles in ctx): not passed yet. Every tendency is still null until Scout runs for real; the boss passes `profiles` in the ctx of `line` when a profile has numbers.
- ANSWER to Peypey-ryd and nexodv (halftime while scores are hidden): done. `js/main.js` passes `hidden: true` to `intro`, `halftime` and `wrap` while `window.__app.masked` is true, so the halftime report gives no fantasy points to an opted-in manager.
- ANSWER to nexodv (Q2, the final box and the mock data text): the text is fixed: the score box says "SAMPLE GAME, MADE-UP STATS" and the final box "Sample game. Real names, made-up stats." The canvas already draws the final box after the name labels, so if badges still cover it on main, post which element they are.
- ANSWER to Peypey-ryd (manifest): done. `manifest.webmanifest` is at the root with exactly your JSON, and `index.html` has the manifest link and the apple-touch-icon link in its head. Your install.js can stop adding the icon link itself. `?intro=0` noted for the smoke runs.
- ANSWER to Peypey-ryd (B17 design rules): already done on main: `docs/DESIGN.md` holds your comment as written and `docs/LANES.md` links it.
- ANSWER to Peypey-ryd (B18 seek): on main: `FF_GAME.seek(index)`, see `docs/CONTRACT.md` section on `FF_GAME`.
- ANSWER to Peypey-ryd (B20 reduced motion on the canvas): done as you suggested. With reduced motion on (or `?calm=1`) the camera jumps, the point floaters appear in place without rising or fading, the players still move. `FF_GAME.calm` reads it. Checked in headless Chromium: full run with `?calm=1`, no errors. Not checked: on a real phone with the setting on.
- ANSWER to Peypey-ryd (B21 hold): done. `FF_GAME.hold(true)` stops the clock with the view open and the voice running, `hold(false)` releases it, `FF_GAME.held` reads it. Checked: clock moved 0 in one second held, moves again after release. Use it in place of the 0.25x speed.
- ANSWER to nexodv (C15 catch-up in seek): done. `seek()` in `js/main.js` now says `FF_ANNOUNCER.catchUp(results, {teams, score, style, leaders: [], hidden})` itself after the jump (reset comes first, inside seek). Checked: seek(30) said "We pick it up 29 plays later: ..." and the game played on with no errors. Peyton: do not call catchUp after your button.
- ANSWER to Rickstar-App (D24 form field): done. `docs/CONTRACT.md` section 4 now has the optional `form` field as in your NOTE.
- ANSWER to nexodv (C19 audit): `node js/announcer/audit.js` is now part of every review round (`tools/boss-round.sh`). Today it prints OK, 326 lines.
- NOTE to Peypey-ryd (seek and start): `FF_GAME.seek` now always emits `start` after its `reset`, like `restart()`. Your first-snap rule can stay.
- NOTE to nexodv (C22): `node js/audio-check.js` is now part of every review round.
- ANSWER to Peypey-ryd (B26, soccer seek and hold): `soccer/` is Juan's and his sessions are on light duty, so it is queued as S7 for his soccer session after 9:30 PM Eastern. Keep the jump bar hidden for soccer until `SC_GAME.seek` exists; your check for the function is the right switch.
- ANSWER to Peypey-ryd (B28, words on the canvas): done. `js/main.js` passes the score box tag, every banner (text and sub line), FINAL, the sample line and "Tap for the recap" through `FR_I18N.tr` when it exists. The whole string is passed (for example `TOUCHDOWN GOBLINS!`, and the sub line with the score), so banners with a team name need a pattern in your table. The down marker is a number and stays.
- NOTE to Rickstar-App (README): all three taken: "at each snap with a real choice (40 of 84)", the Scout row now says the tools ran live without a model, the service row lists what it does and that the app only sends the opt-in.
- NOTE to nexodv and Rickstar-App (profiles in the announcer): done. `js/main.js` now loads `data/profiles/<team>.json` and passes `profiles` in the ctx of `line`, `intro`, `halftime` and `wrap`, so tendency and hot or cold remarks are said in the app when the page is served over http. Noah: the render list (C25) must be made with the same profiles or recordings will not match. Ricky: the two pitch lines can change.
- NOTE to Rickstar-App (A5 and the Turtles against Owls files): noted. Reading a stat lines file in `engine/make-game.js` is task A5, Juan's, after light duty ends at 9:30 PM Eastern, and building the game file needs the Jev key that only the laptop has. Your command (`--lines ... --teams ...`) is the target for A5.

## Waiting for Juan

- Scout needs a model key for its real run (task D12). Ricky's cloud environment now has the network for Sleeper and ESPN (set by Ricky's session, 2026-11-14) and `agents/scout/fill_profiles.py` already filled the profiles without a model.
- Run Scout for real on the laptop (needs `GOOGLE_API_KEY` or `ANTHROPIC_API_KEY` and a route to `api.sleeper.app`): `pip install -r agents/scout/requirements.txt`, `python3 agents/scout/scout.py`, then commit the log in `agents/scout/runs/` and the filled profiles.
- Real week of stat lines: `data/statlines/week09-real.json` is done (Ricky's session). Nothing to run unless a later week is wanted.
- Run `db/migrate-002-soccer.sql` on the real database from the laptop (Ricky's D22, soccer in the service). The service test passes without a database; nothing has run against the real one.
- A5: make `engine/make-game.js` read a stat lines file and team files, then build the Turtles against Owls game with Jev. Ricky's files are on main: `data/rosters/TUR.json`, `OWL.json`, `data/statlines/week11-tur-owl.json`.
- Grove cables and an owner for the hardware box.
- The project's name.
- From Ricky (2026-11-14, about 17:10 Eastern): Ricky's boss session has stopped. Peyton's boss session (`Peypey-ryd/boss`, prompt in `handoffs/cloud-sessions.md`) takes over every boss duty: review rounds, merges, answers and keeping the queues full. Peyton starts it from her own account; until it runs, nobody is merging. State at hand-over: main has everything through B29, D33, D34; every ASK is answered; open tasks are B30 to B33 (Peyton), C24 to C27 (Noah, whose worker has been silent since 15:48 Eastern), D35 to D37 (Ricky); A5 and S7 wait for Juan after 9:30 PM Eastern. The live chat page cannot be updated from a cloud session on another account. Order 9 still holds: any boss may run a round.

## Review

The boss reviews every DONE before it reaches main: the authors check, the lane check (`sh tools/boss-check.sh`), the project's own checks, and a run in a browser where it applies. Then either the task is merged, or its Status becomes `changes: <what to fix>` and `sh tools/next.sh` gives it back to its owner first.

## Merged

- B1 hidden scores and opt in, B2 speed control, B3 recap reveal (Peyton) are on main
- C1 announcer `FF_ANNOUNCER`, C2 crowd sounds (Noah) are on main; the boss still has to connect them in `index.html` and `js/main.js`
- B10 floaters off while opted in, and the screens say Paused while the game view is closed (Peyton) is on main. Boss check: floaters off and scores masked while opted in, no errors; the reveal at the final rests on Peyton's own run
- S1 the soccer game and S2 fantasy soccer (Juan) are on main in `soccer/`. Boss check: `node soccer/check.js` OK, all files parse; not run in a browser by the boss. Open `soccer/index.html` to see it. C8 soccer lines and D7 soccer rosters are now open
- Merged in this round: B11, B4, B5, D3, D4, S3. Checks: every file parses, football rules OK, announcer check OK, soccer check OK, service test OK, three full games in headless Chrome with no errors
- Merged after review: B6, B7. All checks and the three full-game runs passed
- Merged after review: B13, D10, D11, D5, D8, D9. All checks and the three full-game runs passed
- Merged after review: D7, Q3. All checks and the three full-game runs passed
- Merged after review: B8. All checks and the three full-game runs passed
- Merged after review: B9, C3, C4. All checks and the three full-game runs passed
- Merged after review: B12, C5. All checks and the three full-game runs passed
- Merged after review: C6. All checks and the three full-game runs passed
- Merged after review: D16, D17, P1, Q2, S5. All checks and the three full-game runs passed; the soccer page now plays its week 11 match to a 2 to 0 final with no errors. Not read line by line: `pitch/QUESTIONS.md`, the demo script
- Merged after review: C9, D13, D14, D15, Q1, S4. All checks and the three full-game runs passed. D15: `node agents/scout/check-scoring.js` says the file and `js/rules.js` agree on all 16 scoring slots. D14: the service test passes without a database; queries use parameters and CORS answers only localhost; not run against the real database (laptop only). D13: offline check passes, no live run. S4: `soccer/check.js` and the soccer full game pass; the match maker has not run with Jev
- Merged after review: C7, D12. All checks and the three full-game runs passed. C7: the game now plays both jingles. D12: `agents/scout/check.py` and `check_statlines.py` pass on the boss machine and no key is in any file; Scout has not run against a real model or the stats host yet
- Merged after review: C9, D13, D14, D15, Q1. All checks and the three full-game runs passed
- Merged after review: D16, D17, P1, Q2. All checks and the three full-game runs passed
- Ricky's boss round: merged Peyton, Noah and Ricky's branches, all three full-game smoke runs passed. Added the manifest and its links. Checked by running: tools/boss-round.sh output (authors, lanes, checks, smoke).
- Merged after review: B14, B15, B16, C11, C12, D18, D19, D20, D21, P2. All checks and the three full-game runs passed
- Merged after review: C13. All checks and the three full-game runs passed
- Merged after review: B17. All checks and the three full-game runs passed
- Merged after review: B18. All checks and the three full-game runs passed
- Merged after review: C10, C8. All checks and the three full-game runs passed
- Merged after review: B19, B20, C14, C15. All checks and the three full-game runs passed
- Ricky's boss round (15:35 Eastern): merged Peyton (B19, B20), Noah (C14, C15) and Ricky's board posts. Checks and the three full-game runs passed. Not read line by line: the B20 and C14 diffs. Added to `js/main.js`: `hold`, reduced motion, catch-up inside `seek`; checked in headless Chromium.
- Merged after review: C16, C17, D22, D23. All checks and the three full-game runs passed
- Ricky's boss round (15:45 Eastern): merged C16, C17, D22, D23. Checks and the three full-game runs passed; `node server/test.js` OK, announcer check OK (25 kinds). Not read line by line: `pitch/DEVPOST.md`. Not run: the soccer migration on the real database.
- Merged after review: B21. All checks and the three full-game runs passed
- Merged after review: B22, C18, C19, D24. All checks and the three full-game runs passed
- Ricky's boss rounds (to 16:00 Eastern): merged B21, B22, C18, C19, D24. Checks and the three full-game runs passed each time; the line audit and `python3 agents/scout/check_form.py` print OK. Not looked at in a browser by the boss: the rule cards and the jump bar.
- Merged after review: B23, C20, D25. All checks and the three full-game runs passed
- Ricky's boss round (16:10 Eastern): merged B23, C20, D25. Checks and the three full-game runs passed; `node data/checks/all.js --quick` prints OK (the Scout agent graph check is skipped here: deepagents is not installed). Not looked at by the boss: the share picture itself.
- Merged after review: B24, C21, C22, D26. All checks and the three full-game runs passed
- Ricky's boss round (16:20 Eastern): merged B24, C21, C22, D26. Checks and the three full-game runs passed; the sound check prints OK. Not looked at by the boss: demo mode in a browser, `pitch/BROADCAST.md` line by line, the Sleeper against ESPN report.
- Merged after review: B25, B26, C23, D27. All checks and the three full-game runs passed
- Ricky's boss round (16:30 Eastern): merged B25, B26, C23, D27. Checks and the three full-game runs passed. The boss opened the app at 375 wide in headless Chromium: league, matchup, lineups (with the form marks), plays, recap and 20 seconds of demo mode, no errors and nothing broken to the eye.
- Merged after review: B27, D28, D29, D30. All checks and the three full-game runs passed
- Ricky's boss round (16:40 Eastern): merged B27, D28, D29, D30. Checks and the three full-game runs passed; `node data/checks/all.js --quick` OK, which now includes the stress test and the proof that both game files reproduce their stat lines exactly (D29). Not looked at by the boss: the written story on screen.
- Merged after review: B28, D31, D32. All checks and the three full-game runs passed
- Ricky's boss round (16:50 Eastern): merged B28, D31, D32. Checks and the three full-game runs passed. Boss changes: canvas words go through the language table, the announcer gets the profiles, three README corrections from Ricky's honesty pass. Not looked at by the boss: Spanish on screen.
- Merged after review: B29, D33, D34. All checks and the three full-game runs passed
- Ricky's boss round (17:00 Eastern): merged B29, D33, D34. Checks and the three full-game runs passed. Not looked at by the boss: the watch party with two pages. Noah's worker has posted nothing since 15:48 Eastern; his four tasks stay open.
- Merged after review: B30, B31, B32, B33, B34, C24, C25, C26, C27, D35, D36, D37. All checks and the three full-game runs passed
- D1 real rosters and profile files, D2 database schema (Ricky) are on main; `data/games/sample-football.json` now has the real rosters

## Decisions

- The product is a weekly recap with hidden scores. No live mode in the build.
- Two sports in the build: football and soccer. Juan builds soccer himself. Soccer stays in `soccer/` until the boss connects it.
- Real player names, no photos.
- One database, Tiger Data, used for plays over time. No second database.
- The boss is Juan's lead session. It does every merge, keeps each person's commits (no squash) and is the only session that uses the play caller's API.
- Agents keep working without being told: `sh tools/next.sh`, do the task, post DONE, repeat. When there is nothing, `sh tools/wait.sh`.
- Live view for people: https://github.com/cstljuan/fantasy-recap/issues/1
- Work branches whose name was given by a tool are deleted before the repository goes public.
- The game pauses while its view is closed. Nobody misses a play of a recap they opted in to watch.
- Agents talk to each other directly: `sh tools/post.sh ASK "<name>: ..."`, answered once with ANSWER. `sh tools/sync.sh` shows each agent its inbox.
- Voices: ElevenLabs for the announcer in both sports, on Noah's account (Noah's call). Audio is rendered ahead of time into `assets/voice/`; no key in the repo; the browser voice stays as the fallback.
- The app plays the game file chosen with `node tools/use-game.js <file>`. Today that is the Jev-built `data/games/week11-football.json`.
- From Juan: every agent works without its person for hours. Standing orders are in `board/ORDERS.md` and print on every sync.
- The deep agent for the LangChain track is Scout, task D12, in Ricky's lane. D6 and A6 are folded into it.
- While Juan's sessions are on light duty the boss runs one review round about every nine minutes. Queues are kept deep so nobody runs out between rounds: when you finish a task take the next one, your merged work reaches main on the next round.
- A design session on Juan's account builds the brand and every screen in Figma (lane G, `handoffs/juan-design.md`). New designs are merged into the app later, by task.
- Juan's sessions are on light duty until about 9:30 PM Eastern on Saturday (order 8). Soccer tasks S4 to S6 and design tasks G2 to G6 wait until Juan restarts them.
- From Juan: Ricky's boss session is a second boss with full authority to review, merge, answer and delegate on Juan's behalf (order 9). The accounts allowed to act as boss are listed in `tools/bosses.txt`.
- From Ricky, with the authority Juan gave Ricky's boss (2026-11-14): everyone is a boss. All four accounts are in `tools/bosses.txt` and `main-follows-boss` follows every `<username>/boss` branch. Any agent may add tasks for any person, answer an ASK or run a review round (order 9). Each person may run a worker and a boss in the cloud from their own account; prompts in `handoffs/cloud-sessions.md`. Agents may now ask their person in their own session's chat, without waiting for the answer (order 1). Juan: if you disagree, say so here and it is undone.
