#!/bin/sh
# The laptop night in one command: everything that has never run on Tiger Data, in order, with one report at the end.
#   sh db/laptop.sh            DATABASE_URL from the environment or .env at the repository root
#   sh db/laptop.sh --plain    a plain PostgreSQL without TimescaleDB (a rehearsal on any machine)
# Steps: 1 migrations and seed, 2 service install, 3 service start, 4 push every game file, 5 every read route once,
# 6 the real-database test (writes and cleans up its own dbtest- rows), 7 Scout for one player, only if a model key is set.
# Safe to run twice. Needs Node, npm, curl and psql. Never prints DATABASE_URL.
cd "$(dirname "$0")/.." || exit 1
plain=""; for a in "$@"; do case "$a" in --plain) plain="--plain" ;; *) echo "unknown option $a"; exit 2 ;; esac; done
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then set -a; . ./.env; set +a; fi
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL is not set. Put it in .env (one line, never committed) or export it."; exit 2; }
export DATABASE_URL
tmp=$(mktemp -d); report="$tmp/report"; : > "$report"; pid=""
cleanup() { [ -n "$pid" ] && kill "$pid" 2>/dev/null; rm -rf "$tmp"; }
trap cleanup EXIT INT TERM
note() { printf '%s | %s | %s\n' "$1" "$2" "$3" >> "$report"; printf '  %-8s %s: %s\n' "$2" "$1" "$3"; }
fail=0
step() { # name, command...
  name="$1"; shift
  if "$@" > "$tmp/out" 2>&1; then note "$name" OK "$(tail -1 "$tmp/out" | cut -c1-120)"; return 0
  else note "$name" FAILED "$(tail -3 "$tmp/out" | tr '\n' ' ' | cut -c1-300)"; fail=1; return 1; fi
}
echo "Fantasy Recap laptop night. $(date -u '+%Y-%m-%d %H:%M UTC')"

# 1 migrations and seed
step "1 migrations and seed" sh db/migrate.sh --seed $plain || { echo; echo "Stopped: the database is not ready. Last lines:"; tail -5 "$tmp/out"; exit 1; }

# 2 the service's one dependency
if [ -d server/node_modules/pg ]; then note "2 service install" OK "pg already installed"; else step "2 service install" sh -c 'cd server && npm install --silent' || exit 1; fi

# 3 start the service on a free port
PORT=$(node -e "var s=require('net').createServer().listen(0,function(){console.log(s.address().port);s.close()})")
PORT=$PORT node server/index.js > "$tmp/service.log" 2>&1 &
pid=$!
up=0; for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  if curl -s -m 2 "http://127.0.0.1:$PORT/health" 2>/dev/null | grep -q '"database":true'; then up=1; break; fi; sleep 1; done
if [ $up = 1 ]; then note "3 service start" OK "answering on port $PORT, database true"; else note "3 service start" FAILED "$(tail -3 "$tmp/service.log" | tr '\n' ' ' | cut -c1-300)"; echo "Stopped: the service cannot reach the database."; exit 1; fi
BASE="http://127.0.0.1:$PORT"

# 4 push every game file (football in data/games/, soccer in soccer/data/), id = file name; a repeat adds nothing
pushed=0; bad=0
for f in data/games/*.json soccer/data/week11-soccer.json soccer/data/sample-soccer.json; do
  [ -f "$f" ] || continue
  if node server/push-game.js "$f" --url "$BASE" > "$tmp/push" 2>&1; then pushed=$((pushed+1)); else bad=$((bad+1)); note "4 push $f" FAILED "$(tail -1 "$tmp/push" | cut -c1-200)"; fail=1; fi
done
[ $bad = 0 ] && note "4 push game files" OK "$pushed games pushed"

# 5 every read route once: HTTP status and the start of the answer
get() { # label path
  code=$(curl -s -m 20 -o "$tmp/body" -w '%{http_code}' "$BASE$2")
  if [ "$code" = "200" ]; then note "5 $1" OK "200 $(head -c 90 "$tmp/body" | tr '\n' ' ')"; else note "5 $1" FAILED "HTTP $code $(head -c 120 "$tmp/body")"; fail=1; fi
}
get "health" /health
get "plays" /games/week11-football/plays
get "soccer plays" /games/week11-soccer/plays
get "summary" /games/week11-football/summary
get "top plays" "/games/week11-football/top-plays?n=3"
get "drives" /games/week11-football/drives
get "momentum" "/games/week11-football/momentum?bucket=120"
get "story" /games/week11-football/story
get "optins" /games/week11-football/optins
get "trend" /players/Josh%20Allen/trend
get "scout list" /scout
get "scout report" /scout/GOB.QB
get "league" /league
get "commissioner week 9" /league/week/9/optins
get "release week 9" /league/week/9/release
code=$(curl -s -m 10 -o "$tmp/body" -w '%{http_code}' -X POST "$BASE/party" -d '{}')
if [ "$code" = "201" ]; then note "5 party" OK "201 room made"; else note "5 party" FAILED "HTTP $code"; fail=1; fi
eng=$(curl -s -m 20 "$BASE/games/week11-football/momentum?bucket=120" | sed -n 's/.*"engine":"\([a-z_]*\)".*/\1/p')
note "5 momentum engine" "$( [ "$eng" = "time_bucket" ] || [ -n "$plain" ] && echo OK || echo CHECK )" "answered by: ${eng:-unknown} (time_bucket is Tiger Data; date_bin or javascript means the TimescaleDB query did not run)"
echo "  (not called on purpose: the opt-in, watched and release writes; step 6 does them on its own rows)"

# 6 the real-database test, which writes dbtest- rows and deletes them
step "6 real-database test" node server/test-db.js

# 7 Scout, only with a model key
if [ -n "$GOOGLE_API_KEY" ] || [ -n "$ANTHROPIC_API_KEY" ]; then
  step "7 Scout, one player" sh agents/scout/run.sh --players "${SCOUT_PLAYERS:-GOB.QB}" || true
  echo "  (Scout may have changed files under data/ and agents/scout/runs/: look at git status before committing)"
else note "7 Scout" SKIPPED "no GOOGLE_API_KEY or ANTHROPIC_API_KEY in the environment"; fi

echo; echo "Report"; echo "------"
awk -F' [|] ' '{ printf "%-9s %s\n", $2, $1 }' "$report" | sort -s -k1,1 | awk '{c[$1]++} END { for (k in c) printf "%s: %d  ", k, c[k]; print "" }'
grep -F "| FAILED |" "$report" | sed 's/^/  FAILED: /'
grep -F "| CHECK |" "$report" | sed 's/^/  CHECK:  /'
grep -F "| SKIPPED |" "$report" | sed 's/^/  SKIPPED: /'
[ $fail = 0 ] && echo "No step failed." || echo "Some steps failed: copy the lines above (they hold no secrets) and send them to Ricky."
exit $fail
