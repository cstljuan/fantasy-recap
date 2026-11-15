# Architecture (source for the architecture picture)

Checked against main on 2026-11-15. Each part has a mark: REAL (it runs and was checked), SIMULATED (it runs, but its data is invented), NOT YET RUN (written, offline-tested, never run for real). Two worlds: BUILD TIME on a laptop (a person runs a command, some steps use the network) and THE BROWSER (the app a viewer opens; no install, no build).

## Parts

| # | Part | What it is | Runs | Mark |
|---|---|---|---|---|
| 1 | Football game maker | `engine/make-game.js`: turns stat lines (or a real week's plays) into a full legal game, and tags highlights | build time | REAL |
| 2 | Jev | An outside play caller (TypeSafe AI) the game maker asks, over the network, which play to run at 40 of the 84 snaps of the main game | build time, network | REAL for the main game (40 of 84 snaps) and, since 2026-11-15, for the Turtles against Owls game (97 of 184 snaps) |
| 3 | Rules engine | `js/rules.js`: downs, distance, possession, score, fantasy points. Referees every play when a game is built and again in the browser | both | REAL |
| 4 | Soccer match maker | `soccer/engine/make-match.js` with its own rules; no Jev | build time | REAL, data SIMULATED |
| 5 | Game files | `data/games/*.json` (five football games), `soccer/data/*.json`; `data/games/current.js` points the app at one | files | main game SIMULATED (invented stat lines, real names); two week 9 games REAL plays; Turtles against Owls SIMULATED |
| 6 | Real plays | `data/rosters/plays-2026.json`: 3,177 snaps from ESPN's play-by-play, read by `agents/scout/plays.py` | build time, network | REAL |
| 7 | The app | `index.html`, `js/app.js` and `js/screens/`: league, matchup, lineups, plays, recap, hidden scores, speed, stadium crowd, commissioner view, watch party; plain JavaScript | browser | REAL; league and managers SIMULATED (sample league) |
| 8 | Announcer | `js/announcer/`: template lines in one style, plus ElevenLabs recordings (about 560 football, 190 soccer) in `assets/voice/`; browser voice for a line without a recording | browser (recordings made at build time on Noah's account) | REAL; not heard on the demo machine |
| 9 | Scout (deepagents) | `agents/scout/`: a main agent with three subagents (stats researcher, film room, fact checker); reads Sleeper and ESPN; writes profiles and scouting reports; the report writer refuses any claim without real plays | build time, network, a model key | NOT YET RUN at scale: one model run, one player; 28 reports were written with its tools by hand in a Claude Code session |
| 10 | Profiles and reports | `data/profiles/*.json` (season tendencies, recent form, tendencies from real plays), `data/profiles/notes/` (28 reports and notes pages) | files | REAL numbers; reports REAL plays, written by hand with the tools |
| 11 | Service | `server/`: Node, plays, top plays, drives, story, momentum, trend, Scout reports, league, commissioner, opt-ins | laptop or any host | REAL against a fake database and a plain PostgreSQL 16; NOT YET RUN on Tiger Data beyond the first schema and saving and reading plays |
| 12 | Tiger Data | PostgreSQL with TimescaleDB: `plays` and `fp_awards` hypertables, three continuous aggregates, `time_bucket` queries | hosted | schema REAL (ran once); migrations 002 to 004, `time_bucket` and the weekly aggregate NOT YET RUN (planned for the laptop night, `sh db/laptop.sh`) |
| 13 | Watch party relay | `server/party.js`: a phone as remote for a game on another screen; rooms in memory | service | REAL in tests; never tried with two real devices |
| 14 | Checks | `node data/checks/all.js`: every offline check, plus real database and browser checks when `DATABASE_URL` is set | laptop | REAL |

## What calls what

Build time (laptop, left to right):
1. Sleeper and ESPN (public APIs) are read by Scout's tools and scripts (9, 6) into profiles and plays (10, 6).
2. Stat lines (invented, or the real plays of one week) go into the game maker (1). For each choice the game maker may ask Jev (2) over the network. The rules engine (3) accepts or refuses every play. The finished game is replayed and compared with the stat lines before it is kept. Result: a game file (5).
3. Scout (9) calls a model (Gemini or Claude, by key) and its subagents call Scout's tools; the report writer checks every cited play against the real plays (6) and writes a report (10).
4. ElevenLabs (outside) renders every announcer line into `assets/voice/` (8).
5. `server/push-game.js` sends a game file's plays to the service (11), which stores them in Tiger Data (12).

In the browser (a viewer, no install):
6. The app (7) loads a game file (5), the profiles (10) and the recordings (8) as plain files. It replays the game with the rules engine (3); the announcer (8) speaks each play; the crowd and sounds are made in code.
7. Optional, only when the page is opened with `?api=<service>`: the app calls the service (11) for the league, sends the opt-in and the "reached the final" count, and uses the commissioner routes and the watch party relay (13). The service reads and writes Tiger Data (12), or answers from the game files when the database does not answer.
8. Not wired yet: no screen reads the momentum, trend or Scout routes of the service; they were proven to answer in a browser (`data/checks/service-browser.js`).

## One sentence for the picture

A game maker (with Jev as play caller) builds legal games from stat lines and real plays; Scout, a deepagents team, researches players from Sleeper and ESPN with evidence-checked reports; a browser app replays the games with a recorded announcer and hides the score until the end; a service stores everything in Tiger Data and serves the league, momentum, trends and reports.
