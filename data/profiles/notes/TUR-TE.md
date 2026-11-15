# Brock Bowers

TUR, TE (TE). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.685 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/11604?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.686 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/11604?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.157 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/11604?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.264 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Tight end used like a top receiver: the third down target and a red zone scorer. Success rate and yards per target are up over the last three games. Season 2026 numbers through game week 7.0 (7.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/TUR-TE-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 7 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.264 | 69 of 261 | targets divided by the team's throws in the games played |
| deep targets | 0.188 | 13 of 69 | deep targets divided by targets with a depth |
| red zone target share | 0.268 | 11 of 41 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.382 | 26 of 68 | third down targets divided by the team's third down throws |
| short catch rate | 0.732 | 41 of 56 | short catches divided by short targets |
| deep catch rate | 0.538 | 7 of 13 | deep catches divided by deep targets |
| to the left | 0.348 | 24 of 69 | targets to the left divided by targets with a direction |
| to the middle | 0.348 | 24 of 69 | targets to the middle divided by targets with a direction |
| to the right | 0.304 | 21 of 69 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/11604?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.69 | 0.685 | +0.005 |
| catch rate | 0.769 | 0.686 | +0.083 |
| red zone use | 0.154 | 0.157 | -0.003 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 7, ESPN 7.

Sleeper: https://api.sleeper.com/stats/nfl/player/11604?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4432665/statistics, read 2026-11-14.

## What it means for play calling

Bowers is a main target: 0.264 of the team's throws. Bowers is a short and middle target (0.685 on deep ball).
