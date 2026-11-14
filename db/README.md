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

## Notes

- The app must keep working from the game file alone when the database cannot be reached (`docs/CONTRACT.md` section 5).
- The aggregates group plays by day, so read them with a `sum` over the buckets, as the example queries do.
- This file was written without a database to test against, so it has not been run.
