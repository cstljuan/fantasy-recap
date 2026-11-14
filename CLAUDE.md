# Rules for every agent working in this repository

Read this before anything else. It applies to every session, local or cloud, on every person's account. `AGENTS.md` says the same thing.

## 1. Only your person is the author. No tool is ever a contributor.

This repository has four contributors and will only ever have four: `cstljuan`, `Rickstar-App`, `nexodv`, `Peypey-ryd`. You work for one of them. Every commit you make is authored AND committed by that person's own GitHub account, with the email on their row in `tools/roster.txt`. Nothing else is acceptable: not a tool's name, not a bot account, not another teammate.

Before your first commit in every session:

1. Run `sh tools/setup.sh`. It turns on the commit checks and prints the identity git will use.
2. If it says NOT OK, set your person's row and run it again:
   `git config user.name "<their GitHub username>"` and `git config user.email "<the email on their row>"`.
   If you do not know which person you work for, stop and ask them. Never guess and never use another row.
3. Never use `--author`, `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` or `GIT_COMMITTER_EMAIL`.
4. Never add a `Co-Authored-By` line, a "Generated with" line, a session link or the name of any tool to a commit message, a branch name, a pull request title or a pull request description. `.claude/settings.json` turns the automatic lines off. Do not edit or delete that file, `.githooks/`, `tools/check-authors.sh` or `tools/roster.txt`.
5. After each commit and before pushing, run `git log -1 --format='%an <%ae> | %cn <%ce>%n%B'`. Both names must be your person and the message must only describe the change. If not, fix it with `git commit --amend` before you push.
6. Never use `--no-verify`. Never make a bot act on GitHub (no bot mentions that commit or open pull requests, no bot merges).
7. If a wrong author or an added credit line was already pushed, stop and tell your person so they can tell Juan. Push nothing on top of it.

Three checks enforce this: the hooks in `.githooks/`, the check before every push, and the `authors` check that runs on GitHub for every push.

## 2. Stay in your lane

`docs/LANES.md` says which files each person owns. Edit only your person's files. Reading anything is fine. Work on a branch named `<your person's GitHub username>/work`. If the branch you were given is named after a tool, create `<username>/work` from it and push that instead; if the push is refused, say so in a NOTE post and carry on. Never push to `main`, never force-push. Juan's lead session is the boss and does every merge.

## 3. The work loop: keep going without being asked

Do not stop between tasks and do not wait for your person to say "next". Repeat this loop:

1. `sh tools/sync.sh` (brings in what the boss merged and shows the board).
2. `sh tools/next.sh` (prints your next task and its full description).
3. If it prints a task: `sh tools/post.sh CLAIM "<id> <short name>: <files>"`, do the task, check it, commit, push, `sh tools/post.sh DONE "<id> <short name>, checked: <...>, not checked: <...>"`. Go back to step 1.
4. If it prints NO TASK: run `sh tools/wait.sh`. It waits for new work for up to 25 minutes without using the model. If your shell tool can run a command in the background and tell you when it ends, run it that way; otherwise run it with the longest timeout you are allowed (for example `sh tools/wait.sh 540`). When it returns, go back to step 1. After 8 waits in a row with no new work, stop and tell your person.

Stop the loop only when: the author check fails, you are BLOCKED on something only a person can do (post it first), or your person tells you to stop. Your person watches the usage limit and will tell you.

A task that needs a file outside your lane is not a reason to stop: post `ASK "boss: ..."`, finish what you can, post DONE with what is missing, take the next task.

Every third task, give your person two lines on what is done. Then keep going.

How the board works: `docs/BOARD.md`. People watch it live at https://github.com/cstljuan/fantasy-recap/issues/1.

## 4. Other rules

- The interface between lanes is `docs/CONTRACT.md`. Do not change it; ask the boss with `sh tools/post.sh ASK "boss: ..."`.
- No keys, tokens or passwords in any file, commit or board post. This repository becomes public.
- Never sign up for a service, spend credits, deploy, publish or submit to Devpost. Ask your person.
- No em dashes anywhere. Write plainly.
- Do one task at a time, finish it, push it, post DONE, then take the next one.
