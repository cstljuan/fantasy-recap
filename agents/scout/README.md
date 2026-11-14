# Scout, the research agent

Scout is a research agent built with LangChain's `deepagents` package (version 0.7.38, API read from the installed package). For each of the 14 players on the two rosters in `js/data.js` it plans its own steps, calls tools to read a public stats source, works out on-field tendencies from 0 to 1, and writes the profiles. Every step goes into a log so a judge can see it plan and act.

## Status: read this first

- The tools and the agent wiring have been checked (see Check). They were checked offline, with hand-written sample files and a scripted stand-in model.
- **Scout has not run for real yet.** This session had no model key and its network refused `api.sleeper.app` and `api.sleeper.com`. So the Sleeper address shapes and stat names in `scout_tools.py` come from memory and are unverified, and no profile has been filled by Scout. `data/profiles/GOB.json` and `PYT.json` still have null tendencies.
- Which stat names Sleeper really uses (for example `rec_rz_tgt`, `rush_rz_att`, `fgm_40_49`) must be confirmed on the first live run. Where a stat is missing, the tendency stays `null`. Nothing is estimated.

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
- `agents/scout/runs/<time>-scout.log`: one line per step, from `log_step` and from each tool call.

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
