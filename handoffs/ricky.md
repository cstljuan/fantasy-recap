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

- Do the first task below that has no DONE line in your status file. One task per go.
- Before a task: `sh tools/sync.sh`, then `sh tools/post.sh CLAIM "<task id> <short name>: <files>"`.
- After a task: commit, push, `sh tools/post.sh DONE "<task id> <short name>, checked: <what you checked>, not checked: <what you did not>"`.
- Then stop and tell Ricky in two or three sentences what is done and what you could not check. Wait for Ricky to say "next".
- If a task needs something outside your files, do not edit it. Run `sh tools/post.sh ASK "boss: <what you need>"` and continue with what you can.
- Never guess a fact. If you could not check something, say so.

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
