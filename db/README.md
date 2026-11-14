# Database

The database is Tiger Data, which is PostgreSQL with the TimescaleDB extension. Every play is one row in `plays`, stamped with the time it happened in the game. `schema.sql` holds everything: the `games`, `optins` and `plays` tables, `plays` as a hypertable on `played_at`, and two continuous aggregates (fantasy points per player per game, and points per team per quarter). It also has one example query for each screen that would use them, as comments at the bottom.

## Juan on the laptop: exact commands

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
