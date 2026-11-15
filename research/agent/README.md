# The deep research agent

## What it is

A pipeline that plans, pulls data, researches each player, projects, writes the profiles and fact checks the result, mostly on its own. It is a conductor command plus five subagents. It runs inside the terminal coding agent session of whoever starts it, on that person's own plan. It needs no API key, no extra package and no paid service.

The definitions are plain Markdown files:

- `.claude/commands/research.md` (the pipeline command)
- `.claude/agents/research-puller.md`, `research-researcher.md`, `research-modeler.md`, `research-writer.md`, `research-checker.md`

## How to start it

Open the agent session at the repository root and type one line:

```
/research GOB-QB
```

More examples: `/research GOB-QB PYT-WR1` (two players), `/research all` (all 28), `/research TUR-K OWL-K --dry` (a test).

## The eight steps

1. Make `research/runs/<UTC timestamp>/` and its `log.md`.
2. Plan: for each player, what is missing (note, projection, profile).
3. Pull the public data once (`research-puller`).
4. Research each player, two at a time (`research-researcher`).
5. Run the projections once (`research-modeler`).
6. Write the profiles once (`research-writer`).
7. Fact check each player (`research-checker`).
8. Write the summary at the end of `log.md`.

## The five subagents

| Agent | Model size | What it does |
|---|---|---|
| `research-puller` | small | Runs `pull.py --fresh`, `pull_wiki.py` and `dataset.py`, reports which hosts were refused, and keeps the committed `research/data/*.json` files when the pull fails. |
| `research-researcher` | medium | Researches one player and writes one note, `research/notes/<KEY>.json`, following `research/handoffs/NOTE-TASK.md`. |
| `research-modeler` | medium | Runs `research/tools/model.py` and checks `projections.json` (28 players, injured reserve at zero, valid JSON). |
| `research-writer` | medium | Runs `research/tools/write_profiles.py` and fills any missing `scouts_read` in a note. |
| `research-checker` | medium | Fact checks one player's note and profile and writes a short pass or fail list. |

## The --dry flag

`/research <players> --dry` is the test mode. The researcher writes its notes to `research/runs/<timestamp>/notes/<KEY>.json` instead of `research/notes/`, the writer and checker work on those copies, and profiles from a dry run also go under `research/runs/<timestamp>/`. No finished file outside the run folder is overwritten.

Without `--dry`, only the notes of the players you named are replaced.

## Where the log goes

`research/runs/<UTC timestamp>/log.md`. Every step appends a row: UTC time, step, agent, result, files written. The run ends with a summary in the same file: what ran, what passed, what failed, what was not found. The fact check lists are saved next to it as `check-<KEY>.md`.

## Rules every part follows

- Writes only inside `research/`. Never overwrites another person's finished notes unless the run asked for those players, and never in a dry run.
- No keys, tokens or passwords.
- No em dashes, and no AI or model product names in any file the agents write.
- Every fact has a source address and a date; nothing is invented; "not found" when not found.
- Subagents never read a whole `research/data/*.json` file; they print only the keys they need.
- Never commits, pushes or switches branches. The person who ran it commits the results.

## Limits

- The cloud network refuses ESPN, Sleeper, Wikipedia, Google News, EA and GitHub (nflverse). In the cloud the pull gets almost nothing and the pipeline continues with the committed `research/data/*.json` files. A fresh pull needs a laptop session or those hosts allowed.
- `research/tools/model.py` comes from Ricky and `research/tools/write_profiles.py` comes from Peyton. If one is not on the branch yet, the log says "not available yet" and the pipeline continues without that step.
- Web search can be refused or thin; the notes then say "not found" and the checker reports what it could not check.
- It runs on a plan with usage limits. If a limit message appears, it stops starting subagents and writes the summary with what is done.
