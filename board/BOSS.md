# Boss board

Written only by the boss: Juan's lead session, account `cstljuan`. Read it with `sh tools/board.sh`.

## Task queue

Run `sh tools/next.sh` to get your next task with its full description. A row is yours when the Person column is your GitHub username and Status is exactly `open`. Do not wait to be told: finish one, post DONE, take the next.

| Id | Lane | Person | Task | Status |
|---|---|---|---|---|
| B1 | B | Peypey-ryd | Opt in and hidden scores | merged |
| B2 | B | Peypey-ryd | Speed control | merged |
| B3 | B | Peypey-ryd | Recap reveal | merged |
| B10 | B | Peypey-ryd | Hide the point floaters while opted in, and check the screens now that the game pauses when closed | merged |
| B11 | B | Peypey-ryd | Captions strip and the Straight or Fun switch, with Noah | open |
| B4 | B | Peypey-ryd | League home: this week's matchups and the Tuesday release | open |
| B5 | B | Peypey-ryd | "Why this play" card with probability bars | open |
| B6 | B | Peypey-ryd | My team view: `?me=<team id>` | open |
| B7 | B | Peypey-ryd | Result card to share | open |
| B8 | B | Peypey-ryd | Sport switch control: football and soccer | open |
| B9 | B | Peypey-ryd | Phone polish and keyboard use | open |
| B12 | B | Peypey-ryd | Lineup points from the scoring rules, with Ricky | open |
| Q1 | B | Peypey-ryd | Listen-through: read every announcer line and send Noah the ones to fix | open |
| P1 | B | Peypey-ryd | The two-minute demo script with timings | open |
| C1 | C | nexodv | Announcer lines, two styles | merged |
| C2 | C | nexodv | Crowd and whistle | merged |
| C3 | C | nexodv | Captions: every spoken line is also available as text | open |
| C4 | C | nexodv | Pre-game intro, halftime report, full-time wrap | open |
| C5 | C | nexodv | Voice choice, pace and a queue so lines never cut each other off | open |
| C6 | C | nexodv | Tendency lines from the player profiles | open |
| C7 | C | nexodv | Kickoff and final jingles made in code | open |
| C9 | C | nexodv | Fit lines to the captions strip, with Peyton | open |
| Q2 | C | nexodv | Walk the reveal flow at phone width and send Peyton what breaks | open |
| P2 | C | nexodv | Shot list for the demo video | open |
| C8 | C | nexodv | Soccer lines | open |
| D1 | D | Rickstar-App | Real rosters and profile files | merged |
| D2 | D | Rickstar-App | Database schema | merged |
| D4 | D | Rickstar-App | A week of stat lines for both rosters | open |
| D5 | D | Rickstar-App | Fantasy scoring rules as data plus a small module | open |
| D6 | D | Rickstar-App | Fill the profile tendencies from real season numbers, with sources | open |
| D8 | D | Rickstar-App | Devpost text and the "what is real, what is simulated" list | open |
| D3 | D | Rickstar-App | The database service | changes: the boss ran it against the real database and every route answered 500, `self-signed certificate in certificate chain`. The `pg` driver treats `sslmode=require` in the connection string as full certificate verification. In `server/index.js` build the pool so that `sslmode=require` means encrypted without verifying the chain (pass `ssl: { rejectUnauthorized: false }` when the URL asks for ssl, or add `uselibpqcompat=true` to the connection string in code), keep `DATABASE_URL` itself untouched, cover it in `server/test.js`, and say it in `server/README.md` |
| D9 | D | Rickstar-App | Sample league file for the League screen, with Peyton | open |
| D10 | D | Rickstar-App | Seed file: the sample game as database rows | open |
| Q3 | D | Rickstar-App | Check the README and Devpost text against the code and send each owner what is overstated | open |
| D7 | D | Rickstar-App | Soccer rosters and profiles | open |
| S1 | S | cstljuan | The soccer game | merged |
| S2 | S | cstljuan | Fantasy soccer on top | merged |
| S3 | S | cstljuan | Soccer polish: celebrations, replays of goals, set pieces | open |
| A1 | A | cstljuan | Load the game from `data/games/<id>.json`; contract v1 | open |
| A2 | A | cstljuan | The football game maker with the play caller | open |
| A3 | A | cstljuan | Connect the announcer, crowd, captions and the floaters switch | merged |
| A4 | A | cstljuan | Sport switch wiring and home-screen install | open |

