# Amon-Ra St. Brown

GOB, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.539 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/7547?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.709 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/7547?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.209 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/7547?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.315 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.315 | 86 of 273 | targets divided by the team's throws in the games played |
| deep targets | 0.244 | 21 of 86 | deep targets divided by targets with a depth |
| red zone target share | 0.327 | 18 of 55 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.409 | 27 of 66 | third down targets divided by the team's third down throws |
| short catch rate | 0.754 | 49 of 65 | short catches divided by short targets |
| deep catch rate | 0.571 | 12 of 21 | deep catches divided by deep targets |
| to the left | 0.384 | 33 of 86 | targets to the left divided by targets with a direction |
| to the middle | 0.291 | 25 of 86 | targets to the middle divided by targets with a direction |
| to the right | 0.326 | 28 of 86 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/7547?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.594 | 0.539 | +0.055 |
| catch rate | 0.828 | 0.709 | +0.119 |
| red zone use | 0.069 | 0.209 | -0.140 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/7547?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4374302/statistics, read 2026-11-14.

## What it means for play calling

St. Brown is the focus of the passing game: 0.315 of the team's throws. St. Brown gains little per catch (0.539): a short and middle target.
