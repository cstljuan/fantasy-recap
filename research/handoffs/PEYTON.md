# Peyton: the TUR notes and every profile, team and matchup file

Read `research/handoffs/README.md` first (branch, identity, rules). Your branch: `Peypey-ryd/research`. You write ONLY these files:

- `research/notes/TUR-QB.json`, `TUR-RB.json`, `TUR-WR1.json`, `TUR-WR2.json`, `TUR-WR3.json`, `TUR-TE.json`, `TUR-K.json`
- `research/tools/write_profiles.py`
- `research/players/<KEY>.md` (all 28), `research/teams/<TEAM>.md` (4), `research/matchups/GOB-vs-PYT.md` and `research/matchups/TUR-vs-OWL.md`

## Units 1 to 7: the seven TUR notes (one Sonnet subagent per player, 2 at a time at most)

Prompt for each subagent: `KEY = TUR-QB. Read research/handoffs/NOTE-TASK.md and do exactly that task for this KEY.` (then TUR-RB, TUR-WR1, TUR-WR2, TUR-WR3, TUR-TE, TUR-K). The finished pattern is `research/notes/GOB-QB.json`. After each one: `python3 -m json.tool research/notes/<KEY>.json`, `grep -c $'\xe2\x80\x94' research/notes/<KEY>.json` (counts em dashes) must print 0, then commit `research: note for <KEY>` and push.

If a TUR player is questionable or on injured reserve, the note must say so with the source and date (Ladd McConkey and Garrett Wilson were reported questionable; check which TUR or OWL slot they are in the data files).

## Unit 8: `research/tools/write_profiles.py` (one Sonnet subagent, standard library only)

A script, not hand writing: it builds every profile, team and matchup file from `research/data/<KEY>.json`, `research/notes/<KEY>.json`, `research/data/league.json` and `research/data/projections.json`. The only model-written text is the `scouts_read` paragraph already in each note. Missing pieces print "not found" (or "projection pending" if `projections.json` does not exist yet). The subagent inspects data shapes with short `python3 -c` snippets, never a whole data file.

Each `research/players/<KEY>.md`:
1. Header: name, NFL team, position, fantasy team and slot, next game (week, opponent, home or away, kickoff, line, weather if present).
2. Bio: age, height, weight, college, draft, experience. Body and combine numbers. Madden ratings (top few). Contract.
3. Career: totals table by season.
4. Splits: by opponent (best and worst), home and away, roof and surface, temperature and wind, as available in the data file.
5. 2026 usage: snaps, targets or carries, share, red zone, play tendencies from the play-by-play section.
6. Health: injury reports and status, from the data file and the note's `availability`.
7. Family and background, recent events, quotes: from the note, each item with its source address and date.
8. Prediction: from `projections.json`: stat line, fantasy points mean with 10th to 90th range, touchdown chance, chance of playing, the reason line, and a plain sentence on uncertainty (from `backtest_summary`: the typical miss for his position). Then the note's `scouts_read`.
9. Sources: every address used.

Each `research/teams/<TEAM>.md` (GOB, PYT, TUR, OWL, seven players each):
the roster table with projections; how this fantasy team scores (which players carry it, by projected share); likely ways each player gets his points (from play tendencies: pass depth, rushing direction, red zone usage); strengths; weaknesses; red zone; who is missing or at risk (IR, questionable, bye, already played); the projected team total with its range.

Each matchup file (GOB vs PYT, TUR vs OWL):
expected score for both sides, win chance and margin range from `projections.json` `matchups`; the key head-to-head position battles; which players swing the result most (the widest ranges); how the weekend would unfold in broad strokes, in kickoff order of the NFL games involved (who plays in the early window, the late window, the night game, Monday, and who already played or is on bye). Plain words, no invented events.

Checks: run `python3 research/tools/write_profiles.py` from the repo root; 28 + 4 + 2 files exist; `grep -rc $'\xe2\x80\x94' research/players research/teams research/matchups` (counts em dashes) totals 0; no file names an AI tool or model; open two profiles and confirm the numbers match the data file. Commit the script and the output files and push.

## Unit 9: rerun once Ricky's projections exist

Ricky pushes `research/data/projections.json` on `Rickstar-App/research`. When it is there: `git fetch origin && git show origin/Rickstar-App/research:research/data/projections.json > research/data/projections.json`, rerun `write_profiles.py`, then `git checkout -- research/data/projections.json 2>/dev/null || rm research/data/projections.json` so that file is NOT committed on your branch. Commit the regenerated profiles and push.

## Done looks like

7 TUR notes, `write_profiles.py`, 28 player files, 4 team files, 2 matchup files pushed to `Peypey-ryd/research`, and a short report to Juan: what ran, what was checked, what was not found.
