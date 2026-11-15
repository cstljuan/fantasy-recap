# Scout, the research agent

Scout is a research agent built with LangChain's `deepagents` package (version 0.7.38, API read from the installed package). For each of the 14 players on the two rosters in `js/data.js` it plans its own steps, calls tools to read a public stats source, works out on-field tendencies from 0 to 1, and writes the profiles. Every step goes into a log so a judge can see it plan and act.

## Status: read this first

What ran for real and what did not (2026-11-14):

- **Ran for real, no model:** the tools against `api.sleeper.app` and ESPN's public JSON (14 and then 28 players resolved), `fill_profiles.py`, `form.py`, `plays.py` (116 games), `research.py` (reports written by fixed rules), and `python3 agents/scout/scout.py --preflight`, which reached both Sleeper and ESPN from this session.
- **Ran offline with a scripted stand-in model:** the whole team through the real deepagents graph (`check_agent_team.py`, `check_agent.py`) and the readiness and guard checks (`check_scout_ready.py`). These prove the wiring, not that a real model plans well.
- **Ran once with a real model (2026-11-15, one player, GOB.WR2):** the whole deepagents team with `gemini-3.5-flash-lite` on a Gemini key from the environment (about 2 minutes for the run that worked, log `agents/scout/runs/20261115-012822-scout.txt`; two earlier attempts on the same player failed, one after 7 minutes). It built a profile, studied the plays, and wrote a report that passed the evidence guard (3 of 3 cited plays real, then `write_report` accepted 6 claims and 18 plays); the report is saved as `agents/scout/runs/20261115-GOB-WR2-report-by-gemini-3.5-flash-lite.md`. I did **not** keep its output in `data/`: the claims are weaker than the existing report (it calls a 39 percent success rate on deep targets "strong efficiency"), and its profile step dropped the `how` text of each tendency and most raw stats. Earlier runs on `gemini-3.5-flash` hit the free-tier limit of 20 requests and stopped with the rate-limit message. Nothing else has run with a model; the other 27 players were not run.
- **What those runs found and fixed:** a tool call with bad JSON crashed the run (tool errors now go back to the model); the profile step overwrote real numbers with nulls and deleted recent form (writes now merge and a null never replaces a number); the fact-checker rejected every cited play because the model cited bare play text (bare text is now accepted when it matches exactly one real play, and a rejection says why). The model's own final summary said "reports written" in runs where none was written, so read the log, not the summary.
- **Model names:** `gemini-2.5-flash` is no longer offered to new keys, so the default is `gemini-3.5-flash`. A free key needs `SCOUT_MODEL=gemini-3.5-flash-lite`. `claude-sonnet-5-5` was never called.
- **The 28 reports in `data/profiles/notes/*-report.md`** were written with Scout's tools in a Claude Code session, not by `scout.py`; each says so on its second line.

## One command

```bash
export ANTHROPIC_API_KEY=...        # or GOOGLE_API_KEY; in your shell only, never in a file
sh agents/scout/run.sh              # makes .venv, installs requirements, checks, runs all 28 players
sh agents/scout/run.sh --players GOB.QB,GOB.WR1   # a few players first (recommended for the first run)
sh agents/scout/run.sh --preflight  # only checks that a run could start
```

Either key works: `GOOGLE_API_KEY` (Gemini, default model `gemini-3.5-flash`) or `ANTHROPIC_API_KEY` (Claude, default `claude-sonnet-5-5`). With both set, Gemini is used unless `SCOUT_PROVIDER=anthropic`. `SCOUT_MODEL` names another model. A free Gemini key allows only about 20 requests a day on `gemini-3.5-flash`, so use `SCOUT_MODEL=gemini-3.5-flash-lite` or a paid key; one player takes about 100 model calls. The Claude path has been built and tested offline only: it has never called the API.

`GOOGLE_API_KEY` (Gemini) is used if set, otherwise `ANTHROPIC_API_KEY`. `SCOUT_MODEL` overrides the model name; `SCOUT_SEASON` sets the season (default 2026). `python3 agents/scout/scout.py --dry-run` builds the agent and makes no model call.

Before any model call it checks: the packages, a model key, `data/rosters/plays-2026.json`, `node`, and that Sleeper and ESPN answer. Each problem is printed as `NOT READY: <what, and the command that fixes it>` and the exit code is 2. If the model or network fails during the run, it prints `STOPPED: <plain reason>` (key refused, model name not accepted, network failed, rate limit), writes the same line to the log and exits 3. Any other error shows its traceback.

