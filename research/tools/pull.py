"""Deep research pull: every public data point we can reach for the 28 roster players.

Plain Python, no packages. Everything lands in research/raw/ (not committed: it is a cache).
    python3 research/tools/pull.py            pull what is missing
    python3 research/tools/pull.py --fresh    pull the fast-moving sources again (news, injuries, lines, this season)

Sources (all public, no key): Sleeper (bio, weekly stats, weekly projections), ESPN (bio, career, game logs,
splits, news, injuries, schedule, betting lines), nflverse (weekly stats for every player since 2016, snap
counts, advanced stats, injuries, combine, schedule), Wikipedia (life story), Google News (recent headlines),
EA (Madden ratings).
"""
import concurrent.futures as cf
import gzip
import hashlib
import json
import os
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "research", "raw")
SEASON = 2026
FRESH = "--fresh" in sys.argv
UA = {"User-Agent": "Mozilla/5.0 (research-client)"}
TEAMS = ["GOB", "PYT", "TUR", "OWL"]


def fetch(url, name, fresh=False, binary=False, tries=3):
    """Gets url into raw/<name>. Returns the path, or None if the source said no."""
    path = os.path.join(RAW, name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path) and os.path.getsize(path) > 0 and not fresh:
        return path
    miss = path + ".missing"
    if os.path.exists(miss) and not fresh:
        return None
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as r:
                data = r.read()
            if url.endswith(".gz"):
                data = gzip.decompress(data)
            with open(path, "wb") as f:
                f.write(data)
            return path
        except Exception as e:  # noqa
            last = e
            code = getattr(e, "code", None)
            if code in (400, 404):
                break
            time.sleep(1.5 * (i + 1))
    with open(miss, "w") as f:
        f.write("%s\n%s\n" % (url, last))
    return None


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def roster():
    """The 28 players with their ids, from the files Ricky's lane already keeps."""
    cc = load(os.path.join(ROOT, "data", "rosters", "crosscheck-2026.json"))["players"]
    cc = list(cc.values()) if isinstance(cc, dict) else cc
    by_name = {c["name"]: c for c in cc}
    out = []
    for t in TEAMS:
        prof = load(os.path.join(ROOT, "data", "profiles", t + ".json"))
        for slot, p in prof["players"].items():
            c = by_name[p["name"]]
            out.append({"key": "%s-%s" % (t, slot), "team": t, "slot": slot, "name": p["name"],
                        "position": p["position"], "sleeper_id": str(c["sleeper_id"]), "espn_id": str(c["espn_id"])})
    return out


def pull_player(p):
    k, sid, eid = p["key"], p["sleeper_id"], p["espn_id"]
    got = {}
    web = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/%s" % eid
    core = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes/%s" % eid
    got["core"] = fetch(core, "%s/espn-core.json" % k)
    got["athlete"] = fetch(web, "%s/espn-athlete.json" % k, FRESH)
    got["bio"] = fetch(web + "/bio", "%s/espn-bio.json" % k)
    got["stats"] = fetch(web + "/stats", "%s/espn-stats.json" % k, FRESH)
    got["overview"] = fetch(web + "/overview", "%s/espn-overview.json" % k, FRESH)
    got["news"] = fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?athlete=%s&limit=50" % eid,
                        "%s/espn-news.json" % k, FRESH)
    debut = 2016
    if got["core"]:
        c = load(got["core"])
        debut = int(c.get("debutYear") or (c.get("draft") or {}).get("year") or 2016)
        for label in ("college", "contracts", "team"):
            ref = (c.get(label) or {}).get("$ref")
            if ref:
                fetch(ref.replace("http://", "https://"), "%s/espn-%s.json" % (k, label))
    for y in range(debut, SEASON + 1):
        fr = FRESH and y == SEASON
        fetch(web + "/gamelog?season=%d" % y, "%s/espn-gamelog-%d.json" % (k, y), fr)
        fetch(web + "/splits?season=%d" % y, "%s/espn-splits-%d.json" % (k, y), fr)
        fetch("https://api.sleeper.com/stats/nfl/player/%s?season_type=regular&season=%d&grouping=week" % (sid, y),
              "%s/sleeper-weeks-%d.json" % (k, y), fr)
        fetch("https://api.sleeper.com/stats/nfl/player/%s?season_type=post&season=%d&grouping=week" % (sid, y),
              "%s/sleeper-post-%d.json" % (k, y), fr)
    for y in (SEASON - 1, SEASON):
        fetch("https://api.sleeper.com/projections/nfl/player/%s?season_type=regular&season=%d&grouping=week" % (sid, y),
              "%s/sleeper-proj-%d.json" % (k, y), FRESH and y == SEASON)
    q = urllib.parse.quote('"%s" NFL when:21d' % p["name"])
    fetch("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en" % q, "%s/gnews.xml" % k, FRESH)
    q2 = urllib.parse.quote('"%s" interview OR "press conference" OR said when:30d' % p["name"])
    fetch("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en" % q2, "%s/gnews-quotes.xml" % k, FRESH)
    q3 = urllib.parse.quote('"%s" family OR wife OR girlfriend OR father OR mother OR brother OR baby' % p["name"])
    fetch("https://news.google.com/rss/search?q=%s&hl=en-US&gl=US&ceid=US:en" % q3, "%s/gnews-family.xml" % k, FRESH)
    fetch("https://drop-api.ea.com/rating/madden-nfl?locale=en&limit=10&search=%s" % urllib.parse.quote(p["name"]),
          "%s/madden.json" % k)
    # Wikipedia: find the page, then the full plain text
    s = fetch("https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=%s"
              % urllib.parse.quote('%s American football %s' % (p["name"], p["position"])), "%s/wiki-search.json" % k)
    if s:
        hits = load(s).get("query", {}).get("search", [])
        if hits:
            title = hits[0]["title"]
            fetch("https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&redirects=1&titles=%s"
                  % urllib.parse.quote(title), "%s/wiki.json" % k)
    return k


