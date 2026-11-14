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
- The game maker (`engine/make-game.js`) builds a full legal football game from stat lines. The rules engine replays it and the result matches every player's stat line (final GOB 17, PYT 14, 84 plays). 40 of the 84 plays were chosen by Jev, an outside play caller reached over the network, which returned real probabilities.
- The soccer game (`soccer/`) plays a full match in a browser and has its own fantasy scoring. It is a separate page and is not connected to the main app.

## Simulated

- The football game itself. The game the app plays is built from invented stat lines. No play in it happened in a real game, so the score does not match any real result. The older sample game in `js/data.js` is a scripted list that someone invented.
- Every stat line in `data/statlines/week11.json`. The file says it is invented. The numbers are not those players' real numbers.
- The soccer match is scripted. Whether its teams and players are real was not checked here.
- The player profiles have no real statistics. Every tendency is `null`, because no public stats source could be reached.
- There is no live data feed. Nothing reads a real fantasy league or a real NFL game.
- The two managers and their matchup are sample data. There is one viewer and no accounts. The opt-in choice lives in the browser, not in the `optins` table. The other matchup on the League screen and its opted-in marks are fixed invented text.
- The wait is simulated: nothing is hidden for a week, scores are hidden only until the replay ends.

## Written but not proven

- The plays service (`server/`) saves and returns plays. It passes its test against a fake database, and the boss reported it worked against the real database (a save, a repeat save without duplicates, and a read). The summary read came back empty because the aggregates had not refreshed yet. The optional certificate file check was only tested with a fake file.
- The app does not use the database. Nothing in `js/` calls the service. The seed file `db/seed.sql` has not been run.
- Profiles are read by the game maker, but every tendency is `null`, so the plays are not shaped by any real player tendency yet.
- Current team and roster status of every real player was not checked.
