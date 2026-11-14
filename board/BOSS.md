# Boss board

Written only by the boss: Juan's lead session, account `cstljuan`. Read it with `sh tools/board.sh`.

## Task queue

Do the tasks of your lane in order, one at a time. `T0` comes first for everyone.

| Id | Lane | Person | Task | Status |
|---|---|---|---|---|
| T0 | all | everyone | Identity check and READY post | done by all four |
| B1 | B | Peyton | Hidden scores and opt in: a start screen where the manager opts in, and every fantasy number masked until the final | merged |
| B2 | B | Peyton | Speed control on the game view: 0.5x, 1x, 2x, 4x, using `window.__ff.speed` | merged |
| C1 | C | Noah | `js/announcer/`: `FF_ANNOUNCER` from `docs/CONTRACT.md` section 3, with a straight voice and a fun voice | merged |
| C2 | C | Noah | Crowd and whistle sounds in `js/audio.js` that build on big plays | merged |
| D1 | D | Ricky | Two rosters of real players in `js/data.js`, and `data/profiles/<team>.json` with on-field tendencies and the source | merged |
| D2 | D | Ricky | `db/schema.sql`: plays as rows over game time, plus per-quarter and per-player totals | merged |
| D3 | D | Ricky | `server/`: a small service that saves plays to the database and returns them, reading its connection from `.env` | open, needs Juan's database account |
| S1 | S | Juan | `soccer/`: the pitch from above, 11 against 11 in the same pixel style, one sample match that plays start to finish | open |
| S2 | S | Juan | Soccer rules and a play library: build-up, shot, save, goal, corner, free kick, foul, offside | open |
| A1 | A | boss | Load the game from `data/games/<id>.json`; contract v1 | open |
| A2 | A | boss | The football game maker: stat lines and profiles in, a legal game out, each play chosen by the play caller | open |
| A3 | A | boss | Connect the announcer, the speed control and the sport switch once C1, B2 and S1 are merged | open |

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
