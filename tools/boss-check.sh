#!/bin/sh
# Boss only. Checks a branch before merging: authors, and that every changed file
# is inside the lane of the person who committed.   sh tools/boss-check.sh origin/<branch>
cd "$(git rev-parse --show-toplevel)" || exit 1
b="$1"; fail=0
sh tools/check-authors.sh "origin/main..$b" >/dev/null || { sh tools/check-authors.sh "origin/main..$b"; fail=1; }
for c in $(git rev-list --no-merges "origin/main..$b"); do
  who="$(git log -1 --format=%an "$c")"
  allowed="$(grep "^$who " tools/lanes.txt | cut -d' ' -f2-)"
  for f in $(git diff-tree --no-commit-id --name-only -r "$c"); do
    ok=0; for a in $allowed; do case "$f" in "$a"*) ok=1;; esac; [ "$a" = "." ] && ok=1; done
    [ "$ok" = 1 ] || { echo "OUT OF LANE  $(git log -1 --format=%h "$c")  $who  $f"; fail=1; }
  done
done
[ "$fail" = 0 ] && echo "OK to merge: $b"
exit $fail