Sources: every claim in a report must cite real plays. `write_report` refuses a claim with no evidence, and refuses any play that is not exactly one of the player's real plays from `plays-2026.json`. The written report lists each cited play with a link to its ESPN game. Tendencies in the profiles carry the Sleeper address, date and formula per number.

## What it writes

- `data/profiles/GOB.json`, `PYT.json`: the contract shape (`docs/CONTRACT.md` section 4). `tendencies` are plain numbers. `tendency_sources` has, for each number, the source address, the date and how it was computed. `source` says where the numbers came from.
- `data/rosters/season-2026.json`: the raw season numbers Scout used, with source and date.
- `agents/scout/runs/<time>-<label>.txt`: one line per step, from `log_step` and from each tool call.

A real run overwrites the player entries in the two profile files.

## Tools

`find_player(name)`, `season_stats(player_id)`, `weekly_stats(player_id)`, `compute_tendencies(position, season_stats_json)`, `write_profile(team, slot, profile)`, `log_step(text)`. They live in `scout_tools.py`, which needs no packages.

## Tendency formulas (all capped to 0 to 1, null when a needed stat is missing)

- QB: `deep_ball` is pass yards per attempt over 12. `short_pass` is completions over attempts. `scramble` is rush yards over pass plus rush yards.
- RB: `run_share` is carries over carries plus targets. `pass_catching` is catches over targets. `red_zone_use` is red zone carries over carries.
- WR and TE: `deep_ball` is yards per catch over 20. `catch_rate` is catches over targets. `red_zone_use` is red zone targets over targets.
- K: `kicker_range` is field goals made from 40 yards or more over field goals made. `accuracy` is made over attempted.

These scalings (12 and 20) are my own choices, not league facts.

## Check

```bash
python3 agents/scout/check.py          # tools only, no network, no key, no packages
python3 agents/scout/check_agent.py    # same tools through the real deepagents graph with a scripted model (needs the packages)
python3 agents/scout/check_agent_team.py   # main agent, film-room and fact-checker through the graph; a made-up play is refused
python3 agents/scout/check_scout_ready.py  # readiness errors, the three subagents' tools, the evidence guard
```

`check.py` reads the samples in `fixtures/`. They are made up (fake players, fake numbers) and follow the shape expected from Sleeper, which was not confirmed against a live response. `check_agent.py` proves the tools are callable by an agent, not that a real model plans well.

## Real week of stat lines

`statlines.py` reads one NFL week of real numbers for the 14 players from the same source and writes `data/statlines/week<NN>-real.json` in the shape of `data/statlines/week11.json`:

```bash
python3 agents/scout/statlines.py --week 11
python3 agents/scout/check_statlines.py   # offline check, no network, no key, no packages
```

- Extra top-level fields: `season`, `source`, `date`, and `unresolved` (every player it could not read, with the reason).
- A player who played but has no listing for a stat gets 0 for it. A player with no entry for that week, or a name the source does not know, gets `null` for every field and appears in `unresolved`. Nothing is guessed.
- Defense is not read: those five fields are `null`, because the roster defenses are made up and not real NFL teams. The game maker does not read stat lines from this file yet, so check that before relying on it.
- Not run against the live source yet, same reason as Scout above. The samples in `fixtures/week5/` are hand-written.

## Recent form

```bash
python3 agents/scout/form.py          # live, no model, no key
python3 agents/scout/check_form.py    # offline, fixtures in fixtures/form/
```

For each roster player it reads `weekly_stats`, takes the last league week with any stats (or `--latest`), walks back to the last three weeks the player played, adds those weeks up and computes the same tendencies with the same formulas as the season ones. It adds `players.<slot>.form` to `data/profiles/<team>.json` and changes no other field:

```
form = { tendencies: { same keys as tendencies, 0 to 1 or null },
         tendency_sources: { key: { source, date, how, weeks } },
         weeks: [weeks used, oldest first], skipped_weeks: [weeks with no stats in the span searched],
         source, date, notes }
```

A week with no stats is a bye, an injury or a game not played yet; the source does not say which, so the file does not either. Three weeks is a small sample: a kicker with three attempts can swing from 0 to 1. The summed weekly numbers are in `data/rosters/form-2026.json`, and each run's steps are in `agents/scout/runs/`.

## Sleeper against ESPN

