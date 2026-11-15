# Team profile: Pixel Pythons (PYT)

Made by Scout's tools, researched in Juan's laptop session on 2026-11-14. A fantasy roster: the seven players play for different NFL teams, so this describes how these players are used, not one real offense.

Source: Scout's research tools (agents/scout/research.py) over data/rosters/plays-2026.json: https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event}. Season weeks 1 to 10, read on 2026-11-14. Trend labels and the summary are judgment, written by hand from the per-player reports in data/profiles/notes/.

## Summary

Run first through Robinson, who carries 18.8 times a game, owns the goal line and catches passes. Jackson is efficient when he plays but has barely played since week 4, so the passing numbers are a small sample. Nabers is the deep threat, Kittle and Collins score in the red zone, and Jefferson and Nabers get the third down targets. Third down is the weak spot of this roster.

## How the offense moves the ball

| Player | Role | Total | A game | Yards a play |
|---|---|---|---|---|
| Lamar Jackson (QB) | throws | 102 | 20.4 | 9.5 |
| Lamar Jackson (QB) | carries | 16 | 4.0 | 9.2 |
| Bijan Robinson (RB) | carries | 169 | 18.8 | 5.2 |
| Bijan Robinson (RB) | targets | 40 | 4.4 | 6.0 |
| Justin Jefferson (WR1) | targets | 51 | 7.3 | 7.7 |
| Malik Nabers (WR2) | targets | 85 | 9.4 | 8.2 |
| Nico Collins (WR3) | targets | 39 | 6.5 | 9.8 |
| George Kittle (TE) | targets | 53 | 6.6 | 9.1 |

## Who gets the ball in the red zone

| Player | Role | Inside the 20 | Inside the 5 | Touchdowns |
|---|---|---|---|---|
| Bijan Robinson (RB) | carries | 29 | 8 | 4 |
| Lamar Jackson (QB) | throws | 15 | 5 | 4 |
| George Kittle (TE) | targets | 12 | 1 | 4 |
| Justin Jefferson (WR1) | targets | 7 | 1 | 3 |
| Nico Collins (WR3) | targets | 6 | 0 | 3 |
| Malik Nabers (WR2) | targets | 10 | 2 | 1 |
| Lamar Jackson (QB) | carries | 5 | 2 | 1 |
| Bijan Robinson (RB) | targets | 3 | 0 | 0 |

## Who gets the ball on third down

| Player | Role | Plays | First downs | Success | Touchdowns |
|---|---|---|---|---|---|
| Lamar Jackson (QB) | throws | 23 | 8 | 35 percent | 1 |
| Justin Jefferson (WR1) | targets | 21 | 10 | 48 percent | 2 |
| Malik Nabers (WR2) | targets | 21 | 7 | 33 percent | 0 |
| Bijan Robinson (RB) | carries | 15 | 4 | 27 percent | 0 |
| Bijan Robinson (RB) | targets | 10 | 4 | 40 percent | 1 |
| Nico Collins (WR3) | targets | 9 | 6 | 67 percent | 2 |
| George Kittle (TE) | targets | 9 | 4 | 44 percent | 0 |
| Lamar Jackson (QB) | carries | 1 | 1 | 100 percent | 0 |

## Hot and cold

- **Hot**: George Kittle (TE): targets and yards a game are up in the last three games. [report](notes/PYT-TE-report.md)
- **Cold**: Lamar Jackson (QB): has barely played since week 4: one throw in week 8 in the play-by-play. [report](notes/PYT-QB-report.md)
- **Cold**: Bijan Robinson (RB): yards per carry and rushing yards a game are down in the last three games on the same carries. [report](notes/PYT-RB-report.md)
- **Cold**: Justin Jefferson (WR1): more targets but far fewer yards per target and a lower success rate in the last three games. [report](notes/PYT-WR1-report.md)
- **Cold**: Malik Nabers (WR2): fewer targets and yards a game in the last three games, no touchdown. [report](notes/PYT-WR2-report.md)
- **Cold**: Nico Collins (WR3): targets and yards a game are about half of what they were. [report](notes/PYT-WR3-report.md)
- **Cold**: Harrison Butker (K): made a low share of his kicks in the last three weeks. [report](notes/PYT-K-report.md)

Every row comes from `split` in `agents/scout/research.py`; the calls are logged in `agents/scout/runs/`.
