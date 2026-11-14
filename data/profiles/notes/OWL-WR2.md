# Jaxon Smith-Njigba

OWL, WR2 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.73 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/9488?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.717 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9488?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.131 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/9488?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 9.0 (9.0 games). Filled by agents/scout/fill_profiles.py, no model.

## Recent form

Weeks used: 7, 8, 9. Weeks skipped (no stats): 10. Source: https://api.sleeper.com/stats/nfl/player/9488?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 0.725 | 0.73 | -0.005 |
| catch rate | 0.667 | 0.717 | -0.050 |
| red zone use | 0.061 | 0.131 | -0.070 |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 9, ESPN 9.

Sleeper: https://api.sleeper.com/stats/nfl/player/9488?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4430878/statistics, read 2026-11-14.

## What it means for play calling

Smith-Njigba is a middle depth target (0.73 on deep ball). Smith-Njigba catches 0.717 of targets.
