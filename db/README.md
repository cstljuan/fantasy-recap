# Database

The database is Tiger Data, which is PostgreSQL with the TimescaleDB extension. Every play is one row in `plays`, stamped with the time it happened in the game. `schema.sql` holds everything: the `games`, `optins` and `plays` tables, `plays` as a hypertable on `played_at`, and two continuous aggregates (fantasy points per player per game, and points per team per quarter). It also has one example query for each screen that would use them, as comments at the bottom.

## The laptop night: one command

With `DATABASE_URL` (the Tiger Data connection string) on one line in `.env` at the repository root, or exported in the shell, from a clean clone with Node, npm, curl and psql:

```bash
sh db/laptop.sh
```

It applies the schema, the three migrations and the seed, installs the service's one dependency, starts the service on a free port, pushes every game file (every football game in `data/games/` and both soccer matches), calls every read route once, runs `node server/test-db.js`, and runs Scout for one player (`GOB.QB`, or `SCOUT_PLAYERS=GOB.QB,GOB.WR1`) only when `GOOGLE_API_KEY` or `ANTHROPIC_API_KEY` is set. It prints one line per step (`OK`, `FAILED`, `CHECK` or `SKIPPED`, with the reason) and a report at the end; the exit code is 1 if any step failed. It never prints the connection string, so the output is safe to paste to Ricky. Safe to run twice: the migrations, the seed and the pushes skip what is there, and the test deletes its own `dbtest-` rows.

Two lines to read in the report: `momentum engine` must say `time_bucket` (anything else means the TimescaleDB query did not run and the service used its fallback), and the `summary` and `trend` lines can be empty on the first run because the continuous aggregates refresh on a schedule (hourly), not at once. To rehearse on any PostgreSQL without TimescaleDB: `sh db/laptop.sh --plain`.

Run on 2026-11-15 on a plain PostgreSQL 16 with `--plain`, twice: 22 steps OK, Scout skipped (no key), no failure. It has **not** run on Tiger Data.

## The same, by hand: exact commands

From a clean clone, with only the Tiger Data connection string. Needs Node 18 or newer and `psql` (the PostgreSQL client tools).

```bash
git clone https://github.com/cstljuan/fantasy-recap.git && cd fantasy-recap
export DATABASE_URL='<the Tiger Data connection string>'
sh db/migrate.sh --seed
```

`db/migrate.sh` checks the connection and that the database has TimescaleDB, then applies `schema.sql`, every `migrate-NNN-*.sql` in number order (002 soccer, 003 commissioner) and, with `--seed`, `seed.sql`. It stops at the first error and says which file. It is safe to run again. (Instead of `export` you may put `DATABASE_URL=...` on one line in `.env`, which git ignores.)

```bash
cd server && npm install && cd ..
node server/test-db.js
```

`test-db.js` runs the service against that database: push a game twice, soccer minutes, plays, top plays, story, momentum, summary, opt-ins, league, commissioner release and watched, the watch party relay. It deletes what it made (game ids starting `dbtest-`). Without `DATABASE_URL` it prints `SKIPPED` and exits 0. `node data/checks/all.js` runs it too, when `DATABASE_URL` is set.

```bash
node server/index.js &
node server/push-game.js data/games/week11-football.json
node server/push-game.js soccer/data/week11-soccer.json
curl -s http://localhost:3001/health
```

`/health` must answer `{"ok":true,"database":true}`. To use the app against it, serve the app (`python3 -m http.server 8000`) and open `http://localhost:8000/?api=http://localhost:3001`.

On a plain PostgreSQL without TimescaleDB (a laptop test only): `sh db/migrate.sh --plain --seed`.

What ran and what did not: all of the above ran on 2026-11-14 against a local plain PostgreSQL 16 (`--plain`), including running every file twice. That run found and fixed one bug: `GET /games/:id/plays` did not return the soccer `minute`. **Not run: anything on Tiger Data itself.** The hypertable, the two continuous aggregates and their refresh, and the `time_bucket` query in `db/queries.sql` need TimescaleDB. On Tiger Data the summary route reads the aggregates, which fill on a refresh schedule, so a freshly pushed game can show an empty summary for a while; the real-database test only checks the summary's shape for that reason.

## What TimescaleDB does here (D44)

Migration `db/migrate-004-timescale.sql` adds two things, and the service uses both:

- **`fp_awards`**, a hypertable over game time with one row per fantasy award of a play (the unrolled `detail.fp` of every play: a touchdown pass is two awards, the quarterback's and the receiver's). The service writes a play's awards in the same transaction as the play, so a repeat push adds nothing. The migration also unrolls the plays that were saved before it.
- **`player_points_per_week`**, a continuous aggregate over `fp_awards`: points per player per 7 day bucket, `time_bucket(INTERVAL '7 days', played_at, TIMESTAMPTZ '2026-11-09 00:00:00+00')`, refreshed every hour and including rows not yet refreshed. The origin is a Monday, so the bucket that holds 2026-11-15 (where every game file is played) is league week 11.

`push-game.js` moves a file named `weekNN-...` by whole weeks (week 9 lands two weeks before week 11), because every game file otherwise starts at the same invented kickoff and there would be one week only.

### Momentum over game time, `GET /games/:id/momentum?bucket=120`

The service asks the database to bucket fantasy points with `time_bucket` (the query is `momentumSql` in `server/timescale.js`):

