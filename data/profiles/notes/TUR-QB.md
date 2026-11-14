# Jayden Daniels

TUR, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.586 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.648 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.157 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 7.0 (7.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 8, 9, 10. Weeks skipped (no stats): none. Source: https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.636 | 0.586 | +0.050 |
| short passing | 0.649 | 0.648 | +0.001 |
| running as a quarterback | 0.083 | 0.157 | -0.074 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426348/statistics, read 2026-11-14.

## What it means for play calling

Daniels runs a fair amount (0.157 of the yards on the ground): a called run for the quarterback is in play. Daniels throws at a middle depth (0.586 on deep ball): a mix of short and long.
