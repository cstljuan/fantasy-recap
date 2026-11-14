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

- `GET /games/:id/story` returns the turning points of a game as numbers: `{ game_id, source, home, away, final, winner, leadChanges: [{index, quarter, clock, team, score}], longestDrive: {drive, team, quarter, plays, yards, seconds, result, startIndex, endIndex} or null, biggestSwing: {start, quarter, team, fpSwing, index} or null, bestPlayers: [{team, slot, name, points, index}], decidingPlay: {index, quarter, clock, team, score} or null }`. `index` is the play number from 1, the same as `seq` and the top plays index. From the database when its rows have scores and points, from `data/games/<id>.json` when not. The meaning of each field is at the top of `server/story.js`. `node server/story.js <game file>` prints it.

## League

- `GET /league` returns the league home's data: `{ name, week, invented, release, weeks: [{ week, finished, matchups: [{ teams: [{id, full, tile}, x2], final: [a, b] or null, gameId, finalFrom }] }], standings: [{ id, full, wins, losses, ties, pointsFor, pointsAgainst }], current: { week, matchups: [{ teams, gameId, optedIn: [team ids], optinsFrom }] }, note, source: { optins, finals } }`.

It starts from `data/league.json` (an invented league). Standings are worked out from the finished weeks, best first. For this week, `optedIn` comes from the `optins` table when the database answers (only managers equal to one of the matchup's team ids count; a matchup without a game id keeps the file's list) and from the file when it does not; `optinsFrom` says which. A finished week whose game is in the database gets its fantasy points from the plays. **The current week's points are always null**, even when the database or a game file holds them, so the league home can never show hidden points before the final. In a page: `<script src="server/league.js"></script>` and `FR_LEAGUE.fromLeague(leagueJson)` gives the same without the service (checked in headless Chromium). `node server/league.js` prints it and checks the standings against the file.

## Commissioner

**There are no accounts and no login. Anyone who can reach the service can call these routes**, including releasing a week. Run the service only where the people who can reach it are the league.

- `GET /league/week/:n/optins` returns `{ week, finished, matchups: [{ teams: [ids], gameId, optedIn: [team ids], from, watched }] }`. No points. `from` is `database` (the `optins` table), `file` (the current week in `data/league.json` when the database does not answer or the matchup has no game) or `none` (a past week the file does not know). `watched` counts the managers who reached the final.
- `POST /league/week/:n/release` with `{ released: true | false }` sets the Tuesday release by hand; `GET /league/week/:n/release` returns `{ week, released, changed_at, source }`. A week never set reads as `released: false`. The app should show a week's recap only when it is released.
- `POST /games/:id/watched` with `{ manager }` (1 to 100 characters) records that a manager reached the final: `201 { game_id, manager, watched, source }`. The same manager counts once.

`n` is a whole number from 1 to 30 and must be a week of the league (404 otherwise). Bodies are limited to 2 KB. With the database these need `db/migrate-003-commissioner.sql` (tables `releases` and `watched`). When the database does not answer, release and watched are kept in the service's memory instead and the answer says `source: 'memory'`; that memory ends when the service stops. Covered by `node server/test.js` (database and memory) and `node server/stress.js`; not run on the real database.

## Watch party relay

A phone can be the remote for a game playing on another screen. The rooms live in the service's memory only (no database) and end two hours after they are made; at most 200 are open at once (429 after that). Bodies are limited to 2 KB. Same CORS rule as the other routes.

- `POST /party` makes a room: `201 { code, host, created_at, expires_at }`. `code` is four letters (no I or O) to show on the screen; `host` is a key only the host screen keeps.
- `POST /party/:code/command` with `{ cmd, value }` from a remote: `cmd` is `start`, `hold`, `release`, `seek` (value: play index from 1) or `speed` (value: 0.25 to 8); the others take no value. Answers `201 { code, command: { n, cmd, value, at } }`. `n` counts from 1 in each room.
- `GET /party/:code/commands?after=<n>&wait=<seconds>` for the host: `{ code, commands: [...with n above after], last, expires_at }`. With `wait` (1 to 25) the answer waits until a command comes in or the time is up, so the host can poll in a loop without a delay. Only the last 200 commands of a room are kept.
- `POST /party/:code/state` with `{ host, index, mode, speed }` from the host: `index` the play number (0 before the first), `mode` one lower-case word (`ready`, `play`, `inter`, `final`, ...), `speed` 0.25 to 8. A wrong `host` key gets 403.
- `GET /party/:code/state` for the remotes: `{ code, state: { index, mode, speed } or null, updated_at, expires_at }`.

