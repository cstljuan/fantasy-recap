# Brandon Aubrey

GOB, K (K). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| long kicks | 0.412 | field goals made from 40 yards or more divided by field goals made | https://api.sleeper.com/stats/nfl/player/11533?season_type=regular&season=2026 | 2026-11-14 |
| accuracy | 0.773 | field goals made divided by attempted | https://api.sleeper.com/stats/nfl/player/11533?season_type=regular&season=2026 | 2026-11-14 |

Kicker asked to try very long field goals: perfect inside 50, but he makes fewer than half from 50 and out. Season 2026 numbers through game week 9.0 (9.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/GOB-K-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 9 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| made from 0 to 39 | 1 | 10 of 10 | field goals made from 0 to 39 yards divided by attempts |
| made from 40 to 49 | not known | 4 of 4 | field goals made from 40 to 49 yards divided by attempts (null: fewer than 5 plays) |
| made from 50 or more | 0.375 | 3 of 8 | field goals made from 50 or more yards divided by attempts |
| attempts from 40 or more | 0.545 | 12 of 22 | attempts from 40 yards or more divided by attempts |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/11533?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| long kicks | 0.375 | 0.412 | -0.037 |
| accuracy | 0.8 | 0.773 | +0.027 |

## Sleeper against ESPN

All 8 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td, fg made). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/11533?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/3953687/statistics, read 2026-11-14.

## What it means for play calling

Aubrey makes only 0.375 of attempts from 50 yards or more. Aubrey makes 0.773 of field goals attempted.
