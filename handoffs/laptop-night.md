# Juan's laptop session: everything that only the laptop can do

For the session Juan starts on the MacBook in `~/Projects/fantasy-recap`. The laptop has `.env` with `DATABASE_URL` (Tiger Data) and `TYPESAFE_API_KEY` (Jev). Never print, commit or post either. The cloud director session (`cstljuan/director`) stays the only boss: commit on a branch named `cstljuan/laptop`, push it, and post DONE; the director merges.

Start:

```bash
cd ~/Projects/fantasy-recap && git fetch origin && git checkout -B cstljuan/laptop origin/main && sh tools/setup.sh
```

## 1. Tiger Data, for real (about 10 minutes)

```bash
sh db/laptop.sh
```

Runs the migrations on Tiger Data, seeds, pushes every football and soccer game file through the service, calls every route and prints one report. Safe to run twice. In the report, `momentum engine` must say `time_bucket` (that proves the TimescaleDB query ran). `summary` and `trend` can be empty on the first run because the continuous aggregates refresh hourly. Save the report as `db/runs/laptop-<date>.txt` with any connection details removed, and commit it.

## 2. Jev: rebuild the games built from stat lines (about 5 minutes)

```bash
node engine/make-game.js --from-sample --seed 7 --out data/games/week11-football.json
```

```bash
node engine/make-game.js --lines data/statlines/week11-tur-owl.json --teams TUR,OWL --out data/games/week11-tur-owl.json
```

Without `--no-jev` the maker asks Jev at every snap with a real choice. Check each report says the chooser was Jev, then set `"source": "jev"` in both files (contract section 1) and run `node tools/validate.js` and `node data/checks/all.js`. The real week 9 games are built from real plays and do not use Jev; do not rebuild them. If the director has switched `data/games/current.js` to a week 9 game, leave it.

## 3. Scout, the deep agent, for real (needs a model key)

Put the key in `.env` only: `GOOGLE_API_KEY=...` (Gemini) or `ANTHROPIC_API_KEY=...` (Claude). A free Gemini key allows only about 20 requests a day and one player takes about 100 model calls, so use a paid key, or `SCOUT_MODEL=gemini-3.5-flash-lite` for a first player.

```bash
sh agents/scout/run.sh --preflight
```

```bash
sh agents/scout/run.sh --players GOB.QB
```

Read the report in `agents/scout/runs/`. Keep it only if it is at least as good as the hand-checked one in `data/profiles/notes/`, and say which one the app shows in `pitch/REAL-AND-SIMULATED.md`. Run more players if time allows.

## 4. Before pushing

```bash
sh tools/check-authors.sh HEAD && git log -1 --format='%an <%ae> | %cn <%ce>'
```

```bash
git push -u origin cstljuan/laptop
```

Then `sh tools/post.sh DONE "laptop night: Tiger Data report, Jev rebuilds, Scout run, checked: ..."`. The director merges and updates the Devpost text where these runs make a claim true.
