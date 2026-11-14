# Nico Collins

PYT, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.686 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.718 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.128 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 6.0 (6.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 6, 7, 9. Weeks skipped (no stats): 8, 10. Source: https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.75 | 0.686 | +0.064 |
| catch rate | 0.643 | 0.718 | -0.075 |
| red zone use | 0.143 | 0.128 | +0.015 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 6, ESPN 6.

Sleeper: https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4258173/statistics, read 2026-11-14.

## What it means for play calling

Collins is a middle depth target (0.686 on deep ball). Collins catches 0.718 of targets.
