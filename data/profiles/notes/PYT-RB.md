# Bijan Robinson

PYT, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.809 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.775 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.172 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.157 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 9.0 (9.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.157 | 40 of 255 | targets divided by the team's throws in the games played |
| carry share | 0.679 | 169 of 249 | carries divided by the team's carries in the games played |
| to the left | 0.509 | 86 of 169 | carries to the left divided by carries with a gap |
| to the middle | 0.219 | 37 of 169 | carries to the middle divided by carries with a gap |
| to the right | 0.272 | 46 of 169 | carries to the right divided by carries with a gap |
| goal line share | 0.8 | 8 of 10 | carries inside the 5 divided by the team's carries inside the 5 |
| short yardage share | 0.529 | 9 of 17 | carries on third or fourth and 2 or less divided by the team's |
| runs of 10 or more | 0.118 | 20 of 169 | carries of 10 yards or more divided by carries |
| runs stopped at 0 or less | 0.13 | 22 of 169 | carries for no gain or a loss divided by carries |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| share of carries | 0.817 | 0.809 | +0.008 |
| catching passes | 0.846 | 0.775 | +0.071 |
| red zone use | 0.155 | 0.172 | -0.017 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4430807/statistics, read 2026-11-14.

## What it means for play calling

Robinson gets 0.8 of the team's carries inside the 5: the goal line back. Robinson mostly runs (0.809 of touches are carries) and catches some passes.
