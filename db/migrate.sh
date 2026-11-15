#!/bin/sh
# Applies the database in order: schema.sql, then every db/migrate-NNN-*.sql by number, then (with --seed) seed.sql, which goes right after the schema so that migration 004 unrolls its awards.
# Needs only DATABASE_URL in the environment (or in .env at the repository root) and psql. Safe to run again.
#   sh db/migrate.sh            Tiger Data (PostgreSQL with TimescaleDB)
#   sh db/migrate.sh --seed     also loads the sample game (game id sample-football)
#   sh db/migrate.sh --plain    a plain PostgreSQL without TimescaleDB, for a laptop test only
cd "$(dirname "$0")/.." || exit 1
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then set -a; . ./.env; set +a; fi
[ -n "$DATABASE_URL" ] || { echo "DATABASE_URL is not set. Put it in .env or export it (never commit it)."; exit 2; }
command -v psql >/dev/null 2>&1 || { echo "psql is not installed (it comes with the PostgreSQL client tools)."; exit 2; }
plain=0; seed=0
for a in "$@"; do case "$a" in --plain) plain=1 ;; --seed) seed=1 ;; *) echo "unknown option $a"; exit 2 ;; esac; done
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -qAt -c "select 1" >/dev/null 2>&1 || { echo "Cannot connect with DATABASE_URL. Check the string, the network and that the database is up."; exit 2; }
if [ $plain = 0 ]; then
  has=$(psql "$DATABASE_URL" -qAt -c "select count(*) from pg_available_extensions where name='timescaledb'")
  [ "$has" = "1" ] || { echo "This database has no TimescaleDB extension. Tiger Data has it; on a plain PostgreSQL use: sh db/migrate.sh --plain"; exit 2; }
fi
run() { echo "applying $1"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$2" >/dev/null 2>/tmp/migrate.err || { cat /tmp/migrate.err; echo "FAILED at $1"; exit 1; }; }
if [ $plain = 1 ]; then
  node db/make-plain.js > /tmp/schema-plain.sql || exit 1
  run schema.sql-plain /tmp/schema-plain.sql
else
  run schema.sql db/schema.sql
fi
[ $seed = 1 ] && run seed.sql db/seed.sql
for f in $(ls db/migrate-*.sql | sort); do
  if [ $plain = 1 ] && grep -q "timescaledb" "$f"; then
    node db/make-plain.js "$(basename "$f")" > /tmp/migrate-plain.sql || exit 1
    run "$(basename "$f") (plain)" /tmp/migrate-plain.sql
  else
    run "$(basename "$f")" "$f"
  fi
done
echo "database ready"
