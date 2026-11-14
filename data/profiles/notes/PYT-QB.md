# Lamar Jackson

PYT, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.831 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.701 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.13 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 6.0 (5.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 4, 8, 9. Weeks skipped (no stats): 5, 6, 7, 10. Source: https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.881 | 0.831 | +0.050 |
| short passing | 0.714 | 0.701 | +0.013 |
| running as a quarterback | 0.083 | 0.13 | -0.047 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 5, ESPN 5.

Sleeper: https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3916387/statistics, read 2026-11-14.

## What it means for play calling

Jackson pushes the ball downfield: a high deep ball number (0.831) says the long throw is a real option. Jackson completes a high share of passes (0.701): the short game is safe with this quarterback.
