-- Example queries that are not part of the schema. $1 is the game id.
-- Not run on any database yet.

-- Drive chart (film room): one row per drive, the same numbers as server/drives.js.
-- Needs plays saved by server/push-game.js or db/seed.sql from the current make-seed, which keep the drive
-- number, the team on offense, the ball spots and the seconds in `detail`.
WITH scrim AS (
  SELECT * FROM plays WHERE game_id = $1 AND kind NOT IN ('kickoff', 'xp')
),
per_drive AS (
  SELECT
    (p.detail ->> 'drive')::int                                         AS index,
    min(p.detail ->> 'off')                                             AS team,
    min(p.quarter)                                                      AS quarter,
    (array_agg(CASE WHEN p.kind = 'kickoff' THEN p.detail #>> '{ball,post}' ELSE p.detail #>> '{ball,pre}' END
               ORDER BY p.seq))[1]::int                                 AS start_yard,
    round(sum((p.detail ->> 'secs')::numeric))::int                     AS seconds,
    max((p.detail ->> 'half')::int)                                     AS half
  FROM plays p
  WHERE p.game_id = $1
  GROUP BY 1
),
ends AS (
  SELECT
    (detail ->> 'drive')::int                                           AS index,
    count(*)                                                            AS plays,
    bool_or((detail ->> 'td')::boolean)                                 AS touchdown,
    (array_agg((detail #>> '{ball,end}')::int ORDER BY seq DESC))[1]    AS end_yard,
    (array_agg(kind ORDER BY seq DESC))[1]                              AS last_kind,
    (array_agg((detail #>> '{event,good}')::boolean ORDER BY seq DESC))[1] AS last_good,
    (array_agg((detail #>> '{ball,downs}')::boolean ORDER BY seq DESC))[1] AS last_downs
  FROM scrim
  GROUP BY 1
)
SELECT
  d.index, d.team, d.quarter,
  d.start_yard                                            AS "startYard",
  coalesce(e.end_yard, d.start_yard)                      AS "endYard",
  coalesce(e.plays, 0)                                    AS plays,
  coalesce(e.end_yard, d.start_yard) - d.start_yard       AS yards,
  d.seconds,
  CASE
    WHEN e.touchdown                                      THEN 'touchdown'
    WHEN e.last_kind = 'fg' AND e.last_good               THEN 'field goal'
    WHEN e.last_kind = 'fg'                               THEN 'missed field goal'
    WHEN e.last_kind = 'punt'                             THEN 'punt'
    WHEN e.last_kind = 'int'                              THEN 'interception'
    WHEN e.last_kind = 'fumble'                           THEN 'fumble'
    WHEN e.last_downs                                     THEN 'downs'
    WHEN lead(d.half) OVER (ORDER BY d.index) IS NULL     THEN 'end'
    WHEN lead(d.half) OVER (ORDER BY d.index) <> d.half   THEN 'half'
    ELSE 'end'
  END                                                     AS result
FROM per_drive d
LEFT JOIN ends e USING (index)
ORDER BY d.index;
