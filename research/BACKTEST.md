# Backtest of the projection model

Generated 2026-11-15 by `python3 research/tools/model.py`. Same command regenerates this file.

Every player game from 2025 week 3 to 2026 week 9 is predicted using only games before that week. Parameters are tuned on 2025 only (weeks 3 to 18), and 2026 (weeks 1 to 9) is the test nobody tuned on. Points use `data/scoring.json` (no point per catch). MAE is the mean absolute error in fantasy points. Bias is the average of prediction minus real result (positive means too high).

Limits to know first:

- Only the 28 players' logs are committed. `research/tools/dataset.py` cannot run here (the league wide `games.csv` is missing), so the league wide `defense_tables.build(season, upto)` is not available. In the backtest the opponent factor is rebuilt with the same idea from the 28 logs alone (what a defense gave our players at that position compared with what those players scored against everyone else that season, shrunk toward 1.00). That is a thin sample, so the backtest probably understates what the real league wide `defense_2026` table is worth. The 2026 projections use `defense_2026` from `league.json`, which is not what was backtested.
- Games a player missed are not in his log, so the backtest only scores games he played. It says nothing about injury surprises.
- The RotoWire files cover only some rows (counts below). RotoWire is converted to our scoring from its stat lines.
- RotoWire has no week 10 or 11 entry in the data, so the real week 10 projections come from the model alone.

## Tuned parameters (chosen on 2025 only)

| Parameter | Value | Meaning |
|---|---|---|
| half_life | 40 games | weight halves every this many games back |
| prior | 50 | shrinkage of the opponent factor toward 1.00 (bigger is more shrinkage) |
| gamma | 0.5 | how much of the opponent factor is used (0 off, 1 full) |
| beta | 0.5 | how much of the game factor (implied points over league average) is used |
| spread scale | 1.15 | multiplies the width of the 10 to 90 band around the mean |
| blend weight | 0.05 | weight on the model in the model and RotoWire blend |

2025 model MAE for the chosen settings was 6.178. The same grid with the opponent factor and game factor both switched off (gamma 0, beta 0) and the best half life gave 6.222, so the two factors helped on 2025.

## 2025 weeks 3 to 18 (tuning year, so these numbers are optimistic)

Rows: 341 player games. RotoWire covers 341 of them (100 percent).

Rows where RotoWire exists (all four methods on the same games):

| Group | Rows | Season average MAE | RotoWire MAE | Model MAE | Blend MAE | Season average bias | RotoWire bias | Model bias | Blend bias |
|---|---|---|---|---|---|---|---|---|---|
| All | 341 | 6.30 | 6.06 | 6.18 | 6.06 | 0.12 | 0.30 | 0.03 | 0.29 |
| QB | 42 | 7.63 | 7.43 | 7.77 | 7.43 | 3.52 | 2.67 | 4.13 | 2.74 |
| RB | 59 | 8.30 | 7.90 | 7.81 | 7.89 | -1.01 | 0.27 | -0.05 | 0.25 |
| WR | 141 | 5.78 | 5.61 | 5.76 | 5.61 | 0.15 | 0.57 | 0.05 | 0.55 |
| TE | 41 | 6.33 | 5.94 | 6.10 | 5.94 | -1.36 | -1.19 | -2.77 | -1.27 |
| K | 58 | 4.58 | 4.36 | 4.43 | 4.36 | -0.23 | -0.99 | -0.92 | -0.99 |

All rows (RotoWire and blend only where RotoWire exists):

| Group | Rows | Season average MAE | RotoWire MAE | Model MAE | Blend MAE | Season average bias | RotoWire bias | Model bias | Blend bias |
|---|---|---|---|---|---|---|---|---|---|
| All | 341 | 6.30 | 6.06 | 6.18 | 6.06 | 0.12 | 0.30 | 0.03 | 0.29 |
| QB | 42 | 7.63 | 7.43 | 7.77 | 7.43 | 3.52 | 2.67 | 4.13 | 2.74 |
| RB | 59 | 8.30 | 7.90 | 7.81 | 7.89 | -1.01 | 0.27 | -0.05 | 0.25 |
| WR | 141 | 5.78 | 5.61 | 5.76 | 5.61 | 0.15 | 0.57 | 0.05 | 0.55 |
| TE | 41 | 6.33 | 5.94 | 6.10 | 5.94 | -1.36 | -1.19 | -2.77 | -1.27 |
| K | 58 | 4.58 | 4.36 | 4.43 | 4.36 | -0.23 | -0.99 | -0.92 | -0.99 |

Band: share of real results inside the model's 10 to 90 band (target about 80 percent).

| Group | Rows | Inside band |
|---|---|---|
| All | 341 | 81.2 percent |
| QB | 42 | 73.8 percent |
| RB | 59 | 81.4 percent |
| WR | 141 | 83.7 percent |
| TE | 41 | 75.6 percent |
| K | 58 | 84.5 percent |

Below the 10th percentile: 7.3 percent, above the 90th: 11.4 percent (each should be near 10).

## 2026 weeks 1 to 9 (the honest test)

Rows: 219 player games. RotoWire covers 216 of them (99 percent).

Rows where RotoWire exists (all four methods on the same games):

