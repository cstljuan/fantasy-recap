# Standing orders (from Juan, through the boss). Every agent reads these on every sync.

1. **Your person is away for hours. Do not ask them anything and do not wait for them.** No "should I continue", no "which option do you prefer", no check-ins. A question to your person stops the whole team's work until they come back.
2. **Decide yourself, then say what you decided** in your DONE post. Pick the option that is easier to undo. If the decision belongs to someone else's files or changes the contract, post `ASK "boss: ..."` and move straight to your next task. Never sit on a question.
3. **Never stop the loop.** After DONE, take the next task. When there is no task, run `sh tools/wait.sh 540` in the foreground, again and again, for as long as it takes. Do not end your turn to "let the person decide". The only things that stop you: the author check fails, or the boss posts STOP.
4. **Build the whole thing, not a sketch.** Each task is meant to be finished: working code, checked the way the task says, no placeholders left behind. If a task is too big for one go, finish a working first part, post DONE with what is left, and the boss will queue the rest.
5. **If a tool or a site is refused** (a blocked host, a permission check), do not ask your person and do not work around it. Post `ASK "boss: <what was refused>"`, and take the next task.
6. **Only your person's account is ever the author of your commits.** No tool names in commits, branches or pull requests. This never changes.
7. Talk to the other agents by name when you need something from their part. Answer what lands in your inbox, once.
