# Noah: the OWL notes and the deep agent

Read `research/handoffs/README.md` first (branch, identity, rules, raw cache). Your branch: `nexodv/research`. You write ONLY these files:

- `research/notes/OWL-RB.json`, `OWL-WR1.json`, `OWL-WR2.json`, `OWL-WR3.json`, `OWL-TE.json`, `OWL-K.json` (OWL-QB is done)
- `.claude/agents/research-*.md` (new files only)
- `.claude/commands/research.md`
- `research/agent/README.md`
- `research/runs/<timestamp>/...` (the test run's output and log)

Do NOT edit or delete `.claude/settings.json`. Do NOT touch `agents/scout/` (Ricky's Scout).

## Units 1 to 6: the six OWL notes (one Sonnet subagent per player, 2 at a time at most)

Prompt for each subagent: `KEY = OWL-RB. Read research/handoffs/NOTE-TASK.md and do exactly that task for this KEY.` (then OWL-WR1, OWL-WR2, OWL-WR3, OWL-TE, OWL-K). Pattern: `research/notes/GOB-QB.json`. After each: `python3 -m json.tool`, `grep -c "—"` must print 0, commit `research: note for <KEY>`, push.

## Unit 7: the deep agent (one Sonnet subagent writes the definitions)

Juan wants to present a real deep agent that plans, pulls, researches, projects and writes the profiles on its own. It runs as a Claude Code agent on Juan's Claude plan. NO API key, NO `deepagents` package, NO Gemini, nothing paid.

Subagent definitions in `.claude/agents/`, each a Markdown file with frontmatter (`name`, `description`, `tools`, `model: sonnet`, or `model: haiku` for the purely mechanical ones):

1. `research-puller.md` (haiku): runs `python3 research/tools/pull.py [--fresh]`, `pull_wiki.py`, `dataset.py` and reports refused sources. Tools: Bash, Read.
2. `research-researcher.md` (sonnet): writes one `research/notes/<KEY>.json` following `research/handoffs/NOTE-TASK.md`. Tools: Read, Write, Bash, WebSearch, WebFetch.
3. `research-modeler.md` (sonnet): runs `python3 research/tools/model.py` (Ricky's) and checks `projections.json` (28 players, IR at zero, valid JSON). Tools: Bash, Read.
4. `research-writer.md` (sonnet): runs `python3 research/tools/write_profiles.py` (Peyton's) and fills any missing `scouts_read` in a note. Tools: Bash, Read, Edit.
5. `research-checker.md` (sonnet): fact checks one player's note and profile: every fact has a source address and date, numbers match the data file, no em dashes, no AI names, nothing about family beyond public reporting. Writes a short pass or fail list. Tools: Read, Bash, WebSearch.

The pipeline command `.claude/commands/research.md` (started with one line: `/research all` or `/research GOB-QB PYT-WR1`):
1. Make `research/runs/<UTC timestamp>/` and a `log.md` in it. Every step appends a line: time, step, agent, result, files written.
2. Plan: list the players asked for and what is missing for each (note, projection, profile).
3. Call `research-puller` once (fresh pull).
4. For each player: `research-researcher` (at most 2 at a time).
5. `research-modeler` once.
6. `research-writer` once.
7. `research-checker` for each player.
8. Write a summary at the end of `log.md`: what ran, what passed, what failed, what was not found.

Rules for the command and every agent: write only inside `research/` (and never overwrite another person's finished notes unless the run was asked for those players); no keys; no em dashes; no AI names in files; facts with sources; never commit or push (the person running it commits).

`research/agent/README.md`: what the agent is, how to start it (`/research GOB-QB` in Claude Code at the repo root), the five subagents and what each does, where the log goes, that it runs on a Claude plan with no API key, and its limits.

## Unit 8: test it for real on two players

Run `/research TUR-K OWL-K` (or any two players) end to end in your Claude Code session. For the test, point the researcher at a copy so finished notes are not overwritten: the command writes notes into `research/runs/<timestamp>/notes/` when called with `--dry` and you run it with `--dry`. If `model.py` or `write_profiles.py` are not merged yet, fetch them read-only from `origin/Rickstar-App/research` and `origin/Peypey-ryd/research` with `git show <branch>:<path> > <path>` for the run, and do not commit them on your branch. Keep the whole `research/runs/<timestamp>/` folder, including `log.md`, as proof. If any step fails, fix the definition and rerun, and keep the last good run.

Checks: `log.md` shows every step with a result; the two players' output files exist and pass the checker; `git status` shows nothing changed outside your files. Commit and push.

## Done looks like

6 OWL notes, 5 agent definitions, the `/research` command, `research/agent/README.md` and one complete test run log pushed to `nexodv/research`, and a short report to Juan: what ran, what was checked, what failed, and the exact one line Juan types to start it.
