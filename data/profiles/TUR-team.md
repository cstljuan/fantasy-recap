# Team profile: Turbo Turtles (TUR)

Made by Scout's tools, researched in Juan's laptop session on 2026-11-14. A fantasy roster: the seven players play for different NFL teams, so this describes how these players are used, not one real offense.

Source: Scout's research tools (agents/scout/research.py) over data/rosters/plays-2026.json: https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event}. Season weeks 1 to 10, read on 2026-11-14. Trend labels and the summary are judgment, written by hand from the per-player reports in data/profiles/notes/.

## Summary

Gibbs is the center of the offense: 22.1 carries a game, almost every goal line carry and a first down receiving role. Daniels throws short, with no deep touchdown all season, and runs in the open field. Lamb is the volume and deep target, Bowers is the third down and red zone tight end, and London gains yards deep but not in the red zone.

## How the offense moves the ball

| Player | Role | Total | A game | Yards a play |
|---|---|---|---|---|
| Jayden Daniels (QB) | throws | 227 | 32.4 | 6.6 |
| Jayden Daniels (QB) | carries | 36 | 5.1 | 7.9 |
| Jahmyr Gibbs (RB) | carries | 177 | 22.1 | 4.8 |
| Jahmyr Gibbs (RB) | targets | 45 | 5.6 | 6.1 |
| CeeDee Lamb (WR1) | targets | 108 | 12.0 | 8.4 |
| Garrett Wilson (WR2) | targets | 63 | 7.9 | 8.4 |
| Drake London (WR3) | targets | 67 | 7.4 | 10.3 |
| Brock Bowers (TE) | targets | 69 | 9.9 | 9.5 |

## Who gets the ball in the red zone

| Player | Role | Inside the 20 | Inside the 5 | Touchdowns |
|---|---|---|---|---|
| Jahmyr Gibbs (RB) | carries | 44 | 15 | 8 |
| Jayden Daniels (QB) | throws | 28 | 9 | 8 |
| CeeDee Lamb (WR1) | targets | 18 | 3 | 5 |
| Brock Bowers (TE) | targets | 11 | 2 | 5 |
| Jahmyr Gibbs (RB) | targets | 9 | 0 | 2 |
| Garrett Wilson (WR2) | targets | 6 | 2 | 1 |
| Jayden Daniels (QB) | carries | 6 | 1 | 0 |
| Drake London (WR3) | targets | 4 | 0 | 0 |

## Who gets the ball on third down

| Player | Role | Plays | First downs | Success | Touchdowns |
|---|---|---|---|---|---|
| Jayden Daniels (QB) | throws | 63 | 21 | 33 percent | 5 |
| CeeDee Lamb (WR1) | targets | 32 | 15 | 47 percent | 2 |
| Brock Bowers (TE) | targets | 26 | 16 | 62 percent | 3 |
| Drake London (WR3) | targets | 24 | 13 | 54 percent | 0 |
| Garrett Wilson (WR2) | targets | 20 | 9 | 45 percent | 0 |
| Jahmyr Gibbs (RB) | carries | 12 | 7 | 58 percent | 0 |
| Jahmyr Gibbs (RB) | targets | 11 | 3 | 27 percent | 1 |
| Jayden Daniels (QB) | carries | 6 | 4 | 67 percent | 1 |

## Hot and cold

- **Hot**: Jayden Daniels (QB): passing yards a game and yards per throw are up in the last three games, rushing is down. [report](notes/TUR-QB-report.md)
- **Hot**: CeeDee Lamb (WR1): targets, yards a game and touchdowns are up in the last three games. [report](notes/TUR-WR1-report.md)
- **Hot**: Brock Bowers (TE): success rate and yards per target are up in the last three games, with three touchdowns. [report](notes/TUR-TE-report.md)
- **Hot**: Cameron Dicker (K): made every kick in his last three weeks with a kick. [report](notes/TUR-K-report.md)
- **Cold**: Garrett Wilson (WR2): fewer yards a game and no touchdown in his last three games. [report](notes/TUR-WR2-report.md)
- **Cold**: Drake London (WR3): yards per target and yards a game are about half of what they were. [report](notes/TUR-WR3-report.md)
- **Steady**: Jahmyr Gibbs (RB): more carries and the same yards per carry, but fewer targets and touchdowns. [report](notes/TUR-RB-report.md)

Every row comes from `split` in `agents/scout/research.py`; the calls are logged in `agents/scout/runs/`.
