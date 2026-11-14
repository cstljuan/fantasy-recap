# George Kittle

PYT, TE (TE). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.636 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.717 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.208 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/4217?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.226 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.226 | 53 of 234 | targets divided by the team's throws in the games played |
| deep targets | 0.208 | 11 of 53 | deep targets divided by targets with a depth |
| red zone target share | 0.3 | 12 of 40 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.155 | 9 of 58 | third down targets divided by the team's third down throws |
| short catch rate | 0.786 | 33 of 42 | short catches divided by short targets |
| deep catch rate | 0.455 | 5 of 11 | deep catches divided by deep targets |
| to the left | 0.472 | 25 of 53 | targets to the left divided by targets with a direction |
| to the middle | 0.245 | 13 of 53 | targets to the middle divided by targets with a direction |
| to the right | 0.283 | 15 of 53 | targets to the right divided by targets with a direction |

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

Inside the 20, Kittle gets 0.3 of the team's throws. Kittle sees many red zone targets (0.208): a call near the goal line.
