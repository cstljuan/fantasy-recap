# Bijan Robinson

PYT, RB (RB). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below. On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| share of carries | 0.809 | carries divided by carries plus targets | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |
| catching passes | 0.775 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.172 | red zone carries divided by carries | https://api.sleeper.com/stats/nfl/player/9509?season_type=regular&season=2026 | 2026-11-14 |

Season 2026 numbers through game week 9.0 (9.0 games). Filled by agents/scout/fill_profiles.py, no model.

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

Robinson mostly runs (0.809 of touches are carries) and catches some passes. Robinson catches 0.775 of passes thrown to the back.
