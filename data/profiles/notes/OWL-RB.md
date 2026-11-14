# Derrick Henry

OWL, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.926 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.857 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.217 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 9.0 (9.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| share of carries | 0.918 | 0.926 | -0.008 |
| catching passes | 0.75 | 0.857 | -0.107 |
| red zone use | 0.178 | 0.217 | -0.039 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3043078/statistics, read 2026-11-14.

## What it means for play calling

Henry is a runner first (0.926 of touches are carries): give the ball on the ground. Henry gets a large share of carries near the goal line (0.217): a strong call inside the 20.