```bash
python3 agents/scout/crosscheck.py          # live: ESPN's public JSON, Sleeper from data/rosters/season-2026.json
python3 agents/scout/check_crosscheck.py    # offline, fixtures in fixtures/espn/
```

For the 14 roster players it finds each one in ESPN's search (`site.api.espn.com/apis/common/v3/search`), reads the season totals (`sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/<id>/statistics`) and compares passing, rushing and receiving yards and touchdowns, receptions and field goals made with Sleeper's numbers. A disagreement is more than 5 units or more than 2 percent. It writes `data/rosters/crosscheck-2026.json` with both numbers, the difference, both addresses and dates, and games played on each side. A stat Sleeper leaves out is read as 0 when the player has games; a stat ESPN does not give is null and listed under `not_compared`. No profile is changed.

Live run on 2026-11-14: all 14 players found on ESPN, every compared number equal, games played equal for all 14. The only stats not compared are field goals made for the 12 players who are not kickers: ESPN has no kicking category for them, so their ESPN number is null.

## Soccer numbers

```bash
python3 agents/scout/fill_soccer.py     # live: ESPN's public soccer JSON, no model, no key
python3 agents/scout/check_soccer.py    # offline, fixtures in fixtures/soccer/
```

For the 22 players in `data/rosters/IRN.json` and `RHB.json` it finds each one in ESPN's search, reads the game log (club, league, matches) and the league season totals, and fills the tendencies in `data/profiles/IRN.json` and `RHB.json` with address, date and formula per number. Formulas: keeper `save_rate` saves over shots faced (or over saves plus goals conceded when ESPN gives no shots faced), `pen_save_rate` penalties saved over faced; defender `tackle_rate` tackles won over tackles, `goal_share` goals per appearance; midfielder `pass_share` accurate passes over passes, `shot_share` shots per appearance over 5, `assist_share` assists per appearance; forward `shot_share`, `assist_share` as for midfielders, `shot_conversion` goals over shots, `header_share` headed goals over goals. All capped to 0 to 1. `aerial_win_rate` stays null: ESPN gives all duels together, not aerial ones.

It also writes one real round of lines, `data/statlines/soccer-real-<date>.json`, in the shape of `soccer/data/week11-lines.json`: each player's line from his own league match in the last four days up to the latest match. A player with no league match in that round has an empty line. The players of one fantasy team play for different clubs, so the lines are not one match, and real keeper saves almost never equal the other fantasy team's saved shots: the file lists the match maker rules it breaks in `match_maker_rules`, and nothing was changed to make them fit.

Live run on 2026-11-14: 21 of 22 players filled. William Saliba stays null: ESPN's game log for him only has season 2020 (Arsenal U21) and the 2026 Premier League statistics address answers 404. Round 2026-11-05 to 2026-11-08; Hakimi, Kvaratskhelia, Saka, Nuno Mendes and Kounde had no league match in it. Both keeper-saves rules are broken, so `soccer/engine/make-match.js` refuses the file as it is.

## More teams

`fill_profiles.py` and `form.py` take `--roster-files data/rosters/TUR.json,data/rosters/OWL.json` to fill teams that are not in `js/data.js`. Both merge into `data/rosters/season-2026.json` and `form-2026.json`, so a run for some teams keeps the others. Live run on 2026-11-14: all 14 Turtles and Owls players resolved and filled, with form.

## Notes pages

`python3 agents/scout/notes.py` writes `data/profiles/notes/<team>-<slot>.md` for the 28 players of the four football teams: season tendencies with how, source and date; recent form next to the season; the Sleeper and ESPN result; and two sentences on what it means for play calling. The sentences come from fixed rules on the numbers (`RULES` in the script), not from a model, and each page says so. Run it again after the profiles change; do not edit the pages by hand. Offline check: `python3 agents/scout/check_notes.py`. `data/rosters/crosscheck-2026.json` now covers all 28 players (all agree).

## Real play-by-play

```bash
SCOUT_CACHE=/tmp/espn python3 agents/scout/plays.py    # live; SCOUT_CACHE keeps the game files for a second run
python3 agents/scout/check_plays.py                       # offline, fixtures in fixtures/plays/
```

For the 28 football roster players it finds each one and his NFL team on ESPN, walks every finished week of the season on ESPN's scoreboard, reads the play-by-play of every game those teams played, and keeps every snap that involves our players, parsed from the play text: kind, passer, target, depth and direction of the pass, run gap, yards, touchdown, down, distance, yards to the end zone, quarter and clock. It writes `data/rosters/plays-2026.json` with the address of every game, each game's team totals (for shares), and each player's ESPN box score line per game.

