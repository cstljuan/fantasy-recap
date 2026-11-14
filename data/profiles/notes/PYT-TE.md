# George Kittle

PYT, TE (TE). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.636 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.717 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.208 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 6, 7, 9. Weeks skipped (no stats): 8, 10. Source: https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.632 | 0.636 | -0.004 |
| catch rate | 0.68 | 0.717 | -0.037 |
| red zone use | 0.24 | 0.208 | +0.032 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3040151/statistics, read 2026-11-14.

## What it means for play calling

Kittle sees many red zone targets (0.208): a call near the goal line. Kittle is a short and middle target (0.636 on deep ball).
