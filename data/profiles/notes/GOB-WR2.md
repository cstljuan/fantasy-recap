# Puka Nacua

GOB, WR2 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.511 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.753 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.129 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 7.0 (7.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.452 | 0.511 | -0.059 |
| catch rate | 0.805 | 0.753 | +0.052 |
| red zone use | 0.195 | 0.129 | +0.066 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426515/statistics, read 2026-11-14.

## What it means for play calling

Nacua gains little per catch (0.511): a short and middle target. Nacua catches most targets (0.753): a safe throw.
