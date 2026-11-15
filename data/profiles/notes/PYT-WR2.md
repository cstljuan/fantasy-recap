# Malik Nabers

PYT, WR2 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.597 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/11632?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.682 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/11632?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.106 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/11632?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.284 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Deep threat who is best over the middle and on first down. Not a red zone scorer, and his targets are down over the last three games. Season 2026 numbers through game week 9.0 (9.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/PYT-WR2-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.284 | 85 of 299 | targets divided by the team's throws in the games played |
| deep targets | 0.294 | 25 of 85 | deep targets divided by targets with a depth |
| red zone target share | 0.323 | 10 of 31 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.266 | 21 of 79 | third down targets divided by the team's third down throws |
| short catch rate | 0.75 | 45 of 60 | short catches divided by short targets |
| deep catch rate | 0.52 | 13 of 25 | deep catches divided by deep targets |
| to the left | 0.376 | 32 of 85 | targets to the left divided by targets with a direction |
| to the middle | 0.212 | 18 of 85 | targets to the middle divided by targets with a direction |
| to the right | 0.412 | 35 of 85 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 9, 10. Weeks skipped (no stats): 8. Source: https://api.sleeper.com/stats/nfl/player/11632?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.582 | 0.597 | -0.015 |
| catch rate | 0.708 | 0.682 | +0.026 |
| red zone use | 0.042 | 0.106 | -0.064 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/11632?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4595348/statistics, read 2026-11-14.

## What it means for play calling

Nabers is the focus of the passing game: 0.284 of the team's throws. Nabers is a middle depth target (0.597 on deep ball).
