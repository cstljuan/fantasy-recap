# Nico Collins

PYT, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.686 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.718 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.128 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/7569?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.195 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 6.0 (6.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 6 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.195 | 39 of 200 | targets divided by the team's throws in the games played |
| deep targets | 0.359 | 14 of 39 | deep targets divided by targets with a depth |
| red zone target share | 0.2 | 6 of 30 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.188 | 9 of 48 | third down targets divided by the team's third down throws |
| short catch rate | 0.88 | 22 of 25 | short catches divided by short targets |
| deep catch rate | 0.429 | 6 of 14 | deep catches divided by deep targets |
| to the left | 0.256 | 10 of 39 | targets to the left divided by targets with a direction |
| to the middle | 0.282 | 11 of 39 | targets to the middle divided by targets with a direction |
| to the right | 0.462 | 18 of 39 | targets to the right divided by targets with a direction |

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

0.359 of Collins's targets are deep. Collins is a middle depth target (0.686 on deep ball).
