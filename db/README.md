# Database

The database is Tiger Data, which is PostgreSQL with the TimescaleDB extension. Every play is one row in `plays`, stamped with the time it happened in the game. `schema.sql` holds everything: the `games`, `optins` and `plays` tables, `plays` as a hypertable on `played_at`, and two continuous aggregates (fantasy points per player per game, and points per team per quarter). It also has one example query for each screen that would use them, as comments at the bottom.

## Apply it

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

## Notes

- The app must keep working from the game file alone when the database cannot be reached (`docs/CONTRACT.md` section 5).
- The aggregates group plays by day, so read them with a `sum` over the buckets, as the example queries do.
- This file was written without a database to test against, so it has not been run.

## Seed data

`seed.sql` puts the invented sample game (`data/games/sample-football.json`) into `games` and `plays`: one game and one row per play, spread over three hours. Regenerate it with `node db/make-seed.js` from the repository root. Apply it after the schema, the same way:

```bash
psql "$DATABASE_URL" -f db/seed.sql
```

It can be run twice safely. Things to know:

- The game file has no clock. Quarters are worked out by splitting each half in two by play count, and times are spaced evenly. Both are invented.
- Each play is one row, credited to the player with the biggest fantasy move on that play. A pass that scores for both the quarterback and the receiver is credited to the receiver, and the quarterback's points are in `detail.fp`. So the two continuous aggregates do not count the second scorer of a play.
- It has not been run on any database.
