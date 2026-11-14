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
