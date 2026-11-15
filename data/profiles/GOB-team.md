# Team profile: Gridiron Goblins (GOB)

Made by Scout's tools, researched in Juan's laptop session on 2026-11-14. A fantasy roster: the seven players play for different NFL teams, so this describes how these players are used, not one real offense.

Source: Scout's research tools (agents/scout/research.py) over data/rosters/plays-2026.json: https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event}. Season weeks 1 to 10, read on 2026-11-14. Trend labels and the summary are judgment, written by hand from the per-player reports in data/profiles/notes/.

## Summary

Pass first. Allen throws 31.6 times a game to three high-volume receivers (Nacua, St. Brown and Chase) with McBride underneath, and the middle of the field is his best area. The running game with Barkley has been inefficient at 4.3 yards a carry. In the red zone the throws go to McBride and St. Brown, and Allen runs it in himself at the goal line. On third down St. Brown gets the most targets but Chase is the one who converts.

## How the offense moves the ball

| Player | Role | Total | A game | Yards a play |
|---|---|---|---|---|
| Josh Allen (QB) | throws | 253 | 31.6 | 8.0 |
| Josh Allen (QB) | carries | 50 | 6.2 | 5.9 |
| Saquon Barkley (RB) | carries | 69 | 9.9 | 4.3 |
| Saquon Barkley (RB) | targets | 11 | 1.6 | 3.7 |
| Ja'Marr Chase (WR1) | targets | 73 | 9.1 | 8.9 |
| Puka Nacua (WR2) | targets | 93 | 13.3 | 7.7 |
| Amon-Ra St. Brown (WR3) | targets | 86 | 10.8 | 7.7 |
| Trey McBride (TE) | targets | 94 | 10.4 | 6.4 |

## Who gets the ball in the red zone

| Player | Role | Inside the 20 | Inside the 5 | Touchdowns |
|---|---|---|---|---|
| Josh Allen (QB) | carries | 18 | 10 | 8 |
| Josh Allen (QB) | throws | 36 | 5 | 6 |
| Trey McBride (TE) | targets | 20 | 5 | 5 |
| Amon-Ra St. Brown (WR3) | targets | 18 | 5 | 4 |
| Ja'Marr Chase (WR1) | targets | 13 | 3 | 3 |
| Saquon Barkley (RB) | carries | 12 | 6 | 3 |
| Puka Nacua (WR2) | targets | 8 | 2 | 3 |

## Who gets the ball on third down

| Player | Role | Plays | First downs | Success | Touchdowns |
|---|---|---|---|---|---|
| Josh Allen (QB) | throws | 66 | 29 | 44 percent | 4 |
| Amon-Ra St. Brown (WR3) | targets | 27 | 12 | 44 percent | 1 |
| Puka Nacua (WR2) | targets | 24 | 6 | 25 percent | 0 |
| Trey McBride (TE) | targets | 23 | 9 | 39 percent | 0 |
| Ja'Marr Chase (WR1) | targets | 18 | 13 | 72 percent | 4 |
| Josh Allen (QB) | carries | 15 | 10 | 67 percent | 1 |
| Saquon Barkley (RB) | carries | 4 | 3 | 75 percent | 1 |
| Saquon Barkley (RB) | targets | 1 | 1 | 100 percent | 0 |

## Hot and cold

- **Hot**: Ja'Marr Chase (WR1): targets and yards a game are well up in the last three games. [report](notes/GOB-WR1-report.md)
- **Hot**: Amon-Ra St. Brown (WR3): yards per target and success rate are up in the last three games, without a touchdown. [report](notes/GOB-WR3-report.md)
- **Hot**: Trey McBride (TE): yards per target and yards a game are up in the last three games. [report](notes/GOB-TE-report.md)
- **Cold**: Josh Allen (QB): yards per throw and rushing yards a game are both down in his last three games. [report](notes/GOB-QB-report.md)
- **Cold**: Saquon Barkley (RB): yards per carry and rushing yards a game are down in the last three games, though the touchdowns came then. [report](notes/GOB-RB-report.md)
- **Steady**: Puka Nacua (WR2): same targets a game as before, with a better success rate. [report](notes/GOB-WR2-report.md)
- **Steady**: Brandon Aubrey (K): accuracy in the last three weeks is close to his season rate. [report](notes/GOB-K-report.md)

Every row comes from `split` in `agents/scout/research.py`; the calls are logged in `agents/scout/runs/`.