```sql
WITH o AS (SELECT min(played_at) AS t0 FROM plays WHERE game_id = $1)
SELECT floor(extract(epoch FROM (time_bucket(make_interval(secs => $2::double precision), a.played_at, o.t0) - o.t0)) / $2::double precision)::int AS b,
       a.team, sum(a.pts) AS pts, NULL::int AS quarter, NULL::int AS sh, NULL::int AS sa
FROM fp_awards a, o WHERE a.game_id = $1 GROUP BY 1, 2
UNION ALL  -- the same buckets over plays: the last quarter and score of each bucket
SELECT <same bucket>, NULL, NULL, (array_agg(p.quarter ORDER BY p.seq DESC))[1],
       (array_agg((p.detail -> 'score_after' ->> 0)::int ORDER BY p.seq DESC))[1], (array_agg(... ->> 1 ...))[1]
FROM plays p, o WHERE p.game_id = $1 GROUP BY 1 ORDER BY 1;
```

The answer has the same shape as before plus `engine`: `time_bucket` (Tiger Data), `date_bin` (a plain PostgreSQL 14 or newer gets the same query with `date_bin`, which buckets the same way), `javascript` (the migration is not applied, or the query failed, so the service buckets the plays itself) and `source: "file"` with no database. The test `server/test-db.js` checks that the database's buckets equal the JavaScript buckets exactly, for 120 seconds.

### Trend and hot streak, `GET /players/:id/trend`

`:id` is a name (any case, for example `Josh%20Allen`) or `TEAM.SLOT` (`GOB.QB`):

```sql
SELECT bucket, points, awards, player, team, slot FROM player_points_per_week WHERE player_key = lower($1) ORDER BY bucket;
-- or, for TEAM.SLOT:  ... WHERE upper(team) = upper($1) AND upper(slot) = upper($2) ORDER BY bucket;
```

Answer: `{ player, team, slot, source, weeks: [{ week, points, awards }], summary: { average, last, previous, change, direction, bestWeek, hotStreak } }`. `change` is the last week minus the one before; `direction` is `up` above 0.5, `down` below -0.5, else `flat`, and `none` with one week; `hotStreak` counts the latest weeks in a row that beat the player's own average (0 when the latest week does not). Weeks he did not play are not listed. With no database, no migration or a player the database does not know, the same numbers come from the game files named `weekNN-*.json` in `data/games/` (`source: "file"`; `node server/trend.js "Josh Allen"` prints them); 404 when neither knows the player.

### What was and was not run

Both routes, the awards, the aggregate and the backfill ran on a plain PostgreSQL 16 (`sh db/migrate.sh --plain`, where the aggregate is an ordinary view and `time_bucket` is `date_bin`) and in the offline test with a fake database. **Not run on TimescaleDB:** the hypertable, `time_bucket`, the continuous aggregate and its policy. The migration was written from the TimescaleDB documentation and has never been applied to Tiger Data, so the first `sh db/migrate.sh` there may need a fix; the route falls back to JavaScript or the files if a query fails, and says so in `engine` or `source`.

## Apply it by hand

Wait until Juan has made the database account and has the connection string. It must never go in a file that is committed, in a message or in a board post. It lives only in `.env`, as one line:

```
DATABASE_URL=<the connection string from Juan>
```

`.env` is for your own machine and must not be committed. Then run the schema once:

```bash
set -a; . ./.env; set +a
psql "$DATABASE_URL" -f db/schema.sql
```

The file can be run again safely: every statement skips what already exists.

For soccer matches, apply the migration after the schema (also safe to run again):

```bash
psql "$DATABASE_URL" -f db/migrate-002-soccer.sql
```

It adds a `minute` column to `plays` (the match minute, empty for football) and a view `plays_with_sport` that joins each play to its game's sport. `schema.sql` itself is not changed. For soccer rows `quarter` holds the half, `kind` is `goal` for a goal and `full_time` for the clean sheet row, and `yards` is empty. The football service keeps working before the migration: the minute is only written for rows that have one.

For the commissioner routes (release a week, count who watched), also apply `db/migrate-003-commissioner.sql`, safe to run again. Without it those routes keep their data in the service's memory.

To try the service on a plain PostgreSQL without TimescaleDB, `node db/make-plain.js | psql "$DATABASE_URL"` applies the schema without the TimescaleDB parts (see `server/SETUP.md`).

## Notes

- The app must keep working from the game file alone when the database cannot be reached (`docs/CONTRACT.md` section 5).
- The aggregates group plays by day, so read them with a `sum` over the buckets, as the example queries do.
- `schema.sql` is written for TimescaleDB; the plain-PostgreSQL version of it ran, the TimescaleDB version has not.

## Seed data

`seed.sql` puts the invented sample game (`data/games/sample-football.json`) into `games` and `plays`: one game and one row per play, spread over three hours. Regenerate it with `node db/make-seed.js` from the repository root. Apply it after the schema, the same way:

```bash
psql "$DATABASE_URL" -f db/seed.sql
```

It can be run twice safely. Things to know:

- The game file has no clock. Quarters are worked out by splitting each half in two by play count, and times are spaced evenly. Both are invented.
- Each play is one row, credited to the player with the biggest fantasy move on that play. A pass that scores for both the quarterback and the receiver is credited to the receiver, and the quarterback's points are in `detail.fp`. So the two continuous aggregates do not count the second scorer of a play.
- It ran on a plain PostgreSQL 16 (twice, no errors); not on Tiger Data.