Rules it follows, each found by comparing with the official numbers: only the final ruling of a replay counts ("the play was REVERSED."); a play wiped out by a penalty ("No Play") is kept but left out of every total; an accepted defensive pass interference is not an attempt; an offensive foul beyond the line on a run stops the yards at the foul; yards after a lateral count as receiving yards for the player who took it; aborted snaps are carries; ESPN writes a longer first name part when two players share a short name ("Bi.Robinson"), and some plays with full names.

Live run on 2026-11-14 (weeks 1 to 10, 116 games, 3,177 plays): 1,080 of 1,100 game lines equal ESPN's own box score exactly, and 156 of 172 season totals equal Sleeper's (6 more within 1). Every difference is listed in the file under `reconcile_box` and `reconcile`; the ones left are single attempts or targets on plays wiped out by penalties, which the providers count differently, and a few yards on plays with fouls after the catch.

## Tendencies from real plays

`python3 agents/scout/play_tendencies.py` (no network) reads `data/rosters/plays-2026.json` and adds `play_tendencies` and `play_tendency_sources` to every football profile: for quarterbacks deep share, left, middle and right, deep completion, sack, interception and scramble rates, third down conversion and red zone touchdown rate; for receivers and tight ends target share, deep, red zone and third down target shares, catch rates short and deep, directions; for backs carry and target share, gap sides, goal line and short yardage shares, explosive and stuffed runs; for kickers make rates by distance band. Every number says how it was worked out, how many plays it rests on out of how many, and which games. Team totals come only from the games the player played. A share needs 5 plays or it stays null. It also fills `target_share` in the season `tendencies`, which season totals could not give. `notes.py` shows these in a "From the real plays" section and uses them first for the play-calling sentences. Offline check: `python3 agents/scout/check_play_tendencies.py`.

## Research and scouting reports

`agents/scout/research.py` holds Scout's research tools over the real plays: `research_plan` (the splits that matter for the position), `player_plays` (filtered plays with game, quarter, clock and text), `split` (by down, quarter, field zone, depth, direction, gap or week, with yards per play, success rate, touchdowns and first downs), `team_context`, and `write_report`, which refuses any claim without evidence. Success is the usual measure: 40 percent of the distance on first down, 60 on second, all of it on third or fourth, or a touchdown.

The agent (`scout.py`) gets these as tools and is told to research each player's plays after the profiles and to cite the plays for every claim. With no model key, `python3 agents/scout/research.py` runs the same tools in a fixed order with rules in place of judgment and writes the same reports, `data/profiles/notes/<team>-<slot>-report.md`, each saying it was made by rules: volume and the last three weeks, the side or depth or gap that works best and worst (only when they differ by 10 points of success rate on 8 plays or more), third down, inside the 20, the biggest plays, and for kickers each distance band and the misses. Every claim is numbered and points to the plays behind it, each with a link to its game. Offline check: `python3 agents/scout/check_research.py`.

## The agent team

`scout.py` builds Scout as a deepagents main agent with three subagents, each with its own tools and instructions, reached through deepagents' `task` tool:

- `stats-researcher`: one player's season profile from Sleeper (find_player, season_stats, weekly_stats, compute_tendencies, write_profile).
- `film-room`: one player's real plays (research_plan, split, player_plays, team_context). It returns structured findings (a pydantic `Findings` schema through deepagents' `response_format`): claims, each with the plays behind it.
- `fact-checker`: verifies each claim (verify_evidence, and the same split or player_plays again), drops what does not hold, and writes the report.

The main agent plans with deepagents' todo tool, runs the three for each player in turn and logs every step. `write_report` itself refuses a claim whose evidence is not one of the player's real plays (same game, clock and text), so a report cannot cite a play that never happened even if a model makes one up.

```bash
pip install -r agents/scout/requirements.txt
GOOGLE_API_KEY=... python3 agents/scout/scout.py --players GOB.WR1     # or ANTHROPIC_API_KEY; one player first
python3 agents/scout/scout.py --dry-run                                # builds the team, no model call
python3 agents/scout/check_agent_team.py                               # the whole team on a stand-in model, offline
```

Status: the team builds and runs end to end on a scripted stand-in model (`check_agent_team.py`); it has not run with a real model because this session has no model key. The 28 reports in `data/profiles/notes/` were written by `research.py` with rules and say so.
