#!/bin/sh
# Shows the whole team's status: the boss file on main, then each person's newest
# status file, wherever it was pushed. Read docs/BOARD.md for how the board works.
#   sh tools/board.sh        last 12 lines per person
#   sh tools/board.sh 40     last 40 lines per person
cd "$(git rev-parse --show-toplevel)" || exit 1
N="${1:-12}"
git fetch -q origin --prune 2>/dev/null || echo "(could not reach GitHub: showing the last fetched state)"
echo "================ BOSS  (origin/main:board/BOSS.md) ================"
git show origin/main:board/BOSS.md 2>/dev/null || echo "(no boss file yet)"
for u in $(cut -d' ' -f1 tools/roster.txt); do
  best=""; bestt=0
  for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin | grep -v '/HEAD$'); do
    t="$(git log -1 --format=%ct "$ref" -- "board/$u.md" 2>/dev/null)"
    if [ -n "$t" ] && [ "$t" -gt "$bestt" ]; then bestt="$t"; best="$ref"; fi
  done
  echo ""
  if [ -z "$best" ]; then
    echo "================ $u: nothing posted yet ================"
  else
    echo "================ $u  (${best#refs/remotes/}) ================"
    git show "$best:board/$u.md" | tail -n "$N"
  fi
done
