'use strict';
// Prints db/schema.sql rewritten for a plain PostgreSQL without the TimescaleDB extension, for trying the service
// on a local database (server/SETUP.md, "Without Tiger Data"). Not for Tiger Data: use db/schema.sql there.
//   node db/make-plain.js [migrate-004-timescale.sql] | psql "$DATABASE_URL"
// What changes: the extension, create_hypertable and the refresh policies are left out, and each continuous
// aggregate becomes an ordinary view with date_trunc in place of time_bucket. Tables, keys and checks are the same.
var fs = require('fs');
var path = require('path');
var file = process.argv[2] || 'schema.sql';
var sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
var out = sql
  .replace(/^CREATE EXTENSION IF NOT EXISTS timescaledb;\s*$/m, '-- (plain PostgreSQL: no timescaledb extension)')
  .replace(/^SELECT create_hypertable\([^;]*\);\s*$/m, '-- (plain PostgreSQL: plays is an ordinary table)')
  .replace(/SELECT add_continuous_aggregate_policy\([^;]*\);/g, '-- (plain PostgreSQL: no refresh policy)')
  .replace(/CREATE MATERIALIZED VIEW IF NOT EXISTS (\w+)\s+WITH \(timescaledb\.continuous\) AS/g, 'CREATE OR REPLACE VIEW $1 AS')
  .replace(/time_bucket\(INTERVAL '1 day', played_at\)/g, "date_trunc('day', played_at)")
  .replace(/time_bucket\(INTERVAL '7 days', played_at, (TIMESTAMPTZ '[^']*')\)/g, "date_bin(INTERVAL '7 days', played_at, $1)")
  .replace(/^ALTER MATERIALIZED VIEW \w+ SET \(timescaledb\.materialized_only = false\);\s*$/gm, '-- (plain PostgreSQL: views are always up to date)')
  .replace(/\n(\s*)WITH NO DATA;/g, ';');
// plain PostgreSQL has no create_hypertable, and a non-aggregate comment may mention the words; only code lines are checked below
['timescaledb', 'create_hypertable', 'time_bucket', 'continuous_aggregate'].forEach(function (w) {
  out.split('\n').forEach(function (line) {
    if (line.indexOf(w) >= 0 && !/^\s*--/.test(line)) { console.error('make-plain: left a TimescaleDB line: ' + line); process.exit(1); }
  });
});
process.stdout.write('-- Written by db/make-plain.js from db/schema.sql (or the file named as the argument, for example migrate-004-timescale.sql), for a plain PostgreSQL. Do not use on Tiger Data.\n' + out);
