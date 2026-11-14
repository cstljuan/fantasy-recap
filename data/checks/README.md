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
| league file | `node data/checks/league.js` | `data/league.json` parses, team ids exist, standings follow from the finished weeks |
| stat line sums | `node data/checks/statlines.js` | invented stat line files add up (passing equals receiving, extra points equal touchdowns, points allowed) |
| scoring file | `node agents/scout/check-scoring.js` | `data/scoring.json` says the same as `js/rules.js` and the sample game's points match |
| Scout tools | `python3 agents/scout/check.py` | Scout's tools on saved samples in `agents/scout/fixtures/` |
| real week stat lines | `python3 agents/scout/check_statlines.py` | `statlines.py` writes the shape of `week11.json` from samples |
| recent form | `python3 agents/scout/check_form.py` | `form.py` picks the last three played weeks and leaves the season fields alone |
| Sleeper against ESPN | `python3 agents/scout/check_crosscheck.py` | `crosscheck.py` finds the right ESPN player, flags only real disagreements and writes null where ESPN has no number |
| soccer numbers | `python3 agents/scout/check_soccer.py` | `fill_soccer.py` computes the soccer tendencies, leaves null what ESPN does not give, and builds one real round of lines with the broken match maker rules listed |
| Scout agent graph | `python3 agents/scout/check_agent.py` | the tools are wired into the deepagents graph (stand-in model); needs `pip install -r agents/scout/requirements.txt` |
| authors | `sh tools/check-authors.sh` | every commit is authored and committed by a team account with no tool credit |
| browser runs (3) | `sh tools/smoke.sh`, `sh tools/smoke.sh game=sample`, `sh tools/smoke.sh page=soccer/index.html` | the app, the sample game and the soccer page each play to the final in headless Chrome with no errors |

None of these touch a real database, a stats site or a paid service.
