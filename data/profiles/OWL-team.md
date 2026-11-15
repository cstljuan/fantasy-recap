# Team profile: Midnight Owls (OWL)

Made by Scout's tools, researched in Juan's laptop session on 2026-11-14. A fantasy roster: the seven players play for different NFL teams, so this describes how these players are used, not one real offense.

Source: Scout's research tools (agents/scout/research.py) over data/rosters/plays-2026.json: https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event}. Season weeks 1 to 10, read on 2026-11-14. Trend labels and the summary are judgment, written by hand from the per-player reports in data/profiles/notes/.

## Summary

Mahomes throws short and often (34.2 throws a game), mostly to the right, and all of his touchdown passes are short. Smith-Njigba is the engine at 11.0 targets a game, Higgins is the deep and middle threat, and Henry handles first down and the goal line with almost no receiving role. In the red zone it is Henry on the ground and Smith-Njigba and Higgins through the air. On third down the ball goes to Smith-Njigba.

## How the offense moves the ball

| Player | Role | Total | A game | Yards a play |
|---|---|---|---|---|
| Patrick Mahomes (QB) | throws | 274 | 34.2 | 7.3 |
| Patrick Mahomes (QB) | carries | 17 | 2.1 | 5.5 |
| Derrick Henry (RB) | carries | 175 | 19.4 | 3.9 |
| Derrick Henry (RB) | targets | 14 | 1.8 | 5.4 |
| Tee Higgins (WR1) | targets | 67 | 8.4 | 11.3 |
| Jaxon Smith-Njigba (WR2) | targets | 99 | 11.0 | 10.5 |
| Ladd McConkey (WR3) | targets | 24 | 4.0 | 11.9 |
| Tucker Kraft (TE) | targets | 52 | 5.8 | 6.7 |

## Who gets the ball in the red zone

| Player | Role | Inside the 20 | Inside the 5 | Touchdowns |
|---|---|---|---|---|
| Patrick Mahomes (QB) | throws | 46 | 12 | 12 |
| Derrick Henry (RB) | carries | 40 | 16 | 7 |
| Jaxon Smith-Njigba (WR2) | targets | 13 | 2 | 5 |
| Tee Higgins (WR1) | targets | 7 | 1 | 5 |
| Tucker Kraft (TE) | targets | 9 | 3 | 3 |
| Patrick Mahomes (QB) | carries | 3 | 1 | 1 |
| Ladd McConkey (WR3) | targets | 2 | 0 | 1 |
| Derrick Henry (RB) | targets | 1 | 0 | 1 |

## Who gets the ball on third down

| Player | Role | Plays | First downs | Success | Touchdowns |
|---|---|---|---|---|---|
| Patrick Mahomes (QB) | throws | 71 | 25 | 35 percent | 3 |
| Jaxon Smith-Njigba (WR2) | targets | 32 | 16 | 50 percent | 5 |
| Tee Higgins (WR1) | targets | 17 | 11 | 65 percent | 0 |
| Ladd McConkey (WR3) | targets | 10 | 5 | 50 percent | 1 |
| Tucker Kraft (TE) | targets | 10 | 5 | 50 percent | 2 |
| Derrick Henry (RB) | carries | 8 | 1 | 12 percent | 0 |
| Patrick Mahomes (QB) | carries | 5 | 3 | 60 percent | 0 |
| Derrick Henry (RB) | targets | 1 | 1 | 100 percent | 0 |

## Hot and cold

- **Hot**: Tee Higgins (WR1): yards per target, success rate and touchdowns all jumped in the last three games. [report](notes/OWL-WR1-report.md)
- **Hot**: Tucker Kraft (TE): success rate and touchdowns are up in the last three games. [report](notes/OWL-TE-report.md)
- **Hot**: Ka'imi Fairbairn (K): made every kick in his last three weeks with a kick, long ones included. [report](notes/OWL-K-report.md)
- **Cold**: Patrick Mahomes (QB): yards per throw are down in the last three games on more throws. [report](notes/OWL-QB-report.md)
- **Cold**: Derrick Henry (RB): carries, yards a game and touchdowns are all down in the last three games. [report](notes/OWL-RB-report.md)
- **Cold**: Ladd McConkey (WR3): targets and yards a game are down from an already small role. [report](notes/OWL-WR3-report.md)
- **Steady**: Jaxon Smith-Njigba (WR2): same targets a game, slightly fewer yards and touchdowns. [report](notes/OWL-WR2-report.md)

Every row comes from `split` in `agents/scout/research.py`; the calls are logged in `agents/scout/runs/`.
