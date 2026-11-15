# Tucker Kraft

OWL, TE (TE). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.487 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/9484?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.692 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9484?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.173 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/9484?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.152 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Short-area tight end trusted on fourth down and near the goal line. Better success rate and more touchdowns over the last three games on fewer targets. Season 2026 numbers through game week 9.0 (9.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/OWL-TE-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.152 | 52 of 341 | targets divided by the team's throws in the games played |
| deep targets | 0.135 | 7 of 52 | deep targets divided by targets with a depth |
| red zone target share | 0.176 | 9 of 51 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.103 | 10 of 97 | third down targets divided by the team's third down throws |
| short catch rate | 0.756 | 34 of 45 | short catches divided by short targets |
| deep catch rate | 0.286 | 2 of 7 | deep catches divided by deep targets |
| to the left | 0.25 | 13 of 52 | targets to the left divided by targets with a direction |
| to the middle | 0.288 | 15 of 52 | targets to the middle divided by targets with a direction |
| to the right | 0.462 | 24 of 52 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/9484?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.464 | 0.487 | -0.023 |
| catch rate | 0.733 | 0.692 | +0.041 |
| red zone use | 0.2 | 0.173 | +0.027 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/9484?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4572680/statistics, read 2026-11-14.

## What it means for play calling

Kraft is a short and middle target (0.487 on deep ball). Kraft catches 0.692 of targets.
