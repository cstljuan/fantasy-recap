# Devpost text (draft, 2026-11-14)

Working name: Fantasy Recap. Check every claim against `REAL-AND-SIMULATED.md` before submitting. Nothing here has been submitted.

## Inspiration

Fantasy football managers never get to watch their own roster play together. And once you know your score there is nothing left to watch. We wanted the end of the week to feel like a game day.

## What it does

The idea: two managers opt in when their matchup is set, scores stay hidden all week, and at the end they watch their two rosters play each other in an 8-bit football game and find out who won, with a recap of the top performers and the scoring plays. There is a speed control, floating fantasy points, an announcer and crowd sound. Soccer is a second game built the same way.

In this demo there is one viewer, not two accounts, and no real week of waiting. The opt-in choice is kept in the browser. The game is built from invented stat lines for real player names, so it is not a real result.

## How we built it

Four people, each directing AI coding agents on one part: the app screens, the announcer and sound, the soccer game, and the players and database. We agreed the interfaces in a written contract and coordinated through a board in the repository. The app is plain browser code with no frameworks and no build step. A rules engine works out downs, distance and score from the plays. The pixel players are drawn in code. A game maker builds a legal game from target stat lines, so every player ends with exactly those numbers. Today the targets come from our invented sample game. A play caller called Jev picked 40 of the 84 plays in the current game, and the rules engine refereed every play. For storage we designed a Tiger Data schema (PostgreSQL with the TimescaleDB extension): plays as a hypertable with two continuous aggregates. A small Node service saves and returns plays and has been run once against the real database. The app does not use the database yet.

## Challenges

Keeping four agents from stepping on each other. We gave each person their own files and an agreed contract. Hiding the score in the places we found it could leak: floating points, the recap text and stat lines. We tested this in a headless browser, not on a real phone. Getting a database connection through its certificate checks, which is still being settled.

## Accomplishments

A full game that plays start to finish in a browser, tested at phone width in a headless browser, with scores hidden until the end if the viewer opts in. A rules engine checked against the sample game. Real rosters with real player names. A game maker that reproduces every stat line exactly. A database schema that applied cleanly on a real database. A second sport, soccer, on the same pattern, as shown in the app in a frame, with a scripted match.

## What we learned

Writing the interface down first saves more time than any single feature. Saying what we did not check was as useful as saying what we did.

## What is next

Feed the game maker a real week's stat lines. Fill the player tendencies from real season numbers (they are empty today). Connect the app to the database service. Connect soccer to the app. Bring in real fantasy league data and real accounts. Real phone testing.
