# Judges' questions and honest answers

Written 2026-11-14 by reading the code, and checked again against `main` on 2026-11-15. Answers 1, 3, 4, 7, 8, 9, 10 and 15 were brought up to date on the night of 2026-11-14 (Eastern) after the app switched to the real week 9 game and after the laptop runs on Tiger Data, Jev and Scout; `pitch/practice/index.html` carries the same answers. Each answer is what a person can say out loud. The line under it is where to look. If a line number has moved, search the file for the quoted words. Where something is built but not run or not connected, the answer says so.

## 1. What is real and what is made up?
The code is real and runs: the rules engine, the game view, the hidden-score reveal, the announcer, the soccer game. The player names are real. The game the app opens on is built from real plays: every catch and run our players made in NFL week 9, with their real yards and touchdowns. The filler around them (drive starts, incompletions, penalties, the clock, the order) is made up. The week 11 game is fully made up, from invented stat lines. The league, the managers and who plays whom are invented sample data.
Proof: pitch/REAL-AND-SIMULATED.md; data/games/week09-gob-tur.json ("source": "real-plays"); data/statlines/week11.json ("invented": true); data/league.json.

## 2. What does Jev decide, and what does the rules engine decide?
Jev is a decision model from TypeSafe AI. At a snap it is given the situation and a list of legal calls, and it returns a probability for each. It writes no text. The game maker then draws a call using those probabilities. The rules engine decides everything else: yards, downs, turnovers, touchdowns, scoring and whether a game is legal.
Proof: `engine/jev.js` lines 1 to 3; `engine/make-game.js` line 238 (`choose`); `js/rules.js` line 104 (`apply`).

## 3. How many plays did Jev choose?
In the week 11 game, 40 of 84. The other 44 had only one legal option or an even draw. In the Turtles against Owls game, rebuilt with Jev on the night of 2026-11-14, 97 of 184. In the real week 9 game, none: the plays really happened, so there was nothing to choose. Each game file records which plays Jev chose, with the probabilities.
Proof: data/games/week11-football.json and week11-tur-owl.json ("report": plays, playsChosenByJev, model jev-1.14.0).

## 4. Is the game a real NFL game?
No. The week 9 game uses real plays by real players, but they play for different NFL teams, so the matchup and the 27 to 30 score on the field are ours. The fantasy points are the real ones: for 19 players they are within 0.25 points of the player's real week 9 line. The week 11 game is made up from start to finish.
Proof: node data/checks/real-week.js; engine/make-game.js (--plays and --from-sample).

## 5. How do you know the game is legal and the numbers add up?
Every play goes through the rules engine, and the finished game is replayed from scratch and compared with the target stat lines. A game that does not match is thrown away. The report says it matched.
Proof: `engine/make-game.js` lines 12 and 13; `data/games/week11-football.json` (`matchesTargets: true`); `node tools/validate.js` for the sample game.

## 6. Why are the scores hidden?
That is the product idea: if you already know your score, there is nothing left to watch. When a viewer chooses "opt in", points, stat lines, leaders and floating points are masked until the final whistle. In this demo the wait is only until the replay ends, not a week, and the choice is stored in the browser.
Proof: `js/app.js` line 46 (`fr.optin`, mask text), lines 83 to 86 (`masked`, `setFloaters`), line 418 (the opt-in card).

## 7. Do two managers really opt in?
No. There is one viewer, no accounts and no second manager. The choice is saved in that browser. When the page is opened with ?api= and the service address, it is also sent to the service's opt-in table. That route passed on the real Tiger Data database on the night of 2026-11-14, on the test's own rows. The demo does not use it.
Proof: js/app.js (fr.optin, ?api=); server/index.js (/games/:id/optin); db/runs/laptop-2026-11-15-rerun.txt.

## 8. What does the database store, and does the app read it today?
Every play is a row with the time it happened in the game, its fantasy points and Jev's why. Continuous aggregates give points per player per game, per team per quarter and per player per week. It all ran on the real Tiger Data service on the night of 2026-11-14: the schema, the seed, migrations 002 to 005, all 11 game files pushed and read back, momentum bucketed in the database with time_bucket, and 19 checks passing. The app does not read plays from the database today: it plays from a game file. With ?api= it can write an opt-in, read the league and use the commissioner and watch party routes. No screen reads momentum, the weekly trend or Scout's reports yet.
Proof: db/runs/laptop-2026-11-15-rerun.txt; db/schema.sql; server/.

## 9. What went wrong or was not tried on the database?
The first real run found two bugs. The service could not find time_bucket on Tiger Data, so it quietly used plain PostgreSQL instead, and the aggregates only showed refreshed rows, so the weekly trend came back from files. Both were fixed the same night and the second run was clean. Not tried: the app reading its plays from the database, real accounts, the stress test against the real database (it runs against a stand-in), the certificate check with a real file. The summary route still came back empty for the main game and nobody has looked into it.
Proof: db/runs/laptop-2026-11-15.txt (first run); db/runs/laptop-2026-11-15-rerun.txt; db/migrate-005-realtime.sql; server/timescale.js.