def pull_league():
    nv = "https://github.com/nflverse/nflverse-data/releases/download/"
    jobs = []
    for y in range(2016, SEASON + 1):
        jobs.append((nv + "stats_player/stats_player_week_%d.csv" % y, "nflverse/stats_player_week_%d.csv" % y, FRESH and y == SEASON))
    for y in (SEASON - 2, SEASON - 1, SEASON):
        fr = FRESH and y == SEASON
        jobs += [
            (nv + "snap_counts/snap_counts_%d.csv" % y, "nflverse/snap_counts_%d.csv" % y, fr),
            (nv + "pfr_advstats/advstats_week_rec_%d.csv" % y, "nflverse/adv_rec_%d.csv" % y, fr),
            (nv + "pfr_advstats/advstats_week_rush_%d.csv" % y, "nflverse/adv_rush_%d.csv" % y, fr),
            (nv + "pfr_advstats/advstats_week_pass_%d.csv" % y, "nflverse/adv_pass_%d.csv" % y, fr),
            (nv + "injuries/injuries_%d.csv" % y, "nflverse/injuries_%d.csv" % y, fr),
            (nv + "stats_team/stats_team_week_%d.csv" % y, "nflverse/stats_team_week_%d.csv" % y, fr),
            (nv + "depth_charts/depth_charts_%d.csv" % y, "nflverse/depth_charts_%d.csv" % y, fr),
            (nv + "ftn_charting/ftn_charting_%d.csv" % y, "nflverse/ftn_charting_%d.csv" % y, fr),
        ]
    for kind in ("passing", "receiving", "rushing"):
        jobs.append((nv + "nextgen_stats/ngs_%s.csv.gz" % kind, "nflverse/ngs_%s.csv" % kind, FRESH))
    jobs += [
        (nv + "combine/combine.csv", "nflverse/combine.csv", False),
        (nv + "players/players.csv", "nflverse/players.csv", False),
        (nv + "draft_picks/draft_picks.csv", "nflverse/draft_picks.csv", False),
        (nv + "contracts/historical_contracts.csv.gz", "nflverse/contracts.csv", False),
        ("https://github.com/nflverse/nfldata/raw/master/data/games.csv", "nflverse/games.csv", FRESH),
        ("https://api.sleeper.app/v1/players/nfl", "sleeper-players.json", FRESH),
        ("https://api.sleeper.app/v1/state/nfl", "sleeper-state.json", True),
        ("https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries", "espn-injuries.json", FRESH),
    ]
    for w in range(1, 19):
        jobs.append(("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=%d&dates=%d" % (w, SEASON),
                     "espn-scoreboard-w%02d.json" % w, FRESH and w >= 9))
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(lambda j: (j[1], fetch(j[0], j[1], j[2])), jobs))
    return res


def main():
    os.makedirs(RAW, exist_ok=True)
    ps = roster()
    with open(os.path.join(RAW, "roster.json"), "w") as f:
        json.dump(ps, f, indent=1)
    t = time.time()
    league = pull_league()
    miss = [n for n, p in league if not p]
    print("league files: %d ok, %d missing %s" % (len(league) - len(miss), len(miss), miss))
    with cf.ThreadPoolExecutor(6) as ex:
        for k in ex.map(pull_player, ps):
            pass
    n = sum(len(fs) for _, _, fs in os.walk(RAW))
    size = sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(RAW) for f in fs)
    missing = [os.path.relpath(os.path.join(d, f), RAW) for d, _, fs in os.walk(RAW) for f in fs if f.endswith(".missing")]
    print("%d files, %.1f MB, %d sources said no, %.0f seconds" % (n, size / 1e6, len(missing), time.time() - t))
    for m in sorted(missing):
        print("  no answer:", m[:-8])


if __name__ == "__main__":
    main()
