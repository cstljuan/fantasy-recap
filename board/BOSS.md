# Boss board

Written only by the boss: Juan's lead session, account `cstljuan`. Read it with `sh tools/board.sh`.

## Task queue

Run `sh tools/next.sh` to get your next task with its full description. A row is yours when the Person column is your GitHub username and Status is exactly `open`. Do not wait to be told: finish one, post DONE, take the next.

| Id | Lane | Person | Task | Status |
|---|---|---|---|---|
| B1 | B | Peypey-ryd | Opt in and hidden scores | merged |
| B2 | B | Peypey-ryd | Speed control | merged |
| B3 | B | Peypey-ryd | Recap reveal | merged |
| B10 | B | Peypey-ryd | Hide the point floaters while opted in, and check the screens now that the game pauses when closed | open |
| B4 | B | Peypey-ryd | League home: this week's matchups and the Tuesday release | open |
| B5 | B | Peypey-ryd | "Why this play" card with probability bars | open |
| B6 | B | Peypey-ryd | My team view: `?me=<team id>` | open |
| B7 | B | Peypey-ryd | Result card to share | open |
| B8 | B | Peypey-ryd | Sport switch control: football and soccer | open |
| B9 | B | Peypey-ryd | Phone polish and keyboard use | open |
| C1 | C | nexodv | Announcer lines, two styles | merged |
| C2 | C | nexodv | Crowd and whistle | merged |
| C3 | C | nexodv | Captions: every spoken line is also available as text | open |
| C4 | C | nexodv | Pre-game intro, halftime report, full-time wrap | open |
| C5 | C | nexodv | Voice choice, pace and a queue so lines never cut each other off | open |
| C6 | C | nexodv | Tendency lines from the player profiles | open |
| C7 | C | nexodv | Kickoff and final jingles made in code | open |
| C8 | C | nexodv | Soccer lines | waiting: soccer merged |
| D1 | D | Rickstar-App | Real rosters and profile files | merged |
| D2 | D | Rickstar-App | Database schema | merged |
| D4 | D | Rickstar-App | A week of stat lines for both rosters | open |
| D5 | D | Rickstar-App | Fantasy scoring rules as data plus a small module | open |
| D6 | D | Rickstar-App | Fill the profile tendencies from real season numbers, with sources | open |
| D8 | D | Rickstar-App | Devpost text and the "what is real, what is simulated" list | open |
| D3 | D | Rickstar-App | The database service | waiting: database account |
| D7 | D | Rickstar-App | Soccer rosters and profiles | waiting: soccer merged |
| S1 | S | cstljuan | The soccer game | open |
| S2 | S | cstljuan | Fantasy soccer on top | open |
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

## Review

The boss reviews every DONE before it reaches main: the authors check, the lane check (`sh tools/boss-check.sh`), the project's own checks, and a run in a browser where it applies. Then either the task is merged, or its Status becomes `changes: <what to fix>` and `sh tools/next.sh` gives it back to its owner first.

## Merged

- B1 hidden scores and opt in, B2 speed control, B3 recap reveal (Peyton) are on main
- C1 announcer `FF_ANNOUNCER`, C2 crowd sounds (Noah) are on main; the boss still has to connect them in `index.html` and `js/main.js`
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
