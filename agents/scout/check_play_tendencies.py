"""Offline check for play_tendencies.py. No network.   python3 agents/scout/check_play_tendencies.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import play_tendencies as PT  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


def play(**k):
    base = {"ev": "1", "wk": 1, "q": 1, "clk": "10:00", "dn": 1, "dist": 10, "ytg": 60, "td": False, "nullified": False, "text": "x"}
    base.update(k)
    return base


# a receiver: 10 targets in 2 games, team threw 40 times; 4 deep (2 caught), 6 short (5 caught), 3 in the red zone of the
# team's 10 red zone throws, 2 on third down of the team's 8; plus a wiped-out target and a DPI that must not count
wr_plays = ([play(role="target", kind="pass", depth="deep", dir="left", yds=30)] * 2 + [play(role="target", kind="inc", depth="deep", dir="right")] * 2
            + [play(role="target", kind="pass", depth="short", dir="middle", yds=8, ytg=15)] * 3 + [play(role="target", kind="pass", depth="short", dir="right", yds=6, dn=3)] * 2
            + [play(role="target", kind="inc", depth="short", dir="right")] + [play(role="target", kind="pass", depth="short", dir="left", nullified=True)]
            + [play(role="target", kind="inc", depth="deep", dir="left", dpi=True)])
wr_plays = [dict(p, ev="1" if i < 5 else "2") for i, p in enumerate(wr_plays)]
team = {"T": {"1": {"pass_att": 20, "rz_pass": 5, "third_pass": 4, "rush_att": 10, "gl_rush": 2, "sy_rush": 1},
              "2": {"pass_att": 20, "rz_pass": 5, "third_pass": 4, "rush_att": 10, "gl_rush": 2, "sy_rush": 1},
              "3": {"pass_att": 50, "rz_pass": 9, "third_pass": 9}}}
r = PT.compute({"position": "WR", "nfl_team": "T", "plays": wr_plays, "box": {}}, team, "test", "2026-11-14")
v = {k: x[0] for k, x in r.items()}
check(v["target_share"] == 0.25 and r["target_share"][1]["of"] == 40, "target share: 10 of the team's 40 throws, in his games only (game 3 left out)")
check(v["deep_target_share"] == 0.4 and v["catch_rate_short"] == round(5 / 6, 3), "depth share and short catch rate (the DPI and the wiped-out target left out)")
check(v["catch_rate_deep"] is None and r["catch_rate_deep"][1]["of"] == 4, "4 deep targets are too few for a deep catch rate")
check(v["red_zone_target_share"] == 0.3 and v["third_down_target_share"] == 0.25, "red zone and third down shares of the team's")
check(v["left_share"] == 0.2 and v["middle_share"] == 0.3 and v["right_share"] == 0.5, "directions")
check(r["target_share"][1]["games"] == ["1", "2"] and r["target_share"][1]["n"] == 10, "every number says how many plays and which games")

# a back with 4 carries: too few for a share, which stays null and says why
rb = PT.compute({"position": "RB", "nfl_team": "T", "plays": [play(role="rusher", kind="run", gap="left end", yds=12)] * 4, "box": {}}, team, "t", "d")
check(rb["explosive_run_rate"][0] is None and "fewer than 5" in rb["explosive_run_rate"][1]["how"], "fewer than 5 plays: null, with the reason")

# a quarterback: third down conversions and sacks
qb_plays = ([play(role="passer", kind="pass", depth="short", dir="left", yds=12, dn=3, dist=8)] * 3 + [play(role="passer", kind="inc", depth="deep", dir="right", dn=3, dist=8)] * 2
            + [play(role="passer", kind="sack", yds=-7)] + [play(role="rusher", kind="scramble", yds=9, dn=3, dist=5)])
q = {k: x[0] for k, x in PT.compute({"position": "QB", "nfl_team": "T", "plays": qb_plays, "box": {}}, team, "t", "d").items()}
check(q["third_down_conversion"] == round(4 / 6, 3) and q["sack_rate"] == round(1 / 6, 3) and q["deep_share"] == 0.4, "quarterback: third down, sacks, depth")

# a kicker
k = {k: x[0] for k, x in PT.compute({"position": "K", "nfl_team": "T", "box": {}, "plays": [play(role="kicker", kind="fg", dist_fg=52, good=g) for g in (True, True, False, True, False)]
                                     + [play(role="kicker", kind="fg", dist_fg=30, good=True)] * 5}, team, "t", "d").items()}
check(k["make_rate_50_plus"] == 0.6 and k["make_rate_0_39"] == 1.0 and k["make_rate_40_49"] is None and k["long_attempt_share"] == 0.5, "kicker by distance band")

# main: writes the profile, fills target_share, leaves everything else alone
tmp = tempfile.mkdtemp(prefix="pt-check-")
os.makedirs(os.path.join(tmp, "profiles"))
prof = {"team": "ZZZ", "players": {"WR1": {"name": "Test Receiver", "position": "WR", "tendencies": {"deep_ball": 0.5},
                                           "tendency_sources": {"deep_ball": {"source": "s", "date": "d", "how": "h"}}, "notes": "keep me"}}}
json.dump(prof, open(os.path.join(tmp, "profiles", "ZZZ.json"), "w"))
json.dump({"date": "2026-11-14", "team_games": team, "players": {"ZZZ.WR1": {"name": "Test Receiver", "position": "WR", "nfl_team": "T", "plays": wr_plays, "box": {}}}},
          open(os.path.join(tmp, "plays.json"), "w"))
PT.main(["--plays", os.path.join(tmp, "plays.json"), "--profiles", os.path.join(tmp, "profiles")])
p = json.load(open(os.path.join(tmp, "profiles", "ZZZ.json")))["players"]["WR1"]
check(p["tendencies"] == {"deep_ball": 0.5, "target_share": 0.25} and p["notes"] == "keep me", "season numbers kept, target_share filled from the plays")
check(p["play_tendencies"]["target_share"] == 0.25 and p["play_tendency_sources"]["target_share"]["date"] == "2026-11-14", "play tendencies written with sources")
print("OK")
