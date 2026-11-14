# Handoff for Ricky's agent

You work for **Ricky**. GitHub username `Rickstar-App`. Git email `222289480+Rickstar-App@users.noreply.github.com`.
Lane: D, players, profiles and database. You may edit only: `js/data.js`, `data/rosters/`, `data/profiles/`, `agents/scout/`, `db/`, `server/`, and your own `board/Rickstar-App.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "Rickstar-App"` and `git config user.email "222289480+Rickstar-App@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `Rickstar-App/work` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/Rickstar-App.md` has no READY line yet, run `sh tools/post.sh READY "hello from Ricky"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `Rickstar-App` as both names. If it shows anything else, STOP and tell Ricky to tell Juan. Do nothing else.

## How to work

Follow the work loop in `CLAUDE.md` section 3: `sh tools/sync.sh`, `sh tools/next.sh`, CLAIM, do it, DONE, repeat, without waiting to be told. When there is no task, `sh tools/wait.sh`. Never guess a fact. If you could not check something, say so in the DONE post. The boss queue in `board/BOSS.md` decides the order; the sections below are the full descriptions.

## Task D1: real players and their profiles

Edit only `js/data.js` and new files in `data/profiles/` and `data/rosters/`.

1. In `js/data.js`, replace the invented player names in both `TEAMS` rosters (QB, RB, WR1, WR2, WR3, TE, K) with real current NFL players, as two fantasy rosters would have them: players from different real teams on each roster. Keep the team ids, the fantasy team names and the colors. Do not change `SAMPLE_GAME`. Update the comment at the top so it is true: the players are real, the sample game is still invented.
2. Create `data/profiles/GOB.json` and `data/profiles/PYT.json` in the shape of `docs/CONTRACT.md` section 4. For each player: name, position, and tendencies as numbers from 0 to 1 (for example `deep_ball`, `short_pass`, `run_share`, `target_share`, `red_zone_use`, `kicker_range`). On-field tendencies only. Nothing about anyone's private life. No photos.
3. Say where every number came from in the `source` field, with the date. If you cannot verify a number, write `null` and say so in `notes`. Do not invent statistics.

Check: `node tools/validate.js` still passes and the page loads with no console errors.

## Task D2: the database schema

Create `db/schema.sql` and `db/README.md`. Edit nothing outside `db/`. Do not sign up for anything and do not connect to any database.

The database is Tiger Data (PostgreSQL with the TimescaleDB extension). Every play is one row over game time:

- a table `plays` (`game_id`, `seq`, `played_at timestamptz`, `quarter`, `team`, `slot`, `player`, `kind`, `yards`, `fantasy_points`, `detail jsonb`, `why jsonb`), made a hypertable on `played_at`
- a table `games` (`id`, `sport`, `home`, `away`, `created_at`, `final_home`, `final_away`) and a table `optins` (`game_id`, `manager`, `opted_in_at`)
- two continuous aggregates: fantasy points per player per game, and points per team per quarter
- one example query for each screen that would use it (the recap's top performers, the score by quarter)

`db/README.md` explains in plain words how to apply the schema once Juan has the connection string, and that the string lives only in `.env`.

## Task D3: the service

Only after the boss posts that the database account exists. In `server/`, a small Node service with no framework: `POST /games/:id/plays` saves plays, `GET /games/:id/plays` returns them in order, `GET /games/:id/summary` returns the two aggregates. It reads `DATABASE_URL` from `.env`. Add `server/README.md` with how to run it.

## Task D4: a week of stat lines

Create `data/statlines/week11.json`: for each of the 14 players on the two rosters and the two defenses, one fantasy stat line for a made-up week (pass yards, pass touchdowns, interceptions, rush yards, rush touchdowns, receptions, receiving yards, receiving touchdowns, field goals made and missed, extra points). Keep each line believable for that position. Mark the file clearly as invented sample data. This file is what the game maker reads to build a game, so add `data/statlines/README.md` describing every field.

## Task D5: scoring rules

Create `data/scoring.json` with the league's scoring rules as data (standard half-point-per-reception rules: 1 point per 25 pass yards, 4 per pass touchdown, minus 2 per interception, 1 per 10 rush or receiving yards, 6 per rush or receiving touchdown, 0.5 per reception, 3 per field goal, 1 per extra point) and `agents/scout/score.js`, a small module with no dependencies that turns a stat line into fantasy points, runnable with node, with a check that prints each player's points for `week11.json`.

## Task D6: real tendencies with sources

Fill the `tendencies` in `data/profiles/GOB.json` and `PYT.json` from real season numbers where you can read them from a public source in this session. Put the source and the date next to every number you fill. Where you cannot reach a source, leave `null` and say so. Do not estimate from memory and do not invent.

## Task D8: Devpost text and the honest list

Create `pitch/DEVPOST.md`: the sections Devpost asks for (inspiration, what it does, how we built it, challenges, accomplishments, what we learned, what is next), written from `README.md`, `docs/` and the board. Create `pitch/REAL-AND-SIMULATED.md`: two lists, what is real and what is simulated, taken from the code and the DONE posts, with nothing overstated. Plain words, no em dashes.

## Task D7: soccer rosters and profiles

Only after the boss posts that soccer is merged. Two fantasy soccer rosters of real players in the shape the soccer game reads, and profile files with on-field tendencies and sources.

## Task D9: sample league file (with Peyton)

Peyton is building a League screen (task B4). Create `data/league.json`: a small invented league with four fantasy teams, this week's two matchups (ours first, using the two rosters in `js/data.js`), who opted in, and the recap release day. Ask Peyton which fields her screen needs before you finish: `sh tools/post.sh ASK "peyton: ..."`. Mark the league as invented. Post a NOTE to her with the final shape.

## Task D10: seed file

Create `db/seed.sql`: `INSERT` statements that put the sample game from `data/games/sample-football.json` into the `games` and `plays` tables of `db/schema.sql`, one row per play, with `played_at` spaced over a three-hour game. Add `db/make-seed.js`, runnable with node and no packages, that regenerates the file from the game file. You cannot run it against the database; the boss will.

## Task Q3: honesty check

Read `README.md`, `pitch/` and the DONE posts on the board, and compare them with the code on main. Send each owner a NOTE for anything that says more than the code does: `sh tools/post.sh NOTE "<name>: <file>: <the sentence> is not true because <what the code does>"`. Send the boss the same for `README.md`. The Devpost rules disqualify projects that overstate, so be strict.

## Task D11: optional certificate check

In `server/index.js`: when the environment has `DATABASE_CA_FILE`, read that certificate file and pass it to the driver so the server is verified against it; when it is not set, connect exactly as the connection string says. Cover both paths in `server/test.js` with the fake database, and describe it in `server/README.md`. Never turn certificate checking off in code.

## Task D12: Scout, the deep agent (the LangChain track)

Build a real research agent with LangChain's `deepagents` package in `agents/scout/` (Python). First read the package's current documentation and its installed source (`pip show deepagents`, then the files) so you use its real API; do not write it from memory.

What Scout does: for each of the 14 players on the two rosters in `js/data.js`, it plans its own steps, calls tools, and writes a profile.

- Tools you write for it: `find_player(name)` and `season_stats(player_id)` and `weekly_stats(player_id)` that read a public stats source over HTTPS (start with Sleeper's public API at `api.sleeper.app` and `api.sleeper.com`, which needs no key; ESPN's public JSON is the second choice), `write_profile(team, slot, profile)`, and `log_step(text)`.
- From the numbers it computes on-field tendencies from 0 to 1 (for example target share, yards per catch scaled, share of carries, red zone use, deep ball rate, kicker range) and writes `data/profiles/GOB.json` and `PYT.json` in the contract's shape, with the source address and the date next to every number. It also writes `data/rosters/season-2026.json` with the raw season numbers it used.
- It writes a research log for each run in `agents/scout/runs/`, one line per step it took, so a judge can see it plan and act.
- The model comes from the environment: use `GOOGLE_API_KEY` (Gemini) if it is set, otherwise `ANTHROPIC_API_KEY`. No key in any file.
- `agents/scout/README.md` says how to install and run it. `agents/scout/check.py` runs the tools against saved sample responses in `agents/scout/fixtures/`, with no network and no key, and must pass.

If a host or a key is refused in your session: do not ask your person. Post `ASK "boss: ..."` saying exactly which host or key is missing, finish the code and the offline check anyway, and say in DONE that the agent has not been run for real. Nothing about anyone's private life goes in a profile.

## Task D13: a real week of stat lines

`agents/scout/statlines.py`: for a given NFL week of this season, read the real weekly numbers for the 14 players from the same public source and write `data/statlines/week<NN>-real.json` in exactly the shape of `data/statlines/week11.json`, with the source and date. This is what lets the game maker build a game from a real week. Add fixtures and an offline check like D12. If the host is refused, finish the code and the check and post the ASK.

## Task D14: the service, finished

In `server/`: `POST /games/:id/optin` and `GET /games/:id/optins` using the `optins` table; `server/push-game.js`, run with node, that reads a game file from `data/games/`, replays it with `js/rules.js`, and sends every play to the service with the time it happened in the game, the fantasy points and the `why`; answers for a browser on another port (CORS for `http://localhost:*`); and a `GET /health` that says whether the database answers. Extend `server/test.js` for all of it.

