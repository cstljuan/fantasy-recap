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
- `GET /games/:id/summary` returns `{ players, quarters }` from the two continuous aggregates: points per player and points per team per quarter. Numbers come back as strings, as PostgreSQL sends them.

## Test

```bash
node server/test.js
```

This runs the routes against a fake database. It checks routing and input checks only, not the SQL.

## Not checked

The service has not been run against the real database. This session cannot reach it: the connection string is only on Juan's laptop. The aggregates may also lag behind new plays until they refresh, see `db/schema.sql`.
