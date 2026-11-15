# Devpost text, final draft (checked against main on 2026-11-15)

Plain text for pasting. Each section is one Devpost field. Updated after the laptop runs (Tiger Data, Jev, Scout's research) and after the app switched to the real week nine game: every sentence that depended on those runs now says what happened. The run reports are in `db/runs/`.

## Name

Fantasy Recap

## Tagline

Hide your fantasy score all week, then watch your two rosters play each other in an 8-bit game and find out who won.

## The story (Inspiration and What it does)

Fantasy football managers never get to watch their own roster play together, and once you know your score there is nothing left to watch. We wanted the end of the week to feel like game day again. Two managers opt in when their matchup is set. Their scores stay hidden. At the end they watch their two rosters play each other: pixel players on a stadium field with a crowd, a play by play announcer, a halftime report that leaves out the points, speed controls. Only at the final whistle does the recap say who won, with the story of the game, the top performers and every scoring play. Soccer works the same way on its own page.

In this demo there is one viewer on one device, not two accounts, and no real week of waiting. The opt-in is kept in the browser, and also sent to our service when the page is opened with its address. The players are real NFL players and footballers. The football game the app opens on is built from the real plays of NFL week 9: every catch and run these players really made, arranged into one matchup, so the fantasy points are real and the matchup and the score on the field are ours. A second football game (Goblins against Pythons) and the soccer match come from invented stat lines, so neither is a real result.

## How we built it

Four people, each directing AI coding agents on one part, coordinated through a written contract and a board. The app is plain browser code with no framework and no build step. A rules engine works out downs, distance and score. A game maker builds a full legal game, either from a real week's plays or from target stat lines, so every player ends with exactly those numbers; a separate check replays each game and compares every number. For a game built from stat lines a play caller called Jev picks the plays: Jev chose 40 of the 84 plays of the Goblins against Pythons game, and the rules engine refereed every play. The announcer writes its lines from templates, and the lines of the featured games are ElevenLabs recordings. Scout, a research agent, reads Sleeper and ESPN and produces player profiles and scouting reports. A small Node service on Tiger Data stores plays and serves the league, momentum, player trends and Scout's reports.

## Tiger Data track

The database is Tiger Data (PostgreSQL with TimescaleDB). Every play is a row stamped with the time it happened in the game, in a hypertable. Continuous aggregates give fantasy points per player per game, per team per quarter and per player per week. Three more pieces use what TimescaleDB adds over plain PostgreSQL: momentum buckets each team's fantasy points over game time with time_bucket; a hypertable of fantasy awards feeds the weekly continuous aggregate that answers GET /players/:id/trend (week over week points and a hot streak); and push-game spreads games over real weeks so the weekly buckets mean something.

What ran on Tiger Data: all of it. From Juan's laptop, `sh db/laptop.sh` applied the schema, the seed and every migration on the real Tiger Data service, started our service against it, pushed every football and soccer game file and called every route. The first run was honest with us: the momentum route answered with date_bin, because our check for time_bucket failed on Tiger Data (the function has many overloads), and the weekly trend came back from files, because the continuous aggregates only showed refreshed rows. We fixed both that night (the function is now found through pg_proc, and a migration makes the aggregates real-time) and ran it again: no step failed, the momentum answer said time_bucket, and a 19 check test against a real database (`node server/test-db.js`) passed on Tiger Data, with the database's momentum buckets equal to the JavaScript buckets and the trend read from the weekly aggregate. Both run reports are in the repository. Before that night everything beyond the first schema had only run on a plain PostgreSQL 16, with date_bin standing in for time_bucket. What the app does today: it plays from a game file and reads no plays from the database; opened with the service address it sends the opt-in, reads the league and uses the commissioner and watch party routes.

## LangChain deep agents track

Scout is a deepagents team: a main agent plans with a todo list and delegates through the task tool to three subagents. The stats researcher builds a profile from Sleeper season numbers. The film room studies a player's real play by play from ESPN (3,177 snaps of the 28 roster players) and returns findings as structured claims. The fact checker verifies every cited play against the plays file and writes the report; the report writer refuses any claim without evidence and any play that is not a real play of that player. Every report claim links to the ESPN game behind it. Offline tests run the whole team on a scripted stand-in model, including a made-up play being refused. The agent itself has run once with a real model: one player (Puka Nacua), model gemini-3.5-flash-lite, about 2 minutes, with the main agent and all three subagents working. Its report passed the evidence check but was weaker than the one we kept. That was the only model run, so the other 27 players have not run through the agent. The 28 scouting reports in the repository were written by hand with Scout's tools, not by the agent, and say so on their second line: the numbers were pulled live from Sleeper and ESPN, each claim was written from the splits the film room tools returned, and every cited play passed the fact checker's tool before the report writer saved it. Each football team also has a team profile built the same way: how the offense moves the ball, who gets the ball in the red zone and on third down, and who is hot or cold.

## What is real and what is simulated

Real: the rules engine and the check that replays every game; the player names and rosters; season tendencies and recent form read live from Sleeper, cross-checked against ESPN (all agree); 3,177 real plays and the two week 9 games built from them, one of which is the game the app opens on; the database, tested end to end on Tiger Data; Jev's play calls in the two football games built from stat lines; the ElevenLabs recordings (about 740 football lines and 280 soccer lines); 28 scouting reports with the plays behind every claim.
Simulated: every play of the Goblins against Pythons game, the Turtles against Owls game and the soccer match (invented stat lines, real names); in the games built from real plays, the drive starts, incompletions, penalties, the clock and the score on the field; the league and the second manager (sample data); the week of waiting.
Not checked: sound and speed on a real phone, the voice by ear on the demo machine, the app reading its plays from the database (it does not), one summary route that came back empty on Tiger Data, the Claude path of Scout, and a model run for 27 of the 28 players.

## Built with

Plain JavaScript in the browser. Node and the pg driver for the service. Tiger Data (PostgreSQL with TimescaleDB). Jev (TypeSafe AI) as the football play caller. LangChain deepagents, langchain-google-genai and langchain-anthropic for Scout. Gemini. ElevenLabs for the announcer. Sleeper's and ESPN's public data. Claude Code and other AI coding agents for most of the code.

## Setup in three lines

python3 -m http.server 8000, then open http://localhost:8000 (no install, no build).
Check everything: node data/checks/all.js (add DATABASE_URL for the database and browser checks).
With a database: DATABASE_URL=<connection string> sh db/laptop.sh, then node server/index.js and open the app with ?api=http://localhost:3001.

## What is next

Run Scout across all 28 players on a stronger model. Build a game with the filled profiles. Have the app read plays, momentum and trends from the service. Real leagues with two managers watching together, accounts, and testing on phones.
