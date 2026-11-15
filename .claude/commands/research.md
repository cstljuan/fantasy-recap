---
description: Deep player research pipeline. Plans, pulls, researches, projects, writes profiles and fact checks the players you name (use "all" for all 28, add --dry for a test that overwrites nothing).
argument-hint: <all | KEY ...> [--dry]   for example: GOB-QB PYT-WR1 --dry
---

You are the conductor of the deep player research pipeline. The arguments are: $ARGUMENTS

Run the eight steps below in order, yourself, calling the five subagents with the Agent tool (subagent_type is the agent name). Keep going until the summary is written. Never ask the person anything and never stop early; if a step fails, log the failure and carry on with the next step.

## Rules (they apply to you and to every subagent)

- Write only inside `research/`. Never write outside it.
- Never overwrite another person's finished file in `research/notes/` unless this run was asked for that exact player. In a `--dry` run, never overwrite any finished file anywhere: everything is written inside `research/runs/<timestamp>/`.
- No API keys. It runs on the plan of the person who starts it. Never read or print `.env`.
- No em dashes (U+2014) anywhere. No AI or model product names in any file the agents write.
- Every fact has its source address and date. Nothing invented. "not found" when not found.
- Subagents never read a whole `research/data/*.json` file. They print only the keys they need with `python3 -c`.
- Never commit, push, merge or switch branches. The person running this commits.
- At most 2 subagents running at the same time.
- If a usage or rate limit message appears: stop starting subagents, log it, finish the summary with what is done.

## Step 1: set up the run

Parse `$ARGUMENTS`. If it contains `--dry`, this is a dry run; remove the flag from the player list. If the list is `all`, the players are the 28 keys: teams GOB, PYT, TUR, OWL, each with slots QB, RB, WR1, WR2, WR3, TE, K. Otherwise the list is the keys given (check each one exists as `research/data/<KEY>.json`; log any that do not and drop them). If the list is empty, log "no players given" and stop after writing the summary.

Make the run folder with the UTC time: `TS=$(date -u +%Y%m%d-%H%M%S); mkdir -p research/runs/$TS`. In a dry run also `mkdir -p research/runs/$TS/notes research/runs/$TS/players research/runs/$TS/teams research/runs/$TS/matchups`. Create `research/runs/$TS/log.md` starting with a heading, the arguments, whether it is dry, and a table header:

`| UTC time | Step | Agent | Result | Files written |`

From now on, after EVERY step (and every subagent call), append one row to that table with `date -u +%H:%M:%S` as the time, the step name, the agent, the result in a few words (ok, failed, not available yet, not found) and the files written (or "none"). Write the row immediately, not at the end. Use a shell append (`echo "| ... |" >> research/runs/$TS/log.md`). Keep the rows free of em dashes.

## Step 2: plan

For each player, check what exists with short shell tests: note (`research/notes/<KEY>.json`), projection (`python3 -c` that checks the key in `research/data/projections.json`, or "no projections file"), profile (`research/players/<KEY>.md`). Also check whether `research/tools/model.py` and `research/tools/write_profiles.py` exist. Append a plan section to `log.md` (one line per player: what is missing) and a row to the table, agent "command".

A player asked for by name always gets researched (the note is written fresh), even if a note exists. In a normal run the note replaces `research/notes/<KEY>.json`; in a dry run it goes to `research/runs/$TS/notes/<KEY>.json`.

## Step 3: pull (once)

Call the `research-puller` agent once, asking for a fresh pull (`--fresh`). Log its result: ok, partial or failed, and the list of refused hosts. This cloud network refuses ESPN, Sleeper, Wikipedia, Google News, EA and GitHub (nflverse), so a partial or failed pull is expected there. IF THE PULL FAILS, DO NOT STOP: log "pull failed, continuing with the committed research/data/*.json files" and go on.

## Step 4: research each player

For each player, call the `research-researcher` agent with the KEY and the exact output path (normal run: `research/notes/<KEY>.json`; dry run: `research/runs/$TS/notes/<KEY>.json`). At most 2 at the same time. When each returns, verify the file exists and `python3 -m json.tool` accepts it, then log a row (result and file written). If it failed, retry once, then log the failure and continue.

## Step 5: model (once)

Call the `research-modeler` agent once. In a dry run tell it it is a dry run and the run folder, so any `projections.json` it writes is copied into `research/runs/$TS/` and the tracked original restored. If `research/tools/model.py` is missing it reports "not available yet": log that and continue.

## Step 6: write (once)

Call the `research-writer` agent once. Tell it the run folder, whether this is a dry run, and the list of keys. In a dry run the profiles it produces (and the notes it adds `scouts_read` to) are the copies under `research/runs/$TS/`. If `research/tools/write_profiles.py` is missing it reports "not available yet": log that and continue.

## Step 7: check each player

For each player, call the `research-checker` agent with the KEY, the note path (the run folder copy in a dry run) and the profile path if it exists (the run folder copy in a dry run). At most 2 at the same time. Save each returned list to `research/runs/$TS/check-<KEY>.md` and log a row (PASS or FAIL, file written).

## Step 8: summary

Append a `## Summary` section to `research/runs/$TS/log.md` with:

- What ran: each step, its agent and how many players.
- What passed: players whose check said PASS.
- What failed: players or steps that failed, with the reason in a few words.
- What was not found: refused hosts, tools "not available yet", facts reported "not found", checks reported "not checked".
- Where the files are: the run folder, and in a normal run the notes written to `research/notes/`.
- A reminder line: nothing was committed or pushed; the person running this commits.

Then check the log and every file you or the agents wrote for em dashes with `grep -c $'\xe2\x80\x94'` (must print 0 for each; fix any that do not), and run `git status --short` to confirm that in a dry run nothing outside `research/runs/` changed (if something did, restore it with `git checkout <path>` and log it). End your reply with a 5 line report: players, passed, failed, not found, log path.
