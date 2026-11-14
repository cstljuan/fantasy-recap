# Josh Allen

GOB, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.716 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.661 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.123 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 6, 8, 9. Weeks skipped (no stats): 7, 10. Source: https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.662 | 0.716 | -0.054 |
| short passing | 0.663 | 0.661 | +0.002 |
| running as a quarterback | 0.056 | 0.123 | -0.067 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3918298/statistics, read 2026-11-14.

## What it means for play calling

Allen pushes the ball downfield: a high deep ball number (0.716) says the long throw is a real option. Allen runs a fair amount (0.123 of the yards on the ground): a called run for the quarterback is in play.
