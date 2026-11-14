#!/bin/sh
# Boss only. Waits (without using the model) until any agent posts something new, or a branch
# has commits that are not on main yet. Up to 9 minutes by default, then returns.
cd "$(git rev-parse --show-toplevel)" || exit 1
max="${1:-540}"; t=0
# A second number is the least time to wait before saying that work is waiting (light duty: one round every nine minutes).
min="${2:-0}"; [ "$min" -gt 0 ] 2>/dev/null && { sleep "$min"; }
snap() { git for-each-ref --format='%(refname) %(objectname)' refs/remotes/origin | grep -v -e '/HEAD ' -e '/main ' | sort; }
git fetch -q origin --prune 2>/dev/null; before="$(snap)"
pending() { for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v -e '^origin$' -e 'origin/main$' -e 'origin/HEAD$' -e '/boss$' ); do [ "$(git rev-list --count --no-merges "origin/main..$b")" != "0" ] && { echo yes; return; }; done; }
if [ -n "$(pending)" ]; then echo "WORK IS WAITING. Run: sh tools/boss-round.sh"; exit 0; fi
while [ "$t" -lt "$max" ]; do
  sleep 20; t=$((t+20))
  git fetch -q origin --prune 2>/dev/null || continue
  if [ "$(snap)" != "$before" ]; then echo "NEW POSTS OR COMMITS. Run: sh tools/boss-round.sh"; exit 0; fi
done
echo "Nothing new after $max seconds. Run sh tools/boss-wait.sh again."
