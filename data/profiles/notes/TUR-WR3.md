# Drake London

TUR, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.786 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/8112?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.647 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/8112?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.059 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/8112?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 9.0 (9.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/8112?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.546 | 0.786 | -0.240 |
| catch rate | 0.619 | 0.647 | -0.028 |
| red zone use | 0.095 | 0.059 | +0.036 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/8112?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426502/statistics, read 2026-11-14.

## What it means for play calling

London gains a lot per catch (0.786 on deep ball): the downfield target. Lately London's deep ball number is down: 0.546 in weeks 7, 8, 9 against 0.786 for the season, a small sample.
