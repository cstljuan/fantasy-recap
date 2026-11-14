"""Offline check for form.py. No network, no key, no packages.   python3 agents/scout/check_form.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "form")
tmp = tempfile.mkdtemp(prefix="form-check-")
os.environ.update(SCOUT_FIXTURES=fx, SCOUT_OUT_DIR=os.path.join(tmp, "data"),
                  SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import form as F  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


# a season profile already there: form must leave it exactly as it is
T.write_profile("GOB", "QB", {"name": "Test Quarterback", "position": "QB", "player_id": "FX1", "source": "https://example.test/season",
                              "tendencies": {"deep_ball": {"value": 0.5, "how": "season"}}, "season_stats": {}, "notes": "season note"})
before = json.load(open(os.path.join(tmp, "data", "profiles", "GOB.json")))["players"]["QB"]

check(F.pick_weeks({"1": {"gp": 1}, "2": None, "3": {"gp": 0}, "4": {}}, 4) == ([1], [2, 3, 4]), "pick_weeks skips null, empty and gp 0 weeks")
F.main(["--roster-file", os.path.join(fx, "rosters.json")])
doc = json.load(open(os.path.join(tmp, "data", "profiles", "GOB.json")))
qb = doc["players"]["QB"]
for k in ("name", "position", "tendencies", "tendency_sources", "notes"):
    check(qb[k] == before[k], "season field %s is unchanged" % k)
f = qb["form"]
check(set(f) == {"tendencies", "tendency_sources", "weeks", "skipped_weeks", "source", "date", "notes"}, "form has the agreed fields")
check(f["weeks"] == [2, 4, 5] and f["skipped_weeks"] == [3, 6], "QB uses the last three played weeks and lists the skipped ones")
check(f["tendencies"] == {"deep_ball": 0.8, "short_pass": 0.69, "scramble": 0.094}, "QB form numbers from the summed weeks")
check(all(s["weeks"] == [2, 4, 5] and s["source"] and s["date"] and s["how"] for s in f["tendency_sources"].values()),
      "every form number has source, date, how and the weeks")
check(set(f["tendencies"]) == set(T.compute_tendencies("QB", {})), "form has the same keys as the season tendencies")
rb = doc["players"]["RB"]["form"]
check(rb["weeks"] == [5, 6] and "Only 2 played weeks" in rb["notes"], "a player with fewer than three weeks gets what there is and a note")
check(rb["tendencies"] == {"run_share": 0.75, "pass_catching": 0.6, "red_zone_use": 0.2}, "RB form numbers")
check(doc["players"]["WR1"]["form"]["tendencies"]["deep_ball"] == 1.0 and doc["players"]["WR1"]["form"]["weeks"] == [4, 5, 6],
      "WR form uses weeks 4 to 6 only")
k = doc["players"]["K"]["form"]
check(k["weeks"] == [] and all(v is None for v in k["tendencies"].values()) and "No week with stats" in k["notes"],
      "a player with no week of stats has null form and says why")
p = json.load(open(os.path.join(tmp, "data", "profiles", "PYT.json")))["players"]["QB"]["form"]
check(all(v is None for v in p["tendencies"].values()) and p["notes"].startswith("Not filled"), "an unresolved player has null form and says why")
raw = json.load(open(os.path.join(tmp, "data", "rosters", "form-2026.json")))
check(raw["latest_week"] == 6 and raw["players"]["GOB.QB"]["stats"]["pass_yd"] == 960, "raw sums are saved")
logs = os.listdir(os.path.join(tmp, "runs"))
check(any(n.endswith("-form.txt") for n in logs), "a research log is written")
print("OK")
