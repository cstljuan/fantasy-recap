#!/bin/sh
# Run at the start of every task: brings everything the boss has merged into your
# branch, then shows the board. This is how you get a feature another lane finished.
cd "$(git rev-parse --show-toplevel)" || exit 1
sh tools/setup.sh
git fetch -q origin --prune || { echo "Could not reach GitHub."; exit 1; }
branch="$(git branch --show-current)"
if [ -n "$(git status --porcelain)" ]; then
  echo "You have uncommitted changes. Commit them first, then run sync again."
else
  if [ "$branch" = "main" ]; then
    git merge -q --ff-only origin/main && echo "main is up to date."
  else
    if git merge -q --no-edit origin/main; then
      echo "Your branch now has everything on main."
    else
      git merge --abort
      echo "main does not merge cleanly into your branch. Do not force it."
      echo "Post it:  sh tools/post.sh BLOCKED \"merge conflict with main in <files>\""
    fi
  fi
fi
sh tools/board.sh
sh tools/inbox.sh
