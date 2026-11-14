# Plays service

A small Node service with no framework. It saves plays to the database and returns them. The database is Tiger Data (PostgreSQL), set up by `db/schema.sql`.

## Run it

1. Put the connection string in `.env` at the repository root, as one line: `DATABASE_URL=<the connection string>`. It lives only there. `.env` is ignored by git, so never commit it or paste it anywhere.
2. Install the one dependency, the `pg` driver:

```bash
cd server && npm install
```

3. Start it (default port 3001, or set `PORT`):

```bash
node server/index.js
```

## Routes

- `POST /games/:id/plays` saves plays. Body: `{ "game": { "sport": "football", "home": "GOB", "away": "PYT" }, "plays": [ { "seq": 1, "played_at": "2026-01-01T00:00:00Z", "quarter": 1, "team": "GOB", "slot": "RB", "player": "Saquon Barkley", "kind": "run", "yards": 4, "fantasy_points": 0.4, "detail": {}, "why": {} } ] }`. Send `game` with the first plays so the game row exists. Plays that are already saved (same `seq` and `played_at`) are skipped, so a repeat send is safe. All plays in one request are saved together or not at all. Answers 201.
- `GET /games/:id/plays` returns the plays in `seq` order.
- `POST /games/:id/optin` records that a manager opted in. Body: `{ "manager": "ricky" }`. Answers 201, or 404 if the game does not exist yet. A repeat is ignored.
- `GET /games/:id/optins` returns who opted in, oldest first.
- `GET /health` answers 200 `{ ok: true, database: true }` when the database answers a `SELECT 1`, otherwise 503 `{ ok: false, database: false }`.
- `GET /games/:id/top-plays?n=3` returns the `n` biggest plays (1 to 20, default 3) with `source`: `"database"` when the plays table answers with rows for the game, `"file"` when it does not and `data/games/<id>.json` exists, otherwise 404. Items: `{ index, quarter, clock, team, kind, yards, players, points, highlight, text }`. `points` is the fantasy points the play moved, ignoring sign; ranked by points, then `why.highlight` (0 when the play has none), then the earlier play. `index` counts from 1, like `seq`. `quarter` and `clock` are worked out, the game file has no clock. Same list on the command line: `node server/top-plays.js data/games/week11-football.json 3`.
- `GET /games/:id/drives` returns one entry per drive for the film room's drive chart: `{ index, team, quarter, startYard, endYard, plays, yards, seconds, result }`, with `source` `"database"` or `"file"` as for top plays. Yards are from the offense's own goal line (0 to 100). `result` is `touchdown`, `field goal`, `missed field goal`, `punt`, `interception`, `fumble`, `downs`, `half` or `end`. `quarter` and `seconds` are worked out, the game file has no clock. Rows saved by an older seed lack the drive details, so the service then answers from the game file. Same list on the command line: `node server/drives.js data/games/week11-football.json`. `db/queries.sql` has a query that gives the same numbers from the `plays` table (not run on any database).
- `GET /games/:id/momentum?bucket=120` returns `{ bucketSeconds, buckets: [{ start, quarter, fp: [home, away], score, fpTotal, scoreTotal }], source }`: each team's fantasy points and real points per bucket of game time (10 to 3600 seconds), with running totals. The last bucket equals the final score and the game's fantasy points. Time is the plays' own time, spread over three hours; empty buckets are listed with zeros. Shown only after the reveal. Command line: `node server/momentum.js data/games/week11-football.json 120`. The route buckets in JavaScript, not with `time_bucket`; the same buckets in SQL are in `db/queries.sql` (not run on any database).
- `GET /games/:id/summary` returns `{ players, quarters }` from the two continuous aggregates: points per player and points per team per quarter. Numbers come back as strings, as PostgreSQL sends them.

## Optional certificate check

Set `DATABASE_CA_FILE` in `.env` to the path of the database's CA certificate file (a certificate is public, not a secret, but the path is still only in `.env`). The service then checks the database's certificate against it and refuses a connection that does not match. If it is not set, nothing changes: the connection string is used as given. With it set, the `sslmode` words in the connection string are ignored.

## Push a game

```bash
node server/push-game.js data/games/week11-football.json
```

It replays the game file with `js/rules.js` and sends every play to the service (default `http://localhost:3001`, or `--url`), in batches of 40. Each play carries the time it happened in the game, its fantasy points and its `why`. The game file has no clock, so quarters and times are worked out the same way `db/seed.sql` does (`server/replay.js` does both). `--id` sets the game id, which otherwise is the file name. Each play is credited to the player with the biggest fantasy move on it. Other scorers on that play are in `detail.fp`, not in the aggregates.

## Browsers on another port

A page served from `http://localhost:<port>` or `http://127.0.0.1:<port>` may call the service. Other origins get no CORS header. Opening the page straight from a file sends no usable origin and is not covered.

## Test

```bash
node server/test.js
```

This runs every route against a fake database, plus the CORS rules, a database that is down, and `push-game.js` sending all 73 plays of the sample game. It checks routing, input checks and the data sent, not the SQL.

## Not checked

The service has not been run against the real database. This session cannot reach it: the connection string is only on Juan's laptop. The aggregates may also lag behind new plays until they refresh, see `db/schema.sql`.
