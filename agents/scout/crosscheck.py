"""Cross-check Sleeper's season numbers against ESPN's public JSON for the 14 roster players.

    python3 agents/scout/crosscheck.py                      (live; rosters from js/data.js)
    python3 agents/scout/crosscheck.py --roster-file <json {team: {slot: name}}> --out <file>

Sleeper's numbers come from data/rosters/season-2026.json (written by fill_profiles.py), read as they are; this
script does not call Sleeper. ESPN is read live:

    find the player   https://site.api.espn.com/apis/common/v3/search?query=<name>&limit=10&type=player
    season totals     https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/<season>/types/2/athletes/<id>/statistics

Both addresses were read by hand first (2026-11-14). The player is the NFL match with the same position
(ESPN calls a kicker PK); an active one wins when there are several. The compared stats are below in STATS.

Rules:
  - Sleeper leaves out a stat that is zero. When the player has games in the Sleeper file, a missing stat is
    read as 0 and marked sleeper_missing. Without games it stays null.
  - When ESPN has no such category or stat for the player, the ESPN number is null and the note says so. A null
    is never a disagreement; it is listed under not_compared.
  - A disagreement is a difference of more than 5 units or more than 2 percent of the larger number.
  - Games played are put next to each player (Sleeper gp, ESPN gamesPlayed) so a timing gap can be seen.

Writes data/rosters/crosscheck-<season>.json and a log in agents/scout/runs/. It changes no profile.
"""
import argparse
import json
import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import statlines as S  # noqa: E402

SEARCH_URL = "https://site.api.espn.com/apis/common/v3/search?query={q}&limit=10&type=player"
STATS_URL = ("https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/{season}/types/2/"
             "athletes/{aid}/statistics")

# our name: (Sleeper stat, ESPN category, ESPN stat)
STATS = [
    ("pass_yards", "pass_yd", "passing", "passingYards"),
    ("pass_td", "pass_td", "passing", "passingTouchdowns"),
    ("rush_yards", "rush_yd", "rushing", "rushingYards"),
    ("rush_td", "rush_td", "rushing", "rushingTouchdowns"),
    ("receptions", "rec", "receiving", "receptions"),
    ("rec_yards", "rec_yd", "receiving", "receivingYards"),
    ("rec_td", "rec_td", "receiving", "receivingTouchdowns"),
    ("fg_made", "fgm", "kicking", "fieldGoalsMade"),
]
ESPN_POS = {"QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE", "K": "PK"}
UNITS, PCT = 5, 0.02


def _fx(name):
    return "espn_" + T._norm(name).replace(" ", "_")


def espn_find(name, position):
    """Returns (athlete id, address read, None) or (None, address read, reason)."""
    url = SEARCH_URL.format(q=urllib.parse.quote(name))
    data = T._get_json(url, _fx(name) + "_search.json")
    want = ESPN_POS[position]
    hits = [i for i in (data or {}).get("items", [])
            if i.get("league") == "nfl" and (i.get("position") or {}).get("abbreviation") == want
            and T._norm(i.get("displayName", "")) == T._norm(name)]
    active = [i for i in hits if i.get("isActive")] or hits
    T._log_call("espn_find(%s, %s) -> %d match(es)" % (name, want, len(active)))
    if len(active) == 1:
        return str(active[0]["id"]), url, None
    if not hits:
        return None, url, "no NFL %s named %s in ESPN's search" % (want, name)
    return None, url, "%d NFL %s players named %s in ESPN's search, could not pick one" % (len(active), want, name)


def espn_stats(aid):
    """Season totals: {category: {stat: value}}, and the address."""
    url = STATS_URL.format(season=T.season(), aid=aid)
    data = T._get_json(url, "espn_stats_%s.json" % aid)
    cats = {}
    for c in ((data or {}).get("splits") or {}).get("categories", []):
        cats[c.get("name")] = {s.get("name"): s.get("value") for s in c.get("stats", [])}
    T._log_call("espn_stats(%s) -> %s" % (aid, ", ".join(sorted(cats))))
    return cats, url


def differ(a, b):
    d = abs(a - b)
    return d > UNITS or (max(abs(a), abs(b)) > 0 and d / max(abs(a), abs(b)) > PCT)


