# Justin Jefferson

PYT, WR1 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.634 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.608 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.137 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 7.0 (7.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.562 | 0.634 | -0.072 |
| catch rate | 0.444 | 0.608 | -0.164 |
| red zone use | 0.111 | 0.137 | -0.026 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4262921/statistics, read 2026-11-14.

## What it means for play calling

Jefferson is a middle depth target (0.634 on deep ball). Lately Jefferson's catch rate number is down: 0.444 in weeks 7, 8, 9 against 0.608 for the season, a small sample.
