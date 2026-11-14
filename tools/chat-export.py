#!/usr/bin/env python3
"""Boss only. Prints the board posts that have not been sent to the live chat page yet,
as one JSON document for the live chat page.
    python3 tools/chat-export.py [output file]
"""
import subprocess, json, hashlib, re, sys, os, datetime
def sh(*a):
    return subprocess.run(a, capture_output=True, text=True).stdout
top = sh('git', 'rev-parse', '--show-toplevel').strip()
state_file = os.path.join(sh('git', 'rev-parse', '--git-common-dir').strip(), 'fr-chat-sent.json')
if not os.path.isabs(state_file): state_file = os.path.join(top, state_file)
sent = set(json.load(open(state_file))) if os.path.exists(state_file) else set()
WHO = {'Peypey-ryd': 'peyton', 'nexodv': 'noah', 'Rickstar-App': 'ricky', 'cstljuan': 'juan'}
sh('git', 'fetch', '-q', 'origin', '--prune')
refs = [r for r in sh('git', 'for-each-ref', '--format=%(refname)', 'refs/remotes/origin').split() if not r.endswith('/HEAD')]
out = {}
for user, who in WHO.items():
    lines = {}
    for ref in refs:
        txt = sh('git', 'show', f'{ref}:board/{user}.md')
        for l in txt.splitlines():
            m = re.match(r'- (\d\d)-(\d\d) (\d\d):(\d\d) UTC \| (\w+) \| ([^|]*) \| (.*)$', l)
            if m: lines[l] = m
    for i, (l, m) in enumerate(sorted(lines.items(), key=lambda kv: kv[0])):
        mo, d, h, mi, st, br, text = m.groups()
        ts = int(datetime.datetime(2026, int(mo), int(d), int(h), int(mi), tzinfo=datetime.timezone.utc).timestamp() * 1000) + i
        did = hashlib.sha1(('%s|%s' % (user, l)).encode()).hexdigest()[:16]
        out[did] = {'ts': ts, 'who': who, 'state': st, 'branch': br.strip(), 'text': text.strip()[:900]}
# boss lines: answers, notes, merged, decisions, with the time of the commit that added them
blame = sh('git', 'blame', '--line-porcelain', 'origin/main', '--', 'board/BOSS.md')
t = 0; n = 0
for l in blame.splitlines():
    if l.startswith('committer-time '): t = int(l.split()[1])
    elif l.startswith('\t- '):
        text = l[3:].strip(); n += 1
        st = 'ANSWER' if text.startswith('ANSWER') else 'NOTE' if text.startswith('NOTE') else 'MERGED' if ' on main' in text[:140] else 'DECISION'
        text = re.sub(r'^(ANSWER|NOTE) ', '', text)
        did = hashlib.sha1(('boss|' + text).encode()).hexdigest()[:16]
        out[did] = {'ts': t * 1000 + n, 'who': 'boss', 'state': st, 'branch': '', 'text': text[:900]}
# One document holds the whole feed. Write it to a file the boss uploads in one call.
posts = [dict(v, id=k) for k, v in sorted(out.items(), key=lambda kv: kv[1]['ts'])]
dest = sys.argv[1] if len(sys.argv) > 1 else '/tmp/fr-chat-feed.json'
json.dump({'posts': posts, 'updated': int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)}, open(dest, 'w'))
new = [k for k in out if k not in sent]
json.dump(sorted(set(out)), open(state_file, 'w'))
print('feed file:', dest, '| posts:', len(posts), '| new since last export:', len(new))
