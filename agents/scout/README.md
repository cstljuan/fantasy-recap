# Scout, the research agent

Scout is a research agent built with LangChain's `deepagents` package (version 0.7.38, API read from the installed package). For each of the 14 players on the two rosters in `js/data.js` it plans its own steps, calls tools to read a public stats source, works out on-field tendencies from 0 to 1, and writes the profiles. Every step goes into a log so a judge can see it plan and act.

## Status: read this first

- The tools were run live on 2026-11-14 against `api.sleeper.app` and `api.sleeper.com`: all 14 players resolved and the stat names the formulas use (`pass_att`, `rec_rz_tgt`, `rush_rz_att`, `fgm_40_49`, `fgm_50p` and the rest) exist in the responses. `api.sleeper.app/v1/state/nfl` reported season 2026, week 10.
- `python3 agents/scout/fill_profiles.py` called the same tools in a fixed order, with **no model**, and filled the real tendencies in `data/profiles/GOB.json`, `PYT.json` and `data/rosters/season-2026.json`. That is not the agent.
- **The deepagents agent (`scout.py`) has still not run for real**: this session has no model key. Its wiring passed the offline checks (`check.py`, `check_agent.py`) only. A research log from a model-driven run does not exist yet.
- ESPN's public JSON (`site.api.espn.com`) answered when tested, but nothing in Scout reads it. Sleeper is the only source in use.

## Install and run

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r agents/scout/requirements.txt
```

Set a model key in the environment only, never in a file. `GOOGLE_API_KEY` (Gemini) is used if set, otherwise `ANTHROPIC_API_KEY`. `SCOUT_MODEL` overrides the model name (defaults: `gemini-2.5-flash`, `claude-sonnet-5-5`, both unverified names). `SCOUT_SEASON` sets the season (default 2026).

```bash
python3 agents/scout/scout.py --dry-run   # builds the agent, makes no model call
python3 agents/scout/scout.py             # the real run
```

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