## 10. What is Scout, and has it run for real?
Scout is a research agent built with LangChain's deepagents: a main agent with a stats researcher, a film room and a fact checker. The agent has run once with a model: one player (Puka Nacua) on a small Gemini model, about 2 minutes. Its report passed the evidence check but was weaker than the one we kept. The 28 scouting reports and four team profiles in the repository were written with Scout's tools by hand in a coding session, not by the agent: the numbers were pulled live from Sleeper and ESPN, and every cited play was verified against the play-by-play before a report was saved (140 claims, none dropped). Say "28 scouting reports with the plays behind every claim", not "an AI wrote them".
Proof: agents/scout/README.md "Status"; data/profiles/notes/*-report.md (second line of each); agents/scout/runs/.

## 11. Do the player profiles shape the game you watch?
Not yet. The profiles hold real numbers now, and the game maker and the announcer can read them. But the game the app plays was built before they were filled, when Jev was told "not available" for tendencies, and the game view now passes the profiles to the announcer for its tendency and hot or cold remarks, but nobody has counted how often it says them. The Lineups screen shows hot, cold or steady marks from recent form. No game has been rebuilt with the profiles.
Proof: `engine/make-game.js` line 337 onward (`player_tendencies`); `js/announcer/index.js` lines 17 to 20; `data/profiles/PYT.json`; `data/games/week11-football.json` (`report`).

## 12. How does the announcer make its lines?
From templates, not from a model. Each kind of play has several variants in one style (the Straight and Fun switch is gone). The announcer fills in names, yards and the spot from the rules engine's result and avoids repeats. It also writes a pre-game intro, a halftime report, a full-time wrap and big calls for the top plays. The lines are spoken from ElevenLabs recordings (about 740 football and 280 soccer lines); a line without a recording falls back to the browser's voice.
Proof: `js/announcer/lines.js` lines 1 to 14; `js/announcer/index.js` lines 1 to 25; `js/announcer/voices.js` line 1; `js/announcer/check.js` (script check).

## 13. What does soccer share with football?
The same pattern: a game is a list of events, a rules file works out goals and score, every result carries fantasy points, and the app, the announcer and the speed control work for both. Soccer has its own pitch, plays, players and scoring. It is shown in the app inside a frame when you switch sport. Its match was built by its own match maker from invented lines, with equal weights: Jev was not used for soccer.
Proof: `docs/CONTRACT.md` section 6 (line 55); `js/sport.js` lines 13 to 15; `soccer/js/fantasy.js`; `node soccer/check.js`.

## 14. What did each of the four people build?
Juan built soccer, and his lead session ran the project: it merged everyone's work and built the football rules engine, the game view, the game maker and the Jev link. Ricky built the players, profiles, recent form, stat lines, scoring rules, the Sleeper and ESPN cross-check, the database schema, the service (with the story data and a watch party relay), Scout, the one-command checks and the sample league. Peyton built the app screens: league, matchup, lineups, plays, recap, hidden scores, speed control and the phone polish. Noah built the announcer and the sound. All four directed AI coding agents on their own part.
Proof: `docs/LANES.md`; the DONE posts in `board/*.md`.

## 15. What is next?
Have the app read plays, momentum and trends from the database instead of a file. Run the Scout agent on all 28 players with a stronger model. Build a game with the filled profiles. Real leagues with accounts and two managers watching together. Test on real phones. None of that is done today.
Proof: agents/scout/README.md "Status"; server/README.md.

## Claims to avoid on stage

- "Real game", "real results" or "real scores" for the week 11 game: it and its stat lines are invented. For the week 9 game say "real plays", not "a real game": the matchup and the score on the field are ours.
- "Two managers" or "a week of waiting". It is one viewer and the choice sits in the browser.
- "Powered by AI" for the whole game. Jev chooses plays (40 of 84 in the week 11 game, none in the real week 9 game) and writes no text. The announcer lines are templates. Scout's agent has run once, for one player.
- "The game uses real player tendencies". The profiles have them, the game was built without them. "Scout, our AI agent, researched the players". The reports were written by hand with Scout's tools in a coding session; the agent itself ran once, for one player.
- "Live from the database". The database is real and was tested on Tiger Data (`db/runs/laptop-2026-11-15-rerun.txt`), but the app reads no plays from it; with `?api=` it writes the opt-in and the watched count and reads the league.
- "Tested on phones". Tests ran in a headless browser at phone width only.
- "Every line is ElevenLabs". Almost every line is; a line added after the last render uses the browser's voice. Nobody has listened on the demo machine.
- "The announcer knows who is hot". It can and the game view gives it the profiles, but nobody has counted how often it says so.
- Any number you did not read from a file in the last hour. If unsure, say "I would have to check".
