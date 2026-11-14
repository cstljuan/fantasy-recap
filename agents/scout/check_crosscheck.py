"""Offline check for crosscheck.py. No network, no key, no packages.   python3 agents/scout/check_crosscheck.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "espn")
tmp = tempfile.mkdtemp(prefix="crosscheck-check-")
os.environ.update(SCOUT_FIXTURES=fx, SCOUT_OUT_DIR=os.path.join(tmp, "data"),
                  SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")
sys.path.insert(0, HERE)
import crosscheck as C  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


check(C.differ(1000, 1006) and not C.differ(1000, 1005), "more than 5 units disagrees, exactly 5 of 1000 does not")
check(C.differ(20, 21) and not C.differ(2000, 2003), "more than 2 percent disagrees, under 2 percent and 5 units does not")
out = os.path.join(tmp, "cross.json")
C.main(["--roster-file", os.path.join(fx, "rosters.json"), "--season-file", os.path.join(fx, "season.json"), "--out", out])
d = json.load(open(out))
qb = d["players"]["GOB.QB"]
check(qb["espn_id"] == "901", "the NFL player with the same name and position is picked, not college or a longer name")
check(qb["espn_source"].startswith("https://sports.core.api.espn.com/") and qb["espn_date"], "the ESPN address and date are kept")
check(qb["stats"]["pass_yards"] == {"sleeper": 2000, "espn": 2003.0, "difference": 3.0, "disagree": False}, "a small gap is not a disagreement")
dis = sorted((x["player"], x["stat"]) for x in d["disagreements"])
check(dis == [("GOB.QB", "pass_td"), ("GOB.QB", "rush_yards")], "exactly the two planted disagreements are listed")
wr = d["players"]["GOB.WR1"]["stats"]["rush_td"]
check(wr["sleeper"] == 0 and wr.get("sleeper_missing") and not wr["disagree"], "a stat Sleeper leaves out is read as 0 and marked")
k = d["players"]["GOB.K"]["stats"]["fg_made"]
check(k["espn"] is None and "no kicking" in k["note"] and not k["disagree"], "a stat ESPN does not give is null with a note")
check(any(n["player"] == "GOB.K" and n["stat"] == "fg_made" for n in d["not_compared"]), "and it is listed under not_compared")
check(d["players"]["PYT.QB"]["espn_id"] is None and "PYT.QB" in d["unmatched"], "a player not found on ESPN is not compared")
check(sorted(d["matched"]) == ["GOB.K", "GOB.WR1"] and sorted(d["unmatched"]) == ["GOB.QB", "PYT.QB"], "matched and unmatched lists")
check(d["players"]["GOB.QB"]["games"] == {"sleeper": 8, "espn": 8.0}, "games played from both sides")
check(not os.path.exists(os.path.join(tmp, "data", "profiles")), "no profile is written")
check(any(n.endswith("-crosscheck.txt") for n in os.listdir(os.path.join(tmp, "runs"))), "a research log is written")
print("OK")
