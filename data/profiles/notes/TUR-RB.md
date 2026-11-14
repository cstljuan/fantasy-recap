# Jahmyr Gibbs

TUR, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.797 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/9221?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.756 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9221?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.243 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/9221?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.165 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.165 | 45 of 273 | targets divided by the team's throws in the games played |
| carry share | 0.805 | 177 of 220 | carries divided by the team's carries in the games played |
| to the left | 0.322 | 57 of 177 | carries to the left divided by carries with a gap |
| to the middle | 0.322 | 57 of 177 | carries to the middle divided by carries with a gap |
| to the right | 0.356 | 63 of 177 | carries to the right divided by carries with a gap |
| goal line share | 0.938 | 15 of 16 | carries inside the 5 divided by the team's carries inside the 5 |
| short yardage share | 0.714 | 10 of 14 | carries on third or fourth and 2 or less divided by the team's |
| runs of 10 or more | 0.164 | 29 of 177 | carries of 10 yards or more divided by carries |
| runs stopped at 0 or less | 0.22 | 39 of 177 | carries for no gain or a loss divided by carries |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/9221?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| share of carries | 0.867 | 0.797 | +0.070 |
| catching passes | 0.636 | 0.756 | -0.120 |
| red zone use | 0.194 | 0.243 | -0.049 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/9221?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4429795/statistics, read 2026-11-14.

## What it means for play calling

Gibbs gets 0.938 of the team's carries inside the 5: the goal line back. Gibbs gets a large share of carries near the goal line (0.243): a strong call inside the 20.
