"""Offline check for fill_soccer.py. No network, no key, no packages.   python3 agents/scout/check_soccer.py"""
import json
import os
import shutil
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "soccer")
tmp = tempfile.mkdtemp(prefix="soccer-check-")
os.environ.update(SCOUT_FIXTURES=fx, SCOUT_OUT_DIR=os.path.join(tmp, "data"), SCOUT_RUNS_DIR=os.path.join(tmp, "runs"))
os.makedirs(os.path.join(tmp, "data", "rosters"))
for t in ("IRN", "RHB"):
    shutil.copy(os.path.join(fx, "rosters_%s.json" % t), os.path.join(tmp, "data", "rosters", "%s.json" % t))
sys.path.insert(0, HERE)
import fill_soccer as F  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


F.main(["--before", "2026-11-14", "--season", "2026"])
irn = json.load(open(os.path.join(tmp, "data", "profiles", "IRN.json")))["players"]
rhb = json.load(open(os.path.join(tmp, "data", "profiles", "RHB.json")))["players"]
check(irn["GK"]["tendencies"] == {"save_rate": 0.8, "pen_save_rate": None}, "keeper: saves over shots faced, no penalties faced is null")
check(rhb["GK"]["tendencies"]["save_rate"] == 0.6 and "plus goals conceded" in rhb["GK"]["tendency_sources"]["save_rate"]["how"],
      "keeper without shots faced: saves over saves plus goals conceded, and the formula says so")
check(irn["ST"]["tendencies"] == {"shot_share": 0.6, "shot_conversion": 0.2, "assist_share": 0.2, "header_share": 0.5}, "forward numbers")
check(rhb["CM2"]["tendencies"] == {"pass_share": 0.9, "shot_share": 0.2, "assist_share": 0.1}, "midfielder numbers")
check(rhb["CM2"]["espn_id"] == "812" and "2 ESPN players" in rhb["CM2"]["notes"], "two matches: the first in ESPN's order, and the note says so")
src = irn["ST"]["tendency_sources"]["shot_share"]
check(src["source"].startswith("https://sports.core.api.espn.com/v2/sports/soccer/leagues/tst.1/seasons/2026/") and src["date"] and src["how"],
      "every number has the address, the date and the formula")
check(all(v is None for v in irn["CB1"]["tendencies"].values()) and "only has season 2020" in irn["CB1"]["notes"],
      "a player with no current season on ESPN stays null and says why")
check(all(v is None for v in rhb["LW"]["tendencies"].values()) and "no soccer player named" in rhb["LW"]["notes"], "a player not on ESPN stays null")
check(irn["ST"]["club"] == "Test City" and irn["ST"]["league"] == "tst.1", "club and league are kept")
lines = json.load(open(os.path.join(tmp, "data", "statlines", "soccer-real-2026-11-08.json")))
check(lines["invented"] is False and lines["round"] == {"from": "2026-11-05", "to": "2026-11-08"}, "the round is the last 4 days up to the latest match")
P0, P1 = lines["teams"][0]["players"], lines["teams"][1]["players"]
check(P0["ST"] == {"goals": 1, "sot": 2, "yellow": 1} and P0["GK"] == {"saves": 3} and P1["GK"] == {"saves": 1}, "lines from the matches in the round")
check(P1["CM2"] == {} and any(d["name"] == "Test Mid" and d["last_league_match"] == "2026-10-20" for d in lines["did_not_play"]),
      "a player with no match in the round has an empty line and is listed")
check(set(P0) == {"GK", "CB1", "ST"} and set(P1) == {"GK", "CM2", "LW"}, "every roster slot has a line")
check(lines["matches"]["IRN.ST"]["event_id"] == "e2" and lines["matches"]["IRN.ST"]["source"], "the match and the address are next to each line")
check(lines["match_maker_rules"] == ["team 0 keeper: 3 saves, but the other team had 0 saved shots"], "the broken match maker rule is listed, nothing is changed")
check(F.rules_broken([{"players": {"GK": {"saves": 1}, "ST": {"goals": 1, "sot": 1}}}, {"players": {"GK": {}, "ST": {"sot": 1}}}]) == [],
      "lines that fit break no rule")
raw = json.load(open(os.path.join(tmp, "data", "rosters", "soccer-season-2026.json")))
check(raw["players"]["IRN.ST"]["stats"]["offensive.totalShots"] == 30, "raw season numbers are saved")
check(any(n.endswith("-fill-soccer.txt") for n in os.listdir(os.path.join(tmp, "runs"))), "a research log is written")
print("OK")