| Group | Rows | Season average MAE | RotoWire MAE | Model MAE | Blend MAE | Season average bias | RotoWire bias | Model bias | Blend bias |
|---|---|---|---|---|---|---|---|---|---|
| All | 216 | 6.77 | 5.96 | 5.79 | 5.95 | 0.72 | -0.26 | -0.35 | -0.26 |
| QB | 27 | 7.42 | 7.18 | 6.70 | 7.16 | 3.19 | -0.24 | 1.42 | -0.16 |
| RB | 32 | 9.22 | 7.66 | 7.37 | 7.64 | 2.85 | 1.14 | 0.12 | 1.09 |
| WR | 91 | 7.00 | 6.10 | 6.03 | 6.08 | 0.08 | -0.24 | -1.07 | -0.28 |
| TE | 33 | 5.30 | 4.96 | 4.65 | 4.95 | 0.04 | -1.01 | -1.26 | -1.02 |
| K | 33 | 4.67 | 3.94 | 3.96 | 3.93 | -0.95 | -0.92 | 0.61 | -0.85 |

All rows (RotoWire and blend only where RotoWire exists):

| Group | Rows | Season average MAE | RotoWire MAE | Model MAE | Blend MAE | Season average bias | RotoWire bias | Model bias | Blend bias |
|---|---|---|---|---|---|---|---|---|---|
| All | 219 | 6.78 | 5.96 | 5.85 | 5.95 | 0.81 | -0.26 | -0.21 | -0.26 |
| QB | 27 | 7.42 | 7.18 | 6.70 | 7.16 | 3.19 | -0.24 | 1.42 | -0.16 |
| RB | 33 | 9.09 | 7.66 | 7.50 | 7.64 | 2.92 | 1.14 | 0.47 | 1.09 |
| WR | 93 | 7.04 | 6.10 | 6.10 | 6.08 | 0.27 | -0.24 | -0.85 | -0.28 |
| TE | 33 | 5.30 | 4.96 | 4.65 | 4.95 | 0.04 | -1.01 | -1.26 | -1.02 |
| K | 33 | 4.67 | 3.94 | 3.96 | 3.93 | -0.95 | -0.92 | 0.61 | -0.85 |

Band: share of real results inside the model's 10 to 90 band (target about 80 percent).

| Group | Rows | Inside band |
|---|---|---|
| All | 219 | 83.1 percent |
| QB | 27 | 88.9 percent |
| RB | 33 | 78.8 percent |
| WR | 93 | 81.7 percent |
| TE | 33 | 84.8 percent |
| K | 33 | 84.8 percent |

Below the 10th percentile: 7.3 percent, above the 90th: 9.6 percent (each should be near 10).

## Band width, what I changed

With the raw spread (scale 1.00) the 2025 band held 72.4 percent of real results. I searched the scale in steps of 0.05 and kept the one closest to 80 percent on 2025: scale 1.15, which gives 81.2 percent on 2025 and 83.1 percent on 2026 (not tuned). Raw ratio quantiles come from the player's own last 30 games plus the pool of his position, so a scale above 1 means games are wilder than the history shows, which is expected because the mean itself carries error.

## Blend of model and RotoWire

Weight on the model tuned on 2025 rows where RotoWire exists: 0.05 (RotoWire gets 0.95). On 2025 the blend had MAE 6.06 against 6.18 for the model and 6.06 for RotoWire. On 2026 (same kind of rows) the blend had MAE 5.95 against 5.79 for the model and 5.96 for RotoWire. Blend wins on 2026: **no**. projections.json uses the model alone.

## Touchdown chance check

Chance of at least one touchdown (Poisson from the projected touchdown rate), non kickers. Predicted average versus real share, and the Brier score (lower is better; always saying the average rate scores about p(1-p)).

| Period | Games | Predicted | Real | Brier |
|---|---|---|---|---|
| 2025 | 283 | 0.483 | 0.502 | 0.253 |
| 2026 | 186 | 0.487 | 0.554 | 0.225 |

## Week 10 matchups (20,000 draws each, seed 20261115)

Each player's points are drawn from his distribution (zero for injured reserve, a coin flip on playing for questionable players with the stated chance). Players are treated as independent. Margin is the first team minus the second.

| Pairing | Win chance first | Win chance second | Mean score first | Mean score second | Median first | Median second | Margin p10 | Margin p90 |
|---|---|---|---|---|---|---|---|---|
| GOB vs PYT (real game) | 75.1 percent | 24.9 percent | 81.0 | 61.7 | 80.0 | 60.9 | -17.3 | 55.7 |
| TUR vs OWL (real game) | 53.7 percent | 46.3 percent | 80.8 | 78.4 | 79.9 | 77.3 | -34.8 | 39.6 |
| GOB vs TUR | 50.3 percent | 49.7 percent | 80.9 | 80.6 | 80.1 | 79.6 | -38.4 | 39.6 |
| GOB vs OWL | 52.6 percent | 47.4 percent | 80.8 | 78.6 | 79.6 | 77.7 | -35.6 | 40.9 |
| PYT vs TUR | 24.5 percent | 75.5 percent | 61.7 | 80.7 | 61.0 | 79.7 | -54.2 | 15.4 |
| PYT vs OWL | 26.2 percent | 73.9 percent | 61.5 | 78.5 | 60.4 | 77.6 | -51.2 | 16.7 |

## What to expect

Looking at 2026, the model's typical miss on a single player game is about 6.70 points for a QB, 7.50 for a RB, 6.10 for a WR, 4.65 for a TE and 3.96 for a kicker (mean absolute error; a bad game is much worse, and about 1 in 5 real results lands outside the stated 10 to 90 band). Season average to date misses by 6.78 overall against 5.85 for the model; RotoWire (216 of 219 rows) misses by 5.96 against 5.79 for the model on the same rows. Add up seven players and the team total is far less certain than any single number, so read the win chances as rough odds, not promises. Treat the opponent factor and the three questionable players (St. Brown, Wilson, McConkey) as the least trustworthy parts: the first is rebuilt from a thin sample in the backtest and the second is a judgement call from news text.
