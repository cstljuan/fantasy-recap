# Checks

Run every check that needs no network and no key, from the repository root:

```bash
node data/checks/all.js            # everything, about 25 seconds
node data/checks/all.js --quick    # without the three browser runs
```

It prints one line per check (OK, FAILED or SKIPPED with the reason) and a final OK or the number that failed, and exits with 1 when any check failed. A check whose tool is missing (python3, the deepagents package, Chrome) is SKIPPED, not FAILED. A file named `check*` or `test*` that is not in the list is printed as a NOTE so it does not get forgotten.

| Check | Command | What it proves |
|---|---|---|
| football rules on the sample game | `node tools/validate.js` | the football rules engine replays the sample game legally |
| announcer lines | `node js/announcer/check.js` | every announcer line fits, has no unknown placeholder, and the remark rules work (football, and soccer through its own check) |
| soccer announcer | `node js/announcer/soccer/check.js` | the soccer lines on their own |
| soccer rules and fantasy points | `node soccer/check.js` | the soccer sample match replays and its fantasy points add up |
| plays service | `node server/test.js` | every route of `server/` against a fake database, push of a football game and both soccer matches, top plays, drives, momentum |
| service under load | `node server/stress.js` | both sports pushed and read back, bad input on every route, 200 requests at once: no 500, crash, hang, slow answer or missing CORS header |
| plain schema | `node db/make-plain.js` | `db/schema.sql` can still be turned into plain PostgreSQL with no TimescaleDB line left (for trying the service locally, `server/SETUP.md`) |
| league file | `node data/checks/league.js` | `data/league.json` parses, team ids exist, standings follow from the finished weeks |
| league from the service | `node server/league.js` | the standings `server/league.js` works out from the finished weeks equal the ones in `data/league.json`, and the current week shows no points |
| stat line sums | `node data/checks/statlines.js` | invented stat line files add up (passing equals receiving, extra points equal touchdowns, points allowed), including matchup files like `week11-tur-owl.json` |
| rosters | `node data/checks/rosters.js` | every league team has a seven-slot football roster, no player is on two teams, every profile slot matches its roster with a source for every number, matchup stat lines use the roster's names |
| game vs lines | `node data/checks/game-vs-lines.js` | every football file in `data/games/` replayed through `js/rules.js` gives each player's catches, yards, touchdowns, passing, interceptions, fumbles, kicks by distance, extra points, both defenses' sacks and takeaways, fantasy points and the score exactly as the source lines (the sample game in `js/data.js`, the only source `engine/make-game.js` builds from) and the file's own report; tallied independently of the engine |
| scoring file | `node agents/scout/check-scoring.js` | `data/scoring.json` says the same as `js/rules.js` and the sample game's points match |
| Scout tools | `python3 agents/scout/check.py` | Scout's tools on saved samples in `agents/scout/fixtures/` |
| real week stat lines | `python3 agents/scout/check_statlines.py` | `statlines.py` writes the shape of `week11.json` from samples |
| recent form | `python3 agents/scout/check_form.py` | `form.py` picks the last three played weeks and leaves the season fields alone |
| Sleeper against ESPN | `python3 agents/scout/check_crosscheck.py` | `crosscheck.py` finds the right ESPN player, flags only real disagreements and writes null where ESPN has no number |
| Scout notes | `python3 agents/scout/check_notes.py` | `notes.py` writes one page per football player with every number's source and date, null as not known, the Sleeper and ESPN result, and exactly two rule-made sentences with no pronouns |
| soccer numbers | `python3 agents/scout/check_soccer.py` | `fill_soccer.py` computes the soccer tendencies, leaves null what ESPN does not give, and builds one real round of lines with the broken match maker rules listed |
| Scout agent graph | `python3 agents/scout/check_agent.py` | the tools are wired into the deepagents graph (stand-in model); needs `pip install -r agents/scout/requirements.txt` |
| authors | `sh tools/check-authors.sh` | every commit is authored and committed by a team account with no tool credit |
| reveal flow | `node js/screens/flow-test.js` | Peyton's test of the whole reveal flow in headless Chrome; it serves the repository itself. SKIPPED without Chrome or while the file is not on the branch |
| browser runs (3) | `sh tools/smoke.sh`, `sh tools/smoke.sh game=sample`, `sh tools/smoke.sh page=soccer/index.html` | the app, the sample game and the soccer page each play to the final in headless Chrome with no errors |

None of these touch a real database, a stats site or a paid service.
