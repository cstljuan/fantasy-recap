# Research run 20261115-073225

Arguments: TUR-K OWL-K --dry
Dry run: yes (everything is written inside research/runs/20261115-073225)
Third run, after the researcher definition was tightened on private family members (run 2, research/runs/20261115-070928, failed OWL-K on that one check).

## Plan
- TUR-K: note missing, no projections file, profile missing; the note is researched fresh into the run folder
- OWL-K: note exists, no projections file, profile missing; the note is researched fresh into the run folder
- research/tools/model.py: missing (not available yet)
- research/tools/write_profiles.py: present on the profiles branch, copied read-only for the write step, not committed

| UTC time | Step | Agent | Result | Files written |
|---|---|---|---|---|
| 07:32:25 | 1 set up | command | ok, players TUR-K OWL-K, dry run | research/runs/20261115-073225/log.md |
| 07:32:25 | 2 plan | command | ok, notes to research fresh: 2, model.py not available yet | research/runs/20261115-073225/log.md |
| 07:42:51 | 3 pull | research-puller | failed: pull.py and pull_wiki.py stopped at the 5 minute limit, dataset.py stopped at the missing nflverse games.csv; missing-file markers point to the ESPN hosts (refused on this network); pull failed, continuing with the committed research/data/*.json files | none in git (research/data unchanged) |
| 07:44:12 | 4 research TUR-K | research-researcher | ok, Cameron Dicker, valid JSON, about 8 sources; self check named the birthplace conflict, withheld private family names, marked headline-only items, dropped four inferences; www.covers.com and www.nfl.com unreachable | research/runs/20261115-073225/notes/TUR-K.json |
| 07:44:35 | 4 research OWL-K | research-researcher | ok, Ka'imi Fairbairn, valid JSON, about 10 sources; self check dropped one inference, marked headline-only items, recorded two source disagreements, named no spouse (none reliably reported); houstontexans.com and sharpfootballanalysis.com unreachable | research/runs/20261115-073225/notes/OWL-K.json |
| 07:44:52 | 5 model | research-modeler | not available yet: research/tools/model.py is not on this branch (the projections branch has not been pushed) | none |
| 07:45:22 | 6 write | research-writer | ok: write_profiles.py (read-only copy from the profiles branch) run from a temporary copy pointed at the run folder; projections missing so profiles say projection pending; scouts_read already present in both notes | research/runs/20261115-073225/players/TUR-K.md, research/runs/20261115-073225/players/OWL-K.md, research/runs/20261115-073225/teams/TUR.md, research/runs/20261115-073225/teams/OWL.md, research/runs/20261115-073225/matchups/TUR-vs-OWL.md |
| 07:46:02 | 7 check TUR-K | research-checker | PASS: all 10 checks | research/runs/20261115-073225/check-TUR-K.md |
| 07:46:23 | 7 check OWL-K | research-checker | PASS: all 10 checks | research/runs/20261115-073225/check-OWL-K.md |

## Summary

- What ran: set up and plan (command), pull (research-puller, once), research (research-researcher, 2 players), model (research-modeler, once), write (research-writer, once), check (research-checker, 2 players). Every step ran and logged a row.
- What passed: TUR-K (all 10 checks) and OWL-K (all 10 checks).
- What failed: the pull (this network refuses ESPN, Sleeper, Wikipedia, Google News, EA and GitHub); the run continued on the committed research/data/*.json files as designed. No player failed.
- What was not found: research/tools/model.py not available yet (the projections branch has not been pushed), so the profiles say "projection pending"; facts the notes mark "not found" (wind, quotes, this week's injury reports, the opponents' records and defenses).
- Where the files are: this folder only (dry run): notes/, players/, teams/, matchups/, check-TUR-K.md, check-OWL-K.md and this log. Nothing in research/notes/, research/players/, research/teams/ or research/matchups/ was written.
- Earlier runs, kept for the record: research/runs/20261115-062425 (both checks failed, the researcher definition was fixed) and research/runs/20261115-070928 (OWL-K failed one check, the family rule was tightened). This is the last good run.
- Nothing was committed or pushed by the pipeline; the person running it commits.
