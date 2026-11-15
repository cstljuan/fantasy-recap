# Research run 20261115-070928

Arguments: TUR-K OWL-K --dry
Dry run: yes (everything is written inside research/runs/20261115-070928)
Second run, after the researcher definition was fixed (the first run, research/runs/20261115-062425, failed both fact checks).

## Plan
- TUR-K: note missing, no projections file, profile missing; the note is researched fresh into the run folder
- OWL-K: note exists, no projections file, profile missing; the note is researched fresh into the run folder
- research/tools/model.py: missing (not available yet)
- research/tools/write_profiles.py: present on the profiles branch, copied read-only for the write step, not committed

| UTC time | Step | Agent | Result | Files written |
|---|---|---|---|---|
| 07:09:28 | 1 set up | command | ok, players TUR-K OWL-K, dry run | research/runs/20261115-070928/log.md |
| 07:09:28 | 2 plan | command | ok, notes to research fresh: 2, model.py not available yet | research/runs/20261115-070928/log.md |
| 07:28:11 | 3 pull | research-puller | partial: pull.py and pull_wiki.py stopped at the 8 minute limit, dataset.py stopped at the missing nflverse games.csv; missing files belong to ESPN, Sleeper and nflverse (refused on this network); pull failed, continuing with the committed research/data/*.json files | none in git (research/data unchanged) |
| 07:29:41 | 4 research OWL-K | research-researcher | ok, Ka'imi Fairbairn, valid JSON, facts from the data file, league.json and stored text; self check dropped one wrong claim and marked one source conflict; not found: this week's injury report, the opponent's record and last result, quotes, wind | research/runs/20261115-070928/notes/OWL-K.json |
| 07:29:55 | 4 research TUR-K | research-researcher | ok, Cameron Dicker, valid JSON, about 8 sources; self check dropped two inferences, named the birthplace conflict, marked the engagement unconfirmed; www.covers.com and www.nfl.com unreachable; not found: quotes, wind, contract | research/runs/20261115-070928/notes/TUR-K.json |
| 07:30:14 | 5 model | research-modeler | not available yet: research/tools/model.py is not on this branch (the projections branch has not been pushed) | none |
| 07:30:42 | 6 write | research-writer | ok: write_profiles.py (read-only copy from the profiles branch) run from a temporary copy pointed at the run folder; projections missing so profiles say projection pending; scouts_read already present in both notes | research/runs/20261115-070928/players/TUR-K.md, research/runs/20261115-070928/players/OWL-K.md, research/runs/20261115-070928/teams/TUR.md, research/runs/20261115-070928/teams/OWL.md, research/runs/20261115-070928/matchups/TUR-vs-OWL.md |
