"""A real week of stat lines for the 14 roster players, from the same public source as Scout.

    python3 agents/scout/statlines.py --week 11            (writes data/statlines/week11-real.json)
    python3 agents/scout/statlines.py --week 11 --out some.json --roster-file rosters.json

The output has the shape of data/statlines/week11.json: teams -> players -> slot -> {name, line}, plus a
defense entry. Extra top-level fields say where the numbers came from. It needs no packages and no key.
It needs network access to api.sleeper.app and api.sleeper.com, or SCOUT_FIXTURES for the offline check.
"""
import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402

FIELDS = ["pass_yards", "pass_td", "interceptions", "rush_yards", "rush_td", "receptions", "rec_yards", "rec_td",
          "fg_made", "fg_missed", "xp_made"]
DEFENSE_FIELDS = ["sacks", "def_interceptions", "fumble_recoveries", "def_td", "points_allowed"]
SLOT_POS = {"QB": "QB", "RB": "RB", "WR1": "WR", "WR2": "WR", "WR3": "WR", "TE": "TE", "K": "K"}


def rosters_from_js():
    code = "var d=require('./js/data.js');console.log(JSON.stringify(d.TEAMS.map(function(t){return {id:t.id,roster:t.roster}})))"
    return {t["id"]: t["roster"] for t in json.loads(subprocess.check_output(["node", "-e", code], cwd=T.ROOT))}


def rosters_from_files(paths):
    """{team: {slot: name}} from roster files in data/rosters/ (each has "team" and "roster")."""
    out = {}
    for p in paths:
        with open(p, "r", encoding="utf-8") as f:
            d = json.load(f)
        out[d["team"]] = d["roster"]
    return out


def line_from(stats):
    """Sleeper stat names to our eleven fields. A stat the source does not list for a player who played is 0."""
    g = lambda k: int(stats.get(k, 0) or 0)
    fg_missed = int(stats["fgmiss"]) if "fgmiss" in stats else max(0, g("fga") - g("fgm"))
    return {"pass_yards": g("pass_yd"), "pass_td": g("pass_td"), "interceptions": g("pass_int"),
            "rush_yards": g("rush_yd"), "rush_td": g("rush_td"), "receptions": g("rec"), "rec_yards": g("rec_yd"),
            "rec_td": g("rec_td"), "fg_made": g("fgm"), "fg_missed": fg_missed, "xp_made": g("xpm")}


def resolve(name, position):
    """Returns (player_id, None) or (None, reason)."""
    matches = json.loads(T.find_player(name))["matches"]
    ok = [m for m in matches if m["position"] == position]
    active = [m for m in ok if m.get("status") == "Active"] or ok
    if len(active) == 1:
        return active[0]["player_id"], None
    if not matches:
        return None, "no player with this name in the source"
    return None, "%d matches for position %s, could not pick one" % (len(active), position)


def build(week, rosters):
    out = {"invented": False,
           "note": "Real weekly numbers read from Sleeper's public stats API. Defense is not read: those fields are null.",
           "week": week, "season": T.season(), "source": T.WEEKLY_URL.replace("{pid}", "<player_id>").replace("{season}", str(T.season())),
           "date": T.today(), "unresolved": [], "teams": {}}
    for team, roster in rosters.items():
        players = {}
        for slot, name in roster.items():
            pid, why = resolve(name, SLOT_POS[slot])
            line = None
            if pid:
                weeks = json.loads(T.weekly_stats(pid))["weeks"]
                if str(week) in weeks:
                    line = line_from(weeks[str(week)])
                else:
                    why = "no stats listed for week %d (bye, injured or did not play)" % week
            if line is None:
                out["unresolved"].append({"team": team, "slot": slot, "name": name, "reason": why})
                line = {k: None for k in FIELDS}
            players[slot] = {"name": name, "line": line}
        out["teams"][team] = {"players": players,
                              "defense": {"name": team + " defense", "line": {k: None for k in DEFENSE_FIELDS}}}
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--week", type=int, required=True)
    ap.add_argument("--out")
    ap.add_argument("--roster-file", help="JSON {team: {slot: name}} instead of js/data.js")
    a = ap.parse_args(argv)
    rosters = json.load(open(a.roster_file)) if a.roster_file else rosters_from_js()
    doc = build(a.week, rosters)
    path = a.out or os.path.join(T.out_dir(), "statlines", "week%02d-real.json" % a.week)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("wrote %s, %d players unresolved" % (path, len(doc["unresolved"])))
    for u in doc["unresolved"]:
        print("  %s %s %s: %s" % (u["team"], u["slot"], u["name"], u["reason"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
