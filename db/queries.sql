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

-- Momentum: fantasy points and real points per team per bucket of play time. $2 is the bucket in seconds.
-- Not run on any database. server/momentum.js gives the same buckets in JavaScript (and also lists empty buckets).
WITH g AS (SELECT home, away FROM games WHERE id = $1),
t0 AS (SELECT min(played_at) AS t FROM plays WHERE game_id = $1),
fp AS (
  SELECT time_bucket(make_interval(secs => $2), p.played_at, (SELECT t FROM t0)) AS bucket,
         sum(CASE WHEN f ->> 'team' = (SELECT home FROM g) THEN (f ->> 'pts')::numeric ELSE 0 END) AS fp_home,
         sum(CASE WHEN f ->> 'team' = (SELECT away FROM g) THEN (f ->> 'pts')::numeric ELSE 0 END) AS fp_away,
         max((p.detail #>> '{score_after,0}')::int) AS home_score,
         max((p.detail #>> '{score_after,1}')::int) AS away_score
  FROM plays p LEFT JOIN LATERAL jsonb_array_elements(p.detail -> 'fp') f ON true
  WHERE p.game_id = $1
  GROUP BY 1
)
SELECT extract(epoch FROM bucket - (SELECT t FROM t0))::int AS start,
       fp_home, fp_away,
       sum(fp_home) OVER (ORDER BY bucket) AS fp_home_total, sum(fp_away) OVER (ORDER BY bucket) AS fp_away_total,
       home_score AS score_home_total, away_score AS score_away_total
FROM fp ORDER BY bucket;
