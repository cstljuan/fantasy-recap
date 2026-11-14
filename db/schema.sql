-- Fantasy Recap database: PostgreSQL with the TimescaleDB extension (Tiger Data).
-- Every play is one row over game time. Apply once with psql, see db/README.md.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS games (
  id          text PRIMARY KEY,
  sport       text NOT NULL CHECK (sport IN ('football', 'soccer')),
  home        text NOT NULL,
  away        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  final_home  integer,
  final_away  integer
);

CREATE TABLE IF NOT EXISTS optins (
  game_id      text NOT NULL REFERENCES games (id),
  manager      text NOT NULL,
  opted_in_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, manager)
);

CREATE TABLE IF NOT EXISTS plays (
  game_id         text NOT NULL REFERENCES games (id),
  seq             integer NOT NULL,            -- order of the play inside the game
  played_at       timestamptz NOT NULL,        -- when the play happened in game time
  quarter         integer NOT NULL,
  team            text NOT NULL,
  slot            text,                        -- QB, RB, WR1, WR2, WR3, TE, K
  player          text,
  kind            text NOT NULL,               -- run, pass, inc, sack, fg, ...
  yards           integer,
  fantasy_points  numeric(6,2) NOT NULL DEFAULT 0,
  detail          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- the raw event
  why             jsonb NOT NULL DEFAULT '{}'::jsonb,   -- why the play caller chose it
  -- a unique index on a hypertable must include the time column
  PRIMARY KEY (game_id, seq, played_at)
);

SELECT create_hypertable('plays', 'played_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS plays_game_seq_idx ON plays (game_id, seq);

-- Aggregate 1: fantasy points per player per game (bucketed by day, sum the buckets).
CREATE MATERIALIZED VIEW IF NOT EXISTS player_points_per_game
WITH (timescaledb.continuous) AS
SELECT
  game_id,
  team,
  slot,
  player,
  time_bucket(INTERVAL '1 day', played_at) AS bucket,
  sum(fantasy_points) AS points,
  count(*)            AS plays
FROM plays
WHERE player IS NOT NULL
GROUP BY game_id, team, slot, player, bucket
WITH NO DATA;

-- Aggregate 2: points per team per quarter.
CREATE MATERIALIZED VIEW IF NOT EXISTS team_points_per_quarter
WITH (timescaledb.continuous) AS
SELECT
  game_id,
  team,
  quarter,
  time_bucket(INTERVAL '1 day', played_at) AS bucket,
  sum(fantasy_points) AS points,
  count(*)            AS plays
FROM plays
GROUP BY game_id, team, quarter, bucket
WITH NO DATA;

-- Keep both aggregates fresh and include rows not yet materialized.
SELECT add_continuous_aggregate_policy('player_points_per_game',
  start_offset => NULL, end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);
SELECT add_continuous_aggregate_policy('team_points_per_quarter',
  start_offset => NULL, end_offset => INTERVAL '1 minute', schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

-- ---------------------------------------------------------------------------
-- Example queries (comments only, not run when the schema is applied).
-- $1 is the game id.
--
-- Recap screen, top performers (best fantasy scorers of the game):
--   SELECT player, team, slot, sum(points) AS points
--   FROM player_points_per_game
--   WHERE game_id = $1
--   GROUP BY player, team, slot
--   ORDER BY points DESC
--   LIMIT 5;
--
-- Score by quarter screen:
--   SELECT quarter, team, sum(points) AS points
--   FROM team_points_per_quarter
--   WHERE game_id = $1
--   GROUP BY quarter, team
--   ORDER BY quarter, team;
-- ---------------------------------------------------------------------------
