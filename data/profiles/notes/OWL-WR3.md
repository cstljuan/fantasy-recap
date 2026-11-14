# Ladd McConkey

OWL, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.841 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.708 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.083 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (6.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 6, 8, 9. Weeks skipped (no stats): 7, 10. Source: https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 1 | 0.841 | +0.159 |
| catch rate | 0.714 | 0.708 | +0.006 |
| red zone use | not known | 0.083 | not known |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 6, ESPN 6.

Sleeper: https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4612826/statistics, read 2026-11-14.

## What it means for play calling

McConkey gains a lot per catch (0.841 on deep ball): the downfield target. Lately McConkey's deep ball number is up: 1 in weeks 6, 8, 9 against 0.841 for the season, a small sample.
