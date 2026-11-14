# Handoff for Peyton's agent

You work for **Peyton**. GitHub username `Peypey-ryd`. Git email `139926103+Peypey-ryd@users.noreply.github.com`.
Lane: B, reveal flow and screens. You may edit only: `js/app.js`, `js/screens/`, `css/`, and your own `board/Peypey-ryd.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "Peypey-ryd"` and `git config user.email "139926103+Peypey-ryd@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `Peypey-ryd/work` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/Peypey-ryd.md` has no READY line yet, run `sh tools/post.sh READY "hello from Peyton"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `Peypey-ryd` as both names. If it shows anything else, STOP and tell Peyton to tell Juan. Do nothing else.

## How to work

- Do the first task below that has no DONE line in your status file. One task per go.
- Before a task: `sh tools/sync.sh`, then `sh tools/post.sh CLAIM "<task id> <short name>: <files>"`.
- After a task: commit, push, `sh tools/post.sh DONE "<task id> <short name>, checked: <what you checked>, not checked: <what you did not>"`.
- Then stop and tell Peyton in two or three sentences what is done and what you could not check. Wait for Peyton to say "next".
- If a task needs something outside your files, do not edit it. Run `sh tools/post.sh ASK "boss: <what you need>"` and continue with what you can.
- Never guess a fact. If you could not check something, say so.

## Task B1: opt in and hidden scores

Edit only `js/app.js`, `css/app.css` and new files in `js/screens/`. Do not edit `index.html`.

1. On the matchup screen, before kickoff, show a card: "Hide my score until the recap", with two buttons, "Opt in" and "No thanks". Save the choice in `localStorage` under the key `fr.optin`.
2. While the manager is opted in and the game has not reached the final, every fantasy points number and every stat line on the matchup, lineups and plays screens is masked (show `--.-` for points and nothing for stat lines).
3. The recap screen says "Scores are hidden. Watch the game to find out." until the final.
4. When the game sends the `final` event (`window.FF_GAME.on`, see `docs/CONTRACT.md` section 2), reveal everything.
5. "No thanks" leaves the app exactly as it is today.

Check: serve the folder with `python3 -m http.server`, look at 375 pixels wide. No sideways scroll, no console errors. Opt in, watch at `?speed=20`, confirm the numbers appear at the final.

## Task B2: speed control

Edit only `js/app.js`, `css/app.css` and new files in `js/screens/`. Do not edit `index.html`.

Add a speed control to the game view that appears and hides together with the existing Close control: four choices, 0.5x, 1x, 2x, 4x. Create the element in JavaScript, because `index.html` is not yours. It sets `window.__ff.speed` (`docs/CONTRACT.md` section 2), shows the current choice, and remembers it in `localStorage` under `fr.speed`.

Check at 375 wide and at 1280 wide: the control does not cover the score, each choice changes the pace, no console errors.

## Task B3: the recap screen for a reveal

Edit only your files. After the final, the recap screen opens with the winner shown large, then the top performers, then the scoring plays. Add a "Watch again" path that keeps the opt-in choice. Check at 375 wide.
