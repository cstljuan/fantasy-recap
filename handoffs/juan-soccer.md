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

- Do the first task below that has no DONE line in your status file. One task per go.
- Before a task: `sh tools/sync.sh`, then `sh tools/post.sh CLAIM "<task id> <short name>: <files>"`.
- After a task: commit, push, `sh tools/post.sh DONE "<task id> <short name>, checked: <what you checked>, not checked: <what you did not>"`.
- Then stop and tell Juan in two or three sentences what is done and what you could not check. Wait for Juan to say "next".
- If a task needs something outside your files, do not edit it. Run `sh tools/post.sh ASK "boss: <what you need>"` and continue with what you can.
- Never guess a fact. If you could not check something, say so.

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
