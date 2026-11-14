# Handoff for Noah's agent

You work for **Noah**. GitHub username `nexodv`. Git email `88387649+nexodv@users.noreply.github.com`.
Lane: C, announcer and sound. You may edit only: `js/audio.js`, `js/announcer/`, and your own `board/nexodv.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "nexodv"` and `git config user.email "88387649+nexodv@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `nexodv/work` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/nexodv.md` has no READY line yet, run `sh tools/post.sh READY "hello from Noah"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `nexodv` as both names. If it shows anything else, STOP and tell Noah to tell Juan. Do nothing else.

## How to work

- Do the first task below that has no DONE line in your status file. One task per go.
- Before a task: `sh tools/sync.sh`, then `sh tools/post.sh CLAIM "<task id> <short name>: <files>"`.
- After a task: commit, push, `sh tools/post.sh DONE "<task id> <short name>, checked: <what you checked>, not checked: <what you did not>"`.
- Then stop and tell Noah in two or three sentences what is done and what you could not check. Wait for Noah to say "next".
- If a task needs something outside your files, do not edit it. Run `sh tools/post.sh ASK "boss: <what you need>"` and continue with what you can.
- Never guess a fact. If you could not check something, say so.

## Task C1: the announcer

Create `js/announcer/lines.js` and `js/announcer/index.js`. Edit nothing outside `js/announcer/`.

Build `window.FF_ANNOUNCER` exactly as `docs/CONTRACT.md` section 3 describes: `line(res, ctx)`, `speak(text)`, `setStyle(name)`, `style`.

First read `js/rules.js` and `js/main.js` to see what a play result (`res`) contains and what the current `say()` lines are.

Write lines for every kind of result: touchdown, field goal good, field goal missed, extra point, interception, fumble, sack, a gain of 15 yards or more, an ordinary gain, incomplete pass, each of the four penalties, punt, turnover on downs, halftime, final. Two styles: `straight` (what happened and why it matters, in one sentence) and `fun` (the same fact with personality). At least three variants per kind and style, chosen so one game does not repeat itself.

The lines are about the game on the field only. Nothing about any real person's private life.

Add `js/announcer/check.js`, runnable with `node js/announcer/check.js`, that prints one line per kind and style so a person can read them all.

You cannot add the script tags yourself. After pushing, run `sh tools/post.sh ASK "boss: add script tags for js/announcer/lines.js and js/announcer/index.js to index.html and call FF_ANNOUNCER from js/main.js"`.

## Task C2: crowd and whistle

Edit only `js/audio.js`. Keep every existing sound name working.

Add a crowd made in code (no audio files): a low murmur during play, a swell on a gain of 15 yards or more, a roar on a touchdown, a groan on a turnover. Add names for them to the existing `play()` list in the same style. List the new names in your DONE post so the boss can call them from `js/main.js`.

## Task C3: soccer lines

Only after the boss posts that soccer is merged. Add a second set of lines in `js/announcer/` for soccer events (goal, save, shot wide, corner, free kick, foul, offside, halftime, full time), same two styles, same check file.
