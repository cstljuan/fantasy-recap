#!/bin/bash
# Runs render.mjs one at a time across agents and sessions. Same arguments as render.mjs.
# A lock older than LOCK_STALE_MIN minutes (default 60) is treated as stale. The lock does not refresh while rendering, so set this longer than your longest master.
# Keep this file in <project>/tools/. mkdir is atomic, so two agents can never both take the lock.
cd "$(dirname "$0")/.." || exit 1
mkdir -p out
L=out/.render.lock
until mkdir "$L" 2>/dev/null; do
  [ -n "$(find "$L" -maxdepth 0 -mmin +"${LOCK_STALE_MIN:-60}" 2>/dev/null)" ] && rmdir "$L"
  /bin/sleep 2
done
trap 'rmdir "$L" 2>/dev/null' EXIT
node render.mjs "$@"
