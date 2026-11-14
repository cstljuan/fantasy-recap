# Handoff for Juan's agent

You work for **Juan**. GitHub username `cstljuan`. Git email `68199309+cstljuan@users.noreply.github.com`.
Lane: S, soccer. You may edit only: `soccer/`, and your own `board/cstljuan.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "cstljuan"` and `git config user.email "68199309+cstljuan@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `cstljuan/soccer` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/cstljuan.md` has no READY line yet, run `sh tools/post.sh READY "hello from Juan"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `cstljuan` as both names. If it shows anything else, STOP and tell Juan to tell Juan. Do nothing else.

## How to work

Follow the work loop in `CLAUDE.md` section 3: `sh tools/sync.sh`, `sh tools/next.sh`, CLAIM, do it, DONE, repeat, without waiting to be told. When there is no task, `sh tools/wait.sh`. Never guess a fact. If you could not check something, say so in the DONE post. The boss queue in `board/BOSS.md` decides the order; the sections below are the full descriptions.

## Task S1: the soccer game

Build the soccer game in `soccer/` and edit nothing outside it. Follow `docs/CONTRACT.md` section 6.

Study the football game first (`js/data.js`, `js/rules.js`, `js/plays.js`, `js/sprites.js`, `js/main.js`) and keep the same look and the same structure: plain HTML, CSS and JavaScript, no libraries, no build step, no network requests.

Build:

- a pitch seen from above, with the camera following the ball
- 11 against 11 in the same pixel style, each team in its own colors, names under the players a fantasy manager owns
- the score at the top left and the match minute
- a sample match as a list of events over match time: build-up passes, shots, saves, goals, corners, free kicks, fouls, offside
- `soccer/js/rules.js` that works out goals and the final score from the events
- `soccer/js/plays.js`, a library of scripted moves chosen to fit each event, with some randomness
- `soccer/index.html`, which runs the game by itself

`window.SC_GAME` and `window.__sc.speed` must match the contract so the app, the announcer and the speed control work for both sports.

Show Juan a first look of the pitch and the players early and ask before polishing. His taste: modern, tough, not cute, not generic.

Say plainly what is real, what is simulated and what you could not check.

## Task S2: fantasy soccer on top

A sample fantasy soccer matchup: two rosters of real players, points per event (goal, assist, clean sheet, save), and a list of what each event was worth, in the same shape the football app uses, so the boss can connect it.

## Task S3: soccer polish

Goal celebrations, a slow replay of each goal, set pieces that look different from open play, and a halftime and full-time card. Keep `window.SC_GAME` and `window.__sc.speed` matching the contract.

## Task S4: the soccer match maker

`soccer/engine/make-match.js`, run with node: take fantasy soccer stat lines for two rosters (goals, assists, shots on target, saves, clean sheets, cards) and build a full, legal match in the soccer event format that reproduces every line, the same idea as `engine/make-game.js` for football: deal the events into the 90 minutes, let a chooser pick among the moves that still let the match finish correctly, referee with `soccer/js/rules.js`, replay the result and compare it with the targets, throw it away if it does not match. Use `engine/jev.js` as the chooser when `TYPESAFE_API_KEY` is in the environment and equal weights when it is not; say which was used in the file's report. Write the result to `soccer/data/` and make `soccer/index.html` able to play it.

## Task S5: the soccer app

Bring the soccer page level with the football app: lineups with fantasy points, a play-by-play feed, a recap with the top performers, and the opt-in with hidden scores until full time. Keep it all inside `soccer/`.

## Task S6: soccer voice and captions

When Noah's agent posts the soccer announcer (task C12), connect it: call it for every result, show captions, and keep `window.SC_GAME` matching the contract.
