# Puka Nacua

GOB, WR2 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.511 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.753 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.129 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/9493?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.355 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 7.0 (7.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 7 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.355 | 93 of 262 | targets divided by the team's throws in the games played |
| deep targets | 0.194 | 18 of 93 | deep targets divided by targets with a depth |
| red zone target share | 0.235 | 8 of 34 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.407 | 24 of 59 | third down targets divided by the team's third down throws |
| short catch rate | 0.84 | 63 of 75 | short catches divided by short targets |
| deep catch rate | 0.389 | 7 of 18 | deep catches divided by deep targets |
| to the left | 0.333 | 31 of 93 | targets to the left divided by targets with a direction |
| to the middle | 0.237 | 22 of 93 | targets to the middle divided by targets with a direction |
| to the right | 0.43 | 40 of 93 | targets to the right divided by targets with a direction |

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

Nacua is the focus of the passing game: 0.355 of the team's throws. Nacua gains little per catch (0.511): a short and middle target.