## Task D15: one scoring truth (with Peyton)

`js/rules.js` is the scoring the game is built on: read it and make `data/scoring.json` say exactly the same thing (points per yard, per touchdown, field goals by distance, extra points, interceptions, lost fumbles, the defense's sacks and takeaways, and that receptions score nothing). Update `agents/scout/score.js` and its check so the points it computes for the sample game equal the points `node engine/make-game.js --from-sample --no-jev` reports. Post a NOTE to peyton with the final shape.

## Task D16: past weeks and standings (with Peyton)

Peyton's season screen (B16) reads `data/league.json`. Add to it, keeping every field that is there now: `weeks`, a list with two finished past weeks (9 and 10) and the current week 11. Each week: `{ week, finished, matchups: [ { teams: [ {id, full, tile}, {id, full, tile} ], final: [points, points] or null, gameFile: "<path under data/games/>" or null } ] }`. Past weeks have `final` numbers and `gameFile: null` (there is no game file for them, the screen says so). Week 11 has `final: null` and the game file the app plays. Add `standings`: one row per team `{ id, full, wins, losses, pointsFor, pointsAgainst }`, and it must follow from the finished weeks exactly. Keep `invented: true` and say in the file's note that every past score is made up. Write `data/checks/league.js` (run with node, prints OK or what is wrong): the file parses, every team id in a matchup exists, wins plus losses equal the finished weeks each team played, points for and against add up from the finals. Then `sh tools/post.sh NOTE "peyton: ..."` with the exact shape. `data/checks/` is yours.

## Task D17: the judges' questions

`pitch/QUESTIONS.md`: the fifteen questions a judge is most likely to ask, each with an answer of two or three sentences a person can say out loud, and under each answer the file and line that proves it. Cover at least: what is real and what is made up, what Jev (the play caller) decides and what the engine decides, how many plays Jev chose in the game the app plays (read `report` in `data/games/week11-football.json`), why scores are hidden, what the database stores and whether the app reads it today, what Scout is and whether it has run for real, how the announcer makes its lines, what soccer shares with football, what each of the four people built, what is next. An answer may never say more than the code does: read the code for each one, and where something is built but not run or not connected, say that in the answer. End with a short list of claims to avoid on stage.

## Task D18: top plays (with Peyton)

`server/top-plays.js`: a module with `topPlays(gameFile, n)` that replays a game file with `js/rules.js` (as `server/push-game.js` in D14 does) and returns the `n` biggest plays, ranked by the fantasy points of the play and then by `why.highlight`: `{ index, quarter, clock, team, kind, yards, players: [names], points, highlight, text }`, where `text` is one plain sentence for the play. Add `GET /games/:id/top-plays?n=3` to the service, answering from the database when it answers and from the game file in `data/games/` when it does not, and say which in the reply (`source: "database"` or `"file"`). Add `node server/top-plays.js data/games/week11-football.json 3`, which prints the same list, and extend `server/test.js`. Then `sh tools/post.sh NOTE "peyton: ..."` with the shape, so the recap and the season screen can show the biggest plays of a game. If D14 is not finished yet, do D14 first.

## Task D19: drive chart data (with Peyton)

Peyton's film room (B14) draws a drive chart. Give it the data. `server/drives.js`: `drives(gameFile)` replays the game with `js/rules.js` (reuse `server/replay.js`) and returns one entry per drive: `{ index, team, quarter, startYard, endYard, plays, yards, seconds, result }`, where `result` is one of `touchdown`, `field goal`, `missed field goal`, `punt`, `interception`, `fumble`, `downs`, `half`, `end`, and yards are measured from the offense's own goal line (0 to 100). Add `GET /games/:id/drives` to the service (from the database when it answers, from the file when it does not, with `source` in the reply), `node server/drives.js data/games/week11-football.json` to print the list, a query in `db/queries.sql` that gives the same per-drive numbers from the `plays` table, and tests. The number of touchdowns and field goals in the list must match the final score of the game file; check that in the test. Then `sh tools/post.sh NOTE "peyton: ..."` with the shape, and ask Peyton what else the chart needs.

## Task D20: a second week of stat lines

`data/statlines/week12.json`, in exactly the shape of `data/statlines/week11.json`, invented and marked as invented, where the other team wins and the game is high scoring (both teams over 24 points). It has to be a week a real game could produce: each quarterback's passing yards and touchdowns equal the sum of that team's receiving yards and touchdowns, receptions are plausible for the yards, kicker extra points equal that team's touchdowns unless a miss is listed, and each defense's points allowed equal the other team's score. Write `data/checks/statlines.js` (node, prints OK or what is wrong) that checks those sums for every file in `data/statlines/`, and run it on week 11 too. Post `NOTE "boss: ..."` when it is on your branch: the boss builds the second game file from it.

## Task D21: momentum (with Peyton)

`server/momentum.js`: `momentum(gameFile, bucketSeconds)` replays the game and returns, per bucket of game time (default 120 seconds), each team's fantasy points and real points in that bucket and the running totals: `{ bucketSeconds, buckets: [ { start, quarter, fp: [a, b], score: [a, b], fpTotal: [a, b], scoreTotal: [a, b] } ] }`. The last bucket's totals must equal the game's final score and total fantasy points; test that. Add `GET /games/:id/momentum?bucket=120` (from the database with `time_bucket` over the play time when it answers, from the file when it does not, with `source` in the reply), the query in `db/queries.sql`, and `node server/momentum.js <game file>`. Then `NOTE "peyton: ..."` with the shape: it is for a momentum chart in the recap and the film room, shown only after the reveal.

## Task D22: soccer in the service

Make `server/push-game.js` and `server/replay.js` handle a soccer match file (`soccer/data/*.json`, `sport: "soccer"`): replay it with the soccer rules in `soccer/js/`, and send every event as a row with match time, the players, the fantasy points (`res.fp`) and the kind of event. If the `plays` table needs a column to tell the sports apart or to hold match minutes, add a migration file `db/migrate-002-soccer.sql` that is safe to run twice, and do not change `db/schema.sql` in place. Tests with the fake database: the number of goal rows equals the final score of the match file. Ask Juan's soccer agent how events and `res.fp` are shaped if the code does not make it clear: `ASK "juan: ..."`. Say in DONE what has not run on the real database.

## Task D23: Devpost text, refreshed

Re-read `pitch/DEVPOST.md` against what is on main now and fix every line that is out of date (soccer is reachable from the sport switch, the service has opt-in, health and push routes, Scout and the real-week script are built and not run, the jingles and the hidden halftime report exist). Add a section "Sponsor tracks" with one short paragraph each for Typesafe (Jev, the play caller), Tiger Data, LangChain (Scout) and ElevenLabs: what we built with it, the file that shows it, and in plain words what has and has not run for real. Read `board/BOSS.md` (Merged and Waiting for Juan) for the current truth. Keep the whole text under 600 words plus the tracks section.

