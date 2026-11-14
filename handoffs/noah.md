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

Follow the work loop in `CLAUDE.md` section 3: `sh tools/sync.sh`, `sh tools/next.sh`, CLAIM, do it, DONE, repeat, without waiting to be told. When there is no task, `sh tools/wait.sh`. Never guess a fact. If you could not check something, say so in the DONE post. The boss queue in `board/BOSS.md` decides the order; the sections below are the full descriptions.

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

## Task C3: captions

Add `FF_ANNOUNCER.onLine(fn)`: `fn(text, kind, style)` is called every time a line is produced, whether or not it is spoken. Add `FF_ANNOUNCER.caption()` that returns the last line and when it was said. This lets the game show subtitles and lets the app list what was said. Extend `js/announcer/check.js` to cover it.

## Task C4: intro, halftime, wrap

Three longer pieces built from numbers, not from a model: `FF_ANNOUNCER.intro(ctx)` (the two teams and one thing to watch for each), `FF_ANNOUNCER.halftime(ctx)` (score, who leads in fantasy points, the best player so far), `FF_ANNOUNCER.wrap(ctx)` (final, the play that decided it, the top performer). `ctx` adds `leaders` (an array of `{ name, points }`) and `plays` (the list so far) to what `line` receives. Two styles each. Each returns two or three sentences.

## Task C5: voice and queue

Choose the best voice the browser has for each style (prefer an English voice; a different pitch and rate for `fun`). Queue lines so a new one never cuts the previous one mid-word, drop lines that are more than two plays old, and stay silent when speed is above 2. Expose `FF_ANNOUNCER.voices()` so a person can see what was chosen.

## Task C6: tendency lines

Read `data/profiles/<team>.json` when it is available (pass it in through `ctx.profiles`; do not fetch it yourself). When a play matches a player's known tendency, or goes against it, say so: "That is what he does best" or "You do not see him run that route often". Only when the tendency number is present; never invent one.

## Task C7: jingles

In `js/audio.js`, two short tunes made in code: a kickoff theme of about three seconds and a full-time theme of about four. Add names for them to `play()` and list the names in your DONE post.

## Task C9: fit the lines to the captions strip (with Peyton)

Peyton is building a one-line captions strip (task B11). Ask her how many characters fit at 375 wide: `sh tools/post.sh ASK "peyton: ..."`. Then make sure no line is longer than that: shorten the long ones, and add `FF_ANNOUNCER.maxLength` so the check file fails when a line is too long. Answer her questions about `onLine` when they reach your inbox.

## Task Q2: walk the reveal flow for Peyton

Open the app at 375 wide (headless is fine): opt in, watch at `?speed=20`, close and reopen the game, reach the final, open the recap, watch again. Send Peyton, in one or two NOTE posts, exactly what breaks or reads wrong, with the step that shows it: `sh tools/post.sh NOTE "peyton: ..."`. You do not edit her files.

## Task P2: shot list for the demo video

Create `pitch/VIDEO-SHOTS.md`: the shots for a one-minute demo video, in order, each with what is on screen, what is heard (which announcer lines and crowd sounds), and how long it runs. Use only what is on main.
