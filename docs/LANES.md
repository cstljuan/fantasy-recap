# Lanes: who owns which files

Edit only your own files. Reading anything is fine. A new file goes in a folder you own. If you need a change somewhere else, post `ASK`.

Two sports are in the build: football and soccer.

| Lane | Person | GitHub | Owns |
|---|---|---|---|
| A. Boss and football game maker | Juan's lead session | `cstljuan` | `js/main.js`, `js/rules.js`, `js/plays.js`, `js/sprites.js`, `js/sport.js`, `engine/`, `tools/`, `data/games/`, `docs/`, `board/BOSS.md`, `handoffs/`, `index.html`, every file at the root, `.claude/`, `.github/`, `.githooks/` |
| S. Soccer | Juan | `cstljuan` | `soccer/` (the whole soccer game: field, players, rules, plays, data) |
| B. Reveal flow and screens | Peyton | `Peypey-ryd` | `js/app.js`, `js/screens/`, `css/` |
| C. Announcer and sound | Noah | `nexodv` | `js/audio.js`, `js/announcer/`, `assets/voice/` |
| D. Players, profiles, database | Ricky | `Rickstar-App` | `js/data.js`, `data/rosters/`, `data/profiles/`, `data/statlines/`, `data/scoring.json`, `data/league.json`, `data/checks/`, `agents/scout/`, `db/`, `server/` |
| G. Design and brand | Juan's design session | `cstljuan` | `design/`, `pitch/assets/` |
| H. Watch party box | by hand, owner to be named | | `hardware/` |
| Pitch | everyone, Juan decides | | `pitch/` |

Everyone also owns their own `board/<github-username>.md`.

`index.html` belongs to the boss. To load a new script, post `ASK "boss: add <script src=...> to index.html"`.

Soccer lives in its own folder so that work on one sport can never break the other. The boss connects the two in the app once both run.

Design rules for the screens: `docs/DESIGN.md`.
