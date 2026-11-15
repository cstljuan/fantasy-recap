# Handoffs for the deep player research

Juan's research run (`research/`, branch `cstljuan/research`) is split four ways so nobody runs out of usage. Juan keeps the data rebuild, the GOB and PYT notes and the final merge. Peyton, Noah and Ricky get everything else.

| Who | GitHub | Branch to push | Work | File |
|---|---|---|---|---|
| Juan | `cstljuan` | `cstljuan/research` | raw cache and `dataset.py`, the 14 GOB and PYT notes, PROGRESS.md, the merge | (this session) |
| Ricky | `Rickstar-App` | `Rickstar-App/research` | `model.py`, `projections.json`, `BACKTEST.md`, the week 10 results check, week 11 projections | `RICKY.md` |
| Peyton | `Peypey-ryd` | `Peypey-ryd/research` | the 7 TUR notes, `write_profiles.py`, the 28 player profiles, 4 team files, 2 matchup files | `PEYTON.md` |
| Noah | `nexodv` | `nexodv/research` | the 6 OWL notes, the Claude Code agent in `.claude/`, its two-player test run | `NOAH.md` |

## How each teammate starts

Open a Claude Code session in your own clone of `cstljuan/fantasy-recap` and paste:

```
Read research/handoffs/<YOUR FILE>.md on the branch cstljuan/research and do everything in it. Do the work with Sonnet subagents (Agent tool, model "sonnet"; "haiku" for purely mechanical steps), never Opus. Keep this main session light: it only hands out work, commits and pushes.
```

## Rules that apply to everyone (from `CLAUDE.md` and Juan)

1. Start from Juan's branch: `git fetch origin && git switch -c <your GitHub username>/research origin/cstljuan/research`. Run `sh tools/setup.sh`; your commits must be authored and committed by YOUR OWN row of `tools/roster.txt`. Never use another person's identity.
2. Push only to `<your GitHub username>/research`. Never push `main`, never push `cstljuan/research`, never force-push, no pull request, no board posts, no Devpost, no deploy. Juan merges your branch.
3. Write only the files listed in your handoff. Do NOT edit `research/PROGRESS.md` (Juan updates it at merge time, so there are no conflicts), and do not touch another person's files.
4. No AI names anywhere (files, commit messages, branch names), no `Co-Authored-By` or "Generated with" lines, no em dashes. After each commit run `git log -1 --format='%an <%ae> | %cn <%ce>%n%B'` and check.
5. No keys, tokens or passwords in any file. Never read or print `.env`. No API key is used by any of this work. Never sign up for anything or spend money.
6. Facts: public reporting only, every fact with its source address and date, nothing invented, nothing from memory about the 2026 season. If something cannot be found, write "not found".
7. Subagents never read a whole `research/data/*.json` file (about 150 KB each). They print only the keys they need with a short `python3 -c` snippet.
8. One small unit at a time (one player, one script, one file). Commit and push each unit as soon as it is checked, so a pause loses nothing. At most 2 subagents running at once.
9. If a usage or rate limit message appears: stop starting subagents, push what you have, wait for the reset, then continue. Never switch to a bigger model to get around it.
10. When your list is finished, push and tell Juan: what ran, what was checked, what was not, and any choices you made yourself.

## The raw cache

`research/raw/` is a cache that is not in git. Ricky and Noah need it (Peyton only needs it if a profile wants raw numbers). Build it once with a Haiku subagent:

```
python3 research/tools/pull.py
python3 research/tools/pull_wiki.py
python3 research/tools/dataset.py
```

`pull.py` takes several minutes, `pull_wiki.py` is slow on purpose.

IMPORTANT, found in Juan's cloud session on 2026-11-15: the cloud network refused these hosts (proxy 403 on connect), so `pull.py` and `pull_wiki.py` got almost nothing and `dataset.py` stopped at the missing `research/raw/nflverse/games.csv`:
`site.web.api.espn.com`, `site.api.espn.com`, `sports.core.api.espn.com`, `api.sleeper.app`, `api.sleeper.com`, `news.google.com`, `en.wikipedia.org`, `drop-api.ea.com`, `github.com` (nflverse releases, which also redirect to `objects.githubusercontent.com`).
So either run the pull on a laptop (Claude Code local session, where these hosts are reachable; the laptop session built the committed files this way), or add exactly those hosts to your cloud environment's allowed hosts first. Without the raw cache you still have the committed `research/data/*.json` files (every game of each of the 28 players with its closing line, RotoWire projections, splits) and `research/data/league.json` (`defense_2026`). Ricky: the week by week defense tables of `defense_tables` need the league-wide nflverse files, and the week 10 results check needs `pull.py --fresh`, so do those on a laptop or with the hosts allowed; if neither is possible, approximate the backtest opponent factor from `defense_2026` and say so plainly in BACKTEST.md. If `dataset.py` changes any committed `research/data/` file on your branch, do NOT commit that change (`git checkout research/data`); Juan owns those files.

## Dependencies and order

- Notes (Peyton TUR, Noah OWL) have no dependencies: start them first.
- Ricky's `projections.json` is needed by Peyton's profiles. Ricky pushes `model.py` and `projections.json` as early as possible. Peyton builds `write_profiles.py` so it runs with or without `projections.json` (it writes "projection pending" if the file is missing), then reruns it once Ricky's file exists (fetch `origin/Rickstar-App/research` and copy only `research/data/projections.json` in for the run; do not commit it on your branch).
- Noah's agent is tested on two players and must not overwrite anyone's finished files: its test run writes into `research/runs/<timestamp>/`.

## Merge (Juan's lead session)

When everyone has pushed: `git fetch origin`, then on `cstljuan/research` run `git merge --no-ff origin/Rickstar-App/research`, then `origin/Peypey-ryd/research`, then `origin/nexodv/research`. The files are disjoint, so the merges are clean. Rerun `write_profiles.py` once after the merge so every profile has the final notes and projections, update `PROGRESS.md`, push `cstljuan/research`. Merging into `main` happens only when Juan says so.
