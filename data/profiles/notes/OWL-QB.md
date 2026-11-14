# Patrick Mahomes

OWL, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.645 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.673 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.04 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.578 | 0.645 | -0.067 |
| short passing | 0.686 | 0.673 | +0.013 |
| running as a quarterback | 0.037 | 0.04 | -0.003 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3139477/statistics, read 2026-11-14.

## What it means for play calling

Mahomes rarely runs (0.04): plan for the pocket. Mahomes throws at a middle depth (0.645 on deep ball): a mix of short and long.
