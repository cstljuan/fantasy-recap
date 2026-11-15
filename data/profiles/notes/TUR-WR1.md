# CeeDee Lamb

TUR, WR1 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.646 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/6786?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.648 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/6786?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.157 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/6786?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.321 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Target leader who wins deep and to the right, with heavy red zone volume. More targets and yards lately at a lower success rate. Season 2026 numbers through game week 9.0 (9.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/TUR-WR1-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.321 | 108 of 336 | targets divided by the team's throws in the games played |
| deep targets | 0.259 | 28 of 108 | deep targets divided by targets with a depth |
| red zone target share | 0.34 | 18 of 53 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.386 | 32 of 83 | third down targets divided by the team's third down throws |
| short catch rate | 0.7 | 56 of 80 | short catches divided by short targets |
| deep catch rate | 0.5 | 14 of 28 | deep catches divided by deep targets |
| to the left | 0.352 | 38 of 108 | targets to the left divided by targets with a direction |
| to the middle | 0.176 | 19 of 108 | targets to the middle divided by targets with a direction |
| to the right | 0.472 | 51 of 108 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/6786?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.743 | 0.646 | +0.097 |
| catch rate | 0.564 | 0.648 | -0.084 |
| red zone use | 0.205 | 0.157 | +0.048 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/6786?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4241389/statistics, read 2026-11-14.

## What it means for play calling

Lamb is the focus of the passing game: 0.321 of the team's throws. Lamb is a middle depth target (0.646 on deep ball).
