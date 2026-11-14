-- Migration 003: the commissioner's routes (server/commish.js). Safe to run more than once.
-- Apply after db/schema.sql:  psql "$DATABASE_URL" -f db/migrate-003-commissioner.sql
--   releases  one row per league week that the commissioner released (or took back): the app shows that week's
--             recap only when released is true
--   watched   one row per manager who reached the final of a game

CREATE TABLE IF NOT EXISTS releases (
  week         integer PRIMARY KEY CHECK (week BETWEEN 1 AND 30),
  released     boolean NOT NULL,
  changed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS watched (
  game_id      text NOT NULL REFERENCES games (id),
  manager      text NOT NULL CHECK (length(manager) BETWEEN 1 AND 100),
  watched_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (game_id, manager)
);
