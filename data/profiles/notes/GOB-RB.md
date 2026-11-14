# Saquon Barkley

GOB, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.863 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/4866?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.636 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/4866?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.174 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/4866?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.051 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 7.0 (7.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 7 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.051 | 11 of 217 | targets divided by the team's throws in the games played |
| carry share | 0.381 | 69 of 181 | carries divided by the team's carries in the games played |
| to the left | 0.391 | 27 of 69 | carries to the left divided by carries with a gap |
| to the middle | 0.203 | 14 of 69 | carries to the middle divided by carries with a gap |
| to the right | 0.406 | 28 of 69 | carries to the right divided by carries with a gap |
| goal line share | 0.5 | 6 of 12 | carries inside the 5 divided by the team's carries inside the 5 |
| short yardage share | 0.3 | 3 of 10 | carries on third or fourth and 2 or less divided by the team's |
| runs of 10 or more | 0.087 | 6 of 69 | carries of 10 yards or more divided by carries |
| runs stopped at 0 or less | 0.217 | 15 of 69 | carries for no gain or a loss divided by carries |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/4866?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| share of carries | 0.892 | 0.863 | +0.029 |
| catching passes | 0.75 | 0.636 | +0.114 |
| red zone use | 0.212 | 0.174 | +0.038 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/4866?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3929630/statistics, read 2026-11-14.

## What it means for play calling

Barkley is a runner first (0.863 of touches are carries): give the ball on the ground. Barkley catches 0.636 of passes thrown to the back.
