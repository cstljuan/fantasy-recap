# Handoff for a boss session

Everyone is a boss, with equal authority (`board/ORDERS.md`, order 9; `tools/bosses.txt`). Any of the four people can run a boss session. Your branch is `<your GitHub username>/boss` and your commits are authored and committed by your own account only, with the email on your row in `tools/roster.txt`:

- **Juan**: `cstljuan`, `68199309+cstljuan@users.noreply.github.com`, branch `cstljuan/boss`.
- **Ricky**: `Rickstar-App`, `222289480+Rickstar-App@users.noreply.github.com`, branch `Rickstar-App/boss`.
- **Noah**: `nexodv`, the email on his row in `tools/roster.txt`, branch `nexodv/boss`.
- **Peyton**: `Peypey-ryd`, the email on her row in `tools/roster.txt`, branch `Peypey-ryd/boss`.

If you do not know which person you work for, ask in your session's chat.

Read `CLAUDE.md`, `board/ORDERS.md`, `docs/BOARD.md`, `docs/LANES.md` and `docs/CONTRACT.md` first.

Juan and the team are away, on their phones at most. **Do not stop and never wait.** Decide, record the decision in `board/BOSS.md`, keep going. Only when you truly need your person, ask in your session's chat and keep going meanwhile (order 1).

## Several bosses without collisions

- Start every round from the newest `main` (`sh tools/boss-round.sh` does this). If your push is refused or `main` does not move to your commit within two minutes, the other boss pushed first: run the round again.
- Before you answer an ASK, check "Answers to ASK posts" on the newest `main`. If the other boss already answered it, do not answer again.
- Before you add tasks for a person, check they do not already have three `open` rows.
- If the other boss has pushed to `main` in the last three minutes (`git log -1 --format=%cr origin/main`), take one more `sh tools/boss-wait.sh` before your round. If the other boss has been silent for twenty minutes, you are the only boss: do everything.
- Never undo the other boss's decision. If you disagree, write a line under Decisions saying why and leave it for Juan.

## Light duty until about 9:30 PM Eastern on Saturday

Juan's usage limit is nearly used. Until then: run the review round only when `sh tools/boss-wait.sh` says work is waiting, keep answers to one or two lines, do not rewrite or add large things in your own files, and do not read long files you do not need. Keeping Ricky's, Peyton's and Noah's agents supplied with tasks and merged is the whole job for now.

## Setup

1. `sh tools/setup.sh`. If it says NOT OK, set `git config user.name` and `git config user.email` to your person's values above and run it again.
2. Work on your boss branch (create it from `main`). You cannot push `main` from a cloud session. When you push your boss branch, the workflow `main-follows-boss` moves `main` to the same commit within a minute. Never force-push.

## The loop, for hours

1. `sh tools/boss-round.sh`. It fetches, checks every branch with new work (authors and lanes), merges what passes, runs every check and the full-game smoke tests, marks merged tasks, pushes, and prints your inbox.
2. Read what it printed.
   - A branch was rejected or a check failed: find the cause. If it is in someone's lane, set that task's Status in the queue to `changes: <exactly what to fix>` and push. If it is in your files, fix it.
   - Every ASK in your inbox gets one answer, written as a line under "Answers to ASK posts" in `board/BOSS.md` starting with `- ANSWER to <github username> (<topic>): ...`. If the answer is a change in your files, make it.
   - Look at what was merged the way a reviewer would: read the diff of anything large, open the result where you can, and send work back with `changes:` when it is wrong or unfinished. Say what you checked in the Merged list.
3. Keep every agent busy: each person should always have at least three `open` rows. When someone is running low, add rows to the queue and full descriptions under `## Task <id>` in their handoff file. Prefer large, complete features over small ones, and tasks that make two agents talk to each other. Ideas are at the bottom of this file.
4. `sh tools/boss-wait.sh` (10 minute timeout), then go back to step 1. Never stop after any number of waits.

Your own files are listed in `docs/LANES.md` (lane A). Merge messages must name the person, never a branch (the commit check blocks tool names).

## What you cannot do from the cloud

- The database: its connection is only on Juan's laptop. Leave database runs for Juan and say so in answers.
- Jev (the play caller): only if `TYPESAFE_API_KEY` is in your environment. If it is not, do not rebuild game files; `engine/make-game.js --no-jev` still proves the engine.
- The live chat page in Claude (https://claude.ai/artifact/3SVsaFKrpWSexk1MM82ycJ): if this session has the ArtifactData tool, after each round run `python3 tools/chat-export.py /tmp/fr-chat-feed.json`, read the document `feed/main` to get its version, and `set` it from that file with `if_version`. If the tool is not there, skip it; it then only updates from Juan's laptop session. The GitHub issue https://github.com/cstljuan/fantasy-recap/issues/1 updates by itself.
- Anything that needs a sign-up, a key, money, a deploy, or making the repository public. Record it under "Waiting for Juan" in `board/BOSS.md`.

## Standards

- Honest: `README.md` and `pitch/` never say more than the code does. Fix them when a merge changes what is true.
- No tool name in any commit, branch or pull request. `sh tools/check-authors.sh HEAD` must pass before every push.
- Sunday 3:00 AM Eastern is the feature freeze: after that only fixes, polish and the pitch. Sunday 5:00 AM is the code freeze. Submission is Sunday 8:00 AM and a person does it.

## Open boss tasks

- A5: `engine/make-game.js` should read `data/statlines/week11.json` (Ricky's shape) as well as `--from-sample`, and tag highlights (touchdowns, turnovers, gains of 20 or more, and plays where Jev's highlight answer is high).
- A7: a web app manifest and icons when Peyton's agent asks for them.
- Connect anything the agents hand over: soccer voice and captions, the sound control, the film room, the service.

## Ideas for more tasks

A watch party mode where one phone is the remote for the game on a laptop; a "this week in the league" screen that plays every matchup's biggest play; a share video of the top play; a practice mode that explains each football rule when it comes up; replays of highlights in slow motion; a commissioner view; accessibility for screen readers; a second football game file with a different result; a soccer game file from a real match's numbers; tests for every script in `tools/`; a `pitch/` folder with the demo script, the video shot list, the judges' likely questions and honest answers.
