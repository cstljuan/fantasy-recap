# Ladd McConkey

OWL, WR3 (WR). Written by `agents/scout/notes.py` on 2026-11-14 from the data files, with no model: the two sentences under "What it means" come from fixed rules on the numbers below (the real plays first). On-field numbers only.

## Season tendencies

| Tendency | Value | How | Source | Date |
|---|---|---|---|---|
| deep ball | 0.841 | receiving yards per catch divided by 20, capped at 1 | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |
| catch rate | 0.708 | catches divided by targets | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |
| red zone use | 0.083 | red zone targets divided by targets | https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026 | 2026-11-14 |
| target share | 0.128 | targets divided by the team's throws in the games played (from the real plays) | data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py) | 2026-11-14 |

Low-volume receiver whose deep targets pay off. Little red zone use and a shrinking role over his last three games with a target. Season 2026 numbers through game week 8.0 (6.0 games). Made by Scout's tools, researched in Juan's laptop session: stats step with find_player, season_stats, compute_tendencies and write_profile; film room and fact-check in data/profiles/notes/OWL-WR3-report.md.

## From the real plays

Worked out snap by snap from ESPN's play-by-play of 6 games (data/rosters/plays-2026.json (ESPN play-by-play, parsed by agents/scout/plays.py), read 2026-11-14). A number needs at least 5 plays under it.

| What | Value | Plays | How |
|---|---|---|---|
| target share | 0.128 | 24 of 188 | targets divided by the team's throws in the games played |
| deep targets | 0.292 | 7 of 24 | deep targets divided by targets with a depth |
| red zone target share | 0.087 | 2 of 23 | targets inside the 20 divided by the team's throws inside the 20 |
| third down target share | 0.164 | 10 of 61 | third down targets divided by the team's third down throws |
| short catch rate | 0.647 | 11 of 17 | short catches divided by short targets |
| deep catch rate | 0.857 | 6 of 7 | deep catches divided by deep targets |
| to the left | 0.292 | 7 of 24 | targets to the left divided by targets with a direction |
| to the middle | 0.292 | 7 of 24 | targets to the middle divided by targets with a direction |
| to the right | 0.417 | 10 of 24 | targets to the right divided by targets with a direction |

## Recent form

Weeks used: 6, 8, 9. Weeks skipped (no stats): 7, 10. Source: https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026&grouping=week, read 2026-11-14.

| Tendency | Recent | Season | Change |
|---|---|---|---|
| deep ball | 1 | 0.841 | +0.159 |
| catch rate | 0.714 | 0.708 | +0.006 |
| red zone use | not known | 0.083 | not known |

## Sleeper against ESPN

All 7 compared season totals agree (pass yards, pass td, rush yards, rush td, receptions, rec yards, rec td). Games played: Sleeper 6, ESPN 6.

Sleeper: https://api.sleeper.com/stats/nfl/player/11635?season_type=regular&season=2026, read 2026-11-14. ESPN: https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4612826/statistics, read 2026-11-14.

## What it means for play calling

McConkey gains a lot per catch (0.841 on deep ball): the downfield target. Lately McConkey's deep ball number is up: 1 in weeks 6, 8, 9 against 0.841 for the season, a small sample.
