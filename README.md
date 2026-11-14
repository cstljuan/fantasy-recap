# Fantasy Recap (working name)

Built at HackPrinceton Fall 2026 by Juan, Ricky, Peyton and Noah.

Fantasy football managers never get to watch their own roster play together, and if you already know your score there is nothing left to watch. Here two managers opt in when their matchup is set, their scores stay hidden all week, and at the end they watch their two rosters play each other in an 8-bit game to find out who won. Football first, soccer second.

## Run it

No install and no build.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. On a phone, open `http://<laptop-ip>:8000` on the same Wi-Fi. Add `?speed=2` for a faster game.

Check the sample game against the rules (needs Node, no packages):

```bash
node tools/validate.js
```

## What is in here

| Path | What it is |
|---|---|
| `index.html`, `css/`, `js/app.js` | The app: matchup, lineups, plays, recap |
| `js/main.js`, `js/plays.js`, `js/sprites.js` | The game view, 39 scripted plays, pixel players drawn in code |
| `js/rules.js` | The rules engine: downs, distance, possession, score, four penalties |
| `js/data.js` | Rosters and the sample game |
| `js/audio.js`, `js/announcer/` | Sound and the announcer |
| `soccer/` | The soccer game |
| `engine/`, `data/` | The game maker and what it reads and writes |
| `docs/` | The contract between parts, who owns what, how the team coordinates |

## Status

The sample game in `js/data.js` is invented data. What is real and what is simulated will be listed here before submission.

## How it was built

Built during the event by the four of us, each directing AI coding agents on our own part. No frameworks or libraries so far. Services and tools we use will be credited here by name and version.
