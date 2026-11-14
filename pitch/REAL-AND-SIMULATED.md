# What is real and what is simulated

Written 2026-11-14 from the code and the DONE posts on the board. If something is not listed as real, assume it is not. Items we could not check are marked.

## Real

- The app runs in a browser with no install and no build. No frameworks.
- The football rules engine (`js/rules.js`) works out downs, distance, possession, first downs, touchdowns, turnovers on downs and score from the plays. `node tools/validate.js` checks the sample game against it.
- The pixel players and the field are drawn in code, not from image files.
- Hidden scores: when a manager opts in, points and stat lines stay masked until the final, then the recap shows the winner, top performers and scoring plays. Checked in headless Chromium at phone width. Not checked on a real phone.
- The speed control and the floating fantasy points (they can be switched off).
- The announcer writes a line for each play in two styles, and the browser's speech voice can say it. The lines were checked by a script. Nobody has checked the voice out loud in a browser.
- Crowd and whistle sounds are made in code. Nobody has checked how they sound on a real device.
- The player names on both fantasy rosters are real NFL players.
- The league scoring rules (`data/scoring.json`) are real fantasy rules, half a point per reception. `agents/scout/score.js` turns a stat line into points, and three examples were worked by hand.
- The database schema (`db/schema.sql`) was run on a real Tiger Data database by the boss: 10 statements, no failures, `plays` is a hypertable, both aggregates exist.
- The soccer game (`soccer/`) plays a full match in a browser and has its own fantasy scoring.

## Simulated

- The football game itself. The sample game is a scripted list of plays that someone invented. No play in it happened in a real game, so the score does not match any real result.
- Every stat line in `data/statlines/week11.json`. The file says it is invented. The numbers are not those players' real numbers.
- The soccer match is scripted. Whether its teams and players are real was not checked here.
- The player profiles have no real statistics. Every tendency is `null`, because no public stats source could be reached.
- There is no live data feed. Nothing reads a real fantasy league or a real NFL game.
- The two managers and their matchup are sample data.

## Written but not proven

- The plays service (`server/`) saves and returns plays. It passes its test against a fake database. It has not yet worked against the real database: the boss's run failed with a certificate error and the fix is still open (board task D3).
- Whether the app saves plays to the database during a game was not checked here. The contract says the app must work from the game file alone.
- The game maker that builds a game from stat lines and profiles is a task for the boss and was not finished when this was written. Do not describe it as working.
- Current team and roster status of every real player was not checked.
