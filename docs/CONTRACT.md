# Contract between lanes (v0)

Version 0 writes down what the code does today, so every lane can build against it. Only the boss changes this file.

## 1. Teams and the game file

`js/data.js` sets `window.FF_DATA` with `TEAMS` and `SAMPLE_GAME`. That shape is the game file.

- A team: `{ id, name, full, colors: { jersey, helmet, stripe, pants, tile, zone }, roster: { QB, RB, WR1, WR2, WR3, TE, K } }`. Roster values are player names.
- A game: `{ note, drives: [ { team: '<team id>', plays: [ <event>, ... ] } ] }`.
- An event is one play: `kickoff {to}`, `run {by, yds}`, `pass {to, yds}`, `inc {to}`, `sack {yds}`, `pen {kind, ...}`, `punt {net}`, `fg {good}`, `xp {good}`, `int {to, at, ret}`, `fumble {by, yds}`, `kneel {}`. `by` and `to` are roster slots such as `RB` or `WR1`. The comments at the top of `js/data.js` list every field.
- Touchdowns, first downs and turnovers on downs are never in the file. `js/rules.js` works them out.

Coming in v1 (boss): the same shape saved as `data/games/<id>.json`, loaded instead of `SAMPLE_GAME`, with two optional fields on an event: `why` (the play caller's probabilities, for example `{ "play": { "deep_pass": 0.46, "run": 0.31 } }`) and `tags` (for example `["highlight"]`). Code that ignores unknown fields keeps working.

## 2. The game, from the app's side

`window.FF_GAME`:

- `on(fn)`: `fn(type, data)` is called for `start`, `snap`, `result`, `half`, `final`, `reset`. For `snap` and `result`, `data` is `{ res, play, step }`.
- `start()`, `restart()`, `setActive(true or false)`, `ontap`.
- Read only: `mode`, `active`, `plays`.
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
