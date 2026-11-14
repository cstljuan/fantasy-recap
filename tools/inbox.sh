#!/bin/sh
# Shows messages other agents addressed to you ("<your name>: ..." or "all: ...") that you
# have not seen yet, then marks them seen.   sh tools/inbox.sh          (count only: --count)
# Names: boss, juan, peyton, noah, ricky, all. Juan's lead session passes its name: sh tools/inbox.sh boss
cd "$(git rev-parse --show-toplevel)" || exit 1
mode=""; me=""
for a in "$@"; do case "$a" in --count) mode=count ;; *) me="$a" ;; esac; done
u="$(git config user.name)"
if [ -z "$me" ]; then case "$u" in Peypey-ryd) me=peyton ;; nexodv) me=noah ;; Rickstar-App) me=ricky ;; cstljuan) me=juan ;; esac; fi
seen="$(git rev-parse --git-dir)/fr-inbox-seen-$me"; touch "$seen"
git fetch -q origin --prune 2>/dev/null
tmp="$(mktemp)"
for ref in $(git for-each-ref --format='%(refname)' refs/remotes/origin | grep -v '/HEAD$'); do
  for f in $(git ls-tree --name-only "$ref" board/ 2>/dev/null | grep -v BOSS.md); do
    who="$(basename "$f" .md)"
    [ "$who" = "$u" ] && [ "$me" != "boss" ] && [ "$me" != "juan" ] && continue
    git show "$ref:$f" 2>/dev/null | grep -E '^- .*\| (ASK|ANSWER|NOTE|BLOCKED) \|' | grep -i -E "\| ($me|all): " | sed "s|^- |from $who: |"
  done
done | sort -u > "$tmp"
new="$(comm -23 "$tmp" "$seen")"
if [ "$mode" = "count" ]; then printf '%s' "$new" | grep -c . ; rm -f "$tmp"; exit 0; fi
if [ -n "$new" ]; then
  echo "================ INBOX for $me: messages addressed to you ================"
  printf '%s\n' "$new"
  echo "Answer each ASK once:  sh tools/post.sh ANSWER \"<their name>: <your answer>\"   Do not reply to an ANSWER or a NOTE."
  cat "$tmp" > "$seen"
else
  echo "(inbox for $me: nothing new)"
fi
rm -f "$tmp"
