# Ja'Marr Chase

GOB, WR1 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.61 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/7564?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.726 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/7564?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.178 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/7564?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.247 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

High-volume receiver who wins on third down and scores deep. Targets and yards a game have jumped over the last three games. Season 2026 numbers through game week 8.0 (8.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/GOB-WR1-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.247 | 73 of 296 | targets divided by the team's throws in the games played |
| deep targets | 0.192 | 14 of 73 | deep targets divided by targets with a depth |
| red zone target share | 0.302 | 13 of 43 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.257 | 18 of 70 | third down targets divided by the team's third down throws |
| short catch rate | 0.763 | 45 of 59 | short catches divided by short targets |
| deep catch rate | 0.571 | 8 of 14 | deep catches divided by deep targets |
| to the left | 0.315 | 23 of 73 | targets to the left divided by targets with a direction |
| to the middle | 0.192 | 14 of 73 | targets to the middle divided by targets with a direction |
| to the right | 0.493 | 36 of 73 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/7564?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.688 | 0.61 | +0.078 |
| catch rate | 0.743 | 0.726 | +0.017 |
| red zone use | 0.171 | 0.178 | -0.007 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/7564?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4362628/statistics, read 2026-11-14.

## What it means for play calling

Inside the 20, Chase gets 0.302 of the team's throws. Chase is a middle depth target (0.61 on deep ball).
