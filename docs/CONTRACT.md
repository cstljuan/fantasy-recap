# Contract between lanes (v0)

Version 0 writes down what the code does today, so every lane can build against it. Only the boss changes this file.

## 1. Teams and the game file

`js/data.js` sets `window.FF_DATA` with `TEAMS` and `SAMPLE_GAME`. That shape is the game file.

- A team: `{ id, name, full, colors: { jersey, helmet, stripe, pants, tile, zone }, roster: { QB, RB, WR1, WR2, WR3, TE, K } }`. Roster values are player names.
- A game: `{ note, drives: [ { team: '<team id>', plays: [ <event>, ... ] } ] }`.
- An event is one play: `kickoff {to}`, `run {by, yds}`, `pass {to, yds}`, `inc {to}`, `sack {yds}`, `pen {kind, ...}`, `punt {net}`, `fg {good}`, `xp {good}`, `int {to, at, ret}`, `fumble {by, yds}`, `kneel {}`. `by` and `to` are roster slots such as `RB` or `WR1`. The comments at the top of `js/data.js` list every field.
- Touchdowns, first downs and turnovers on downs are never in the file. `js/rules.js` works them out.

Version 1 (live): a game file is `data/games/<id>.json`: `{ version: 1, sport, teams, game, report }`, with `teams` and `game` in the shape above. The boss picks the one the app plays with `node tools/use-game.js data/games/<id>.json`, which writes `data/games/current.js`; `index.html` loads it and puts it in `FF_DATA.TEAMS` and `FF_DATA.SAMPLE_GAME` before the game starts. `?game=sample` plays the built-in sample.

A play the play caller chose carries two extra fields. Code that ignores unknown fields keeps working.

- `why`: `{ play: { "<option>": probability, ... }, picked: "<option>", highlight: <0 to 1>, by: "jev" }`. Options are calls: `pass_<slot>` or `run_<slot>`, for example `pass_WR1`, `run_RB`. The probabilities are Jev's for the options that were legal at that snap.
- `tags`: a list, for example `["highlight"]`.

Plays the engine decided by itself (sacks, penalties, kicks, turnovers, forced plays) have no `why`.

`report` says how the file was made: tries, plays, plays chosen by Jev, the model, and the score and fantasy points, which match the stat lines it was built from.

## 2. The game, from the app's side

`window.FF_GAME`:

- `on(fn)`: `fn(type, data)` is called for `start`, `snap`, `result`, `half`, `final`, `reset`. For `snap` and `result`, `data` is `{ res, play, step }`.
- `start()`, `restart()`, `setActive(true or false)`, `ontap`.
- Read only: `mode`, `active`, `plays`.
- `seek(index)`: jump to the start of play number `index` (from 1, plays only). The plays before it run at once: listeners still get `reset`, `snap`, `result` and `half` for them so tallies stay right, but there is no sound, voice, floater or banner, and the announcer is not asked for lines. Returns `false` for an index that is not a play. Works before the game starts and after the final. After the jump the game itself says `FF_ANNOUNCER.catchUp(...)` for the skipped plays, so callers of `seek` must not call it again.
- `hold(true or false)`: stop or release the clock. The view stays open and the announcer finishes its line. `held` reads it.
- Reduced motion: when the system asks for reduced motion (or with `?calm=1`) the camera jumps instead of gliding and the point floaters appear in place without rising or fading. The players still move. `calm` reads it.
- `setFloaters(true or false)`: show or hide the fantasy point numbers that float up from players. `floaters` reads it.
- `setBackground(true or false)`: by default the game only advances while its view is open (`setActive(true)`). `setBackground(true)`, or `?bg=1`, lets it run behind the app. `background` reads it.

Speed: `window.__ff.speed = 2` sets the speed while the game runs (0.25 to 40). `window.__ff.speed` reads it.

## 3. The announcer (lane C builds it, the boss connects it)

`js/announcer/index.js` sets `window.FF_ANNOUNCER`:

- `line(res, ctx)` returns the sentence to say for a finished play, or an empty string to stay quiet. `res` is the same object the `result` event carries. `ctx` is `{ teams, score, style }`, where `style` is `"straight"` or `"fun"`.
- `speak(text)` says it out loud with the browser's speech voice and does nothing if speech is not available.
- `setStyle(name)` and `style`.

It is connected: `js/main.js` calls `line` for every play result, for halftime with `{ kind: 'half' }` and for the final with `{ kind: 'final' }`, and speaks through `speak`. If the announcer returns an empty string the game falls back to its own short line.

## 4. Profiles (lane D writes them, the game maker reads them)

`data/profiles/<team id>.json`: `{ "team": "<id>", "source": "<where the numbers came from>", "players": { "<slot>": { "name", "position", "tendencies": { ... numbers from 0 to 1 ... }, "notes" } } }`. On-field tendencies only. Nothing about anyone's private life.

## 5. Database (lane D)

Every play is stored as one row with the time it happened in the game. The schema is in `db/schema.sql`. The app must keep working from the game file alone when the database cannot be reached.

## 6. Soccer (lane S builds it, the boss connects it)

Soccer is a second game in `soccer/`, with its own data, rules, plays and drawing. It follows the same pattern as football so the app, the announcer and the speed control work for both:

- `soccer/js/data.js` sets `window.SC_DATA` with `TEAMS` and `SAMPLE_GAME`. A game is a list of events over match time; goals and the final score follow from the events and the rules, they are never written in the file.
- `soccer/js/main.js` sets `window.SC_GAME` with the same members as `window.FF_GAME` in section 2 (`on`, `start`, `restart`, `setActive`, `ontap`, `mode`, `active`, `plays`) and sends the same event types.
- Speed: `window.__sc.speed`, same meaning as `window.__ff.speed`.
- `soccer/index.html` runs the soccer game by itself, so it can be built and checked without touching the football files.
