#!/bin/sh
# Adds one line to YOUR status file, commits it and pushes your branch.
#   sh tools/post.sh READY   "identity checked, starting"
#   sh tools/post.sh CLAIM   "B1 hidden scores: js/app.js, css/app.css"
#   sh tools/post.sh DONE    "B1 hidden scores, checked at 375 wide, needs: nothing"
#   sh tools/post.sh BLOCKED "B2 needs FF_GAME.setSpeed from the boss"
#   sh tools/post.sh ASK     "boss: may I add a script tag to index.html for js/screens/optin.js"
#   sh tools/post.sh ASK     "noah: what does FF_ANNOUNCER.onLine pass to the callback?"
#   sh tools/post.sh ANSWER  "peyton: (text, kind, style). It fires for every line, spoken or not."
# Start ASK, ANSWER and NOTE with who it is for: boss, juan, peyton, noah, ricky or all.
# States: READY CLAIM DONE BLOCKED ASK ANSWER NOTE. One line, no secrets.
cd "$(git rev-parse --show-toplevel)" || exit 1
state="$1"; shift; text="$*"
case "$state" in READY|CLAIM|DONE|BLOCKED|ASK|ANSWER|NOTE|STOP) ;; *) echo "State must be READY, CLAIM, DONE, BLOCKED, ASK, ANSWER or NOTE."; exit 1 ;; esac
sh tools/check-authors.sh --ident >/dev/null || { sh tools/check-authors.sh --ident; exit 1; }
u="$(git config user.name)"
branch="$(git branch --show-current)"
if [ "$branch" = "main" ] && [ "$u" != "cstljuan" ]; then echo "You are on main. Switch to your own branch first."; exit 1; fi
mkdir -p board
[ -f "board/$u.md" ] || printf '# %s\n\n' "$u" > "board/$u.md"
printf -- '- %s | %s | %s | %s\n' "$(date -u '+%m-%d %H:%M UTC')" "$state" "$branch" "$text" >> "board/$u.md"
git add "board/$u.md" && git commit -q -m "board: $state $(printf '%s' "$text" | cut -c1-60)" -- "board/$u.md" || exit 1
git push -q -u origin HEAD && echo "Posted and pushed: $state $text" || echo "Posted locally, but the push failed. Push your branch, then tell your person."
