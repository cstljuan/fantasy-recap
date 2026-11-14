# Contributing

Four people work in this repository: `cstljuan`, `Rickstar-App`, `nexodv`, `Peypey-ryd`.

1. **Authorship.** Every commit is authored and committed by one of those four accounts, using the email in `tools/roster.txt`. No co-author lines and no tool credits in commits, branch names or pull requests. Run `sh tools/setup.sh` once per clone to turn on the checks. Full rule: `CLAUDE.md`, section 1.
2. **Lanes.** Each person owns the files listed in `docs/LANES.md` and edits only those.
3. **Branches.** `<your GitHub username>/<topic>`. No pushes to `main`, no force-pushes. Merges keep each person's commits (no squash).
4. **Board.** `sh tools/sync.sh` before each task, `sh tools/post.sh` to post status. See `docs/BOARD.md`.
5. **Secrets.** None in the repository. Local keys go in `.env`, which git ignores.
