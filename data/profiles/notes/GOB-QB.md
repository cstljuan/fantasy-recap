# Josh Allen

GOB, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.716 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.661 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.123 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 8.0 (8.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| deep throws | 0.208 | 49 of 236 | deep throws divided by throws with a depth in the play text |
| to the left | 0.331 | 78 of 236 | throws to the left divided by throws with a direction |
| to the middle | 0.237 | 56 of 236 | throws to the middle divided by throws with a direction |
| to the right | 0.432 | 102 of 236 | throws to the right divided by throws with a direction |
| deep completions | 0.469 | 23 of 49 | deep completions divided by deep throws |
| sacks | 0.067 | 17 of 253 | sacks divided by throws plus sacks |
| interceptions | 0.025 | 6 of 236 | interceptions divided by throws |
| scrambles | 0.073 | 20 of 273 | scrambles divided by dropbacks (throws, sacks and scrambles) |
| third downs converted | 0.481 | 39 of 81 | third down plays by the quarterback that gained the first down or scored |
| red zone touchdown throws | 0.176 | 6 of 34 | touchdown throws inside the 20 divided by throws inside the 20 |

## Recent form

Weeks used: 6, 8, 9. Weeks skipped (no stats): 7, 10. Source: https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.662 | 0.716 | -0.054 |
| short passing | 0.663 | 0.661 | +0.002 |
| running as a quarterback | 0.056 | 0.123 | -0.067 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4984?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3918298/statistics, read 2026-11-14.

## What it means for play calling

Allen converts 0.481 of the third downs where Allen throws or runs. Allen pushes the ball downfield: a high deep ball number (0.716) says the long throw is a real option.
