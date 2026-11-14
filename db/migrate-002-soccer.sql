-- Migration 002: soccer matches in the plays table. Safe to run more than once.
-- Apply after db/schema.sql:  psql "$DATABASE_URL" -f db/migrate-002-soccer.sql
--
-- What soccer needs that football did not:
--   minute   the match minute of the event (0 to 90 and stoppage time). Football leaves it empty.
-- The sport itself is already in games.sport ('football' or 'soccer'), so plays join games to tell the sports
-- apart (the view plays_with_sport below). For soccer rows `quarter` holds the half (1 or 2), `slot` is a
-- soccer slot (GK, CB1, ST, ...), `kind` is the event type with 'goal' for a shot or penalty that went in and
-- 'full_time' for the clean sheet row, and `yards` is empty.

ALTER TABLE plays ADD COLUMN IF NOT EXISTS minute smallint;

ALTER TABLE plays DROP CONSTRAINT IF EXISTS plays_minute_range;
ALTER TABLE plays ADD CONSTRAINT plays_minute_range CHECK (minute IS NULL OR minute BETWEEN 0 AND 200);

CREATE OR REPLACE VIEW plays_with_sport AS
SELECT p.*, g.sport
FROM plays p
JOIN games g ON g.id = p.game_id;

-- Example: goals per team in a soccer match, which must equal the final score.
--   SELECT team, count(*) FROM plays WHERE game_id = 'week11-soccer' AND kind = 'goal' GROUP BY team;
-- Note: on a goal row `team` is the team of the biggest award (the scorer's team), so this count is right.
