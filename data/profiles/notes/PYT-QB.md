# Lamar Jackson

PYT, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.831 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.701 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.13 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 6.0 (5.0 games). Filled by agents/scout/fill_profiles.py, no model.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 5 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| deep throws | 0.221 | 21 of 95 | deep throws divided by throws with a depth in the play text |
| to the left | 0.326 | 31 of 95 | throws to the left divided by throws with a direction |
| to the middle | 0.347 | 33 of 95 | throws to the middle divided by throws with a direction |
| to the right | 0.326 | 31 of 95 | throws to the right divided by throws with a direction |
| deep completions | 0.524 | 11 of 21 | deep completions divided by deep throws |
| sacks | 0.069 | 7 of 102 | sacks divided by throws plus sacks |
| interceptions | 0.011 | 1 of 95 | interceptions divided by throws |
| scrambles | 0.089 | 10 of 112 | scrambles divided by dropbacks (throws, sacks and scrambles) |
| third downs converted | 0.375 | 9 of 24 | third down plays by the quarterback that gained the first down or scored |
| red zone touchdown throws | 0.286 | 4 of 14 | touchdown throws inside the 20 divided by throws inside the 20 |

## Recent form

Weeks used: 4, 8, 9. Weeks skipped (no stats): 5, 6, 7, 10. Source: https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.881 | 0.831 | +0.050 |
| short passing | 0.714 | 0.701 | +0.013 |
| running as a quarterback | 0.083 | 0.13 | -0.047 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 5, ESPN 5.

Sleeper: https://api.sleeper.com/stats/nfl/player/4881?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3916387/statistics, read 2026-11-14.

## What it means for play calling

Jackson throws deep often: 0.221 of throws in the real plays. Jackson pushes the ball downfield: a high deep ball number (0.831) says the long throw is a real option.
