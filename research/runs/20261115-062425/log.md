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
