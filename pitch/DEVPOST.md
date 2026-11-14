# Devpost text (draft, 2026-11-14)

Working name: Fantasy Recap. Check every claim against `REAL-AND-SIMULATED.md` before submitting. Nothing here has been submitted.

## Inspiration

Fantasy football managers never get to watch their own roster play together. And once you know your score there is nothing left to watch. We wanted the end of the week to feel like a game day.

## What it does

Two managers opt in when their matchup is set. Their scores stay hidden all week. At the end they watch their two rosters play each other in an 8-bit football game and find out who won, with a recap of the top performers and the scoring plays. There is a speed control, floating fantasy points, an announcer and crowd sound. Soccer is a second game built the same way.

In this build the game is a scripted sample. It shows how a real week would look. It is not a real result.

## How we built it

Four people, each directing AI coding agents on one part: the app screens, the announcer and sound, the soccer game, and the players and database. We agreed the interfaces in a written contract and coordinated through a board in the repository. The app is plain browser code with no frameworks and no build step. A rules engine works out downs, distance and score from the plays. The pixel players are drawn in code. Plays over time go in Tiger Data, PostgreSQL with the TimescaleDB extension, as a hypertable with two continuous aggregates. A small Node service is written to save and return plays.

## Challenges

Keeping four agents from stepping on each other. We gave each person their own files and an agreed contract. Hiding the score everywhere it could leak, including floating points, the recap text and stat lines. Getting a database connection through its certificate checks, which is still being settled.

## Accomplishments

A full game that plays start to finish in a browser on a phone-sized screen, with scores that stay hidden until the end. A rules engine checked against the sample game. Real rosters with real player names. A database schema that applied cleanly on a real database. A second sport on the same pattern.

## What we learned

Writing the interface down first saves more time than any single feature. Saying what we did not check was as useful as saying what we did.

## What is next

Connect the game maker so a real week's stat lines and player tendencies build the game. Fill the player tendencies from real season numbers. Finish the database service and connect it to the app. Bring in real fantasy league data. Real phone testing.
