# Devpost text, final draft (checked against main on 2026-11-15)

Plain text for pasting. Each section is one Devpost field. Lines marked [AFTER THE LAPTOP RUN] depend on Juan running `sh db/laptop.sh` against Tiger Data: if that did not happen or failed, delete the marked sentence. Everything else was true on main when this was written.

## Name

Fantasy Recap

## Tagline

Hide your fantasy score all week, then watch your two rosters play each other in an 8-bit game and find out who won.

## The story (Inspiration and What it does)

Fantasy football managers never get to watch their own roster play together, and once you know your score there is nothing left to watch. We wanted the end of the week to feel like game day again. Two managers opt in when their matchup is set. Their scores stay hidden. At the end they watch their two rosters play each other: pixel players on a stadium field with a crowd, a play by play announcer, a halftime report that leaves out the points, speed controls. Only at the final whistle does the recap say who won, with the story of the game, the top performers and every scoring play. Soccer works the same way on its own page.

In this demo there is one viewer on one device, not two accounts, and no real week of waiting. The opt-in is kept in the browser, and also sent to our service when the page is opened with its address. The players are real NFL players and footballers. The football game the app opens on and the soccer match come from invented stat lines, so neither is a real result. Two earlier league games were built from the real plays of NFL week 9.

## How we built it

Four people, each directing AI coding agents on one part, coordinated through a written contract and a board. The app is plain browser code with no framework and no build step. A rules engine works out downs, distance and score. A game maker builds a full legal game from target stat lines, so every player ends with exactly those numbers; a separate check replays each game and compares every number. A play caller called Jev chose 40 of the 84 plays of the main game, and the rules engine refereed every play. The announcer writes its lines from templates, and every line has an ElevenLabs recording. Scout, a research agent, reads Sleeper and ESPN and produces player profiles and scouting reports. A small Node service on Tiger Data stores plays and serves the league, momentum, player trends and Scout's reports.

## Tiger Data track

The database is Tiger Data (PostgreSQL with TimescaleDB). Every play is a row stamped with the time it happened in the game, in a hypertable. Two continuous aggregates give fantasy points per player per game and per team per quarter. Three more pieces use what TimescaleDB adds over plain PostgreSQL: momentum buckets each team's fantasy points over game time with time_bucket; a hypertable of fantasy awards feeds a weekly continuous aggregate that answers GET /players/:id/trend (week over week points and a hot streak); and push-game spreads games over real weeks so the weekly buckets mean something.

What ran on Tiger Data: the first schema (hypertable and both aggregates, no failures) and saving and reading plays, once. What ran only on a plain PostgreSQL 16 with date_bin standing in for time_bucket: the other migrations, the seed, every route, and a 19 check test against a real database (`node server/test-db.js`) plus a browser test of the app against the service. In that test the database's momentum buckets equalled the JavaScript buckets exactly. [AFTER THE LAPTOP RUN] `sh db/laptop.sh` applied all migrations on Tiger Data, pushed every game and called every route, and the momentum answer said time_bucket.

## Gemini track

Scout can run on a Gemini key (GOOGLE_API_KEY) or a Claude key, whichever is set. It ran once with Gemini: one player (Puka Nacua), model gemini-3.5-flash-lite, about 11 minutes, with the main agent and all three subagents working. Its report passed the evidence check, but it was weaker than the one we kept, so we say so. The run also exposed three bugs we fixed: a tool call with bad JSON ended the run, the profile step overwrote real numbers with nulls, and the fact checker rejected plays the model cited as plain text. The free Gemini tier allowed only about 20 requests on the larger model, so the other 27 players have not run through the agent. [AFTER THE LAPTOP RUN] if a Gemini key was set, `sh db/laptop.sh` ran Scout for one more player; say which.

## LangChain deep agents track

Scout is a deepagents team: a main agent plans with a todo list and delegates through the task tool to three subagents. The stats researcher builds a profile from Sleeper season numbers. The film room studies a player's real play by play from ESPN (3,177 snaps of the 28 roster players) and returns findings as structured claims. The fact checker verifies every cited play against the plays file and writes the report; the report writer refuses any claim without evidence and any play that is not a real play of that player. Every report claim links to the ESPN game behind it. Offline tests run the whole team on a scripted stand-in model, including a made-up play being refused. The 28 scouting reports in the repository were written with Scout's tools in a Claude Code session, not by the agent, and say so on their second line.

## What is real and what is simulated

Real: the rules engine and the check that replays every game; the player names and rosters; season tendencies and recent form read live from Sleeper, cross-checked against ESPN (all agree); 3,177 real plays and the two week 9 games built from them; the Tiger Data schema; the ElevenLabs recordings (about 560 football lines and 190 soccer lines); 28 scouting reports with the plays behind every claim.
Simulated: every play of the main football game, the Turtles against Owls game and the soccer match (invented stat lines, real names); the league, standings and the second manager (sample data); the week of waiting.
Not checked: sound and speed on a real phone, the voice by ear on the demo machine, anything on Tiger Data beyond the schema and saving and reading plays (see the Tiger Data paragraph), the Claude path of Scout, and a model run for 27 of the 28 players.

## Built with

Plain JavaScript in the browser. Node and the pg driver for the service. Tiger Data (PostgreSQL with TimescaleDB). Jev (TypeSafe AI) as the football play caller. LangChain deepagents, langchain-google-genai and langchain-anthropic for Scout. Gemini. ElevenLabs for the announcer. Sleeper's and ESPN's public data. Claude Code and other AI coding agents for most of the code.

## Setup in three lines

python3 -m http.server 8000, then open http://localhost:8000 (no install, no build).
Check everything: node data/checks/all.js (add DATABASE_URL for the database and browser checks).
With a database: DATABASE_URL=<connection string> sh db/laptop.sh, then node server/index.js and open the app with ?api=http://localhost:3001.

## What is next

Run Scout across all 28 players on a stronger model. Rebuild the game from a real week with the filled profiles. Have the app read plays, momentum and trends from the service. Real leagues with two managers watching together, accounts, and testing on phones.
