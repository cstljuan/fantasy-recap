# What is real and what is simulated

Rewritten 2026-11-14 (evening) from the code on `main` and the DONE posts on the board. If something is not listed as real, assume it is not. Items we could not check are marked.

## Real

- The app runs in a browser with no install and no build. No frameworks.
- The football rules engine (`js/rules.js`) works out downs, distance, possession, first downs, touchdowns, turnovers on downs, four kinds of penalty and the score from the plays. `node tools/validate.js` checks the sample game against it.
- The pixel players and the field are drawn in code, not from image files.
- Hidden scores: when a manager opts in, points and stat lines stay masked until the final, then the recap shows the winner, top performers, the story of the game and the scoring plays. Checked in headless Chromium at phone width. Not checked on a real phone.
- The speed control and the floating fantasy points (they can be switched off).
- The announcer writes a line for each play in two styles, plus a pre-game intro, a halftime report that leaves out fantasy points while scores are hidden, a full-time wrap and big calls for the top plays. The browser's speech voice says the lines. The kickoff and final jingles play. The lines were checked by a script. Nobody has checked the voice out loud on a demo device.
- Crowd and whistle sounds are made in code, with captions on screen. Nobody has checked how they sound on a real device.
- The player names on both football rosters are real NFL players, and on both soccer rosters real footballers (21 of 22 found with the same position in ESPN's data; ESPN has no current record for William Saliba).
- The football game the app plays (`data/games/week11-football.json`) was built by the game maker (`engine/make-game.js`): a full legal game in which every player ends with exactly the target stat lines. `node data/checks/game-vs-lines.js` replays it through the rules and checks every player's catches, yards, touchdowns, passing, kicks by distance, both defenses and the fantasy points against the targets: all equal (final GOB 17, PYT 14, 84 plays). 40 of the 84 plays were chosen by Jev 1.14.0, an outside play caller reached over the network, which returned real probabilities; the others had one legal option or an even draw.
- The soccer match the app plays (`soccer/data/week11-soccer.json`) was built by the soccer match maker from the invented lines in `soccer/data/week11-lines.json`, with equal weights (Jev was not used). Soccer is reachable from the sport switch in the app.
- The league scoring rules (`data/scoring.json`) say exactly what `js/rules.js` does: no point per reception, 1 per 25 passing yards, 4 per passing touchdown, field goals by distance, defense sacks and takeaways. `node agents/scout/check-scoring.js` checks the two agree.
- Season tendencies in `data/profiles/GOB.json` and `PYT.json`: real 2026 numbers read live from Sleeper's public API, turned into 0 to 1 numbers by formulas of our own, with the address and date next to every number. Recent form (`form`, the last three weeks each player played) is real in the same way. The lineup screen shows a hot, cold or steady mark from it with the source.
- `data/rosters/crosscheck-2026.json`: Sleeper's season numbers compared with ESPN's public JSON for all 14 football players. All 14 agree on every compared stat.
- Soccer profiles (`data/profiles/IRN.json`, `RHB.json`): real 2026-27 league numbers from ESPN's public JSON for 21 of 22 players, with address, date and formula per number. Saliba stays null.
- `data/statlines/week09-real.json` (football) and `data/statlines/soccer-real-2026-11-08.json` (soccer) hold real numbers read from Sleeper and ESPN. No game or match has been built from either.
- The database schema (`db/schema.sql`) was run on a real Tiger Data database by the boss: 10 statements, no failures, `plays` is a hypertable, both aggregates exist. The plays service (`server/`) saved and read plays there once.
- The service's tests and stress test pass against a stand-in database: every route, both sports, bad input on every route, 200 requests at once (`node server/test.js`, `node server/stress.js`). `node data/checks/all.js` runs every offline check in one go.

## Simulated

- Every play of both games. The football game is built from the stat lines of the invented sample game in `js/data.js` (the game maker ran with `--from-sample`), not from a real week. The soccer match is built from invented lines. No play happened in a real game, and neither score matches a real result.
- Every stat line in `data/statlines/week11.json` and `week12.json`. The files say they are invented.
- There is no live data feed. Nothing reads a real fantasy league or a real game while the app runs. "Live" on a matchup means the replay is playing.
- The two managers, the league, its other matchup, past scores and standings are sample data (`data/league.json` says `invented: true`). There is one viewer and no accounts.
- The wait is simulated: nothing is hidden for a week, scores are hidden only until the replay ends.

## Written but not proven, or not connected

- The opt-in is kept in the browser. It is also sent to the service's `optins` table only when the page is opened with `?api=<service address>`; that was tested against a stand-in database, not the real one. The app reads no plays from the database: it plays from the game file.
- On the real database these have not run: the seed file, the opt-in, health and push routes, the soccer migration (`db/migrate-002-soccer.sql`, so the database has not seen soccer), the story, top plays, drives and momentum routes, and the `time_bucket` queries in `db/queries.sql`. The summary read came back empty on the first real run because the aggregates had not refreshed yet. The certificate file option was only tested with a fake file.
- The watch party relay (`/party` routes, a phone as the remote) exists in the service, in memory only, and passes its tests. No screen uses it yet, and it has not been tried with two real devices.
- The announcer can remark on a player's tendencies and on hot or cold form, but the game view does not pass the profiles to it, so the app never says those remarks. `pitch/BROADCAST.md` is written by a script that does pass them.
- The football game was built before the profiles were filled, so its plays were not shaped by any real player tendency. No game has been rebuilt with them, or from a real week.
- The real soccer lines cannot become a match as they are: the players come from different clubs, so real keeper saves do not equal the other team's saved shots, and the soccer match maker refuses them.
- The Scout agent (deepagents) has not run with a model: no model key. Its tools ran live, without a model, through fixed scripts (`fill_profiles.py`, `form.py`, `statlines.py`, `crosscheck.py`, `fill_soccer.py`).
- ElevenLabs: the voices are chosen and the script to render the lines exists, but nothing has been rendered (no `assets/voice/` folder), so every line is spoken by the browser's voice.
- Current team and roster status of every real player was not checked beyond what Sleeper and ESPN report.
