# Setup: from a clean clone to a running service

Every command below was run in order in a fresh clone on 2026-11-14 (Linux, Node 22, Python 3.13, PostgreSQL 16 without TimescaleDB), and the output shown is what it printed. Run everything from the repository root unless a step says otherwise.

What needs what:

| Part | Needs |
|---|---|
| The app (`index.html`) | A static web server only. No database, no service, no install |
| `node data/checks/all.js` | Node. Python 3 for the Scout checks, Chrome or Chromium for the three browser runs; a missing one is SKIPPED, not FAILED. No database, no network, no key |
| The service (`server/`) | Node, `npm install` in `server/` once, and a PostgreSQL connection string in `.env` |
| Plays over time, continuous aggregates | Tiger Data (PostgreSQL with TimescaleDB), set up with `db/schema.sql` |

## 1. Clone and check

```bash
git clone https://github.com/cstljuan/fantasy-recap.git
cd fantasy-recap
node --version        # v18 or newer
node data/checks/all.js
```

It prints one line per check and ends with:

```
OK (1 skipped)
```

The skipped one is `agents/scout/check_agent.py`, which needs `pip install -r agents/scout/requirements.txt`. Any `FAILED` line names the command to run on its own to see why.

## 2. Open the app without the service

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Everything works from the game files in `data/games/`; nothing is saved anywhere but the browser.

## 3. The database

### With Tiger Data (the real one)

The person who owns the Tiger Data service gives you its connection string. Put it in a file named `.env` at the repository root (next to `index.html`), one line:

```
DATABASE_URL=<the connection string>
```

`.env` is in `.gitignore`. Never commit it, paste it into a board post, a message or any other file. Optional, also in `.env`: `PORT` (default 3001) and `DATABASE_CA_FILE` (a path to the database's CA certificate, see `server/README.md`). Those three names are all the service reads.

Then, once:

```bash
set -a; . ./.env; set +a
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/migrate-002-soccer.sql
psql "$DATABASE_URL" -f db/migrate-003-commissioner.sql
```

Each file is safe to run again; a second run only prints `NOTICE ... already exists, skipping` lines.

### Without Tiger Data (to try it on your own machine)

A plain PostgreSQL works for the service (tested with 16); only the TimescaleDB parts are left out. `db/make-plain.js` prints the schema without them (plays is an ordinary table, the two aggregates are ordinary views):

```bash
createdb fantasy_recap
echo 'DATABASE_URL=postgres://<user>@127.0.0.1:5432/fantasy_recap' > .env
set -a; . ./.env; set +a
node db/make-plain.js | psql "$DATABASE_URL"
psql "$DATABASE_URL" -f db/migrate-002-soccer.sql
psql "$DATABASE_URL" -f db/migrate-003-commissioner.sql
```

## 4. Start the service

```bash
cd server && npm install && cd ..
node server/index.js
```

`npm install` adds the one dependency, `pg` 8.13.1. The service prints:

```
plays service on http://localhost:3001
```

In a second terminal:

```bash
curl -s http://localhost:3001/health
```

```
{"ok":true,"database":true}
```

`{"ok":false,"database":false}` (status 503) means the service runs but cannot reach the database: check `DATABASE_URL`. Without `DATABASE_URL` the service does not start and prints `DATABASE_URL is not set. Put it in .env, see server/README.md.`

## 5. Seed it

Push the games the app plays (the service must be running):

```bash
node server/push-game.js data/games/week11-football.json
node server/push-game.js soccer/data/week11-soccer.json
```

```
pushed game week11-football: 84 plays, final 17 to 14
pushed game week11-soccer: 83 plays, final 2 to 0
```

A second push of the same file is safe: rows already there are skipped. The older sample game can also go straight into the database with `psql "$DATABASE_URL" -f db/seed.sql` (73 plays, game id `sample-football`).

Check that the routes answer from the database:

```bash
curl -s "http://localhost:3001/games/week11-football/top-plays?n=1"
```

The answer starts with `{"game_id":"week11-football","source":"database",`. `"source":"file"` would mean the plays are not in the database and the service read `data/games/week11-football.json` instead. Every route is listed in `server/README.md`.

## 6. The app against the service

With the service running and the app served as in step 2, open:

```
http://localhost:8000/?api=http://localhost:3001
```

On the Matchup screen, press **Opt in**. The screen says `Saved to the league. Opted in: GOB.` and the row is in the database:

```bash
psql "$DATABASE_URL" -c "select game_id, manager from optins"
```

```
     game_id     | manager
-----------------+---------
 week11-football | GOB
```

Without `?api=`, or when the service does not answer within two seconds, the screen says `Saved on this device.` and nothing is sent. The service only answers pages served from `http://localhost:<port>` or `http://127.0.0.1:<port>`; a page opened straight from a file cannot call it.

There are no accounts: anyone who can reach the service can call every route, including the commissioner's. Run it only where the people who can reach it are the league.

## What was checked, and what was not

Checked on 2026-11-14 in a fresh clone against a local PostgreSQL 16 without TimescaleDB: every step above, both migrations run twice, the seed, every read route answering `source: database`, opt-in, watched and release writes, a repeat push, the soccer rows with their minute and two goal rows, and the drive query in `db/queries.sql` (same 12 drives as `node server/drives.js`). Not checked here: the TimescaleDB parts (hypertable, continuous aggregates and their refresh, the `time_bucket` momentum query), which need Tiger Data, and the steps with a real Tiger Data connection string, which this session does not have.
