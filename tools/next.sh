#!/bin/sh
# Prints your next task: the first row of the boss queue (on main) that is yours,
# is "open", and has no DONE line in your status file. Prints the task's full
# description from handoffs/. Exit 0 = there is a task. Exit 3 = nothing right now.
#   sh tools/next.sh        (Juan's soccer session: sh tools/next.sh S)
cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q origin main 2>/dev/null
u="$(git config user.name)"; lane="$1"
mine="board/$u.md"
git show origin/main:board/BOSS.md 2>/dev/null | grep -E '^\| [A-Z][0-9]+ \|' | while IFS='|' read -r _ id l person task status _; do
  id="$(echo $id)"; l="$(echo $l)"; person="$(echo $person)"; status="$(echo $status)"
  [ "$person" = "$u" ] || continue
  case "$status" in
    changes*) echo "FIX FIRST: $id was reviewed and needs changes before anything else."; echo "What to change: ${status#changes}"; echo "Then: commit, push, sh tools/post.sh DONE \"$id fixed: <what you changed>\""; exit 9 ;;
  esac
  [ "$status" = "open" ] || continue
  [ -n "$lane" ] && [ "$l" != "$lane" ] && continue
  [ -z "$lane" ] && [ "$u" = "cstljuan" ] && [ "$l" != "S" ] && continue
  if [ -f "$mine" ] && grep -q -E "\| DONE \|[^|]*\| $id( |,|:|$)" "$mine"; then continue; fi
  echo "NEXT TASK: $id"
  echo "Summary:$task"
  echo "----- full description -----"
  cat handoffs/*.md | awk -v id="$id" '
    $0 ~ "^## Task " id "(:| |$)" {on=1; print; next}
    on && /^## / {exit}
    on {print}'
  echo "----- end -----"
  echo "Now: sh tools/post.sh CLAIM \"$id <short name>: <files>\", do it, commit, push, sh tools/post.sh DONE \"$id ...\""
  exit 9
done
[ $? = 9 ] && exit 0
echo "NO TASK for $u right now. Run: sh tools/wait.sh"
exit 3
