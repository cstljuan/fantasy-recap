#!/bin/sh
# C28: one command that runs every check in the repository, from the repository root:
#   sh tests/run-all.sh           everything (about 4 minutes)
#   sh tests/run-all.sh --quick   without the browser runs
# It runs:
#   node data/checks/all.js        Ricky's list: rules, announcer lines, soccer, the service, league,
#                                  stat lines, rosters, game files, scoring, Scout on fixtures, commit
#                                  authors, and (without --quick) Peyton's reveal flow test and the
#                                  three full-game browser runs of tools/smoke.sh
#   node js/announcer/audit.js     every line both football games can say, and every recording
#   node js/audio-check.js         the sound of a whole football game and a whole soccer match
#   node tests/walk.js             (without --quick) football and soccer walked at 375 and 1280 wide
# Prints one line per part and a final PASS or FAIL list. Exit 1 when anything failed.
# A browser part that cannot start a browser is SKIPPED, not FAILED. Set CHROME to a browser
# binary when none is found.
cd "$(git rev-parse --show-toplevel)" || exit 1
quick=""; [ "$1" = "--quick" ] && quick="--quick"
log="${TMPDIR:-/tmp}/fr-run-all.$$"
mkdir -p "$log"
pass=""; fail=""; skip=""

part() {   # part <name> <command...>
  name="$1"; shift
  start=$(date +%s)
  "$@" > "$log/$name.txt" 2>&1
  code=$?
  secs=$(( $(date +%s) - start ))
  if [ $code -eq 0 ]; then
    echo "PASS  $name (${secs}s)"; pass="$pass $name"
  elif [ $code -eq 2 ] && grep -q "^SKIP" "$log/$name.txt"; then
    echo "SKIP  $name: $(grep -m1 '^SKIP' "$log/$name.txt")"; skip="$skip $name"
  else
    echo "FAIL  $name (${secs}s), the failing lines:"
    grep -E "FAIL|PROBLEM|^  " "$log/$name.txt" | head -15 | sed 's/^/        /'
    fail="$fail $name"
  fi
}

# tools/smoke.sh and the flow test look for Chrome; point them at Playwright's Chromium when
# nothing else is installed.
if [ -z "$CHROME" ]; then
  for c in $(ls -d /opt/pw-browsers/chromium-*/chrome-linux*/chrome "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null); do
    [ -x "$c" ] && { CHROME="$c"; export CHROME; d="$log/bin"; mkdir -p "$d"; ln -sf "$c" "$d/chromium"; PATH="$d:$PATH"; export PATH; break; }
  done
fi

part checks node data/checks/all.js $quick
part voice-audit node js/announcer/audit.js
part sound-check node js/audio-check.js
[ -z "$quick" ] && part browser-walk node tests/walk.js

echo
echo "Passed:${pass:- none}"
[ -n "$skip" ] && echo "Skipped:$skip"
if [ -n "$fail" ]; then
  echo "FAILED:$fail   (full output in $log)"
  exit 1
fi
echo "PASS: every part passed (full output in $log)"