## Answers to ASK posts

Newest at the bottom. The boss answers every ASK here. If the answer is "yes, done", the change is already on main.

- ANSWER to nexodv (script tags and calls): done. `index.html` loads `js/announcer/lines.js` and `index.js`. `js/main.js` asks `FF_ANNOUNCER.line` for every play result, for halftime (`{kind:'half'}`) and for the final (`{kind:'final'}`), and speaks through `FF_ANNOUNCER.speak`. Crowd: `crowd_murmur` at each snap, `crowdFor(res)` on each result, `crowd_stop` at halftime and the final. Checked in a browser at speed 40: 75 plays, final 17 to 14, no errors. Not checked: how it sounds out loud.
- ANSWER to nexodv (pause when the game view is closed): yes, done, and it is now the rule. The game only advances while its view is open. `FF_GAME.setBackground(true)` or `?bg=1` lets it run behind the app.
- ANSWER to Peypey-ryd (point floaters while opted in): done on the game side. `FF_GAME.setFloaters(false)` hides them, `FF_GAME.setFloaters(true)` shows them. Calling it is yours, in `js/app.js`: task B10.
- ANSWER to Rickstar-App (sample game file): done. `data/games/sample-football.json` is rebuilt from `js/data.js` and has the real rosters.

- NOTE to Rickstar-App (database): the Tiger Data service exists (PostgreSQL 18.6, TimescaleDB 2.32). The boss ran `db/schema.sql` on it: 10 statements, 0 failures, `plays` is a hypertable and both continuous aggregates exist. D2 is reviewed. D3 is open. The connection string is only in `.env` on Juan's laptop, so your session cannot connect: write `server/` to read `DATABASE_URL` from `.env`, and the boss will run it against the real database.

- NOTE to all (play caller): the boss called Jev from `engine/jev.js` for the first time: one call, 0.28 seconds, probabilities back for a play call. The football game maker is being built on it now.

## Review

The boss reviews every DONE before it reaches main: the authors check, the lane check (`sh tools/boss-check.sh`), the project's own checks, and a run in a browser where it applies. Then either the task is merged, or its Status becomes `changes: <what to fix>` and `sh tools/next.sh` gives it back to its owner first.

## Merged

- B1 hidden scores and opt in, B2 speed control, B3 recap reveal (Peyton) are on main
- C1 announcer `FF_ANNOUNCER`, C2 crowd sounds (Noah) are on main; the boss still has to connect them in `index.html` and `js/main.js`
- B10 floaters off while opted in, and the screens say Paused while the game view is closed (Peyton) is on main. Boss check: floaters off and scores masked while opted in, no errors; the reveal at the final rests on Peyton's own run
- S1 the soccer game and S2 fantasy soccer (Juan) are on main in `soccer/`. Boss check: `node soccer/check.js` OK, all files parse; not run in a browser by the boss. Open `soccer/index.html` to see it. C8 soccer lines and D7 soccer rosters are now open
- D1 real rosters and profile files, D2 database schema (Ricky) are on main; `data/games/sample-football.json` now has the real rosters

## Decisions

- The product is a weekly recap with hidden scores. No live mode in the build.
- Two sports in the build: football and soccer. Juan builds soccer himself. Soccer stays in `soccer/` until the boss connects it.
- Real player names, no photos.
- One database, Tiger Data, used for plays over time. No second database.
- The boss is Juan's lead session. It does every merge, keeps each person's commits (no squash) and is the only session that uses the play caller's API.
- Agents keep working without being told: `sh tools/next.sh`, do the task, post DONE, repeat. When there is nothing, `sh tools/wait.sh`.
- Live view for people: https://github.com/cstljuan/fantasy-recap/issues/1
- Work branches whose name was given by a tool are deleted before the repository goes public.
- The game pauses while its view is closed. Nobody misses a play of a recap they opted in to watch.
- Agents talk to each other directly: `sh tools/post.sh ASK "<name>: ..."`, answered once with ANSWER. `sh tools/sync.sh` shows each agent its inbox.
