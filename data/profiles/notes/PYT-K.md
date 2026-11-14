# Harrison Butker

PYT, K (K). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| long kicks | 0.5 | field goals made from 40 yards or more divided by field goals made | https://api.sleeper.com/stats/nfl/player/4227?season_type=regular&season=2026 | 2026-11-14 |
| accuracy | 0.632 | field goals made divided by attempted | https://api.sleeper.com/stats/nfl/player/4227?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| made from 0 to 39 | 1 | 6 of 6 | field goals made from 0 to 39 yards divided by attempts |
| made from 40 to 49 | 0.8 | 4 of 5 | field goals made from 40 to 49 yards divided by attempts |
| made from 50 or more | 0.25 | 2 of 8 | field goals made from 50 or more yards divided by attempts |
| attempts from 40 or more | 0.684 | 13 of 19 | attempts from 40 yards or more divided by attempts |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/4227?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| long kicks | 1 | 0.5 | +0.500 |
| accuracy | 0.333 | 0.632 | -0.299 |

## Sleeper against ESPN

All 8 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td, fg made). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4227?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3055899/statistics, read 2026-11-14.

## What it means for play calling

Butker makes only 0.25 of attempts from 50 yards or more. Lately Butker's long kicks number is up: 1 in weeks 7, 8, 9 against 0.5 for the season, a small sample.
