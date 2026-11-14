# Devpost text (draft, refreshed 2026-11-14)

Working name: Fantasy Recap. Not submitted. Check every claim against `REAL-AND-SIMULATED.md` first.

## Inspiration

Fantasy managers never get to watch their roster play together, and once you know your score there is nothing left to watch. We wanted the end of the week to feel like a game day.

## What it does

Two managers opt in when their matchup is set, scores stay hidden, and at the end they watch their two rosters play each other in an 8-bit football game and find out who won, with a recap of the top performers, the biggest plays and the scoring plays. There is a speed control, fantasy point floaters, an announcer with a halftime report that leaves out fantasy points while scores are hidden, crowd sound and jingles. A sport switch in the header opens a second game, soccer, with its own lineups, plays feed and recap.

In this demo there is one viewer, not two accounts, and no real week of waiting. The opt-in is kept in the browser, and also sent to our plays service when the page is opened with its address. Both games come from invented stat lines for real players, so neither is a real result.

## How we built it

Four people, each directing AI coding agents on one part (screens, announcer and sound, soccer, players and database), coordinated through a written contract and a board in the repository. The app is plain browser code with no frameworks and no build step. A rules engine works out downs, distance and score. A game maker builds a legal game from target stat lines, so every player ends with exactly those numbers. A play caller called Jev picked 40 of the 84 plays in the current football game, and the rules engine refereed every play. Soccer has its own match maker, run without Jev.

For storage we use Tiger Data: plays as a TimescaleDB hypertable with two continuous aggregates. A small Node service saves and returns plays, takes opt-ins, reports its health, and has a script that pushes a whole game (football or soccer). It was run once against the real database for saving and reading plays. The app reads game files, not the database.

Scout is a research agent built on LangChain's deepagents. Its tools read real 2026 season numbers from Sleeper's public API. Those tools have run live and filled the player profiles and a real week of stat lines, but the agent itself has not run with a model.

## Challenges

Keeping four agents out of each other's files. Hiding the score everywhere it could leak: floating points, the recap, stat lines, the announcer. We tested this in a headless browser, not on a real phone.

## Accomplishments

A full football game in the browser, tested at phone width, with scores hidden until the end. A game maker that reproduces every stat line exactly. Real rosters with real player names and real season tendencies with a source for every number. A schema that applied cleanly on a real database. A second sport on the same pattern.

## What we learned

Writing the interface down first saves more time than any feature. Saying what we did not check was as useful as saying what we did.

## What is next

Build a game from a real week of stat lines. Run Scout with a model key. Rebuild the game with the real tendencies (the current one was built before the profiles were filled). Record the announcer with ElevenLabs. Have the app read the database. Real leagues, accounts and phones.

## Sponsor tracks

**Typesafe (Jev, the play caller).** `engine/jev.js` asks Jev which play to run at chosen moments, and `engine/make-game.js` keeps every choice legal and on target. Real: the game the app plays, `data/games/week11-football.json`, was built with Jev, which chose 40 of its 84 plays (its `report` says so, model `jev-1.14.0`). The soccer match maker can call Jev but has only run with equal weights.

**Tiger Data.** `db/schema.sql` makes `plays` a hypertable with two continuous aggregates, and `server/` saves plays, opt-ins and whole games into it. Real: the schema ran on a real Tiger Data service with no failures, and the service saved and read plays there once. Not run there: the seed file, the opt-in and push routes, the soccer migration and the `time_bucket` queries in `db/queries.sql`. The app itself never reads the database.

**LangChain (Scout).** `agents/scout/scout.py` builds a deepagents agent with tools that find players and read season and weekly stats from Sleeper, then write profiles and a research log. Real: the tools ran live without a model (`agents/scout/fill_profiles.py` and `statlines.py`), filling `data/profiles/` and `data/statlines/week09-real.json`. Not run: the agent with a model, because no model key is in the session.

**ElevenLabs.** `js/announcer/voice/render.js` turns every line the announcer will say into an audio file with Noah's chosen voices, and `js/announcer/voice/play.js` plays a recording when there is one and the browser voice when not. Not run yet: no audio has been rendered, because it needs Noah's key, so today every line is spoken by the browser voice.
