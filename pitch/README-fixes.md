# README.md: exact sentences for the boss (D47, 2026-11-15)

`README.md` is the boss's file. Replace these two table rows in "What is in here"; everything else in the README was checked against main and is still true.

Row `agents/scout/`:

| `agents/scout/` | Scout, a research agent built with LangChain deepagents (a main agent with stats, film-room and fact-checker subagents), and scripts that read real data. Its tools have run live against Sleeper and ESPN without a model (season tendencies, recent form, a real week 9 of stat lines, real play-by-play, a Sleeper against ESPN cross-check, soccer numbers; logs in `agents/scout/runs/`). The agent itself has run once with a model, for one player, and its report was weaker than the one we kept. The 28 scouting reports in `data/profiles/notes/` were written with Scout's tools in a Claude Code session, each claim linked to the real plays behind it, not by the agent. `sh agents/scout/run.sh` is the one command for a real run with a Gemini or Claude key |

Row `db/`, `server/`:

| `db/`, `server/` | A Tiger Data (PostgreSQL with TimescaleDB) schema, migrations (`sh db/migrate.sh`) and a small service: plays, top plays, drives, story, momentum (bucketed in the database with `time_bucket`), a player's weekly trend, Scout's stored reports, the league, the commissioner's routes and a watch party relay. Only the schema and saving and reading plays have run on Tiger Data itself; everything else ran on a plain PostgreSQL 16 (`node server/test-db.js`). With `?api=<address>` the app sends the opt-in, reads the league and uses the commissioner and watch party routes; it reads no plays, momentum, trends or reports from the service. `node data/checks/all.js` runs every offline check |

Also: the sentence "The app sends the opt-in to the service when opened with `?api=<address>` and reads nothing from it yet" is no longer true and is replaced by the row above.
