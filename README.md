# Fantasy Recap (working name)

Built at HackPrinceton Fall 2026 by Juan, Ricky, Peyton and Noah.

Fantasy football managers never get to watch their own roster play together, and if you already know your score there is nothing left to watch. The idea: two managers opt in when their matchup is set, their scores stay hidden all week, and at the end they watch their two rosters play each other in an 8-bit game to find out who won.

**What this repository is today:** a demo of that reveal for one viewer on one device. There are no accounts, no second manager and no week of waiting. The opt-in is remembered in the browser. See `pitch/REAL-AND-SIMULATED.md` for the full list of what is real and what is simulated.

## Run it

No install and no build for the app.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On a phone, open `http://<laptop-ip>:8000` on the same Wi-Fi. Soccer: choose it with the sport switch in the app, which shows the soccer app in a frame, or open `http://localhost:8000/soccer/` by itself.

Check the football game against the rules (needs Node, no packages):

```bash
node tools/validate.js
```

## How the football game is made

`engine/make-game.js` takes a week of fantasy stat lines for two rosters and builds a full, legal game in which every player ends with exactly those numbers. At each snap with a real choice (40 of the 84 snaps in the current game; the rest had one legal option) it asks a decision model, Jev by TypeSafe AI, to choose among the plays that still let the drive finish; Jev returns a probability for every option and the play is drawn from them. `js/rules.js` referees every play, and the finished game is replayed and compared with the stat lines before it is kept.

The game in the app (`data/games/week11-football.json`) has 84 plays, 40 of them chosen by Jev 1.14.0. **The players are real NFL players. The stat lines are invented sample data, and no play is a real result.**

## What is in here

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/app.js` | The app: league, matchup, lineups, plays, recap |
| `js/main.js`, `js/plays.js`, `js/sprites.js` | The game view, 39 scripted plays, pixel players drawn in code |
| `js/rules.js` | The rules engine: downs, distance, possession, score, four penalties |
| `js/data.js`, `data/` | Rosters, profiles, stat lines, scoring rules, game files |
| `js/audio.js`, `js/announcer/` | Sound and the announcer |
| `engine/` | The game maker and its link to Jev |
| `soccer/` | The soccer game and its own small app (matchup, lineups, plays, recap). The sport switch shows it in a frame; it shares the opt-in and the speed with football and nothing else |
| `agents/scout/` | Scout, a research agent built with LangChain deepagents (a main agent with stats, film-room and fact-checker subagents), and scripts that read real data. Its tools have run live against Sleeper and ESPN without a model (season tendencies, recent form, a real week 9 of stat lines, real play-by-play, a Sleeper against ESPN cross-check, soccer numbers; logs in `agents/scout/runs/`). The agent itself has run once with a model, for one player, and its report was weaker than the one we kept. The 28 scouting reports in `data/profiles/notes/` were written with Scout's tools in a Claude Code session, each claim linked to the real plays behind it, not by the agent. `sh agents/scout/run.sh` is the one command for a real run with a Gemini or Claude key |
| `db/`, `server/` | A Tiger Data (PostgreSQL with TimescaleDB) schema, migrations (`sh db/migrate.sh`) and a small service: plays, top plays, drives, story, momentum (bucketed in the database with `time_bucket`), a player's weekly trend, Scout's stored reports, the league, the commissioner's routes and a watch party relay. Only the schema and saving and reading plays have run on Tiger Data itself; everything else ran on a plain PostgreSQL 16 (`node server/test-db.js`). With `?api=<address>` the app sends the opt-in, reads the league and uses the commissioner and watch party routes; it reads no plays, momentum, trends or reports from the service. `node data/checks/all.js` runs every offline check |
| `docs/` | The contract between parts, who owns what, how the team coordinates |

## How it was built, and what it uses

Built during the event by the four of us, each directing AI coding agents on our own part.

- The app in the browser uses no frameworks and no libraries.
- The game maker calls **Jev 1.14.0** (TypeSafe AI) over the network when a game is built. The app never calls it.
- The service in `server/` uses the **pg** driver, version 8.13.1, and a **Tiger Data** database.
- The announcer voice: see `pitch/REAL-AND-SIMULATED.md`.
