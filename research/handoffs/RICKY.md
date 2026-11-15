# Ricky: the projection model, the backtest and the reality check

Read `research/handoffs/README.md` first (branch, identity, rules, raw cache). Your branch: `Rickstar-App/research`. You write ONLY these files:

- `research/tools/model.py`
- `research/data/projections.json`
- `research/BACKTEST.md`
- `research/RESULTS-week10.md`
- `research/data/projections-week11.json`

Order matters: push `model.py` and `projections.json` first, because Peyton's profiles read them.

## Unit 1: build the raw cache (Haiku subagent)

Run `pull.py`, `pull_wiki.py`, `dataset.py` as in the README. Report which sources were refused. Do not commit `raw/` or any change to `research/data/<KEY>.json`.

## Unit 2: `research/tools/model.py` (one Sonnet subagent, standard library only)

Give the subagent this whole section. It must first look at the data shape with short snippets, never by reading a whole data file: the keys of `research/data/GOB-QB.json`, the shape of one game log row (opponent, week, season, closing spread and total, stats), `projections_rotowire`, and in `research/data/league.json` the key `defense_2026`. Read `research/tools/dataset.py` around `def defense_tables` (about line 341): `defense_tables(by_season, games)` returns `build(season, upto)`, which gives what each defense allowed to each position using only weeks before `upto`. Scoring is `data/scoring.json` (1 point per 25 pass yards, 4 per pass TD, minus 2 per interception, 1 per 10 rush or receiving yards, 6 per rush or receiving TD, no point per catch, minus 2 per lost fumble, field goals 3, 4 from 40 to 49 yards, 5 from 50, 1 per extra point).

What `model.py` does for each of the 28 players (keys `GOB|PYT|TUR|OWL` - `QB|RB|WR1|WR2|WR3|TE|K`):

1. Base: a recency-weighted average of his own per-game stat line (pass yards, pass TD, INT, rush yards, rush TD, receptions, receiving yards, receiving TD, lost fumbles; kickers: FG made by distance band, extra points). Weight by recency (for example exponential decay per game, half-life tuned on 2025).
2. Opponent factor: from `defense_2026` (or `build(season, upto)` in the backtest): how much that defense allows to his position compared with normal, shrunk toward 1.0 when few games are in.
3. Game factor: his team's implied points from the betting line (`total / 2 - spread / 2` for his side, sign checked on a known game) divided by the league average implied points.
4. Projection = base times opponent factor times game factor. Fantasy points by the scoring rules.
5. Spread: 10th, 50th and 90th percentile of fantasy points and the chance of at least one touchdown. Use the player's own spread of past results (for example a scaled lognormal or empirical residuals), so the 10 to 90 band holds about 80 percent of real results in the backtest.
6. Availability: injured reserve projects to zero. Puka Nacua (GOB-WR2) is on IR (placed Nov 13, earliest return about week 15). Lamar Jackson (PYT-QB) is on IR. Questionable players get a stated chance of playing: rerun `python3 research/tools/pull.py --fresh` and read the latest status for Amon-Ra St. Brown (GOB-WR3, questionable, ribs, expected to play), Ladd McConkey and Garrett Wilson. The projection is then (chance of playing) times (projection if he plays), and the percentiles come from the mixture.
7. Bye and next game: players whose team is on bye or already played this week use their next game. Philadelphia (Saquon Barkley, GOB-RB) is on bye in week 10, next game week 11 against Pittsburgh. Washington and the Giants played Thursday, so Jayden Daniels and Malik Nabers (PYT-WR2) also project for week 11. Write the week used in each record.

Backtest: every week from 2025 week 3 to 2026 week 9, for every player, using only data from before that week (`build(season, upto)` for defenses, the closing line in each log row for the game factor). Compare three methods against the real fantasy points: the season average to date, RotoWire (`projections_rotowire` in each data file, where present), and the model. Tune the few parameters (half-life, shrinkage, spread scale) on 2025 only, then report the 2026 numbers as the honest test. Also try a blend of the model with RotoWire (one weight tuned on 2025); use the blend in `projections.json` only if it wins on 2026.

Matchups: 20,000 Monte Carlo draws per pairing, each player's fantasy points drawn from his distribution (zero for IR, a coin flip on playing for questionable players). Fantasy teams of 7: GOB, PYT, TUR, OWL. Report win chance, mean and median score, and the 10th and 90th percentile of the margin for GOB vs PYT and TUR vs OWL (the two real games) and also the other four pairings. Use a fixed random seed so reruns match.

Outputs:

- `research/data/projections.json`: per player: key, name, NFL team, week, opponent, home or away, implied team points, opponent factor, game factor, chance of playing, projected stat line, fantasy points (mean, p10, p50, p90), touchdown chance, method used, a one-line reason. Plus a `matchups` section with the six pairings. Plus `generated` (date) and `backtest_summary`.
- `research/BACKTEST.md`: plain tables. For 2025 (tuning) and 2026 (test) separately: mean absolute error and bias by method (season average, RotoWire, model, blend), overall and by position; how often the real result fell inside the 10 to 90 band (target about 80 percent) and what you changed if it did not; the tuned parameters. A short honest paragraph: "expect a typical miss of about X points for a QB, Y for a WR...". No em dashes.

Check before commit: `python3 research/tools/model.py` runs clean from the repo root; `python3 -m json.tool research/data/projections.json`; 28 players present; IR players at zero; band coverage on 2026 printed in BACKTEST.md. Commit and push `model.py` + `projections.json` + `BACKTEST.md` together. Tell Peyton in one line that `projections.json` is on your branch.

## Unit 3: week 10 results check (one Sonnet subagent, after the games)

Week 10: Sunday games are 2026-11-15, the last one is Sunday night (PIT at CIN), and LAC at BAL is Monday 2026-11-16. Start this unit only once all games are final.

1. Rerun `python3 research/tools/pull.py --fresh` and `python3 research/tools/dataset.py` (Haiku is fine), so the real week 10 stat lines are in the logs. Do not commit changed `research/data/<KEY>.json` files (Juan owns them); `model.py` can read them locally.
2. Write `research/RESULTS-week10.md`: a table with every player who played in week 10: projected points (mean, p10, p90), real points, real stat line, inside the band or not. Then the totals for GOB vs PYT and TUR vs OWL against the predicted win chance. Then, for each big miss, the plain reason (injury in game, blowout, touchdown luck, role change), with a source for any news cited.
3. Change the model only where the backtest also supports the change (rerun the backtest and show before and after in the results file). One week of results alone is not a reason.
4. Project week 11 with the updated data: `research/data/projections-week11.json` (same format). Barkley, Daniels and Nabers had week 11 as their next game already.
5. Commit and push. Repeat steps 1 to 4 for each later week only if Juan asks.

## Done looks like

`model.py`, `projections.json`, `BACKTEST.md`, `RESULTS-week10.md`, `projections-week11.json` pushed to `Rickstar-App/research`, and a short report to Juan: errors to expect, band coverage, whether the blend with RotoWire won, and anything not checked.
