# Jayden Daniels

TUR, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.586 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.648 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.157 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026 | 2026-11-14 |

Short passer and open-field runner who scores near the goal line, not deep. Passing yards are up over his last three games while his rushing is down. Season 2026 numbers through game week 7.0 (7.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/TUR-QB-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 7 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| deep throws | 0.191 | 40 of 209 | deep throws divided by throws with a depth in the play text |
| to the left | 0.321 | 67 of 209 | throws to the left divided by throws with a direction |
| to the middle | 0.258 | 54 of 209 | throws to the middle divided by throws with a direction |
| to the right | 0.421 | 88 of 209 | throws to the right divided by throws with a direction |
| deep completions | 0.425 | 17 of 40 | deep completions divided by deep throws |
| sacks | 0.075 | 17 of 227 | sacks divided by throws plus sacks |
| interceptions | 0.01 | 2 of 210 | interceptions divided by throws |
| scrambles | 0.113 | 29 of 256 | scrambles divided by dropbacks (throws, sacks and scrambles) |
| third downs converted | 0.362 | 25 of 69 | third down plays by the quarterback that gained the first down or scored |
| red zone touchdown throws | 0.286 | 8 of 28 | touchdown throws inside the 20 divided by throws inside the 20 |

## Recent form

Weeks used: 8, 9, 10. Weeks skipped (no stats): none. Source: https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.636 | 0.586 | +0.050 |
| short passing | 0.649 | 0.648 | +0.001 |
| running as a quarterback | 0.083 | 0.157 | -0.074 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/11566?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426348/statistics, read 2026-11-14.

## What it means for play calling

Daniels scrambles on 0.113 of dropbacks: watch for the run when the pocket breaks. Daniels runs a fair amount (0.157 of the yards on the ground): a called run for the quarterback is in play.
