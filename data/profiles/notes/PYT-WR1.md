# Justin Jefferson

PYT, WR1 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.634 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.608 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.137 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.274 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Third down and red zone receiver whose targets are up but whose production per target has fallen sharply over the last three games. Season 2026 numbers through game week 7.0 (7.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/PYT-WR1-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 7 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.274 | 51 of 186 | targets divided by the team's throws in the games played |
| deep targets | 0.255 | 13 of 51 | deep targets divided by targets with a depth |
| red zone target share | 0.333 | 7 of 21 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.328 | 21 of 64 | third down targets divided by the team's third down throws |
| short catch rate | 0.632 | 24 of 38 | short catches divided by short targets |
| deep catch rate | 0.538 | 7 of 13 | deep catches divided by deep targets |
| to the left | 0.431 | 22 of 51 | targets to the left divided by targets with a direction |
| to the middle | 0.176 | 9 of 51 | targets to the middle divided by targets with a direction |
| to the right | 0.392 | 20 of 51 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.562 | 0.634 | -0.072 |
| catch rate | 0.444 | 0.608 | -0.164 |
| red zone use | 0.111 | 0.137 | -0.026 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/6794?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4262921/statistics, read 2026-11-14.

## What it means for play calling

Inside the 20, Jefferson gets 0.333 of the team's throws. Lately Jefferson's catch rate number is down: 0.444 in weeks 7, 8, 9 against 0.608 for the season, a small sample.
