# Derrick Henry

OWL, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.926 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.857 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.217 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.057 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

First down and goal line runner with almost no receiving role. Carries, yards and touchdowns are all down over the last three games. Season 2026 numbers through game week 9.0 (9.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/OWL-RB-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.057 | 14 of 245 | targets divided by the team's throws in the games played |
| carry share | 0.689 | 175 of 254 | carries divided by the team's carries in the games played |
| to the left | 0.463 | 81 of 175 | carries to the left divided by carries with a gap |
| to the middle | 0.126 | 22 of 175 | carries to the middle divided by carries with a gap |
| to the right | 0.411 | 72 of 175 | carries to the right divided by carries with a gap |
| goal line share | 0.842 | 16 of 19 | carries inside the 5 divided by the team's carries inside the 5 |
| short yardage share | 0.556 | 10 of 18 | carries on third or fourth and 2 or less divided by the team's |
| runs of 10 or more | 0.086 | 15 of 175 | carries of 10 yards or more divided by carries |
| runs stopped at 0 or less | 0.189 | 33 of 175 | carries for no gain or a loss divided by carries |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| share of carries | 0.918 | 0.926 | -0.008 |
| catching passes | 0.75 | 0.857 | -0.107 |
| red zone use | 0.178 | 0.217 | -0.039 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/3198?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3043078/statistics, read 2026-11-14.

## What it means for play calling

Henry gets 0.842 of the team's carries inside the 5: the goal line back. Henry is a runner first (0.926 of touches are carries): give the ball on the ground.