def compare(sleeper_entry, cats):
    """Both numbers, the difference and whether they disagree, for every stat in STATS."""
    st = (sleeper_entry or {}).get("stats") or {}
    has_games = isinstance(st.get("gp"), (int, float)) and st.get("gp") > 0
    out = {}
    for ours, skey, cat, ekey in STATS:
        s = st.get(skey)
        missing = not isinstance(s, (int, float))
        if missing:
            s = 0.0 if has_games else None
        e = cats.get(cat, {}).get(ekey) if cat in cats else None
        row = {"sleeper": s, "espn": e, "difference": None, "disagree": False}
        if missing and s is not None:
            row["sleeper_missing"] = True
        if e is None:
            row["note"] = ("ESPN has no %s category for this player" % cat) if cat not in cats else ("ESPN gives no %s" % ekey)
        elif s is not None:
            row["difference"] = round(e - s, 3)
            row["disagree"] = differ(s, e)
        out[ours] = row
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--roster-file")
    ap.add_argument("--season-file", help="Sleeper numbers (default data/rosters/season-<season>.json)")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    log = T.start_run("crosscheck")
    T.log_step("crosscheck starts (no model, fixed order). season=%d" % T.season())
    rosters = json.load(open(a.roster_file)) if a.roster_file else S.rosters_from_js()
    season_file = a.season_file or os.path.join(T.out_dir(), "rosters", "season-%d.json" % T.season())
    sleeper = T._read(season_file, {"players": {}})
    T.log_step("plan: for each player read Sleeper's numbers from %s, find the player on ESPN, read ESPN's season "
               "totals, compare %d stats" % (os.path.relpath(season_file, T.ROOT) if season_file.startswith(T.ROOT) else season_file, len(STATS)))
    doc = {"season": T.season(), "date": T.today(),
           "rule": "a disagreement is a difference of more than %d units or more than %d percent of the larger number" % (UNITS, PCT * 100),
           "sleeper_source": "data/rosters/season-%d.json (Sleeper public API, read on %s)" % (
               T.season(), next((p.get("date") for p in sleeper["players"].values() if p.get("date")), "unknown")),
           "espn_sources": {"search": SEARCH_URL, "stats": STATS_URL.replace("{season}", str(T.season()))},
           "players": {}, "disagreements": [], "not_compared": [], "matched": [], "unmatched": []}
    for team, roster in rosters.items():
        for slot, name in roster.items():
            key = "%s.%s" % (team, slot)
            pos = S.SLOT_POS[slot]
            T.log_step("starting %s %s: find on ESPN" % (key, name))
            sp = sleeper["players"].get(key)
            entry = {"name": name, "sleeper_id": (sp or {}).get("player_id"), "sleeper_source": (sp or {}).get("source"),
                     "sleeper_date": (sp or {}).get("date"), "espn_id": None, "espn_source": None, "espn_date": None,
                     "games": {"sleeper": ((sp or {}).get("stats") or {}).get("gp"), "espn": None}, "stats": {}, "notes": ""}
            aid, surl, why = espn_find(name, pos)
            if not aid:
                entry["notes"] = "Not compared: " + why
                doc["not_compared"].append({"player": key, "name": name, "stat": None, "why": why})
                doc["unmatched"].append(key)
                doc["players"][key] = entry
                T.log_step("%s: %s" % (name, why))
                continue
            cats, url = espn_stats(aid)
            entry.update(espn_id=aid, espn_source=url, espn_date=T.today())
            entry["games"]["espn"] = cats.get("general", {}).get("gamesPlayed")
            if not sp:
                entry["notes"] = "No Sleeper numbers for this player in %s." % os.path.basename(season_file)
            entry["stats"] = compare(sp, cats)
            bad = []
            for stat, row in entry["stats"].items():
                if row["disagree"]:
                    bad.append(stat)
                    doc["disagreements"].append({"player": key, "name": name, "stat": stat, "sleeper": row["sleeper"],
                                                 "espn": row["espn"], "difference": row["difference"],
                                                 "games": entry["games"]})
                elif row["espn"] is None or row["sleeper"] is None:
                    doc["not_compared"].append({"player": key, "name": name, "stat": stat,
                                                "why": row.get("note") or "no Sleeper number"})
            (doc["unmatched"] if bad or not sp else doc["matched"]).append(key)
            doc["players"][key] = entry
            T.log_step("%s: ESPN %s, games Sleeper %s ESPN %s, %s" % (
                name, aid, entry["games"]["sleeper"], entry["games"]["espn"],
                ("disagree on " + ", ".join(bad)) if bad else "every compared stat agrees"))
    out = a.out or os.path.join(T.out_dir(), "rosters", "crosscheck-%d.json" % T.season())
    T._write(out, doc)
    T.log_step("crosscheck finished: %d of %d players agree on every compared stat, %d disagreements" % (
        len(doc["matched"]), len(doc["players"]), len(doc["disagreements"])))
    print("log:", log)
    print("wrote %s: %d of %d players agree, %d disagreements" % (out, len(doc["matched"]), len(doc["players"]), len(doc["disagreements"])))
    for d in doc["disagreements"]:
        print("  %s %s %s: Sleeper %s, ESPN %s (games %s / %s)" % (d["player"], d["name"], d["stat"], d["sleeper"], d["espn"],
                                                                 d["games"]["sleeper"], d["games"]["espn"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
