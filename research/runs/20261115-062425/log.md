# Research run 20261115-062425

Arguments: TUR-K OWL-K --dry
Dry run: yes (everything is written inside research/runs/20261115-062425)

## Plan
- TUR-K: note missing, no projections file, profile missing; the note is researched fresh into the run folder
- OWL-K: note exists, no projections file, profile missing; the note is researched fresh into the run folder
- research/tools/model.py: missing (not available yet)
- research/tools/write_profiles.py: present (copied read-only from the profiles branch for this run, not committed)


| UTC time | Step | Agent | Result | Files written |
|---|---|---|---|---|
| 06:24:25 | 1 set up | command | ok, players TUR-K OWL-K, dry run | research/runs/20261115-062425/log.md |
| 06:24:25 | 2 plan | command | ok, notes to research fresh: 2, model.py not available yet | research/runs/20261115-062425/log.md |
| 07:05:22 | 3 pull | research-puller | partial: pull.py and pull_wiki.py timed out, dataset.py stopped at the missing nflverse games.csv; refused: site.web.api.espn.com, site.api.espn.com, sports.core.api.espn.com, api.sleeper.com, api.sleeper.app, news.google.com, en.wikipedia.org, drop-api.ea.com, github.com; pull failed, continuing with the committed research/data/*.json files | research/raw/ (cache, not in git; research/data unchanged) |
| 07:06:20 | 4 research TUR-K | research-researcher | ok, Cameron Dicker, valid JSON, about 14 sources (search summaries, no page fetches), not found: this week's quotes, week 10 practice report, wind | research/runs/20261115-062425/notes/TUR-K.json |
| 07:06:40 | 4 research OWL-K | research-researcher | ok, Ka'imi Fairbairn, valid JSON, about 4 sources plus the data file, sports.betmgm.com refused, not found: wind, this week's quotes, week 10 injury report | research/runs/20261115-062425/notes/OWL-K.json |
| 07:06:51 | 5 model | research-modeler | not available yet: research/tools/model.py is not on this branch (the projections branch has not been pushed) | none |
| 07:07:38 | 6 write | research-writer | ok: write_profiles.py (read-only copy from the profiles branch) run from a temporary copy pointed at the run folder; projections missing so profiles say projection pending; scouts_read already present in both notes | research/runs/20261115-062425/players/TUR-K.md, research/runs/20261115-062425/players/OWL-K.md, research/runs/20261115-062425/teams/TUR.md, research/runs/20261115-062425/teams/OWL.md, research/runs/20261115-062425/matchups/TUR-vs-OWL.md |
| 07:08:21 | 7 check TUR-K | research-checker | FAIL: one overstated stat, an unflagged birthplace conflict, an unsourced team record, an unconfirmed engagement | research/runs/20261115-062425/check-TUR-K.md |
| 07:08:43 | 7 check OWL-K | research-checker | FAIL: the Browns' last game (score and opponent) and a pass defense figure are not in any source and contradicted by search | research/runs/20261115-062425/check-OWL-K.md |

## Summary

- What ran: set up and plan (command), pull (research-puller, once), research (research-researcher, 2 players), model (research-modeler, once), write (research-writer, once), check (research-checker, 2 players). Every step ran and logged a row.
- What passed: no player. Both notes match the data file on every number checked, but both failed the fact check.
- What failed: TUR-K (one overstated stat, an unflagged birthplace conflict, an unsourced team record, an unconfirmed engagement) and OWL-K (the opponent's last game, score and a defense figure that no source shows). Cause: the researcher definition did not make the researcher verify every claim against what it actually read before writing. The definition is fixed and the run is repeated in a new run folder.
- What was not found: refused hosts (ESPN, Sleeper, Wikipedia, Google News, EA, GitHub); research/tools/model.py not available yet (projections pending); facts the notes mark "not found" (wind, this week's quotes, the week 10 injury reports).
- Where the files are: this folder only (dry run). Nothing in research/notes/, research/players/, research/teams/ or research/matchups/ was written.
- Nothing was committed or pushed by the pipeline; the person running it commits.
