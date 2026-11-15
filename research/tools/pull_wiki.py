"""Wikipedia life stories for the 28 players, slowly (the site refuses bursts). Writes research/raw/<key>/wiki.json."""
import json, os, sys, time, urllib.parse, urllib.request
RAW = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "raw")
UA = {"User-Agent": "fantasy-recap-research/1.0 (student hackathon project; slow, cached)"}
def get(u):
    wait = 20
    for i in range(8):
        try:
            return urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60).read()
        except Exception as e:
            ra = getattr(e, "headers", None) and e.headers.get("Retry-After")
            time.sleep(int(ra) + 2 if ra and ra.isdigit() else wait); wait = min(wait * 2, 300)
    return None
ps = json.load(open(os.path.join(RAW, "roster.json")))
for p in ps:
    d = os.path.join(RAW, p["key"]); out = os.path.join(d, "wiki.json")
    if os.path.exists(out) and os.path.getsize(out) > 2000: continue
    s = get("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=" + urllib.parse.quote("%s American football %s" % (p["name"], p["position"])))
    if not s: print("no search", p["key"]); continue
    hits = json.loads(s)["query"]["search"]; time.sleep(4)
    if not hits: print("no hit", p["key"]); continue
    w = get("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=" + urllib.parse.quote(hits[0]["title"]))
    if w: open(out, "wb").write(w); print("ok", p["key"], hits[0]["title"], len(w)); sys.stdout.flush()
    time.sleep(4)
print("wiki done")
