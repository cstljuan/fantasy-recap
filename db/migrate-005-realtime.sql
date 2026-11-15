-- Real-time continuous aggregates (found on real Tiger Data in Juan's laptop run, db/runs/laptop-2026-11-15.txt).
-- Tiger Data creates continuous aggregates with materialized_only = true, so a view stayed empty until its hourly
-- refresh and the trend route fell back to the game files. With materialized_only = false a query also reads the
-- rows not yet materialized, which is what db/README.md describes. Safe to run again.
ALTER MATERIALIZED VIEW player_points_per_game SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW team_points_per_quarter SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW player_points_per_week SET (timescaledb.materialized_only = false);
