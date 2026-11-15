-- Migration 004: what TimescaleDB adds, used by the service. Safe to run more than once.
-- Apply after db/schema.sql and the earlier migrations (sh db/migrate.sh does all of it in order).
--   fp_awards              one row per fantasy award of a play (the unrolled detail.fp of every play): who got how many
--                          points on which play. A hypertable over game time, like plays.
--   player_points_per_week continuous aggregate: points per player per 7 day bucket of game time, for
--                          GET /players/:id/trend. Weeks are Monday to Sunday, counted from 2026-11-09 (league week 11).
-- The momentum route buckets fp_awards with time_bucket at the width the caller asks for (server/timescale.js).
-- On a plain PostgreSQL, db/make-plain.js turns this file into ordinary tables and views (time_bucket becomes date_bin).

CREATE TABLE IF NOT EXISTS fp_awards (
  game_id    text NOT NULL REFERENCES games (id),
  seq        integer NOT NULL,
  n          integer NOT NULL,                 -- position inside the play's awards
  played_at  timestamptz NOT NULL,
  team       text NOT NULL,
  slot       text,
  player     text NOT NULL,
  pts        numeric(6,2) NOT NULL,
  PRIMARY KEY (game_id, seq, n, played_at)
);

SELECT create_hypertable('fp_awards', 'played_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS fp_awards_player_idx ON fp_awards (lower(player), played_at);

-- Rows saved before this migration: unroll their detail.fp once (a repeat does nothing).
INSERT INTO fp_awards (game_id, seq, n, played_at, team, slot, player, pts)
SELECT p.game_id, p.seq, f.n::int - 1, p.played_at, f.a ->> 'team', f.a ->> 'slot', f.a ->> 'name', (f.a ->> 'pts')::numeric
FROM plays p, jsonb_array_elements(CASE WHEN jsonb_typeof(p.detail -> 'fp') = 'array' THEN p.detail -> 'fp' ELSE '[]'::jsonb END)
     WITH ORDINALITY AS f(a, n)
WHERE f.a ->> 'name' IS NOT NULL AND f.a ->> 'team' IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE MATERIALIZED VIEW IF NOT EXISTS player_points_per_week
WITH (timescaledb.continuous) AS
SELECT
  lower(player) AS player_key,
  max(player)   AS player,
  team,
  slot,
  time_bucket(INTERVAL '7 days', played_at, TIMESTAMPTZ '2026-11-09 00:00:00+00') AS bucket,
  sum(pts)            AS points,
  count(*)            AS awards
FROM fp_awards
GROUP BY lower(player), team, slot, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('player_points_per_week',
  start_offset => NULL, end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);
