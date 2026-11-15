# Deep player research

Juan's order (2026-11-15): research the 28 roster players as deeply as public data allows, write a detailed profile and a next-game prediction for each, build a team profile for each of the four fantasy teams, and keep adjusting until the predictions hold up against real results.

The four fantasy teams have seven players each (QB, RB, WR1, WR2, WR3, TE, K): GOB, PYT, TUR, OWL. The two games are GOB against PYT and TUR against OWL, 14 players in each.

This folder is separate from Ricky's lane. Nothing here changes `data/`, `agents/scout/`, `db/` or `server/`. It only reads them.

## Layout

| Path | What |
|---|---|
| `tools/pull.py` | Pulls every public source into `raw/` (a cache, not committed). `--fresh` pulls the fast-moving sources again. |
| `tools/pull_wiki.py` | Wikipedia, slowly (it refuses bursts). |
| `tools/dataset.py` | Builds `data/<TEAM>-<SLOT>.json` (one per player) and `data/league.json` from `raw/`. |
| `tools/model.py` | Projections, backtest and matchup simulation. Writes `data/projections.json` and `BACKTEST.md`. |
| `data/<TEAM>-<SLOT>.json` | Everything known about one player: bio, combine, Madden ratings, contract, injury reports, career totals, every game since his rookie year with its context (opponent, home or away, roof, surface, temperature, wind, spread, total, rest), career and 2026 splits, 2026 play tendencies from the real play-by-play, next games with lines and weather, RotoWire's weekly projections, recent headlines, Wikipedia sections. |
| `data/league.json` | 2026: what each defense allows to each position (as a ratio of what those players normally do), each team's points for and against, each player's next two games. |
| `notes/<TEAM>-<SLOT>.json` | Hand research per player: family and background, recent events, interviews, team context, injury detail, each fact with its source address and date. |
| `players/<TEAM>-<SLOT>.md` | The finished player profile. |
| `teams/<TEAM>.md` | The finished team profile. |
| `matchups/` | The two games: prediction, win chance, how the game would look. |

## Sources

Sleeper (bio, weekly stats, RotoWire projections), ESPN (bio, career, game logs, splits, injuries, schedule, lines, weather), nflverse (every player-game since 2016, snap counts, advanced stats, tracking stats, injuries, combine, contracts, schedule with closing lines), Wikipedia, Google News, EA (Madden ratings). All public, no key.

Fantasy points always follow `data/scoring.json`: 1 point per 25 pass yards, 4 a pass touchdown, minus 2 an interception, 1 per 10 rush or receiving yards, 6 a rush or receiving touchdown, no point per catch, minus 2 a lost fumble, 3 a field goal (4 from 40 to 49 yards, 5 from 50), 1 an extra point.

## Rules for anyone working in this folder

- Write only inside `research/`. Read anything.
- No em dashes anywhere. Plain words.
- No keys, tokens or passwords in any file. Never read or print `.env`.
- Never name an AI tool, model or assistant in any file, commit message or branch name.
- Do not commit, push, merge, deploy or post to the board unless Juan says so.
- Every number must come from a file in `data/` or `raw/`, or from a source address written next to it. Nothing is guessed. If something could not be found, say "not found".
- People: only what reputable public sources already report (Wikipedia, team sites, major outlets). No rumors, no addresses, nothing about children beyond what the family made public.
- The NFL week now is week 10 (Sunday 2026-11-15). Washington and the Giants already played on Thursday.
