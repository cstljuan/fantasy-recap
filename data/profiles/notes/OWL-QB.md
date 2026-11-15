# Patrick Mahomes

OWL, QB (QB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.645 | pass yards per attempt divided by 12, capped at 1 | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |
| short passing | 0.673 | completions divided by attempts | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |
| running as a quarterback | 0.04 | rush yards divided by pass plus rush yards | https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026 | 2026-11-14 |

High-volume short passer who throws to the right and scores through the air inside the 20. Yards per throw are down over the last three games on more attempts. Season 2026 numbers through game week 8.0 (8.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/OWL-QB-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 8 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| deep throws | 0.133 | 35 of 263 | deep throws divided by throws with a depth in the play text |
| to the left | 0.3 | 79 of 263 | throws to the left divided by throws with a direction |
| to the middle | 0.224 | 59 of 263 | throws to the middle divided by throws with a direction |
| to the right | 0.475 | 125 of 263 | throws to the right divided by throws with a direction |
| deep completions | 0.4 | 14 of 35 | deep completions divided by deep throws |
| sacks | 0.04 | 11 of 274 | sacks divided by throws plus sacks |
| interceptions | 0.015 | 4 of 263 | interceptions divided by throws |
| scrambles | 0.052 | 15 of 289 | scrambles divided by dropbacks (throws, sacks and scrambles) |
| third downs converted | 0.368 | 28 of 76 | third down plays by the quarterback that gained the first down or scored |
| red zone touchdown throws | 0.279 | 12 of 43 | touchdown throws inside the 20 divided by throws inside the 20 |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.578 | 0.645 | -0.067 |
| short passing | 0.686 | 0.673 | +0.013 |
| running as a quarterback | 0.037 | 0.04 | -0.003 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 8, ESPN 8.

Sleeper: https://api.sleeper.com/stats/nfl/player/4046?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3139477/statistics, read 2026-11-14.

## What it means for play calling

Mahomes rarely throws deep: 0.133 of throws in the real plays. Mahomes rarely runs (0.04): plan for the pocket.