Codes are not case sensitive. An unknown or ended room answers 404, a malformed code 400. `node server/test.js` covers every route, the long poll, the host key, the limits and expiry; `node server/stress.js` sends bad input and 30 party requests inside the 200 at once.

## In the browser

`server/replay.js`, `server/drives.js`, `server/momentum.js` and `server/story.js` run in a page as well as in Node, with the same code. Load them after `js/rules.js` (and `soccer/js/fantasy.js`, `soccer/js/rules.js` for soccer):

```html
<script src="server/replay.js"></script>
<script src="server/drives.js"></script>
<script src="server/momentum.js"></script>
<script src="server/story.js"></script>
```

Then `FR_REPLAY.buildFromGame(gameFile, id)` gives the play records the service stores, `FR_DRIVES.fromRecords(records)`, `FR_MOMENTUM.fromRecords(records, home, away, 120)` and `FR_STORY.fromGame(gameFile, id)` give what the routes give. Checked in headless Chromium: the page's story for `week11-football` and `week11-soccer` equals Node's, with no errors.

## Optional certificate check

Set `DATABASE_CA_FILE` in `.env` to the path of the database's CA certificate file (a certificate is public, not a secret, but the path is still only in `.env`). The service then checks the database's certificate against it and refuses a connection that does not match. If it is not set, nothing changes: the connection string is used as given. With it set, the `sslmode` words in the connection string are ignored.

## Push a game

```bash
node server/push-game.js data/games/week11-football.json
```

It replays the game file with `js/rules.js` and sends every play to the service (default `http://localhost:3001`, or `--url`), in batches of 40. Each play carries the time it happened in the game, its fantasy points and its `why`. The game file has no clock, so quarters and times are worked out the same way `db/seed.sql` does (`server/replay.js` does both). `--id` sets the game id, which otherwise is the file name. Each play is credited to the player with the biggest fantasy move on it. Other scorers on that play are in `detail.fp`, not in the aggregates.

A soccer match file works the same way:

```bash
node server/push-game.js soccer/data/week11-soccer.json
```

When the file says `sport: "soccer"`, `server/replay.js` replays it with `soccer/js/rules.js` and `soccer/js/fantasy.js` and sends one row per event plus one `full_time` row with the clean sheets. Each row has `minute` (the match minute), `quarter` set to the half, and `kind` set to the event type, or `goal` for a shot or penalty that went in, so the goal rows of a team equal its score. A goal row is the scorer's. Other rows are credited to the biggest fantasy award of the event, and every award (goal, assist, save, card, clean sheet, with `why`) is in `detail.fp`. Times are the match minute from an invented kickoff with a 15 minute half time. Soccer rows need `db/migrate-002-soccer.sql` applied first, for the `minute` column. The top plays, drives and momentum routes were written for football: for a soccer match that is in the database, top plays and momentum answer from its rows (top plays ranks by fantasy points, so the clean sheet row can come first) and drives answers 404; for a soccer id with no rows they answer 404.

## Browsers on another port

A page served from `http://localhost:<port>` or `http://127.0.0.1:<port>` may call the service. Other origins get no CORS header. Opening the page straight from a file sends no usable origin and is not covered.

## Test

```bash
node server/test.js
```

This runs every route against a fake database, plus the CORS rules, a database that is down, `push-game.js` sending all 73 plays of the sample game, and both soccer match files (goal rows equal the final score, every player's fantasy points equal the soccer breakdown and the match report, and the minute is sent). It checks routing, input checks and the data sent, not the SQL.

## Stress test

```bash
node server/stress.js
```

With an in-memory stand-in for the database, it pushes `week11-football` and `week11-soccer`, reads every route back, sends bad input to every route (wrong types, missing fields, a body over 1 MB, broken JSON, odd and broken ids, SQL in strings, an unknown sport, bad query numbers, wrong methods) and then 200 requests at once. It fails on any 500, any crash or hang, any answer over one second, and any answer without the CORS header for a localhost page. What it found and what was fixed: a broken percent sign in a game id (`/games/%E0%A4%A/plays`) threw and left the request open (now 400); an unknown sport reached the database (now 400 before any query); text in `fantasy_points`, an object in `yards`, a string in `detail` or `why`, and a manager name of thousands of characters were accepted (now 400). Limits: game id 200 characters, manager 100, a play's fantasy points below 10000. A throw anywhere in a request now answers 500 instead of leaving it open. SQL in strings is stored as plain text: every query uses parameters.

## Not checked

The service has not been run against the real database, and neither has `db/migrate-002-soccer.sql`. This session cannot reach it: the connection string is only on Juan's laptop. The aggregates may also lag behind new plays until they refresh, see `db/schema.sql`.
