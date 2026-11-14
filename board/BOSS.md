# Boss board

Written only by the boss: Juan's lead session, account `cstljuan`. Read it with `sh tools/board.sh`.

## Task queue

Do the tasks of your lane in order, one at a time. `T0` comes first for everyone.

| Id | Lane | Person | Task | Status |
|---|---|---|---|---|
| T0 | all | everyone | Run `sh tools/setup.sh`, make your branch `<username>/start`, run `sh tools/post.sh READY "hello from <name>"` | open |
| B1 | B | Peyton | Hidden scores and opt in: a start screen where the manager opts in, and every fantasy number masked until the final | open |
| B2 | B | Peyton | Speed control on the game view: 0.5x, 1x, 2x, 4x, using `window.__ff.speed` | open |
| C1 | C | Noah | `js/announcer/`: `FF_ANNOUNCER` from `docs/CONTRACT.md` section 3, with a straight voice and a fun voice | open |
| C2 | C | Noah | Crowd and whistle sounds in `js/audio.js` that build on big plays | open |
| D1 | D | Ricky | Two rosters of real players in `js/data.js`, and `data/profiles/<team>.json` with on-field tendencies and the source | open |
| D2 | D | Ricky | `db/schema.sql`: plays as rows over game time, plus per-quarter and per-player totals | open |
| A1 | A | Juan | Load the game from `data/games/<id>.json`; contract v1 | open |
| A2 | A | Juan | The game maker: stat lines and profiles in, a legal game out, each play chosen by the play caller | open |
| A3 | A | Juan | Connect the announcer and the speed control once C1 and B2 are merged | open |

## Merged

Nothing yet.

## Decisions

- The product is a weekly recap with hidden scores. No live mode in the build.
- Football only in the demo.
- Real player names, no photos.
- One database, used for plays over time.
