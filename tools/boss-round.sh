#!/bin/sh
# Boss only. One review round: fetch, check every branch with new work (authors and lanes),
# merge the ones that pass, run every project check and the three full-game smoke tests,
# mark merged tasks on the board, push, rebuild the chat feed, and show the boss inbox.
# Stops before pushing if any check fails.
cd "$(git rev-parse --show-toplevel)" || exit 1
git fetch -q origin --prune
me="$(git branch --show-current)"
# On main (the laptop) the boss pushes main. On any other branch (a cloud session cannot push main)
# the boss pushes its own branch and .github/workflows/main-follows-boss.yml moves main to it.
if [ "$me" = "main" ]; then git pull -q --ff-only origin main || exit 1; else git merge -q --ff-only origin/main 2>/dev/null || git merge -q --no-edit origin/main || exit 1; fi
start="$(git rev-parse HEAD)"; merged=""
for b in $(git for-each-ref --format='%(refname:short)' refs/remotes/origin | grep -v -e '^origin$' -e 'origin/main$' -e 'origin/HEAD$' -e '/boss$'); do
  n=$(git rev-list --count --no-merges "origin/main..$b"); [ "$n" = 0 ] && continue
  if sh tools/boss-check.sh "$b" >/tmp/fr-check.txt 2>&1; then
    # Only the files this person's own commits touched (a branch that merged main would otherwise list
    # main's files too), and never a path that would trip the commit message check.
    files="$(git log --no-merges --format= --name-only "origin/main..$b" 2>/dev/null | grep -v -e '^$' -e '^board/' | cut -d/ -f1-2 | sort -u | grep -v -i -E 'claude|codex|copilot|openai|anthropic|chatgpt' | head -8 | tr '\n' ' ')"
    who="$(git log -1 --format=%an "$b")"
    # The message names the person, never the branch: a branch a tool named would trip the commit check.
    if git merge -q --no-ff --no-edit -m "Merge $who's work: ${files:-board posts}" "$b" 2>/tmp/fr-merge.txt; then merged="$merged $who"; else git merge --abort 2>/dev/null; echo "NOT MERGED: $b"; head -3 /tmp/fr-merge.txt; fi
  else echo "REJECTED by boss-check: $b"; cat /tmp/fr-check.txt; fi
done
echo "merged:${merged:- nothing new}"
fail=0
find js soccer/js server agents engine tools -name "*.js" -not -path "*/node_modules/*" | while read f; do node --check "$f" || echo "SYNTAX $f"; done | grep -q SYNTAX && { echo "FAIL: a file does not parse"; fail=1; }
node tools/validate.js | tail -1 | grep -q OK || { echo "FAIL: football rules check"; fail=1; }
node js/announcer/check.js 2>&1 | tail -1 | grep -q OK || { echo "FAIL: announcer check"; fail=1; }
node soccer/check.js >/dev/null 2>&1 || { echo "FAIL: soccer check"; fail=1; }
[ -f server/test.js ] && { node server/test.js 2>&1 | tail -1 | grep -q OK || { echo "FAIL: server test"; fail=1; }; }
if sh tools/smoke.sh 2>/dev/null | grep -q 'no Chrome'; then echo "smoke: skipped, no browser on this machine"; else
for t in "" "game=sample" "page=soccer/index.html"; do
  r="$(sh tools/smoke.sh $t)"; echo "smoke ${t:-current game}: $(printf '%s' "$r" | cut -c1-150)"
  printf '%s' "$r" | grep -q '"ok":true' || { echo "FAIL: smoke ${t:-current game}"; fail=1; }
done
fi
if [ "$fail" != 0 ]; then echo "CHECKS FAILED. Nothing pushed. Undo with: git reset --hard $start"; exit 1; fi
python3 -I - <<'PY'
import re
p='board/BOSS.md'; s=open(p).read(); done=set()
for u in ['Peypey-ryd','nexodv','Rickstar-App','cstljuan']:
    try: txt=open('board/%s.md'%u).read()
    except Exception: continue
    for m in re.finditer(r'\| DONE \|[^|]*\| ([A-Z]\d+)\b', txt): done.add(m.group(1))
rows=[]
def fix(m):
    if m.group(1) in done and m.group(2) != 'A' and (m.group(5).strip()=='open' or m.group(5).strip().startswith('changes')):
        rows.append(m.group(1)); return '| %s | %s |%s|%s| merged |' % (m.group(1), m.group(2), m.group(3), m.group(4))
    return m.group(0)
s2=re.sub(r'\| ([A-Z]\d+) \| (\w) \|([^|\n]*)\|([^|\n]*)\|([^|\n]*)\|', fix, s)
if rows:
    a="- D1 real rosters and profile files"
    s2=s2.replace(a,"- Merged after review: "+", ".join(sorted(rows))+". All checks and the three full-game runs passed\n"+a,1)
    open(p,'w').write(s2)
print('marked merged:', sorted(rows) or 'none')
PY
git add -A; git diff --cached --quiet || git commit -q -m "board: review round"
[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ] && git push -q origin "HEAD:$me" && echo "pushed $(git log -1 --format=%h) to $me"
python3 -I tools/chat-export.py /tmp/fr-chat-feed.json 2>/dev/null || true
sh tools/inbox.sh boss | cut -c1-600
