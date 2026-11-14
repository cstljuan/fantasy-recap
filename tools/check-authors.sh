#!/bin/sh
# Checks that every commit in a range was authored AND committed by one of the
# four team accounts in tools/roster.txt, and that no commit message credits a tool.
#
#   sh tools/check-authors.sh              every commit reachable from HEAD
#   sh tools/check-authors.sh A..B         only the commits in that range
#   sh tools/check-authors.sh --ident      only the identity git would use right now
#
# Exit code 0 means clean. Anything else means stop and fix before pushing.
ROOT="$(git rev-parse --show-toplevel)" || exit 2
ROSTER="$ROOT/tools/roster.txt"
BAD_WORDS='co-authored-by|generated with|claude|anthropic|codex|openai|chatgpt|copilot|\[bot\]'

in_roster() { # name, email
  grep -i -q -x -F "$1 $2" "$ROSTER"
}

if [ "$1" = "--ident" ]; then
  an="$(git config user.name)"; ae="$(git config user.email)"
  if in_roster "$an" "$ae"; then echo "OK: commits here will be authored by $an <$ae>"; exit 0; fi
  echo "NOT OK: git identity is '$an <$ae>'."
  echo "It must be exactly one row of tools/roster.txt (your own row). Fix with:"
  echo "  git config user.name \"<your GitHub username>\""
  echo "  git config user.email \"<the email on your row>\""
  exit 1
fi

RANGE="${1:-HEAD}"
fail=0
for c in $(git rev-list "$RANGE"); do
  an="$(git log -1 --format=%an "$c")"; ae="$(git log -1 --format=%ae "$c")"
  cn="$(git log -1 --format=%cn "$c")"; ce="$(git log -1 --format=%ce "$c")"
  short="$(git log -1 --format=%h "$c")"
  if ! in_roster "$an" "$ae"; then echo "BAD AUTHOR    $short  $an <$ae>"; fail=1; fi
  if ! in_roster "$cn" "$ce"; then echo "BAD COMMITTER $short  $cn <$ce>"; fail=1; fi
  if git log -1 --format=%B "$c" | grep -i -q -E "$BAD_WORDS"; then
    echo "BAD MESSAGE   $short  $(git log -1 --format=%s "$c")"; fail=1
  fi
done
if [ "$fail" = 0 ]; then echo "OK: every commit is authored and committed by a team account."; fi
exit $fail
