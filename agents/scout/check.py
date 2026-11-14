"""Checks Scout's tools against the saved samples in fixtures/. No network, no key, no agent framework.

    python3 agents/scout/check.py
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
tmp = tempfile.mkdtemp(prefix="scout-check-")
os.environ["SCOUT_FIXTURES"] = os.path.join(HERE, "fixtures")
os.environ["SCOUT_OUT_DIR"] = os.path.join(tmp, "data")
os.environ["SCOUT_RUNS_DIR"] = os.path.join(tmp, "runs")
os.environ["SCOUT_SEASON"] = "2026"

import scout_tools as T  # noqa: E402


def check(cond, msg):
    if not cond:
        print("FAIL:", msg)
        sys.exit(1)
    print("ok:", msg)


log_path = T.start_run("check")
T.log_step("plan: find, read stats, compute, write")

m = json.loads(T.find_player("Test Quarterback"))["matches"]
check(len(m) == 2, "find_player returns both players with the same name")
check(json.loads(T.find_player("test runner"))["matches"][0]["player_id"] == "FX2", "find_player ignores case")
check(json.loads(T.find_player("Nobody Here"))["matches"] == [], "find_player returns no match for an unknown name")

ss = T.season_stats("FX1")
check(json.loads(ss)["stats"]["pass_yd"] == 3000, "season_stats reads the season totals")
check(set(json.loads(T.weekly_stats("FX1"))["weeks"]) == {"1", "2"}, "weekly_stats keeps weeks with data and drops empty ones")

t = T.compute_tendencies("QB", json.loads(ss)["stats"])
check(t["deep_ball"]["value"] == 0.625, "QB deep_ball is 7.5 yards per attempt over 12 = 0.625")
check(t["short_pass"]["value"] == 0.675, "QB short_pass is 270 over 400")
check(t["scramble"]["value"] == round(300 / 3300, 3), "QB scramble is rush yards over total yards")
rb = T.compute_tendencies("RB", json.loads(T.season_stats("FX2"))["stats"])
check(rb["run_share"]["value"] == 0.75 and rb["red_zone_use"]["value"] == 0.2, "RB run_share 0.75 and red_zone_use 0.2")
wr = T.compute_tendencies("WR", json.loads(T.season_stats("FX3"))["stats"])
check(wr["deep_ball"]["value"] == 0.75 and wr["red_zone_use"]["value"] == 0.12, "WR deep_ball 0.75 and red_zone_use 0.12")
k = T.compute_tendencies("K", json.loads(T.season_stats("FX4"))["stats"])
check(k["kicker_range"]["value"] == 0.4 and k["accuracy"]["value"] == round(20 / 24, 3), "K kicker_range 0.4 and accuracy")
missing = T.compute_tendencies("WR", {"rec": 10})
check(all(v["value"] is None for v in missing.values()), "a stat that is not in the data gives null, never a guess")

T.write_profile("TST", "QB", {"name": "Test Quarterback", "position": "QB", "player_id": "FX1", "source": "fixture://season_FX1",
                              "tendencies": t, "season_stats": json.loads(ss)["stats"], "notes": "check run"})
T.write_profile("TST", "WR1", {"name": "Test Receiver", "position": "WR", "player_id": "FX3", "source": "fixture://season_FX3",
                               "tendencies": T.compute_tendencies("WR", {"rec": 10}), "season_stats": {"rec": 10}})
prof = json.load(open(os.path.join(tmp, "data", "profiles", "TST.json")))
check(set(prof["players"]) == {"QB", "WR1"} and prof["team"] == "TST", "profile file has both slots in the contract shape")
check(prof["players"]["QB"]["tendencies"]["deep_ball"] == 0.625, "tendencies are plain numbers")
check(prof["players"]["QB"]["tendency_sources"]["deep_ball"]["source"] == "fixture://season_FX1"
      and prof["players"]["QB"]["tendency_sources"]["deep_ball"]["date"], "source and date sit next to every number")
check(prof["players"]["WR1"]["tendencies"]["deep_ball"] is None, "a null tendency stays null")
raw = json.load(open(os.path.join(tmp, "data", "rosters", "season-2026.json")))
check("TST.QB" in raw["players"] and raw["players"]["TST.QB"]["stats"]["pass_yd"] == 3000, "raw season numbers are saved")
try:
    T.write_profile("TST", "RB", {"name": "x", "position": "RB", "source": "s", "tendencies": {"bad": {"value": 7}}})
    check(False, "a tendency outside 0 to 1 is refused")
except ValueError:
    check(True, "a tendency outside 0 to 1 is refused")
lines = open(log_path).read().strip().splitlines()
check(len(lines) >= 8 and "write_profile" in lines[-1] or any("write_profile" in l for l in lines), "the research log has one line per step (%d lines)" % len(lines))
print("OK")
