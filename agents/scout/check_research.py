"""Offline check for research.py (Scout's research tools and reports). No network, no model.
    python3 agents/scout/check_research.py"""
import json
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp(prefix="research-check-")
plays_file = os.path.join(tmp, "plays.json")
os.environ.update(SCOUT_PLAYS_FILE=plays_file, SCOUT_OUT_DIR=os.path.join(tmp, "data"), SCOUT_RUNS_DIR=os.path.join(tmp, "runs"))


def P(**k):
    base = {"ev": "1", "wk": 1, "q": 1, "clk": "10:00", "dn": 1, "dist": 10, "ytg": 60, "td": False, "nullified": False, "role": "target", "text": "a play"}
    base.update(k)
    return base


# a receiver over 4 weeks: right side works (6 of 8 succeed), left does not (1 of 8); third down 5 plays, 3 converted;
# two touchdowns inside the 20; a wiped-out 80-yard catch that must never count
plays = []
for i in range(8):
    plays.append(P(ev=str(1 + i % 4), wk=1 + i % 4, kind="pass", depth="short", dir="right", yds=8 if i < 6 else 1, dn=1, dist=10, text="right %d" % i))
for i in range(8):
    plays.append(P(ev=str(1 + i % 4), wk=1 + i % 4, kind="pass" if i == 0 else "inc", depth="short", dir="left", yds=7 if i == 0 else 0, dn=2, dist=10, text="left %d" % i))
for i in range(5):
    plays.append(P(ev="4", wk=4, kind="pass", depth="deep", dir="middle", yds=12 if i < 3 else 2, dn=3, dist=6, text="third %d" % i))
plays += [P(ev="2", wk=2, kind="pass", depth="short", dir="middle", yds=9, ytg=9, td=True, text="TD one"),
          P(ev="3", wk=3, kind="pass", depth="short", dir="middle", yds=4, ytg=4, td=True, text="TD two"),
          P(ev="3", wk=3, kind="pass", depth="deep", dir="left", yds=80, nullified=True, text="wiped out")]
data = {"date": "2026-11-14", "sources": {"summary": "https://example.test/summary?event={event}"},
        "games": {str(e): {"week": e, "home": "AAA", "away": "BBB", "source": "https://example.test/summary?event=%d" % e} for e in range(1, 5)},
        "team_games": {"AAA": {"1": {"pass_att": 30}}},
        "players": {"ZZZ.WR1": {"name": "Test Receiver", "position": "WR", "nfl_team": "AAA", "games": ["1", "2", "3", "4"], "plays": plays, "box": {}}}}
json.dump(data, open(plays_file, "w"))
sys.path.insert(0, HERE)
import research as R  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


check(R.success({"kind": "pass", "yds": 4, "dn": 1, "dist": 10}) and not R.success({"kind": "pass", "yds": 3, "dn": 1, "dist": 10})
      and R.success({"kind": "run", "yds": 6, "dn": 2, "dist": 10}) and not R.success({"kind": "run", "yds": 5, "dn": 3, "dist": 6})
      and R.success({"kind": "run", "yds": 1, "dn": 3, "dist": 6, "td": True}), "success: 40, 60 and 100 percent of the distance, or a touchdown")
plan = json.loads(R.research_plan("Test Receiver"))
check([s["split"] for s in plan["steps"]] == ["depth", "direction", "down", "zone", "week"], "a receiver's plan: depth, direction, down, zone, week")
d = {r["group"]: r for r in json.loads(R.split("ZZZ.WR1", "direction"))["rows"]}
check(d["right"]["plays"] == 8 and d["right"]["success"] == 6 and d["left"]["success"] == 1, "split by direction counts plays and successes")
check(d["right"]["examples"][0]["text"] == "right 0" and d["right"]["examples"][0]["event"] == "1", "every row carries example plays with their game")
pp = json.loads(R.player_plays("ZZZ.WR1", {"down": 3}))
check(pp["count"] == 5 and pp["success"] == 3, "player_plays filters by down")
check(all(x["text"] != "wiped out" for x in json.loads(R.player_plays("ZZZ.WR1", {"limit": 99}))["plays"]), "a play wiped out by a penalty never counts")
check(json.loads(R.team_context("AAA", 1))["totals"] == {"pass_att": 30}, "team context for a week")
refused = json.loads(R.write_report("ZZZ", "WR1", {"made_by": "test", "claims": [{"text": "A claim with nothing behind it.", "evidence": []}]}))
check(refused["written"] is None and "evidence" in refused["refused"], "a claim without evidence is refused")
real = json.loads(R.player_plays("ZZZ.WR1", {"down": 3, "limit": 1}))["plays"][0]
made_up = dict(real, text="Test Receiver catches a 99 yard pass")
v = json.loads(R.verify_evidence("ZZZ.WR1", [real, made_up]))
check(v["real"] == 1 and v["not_real"] == [1], "verify_evidence tells a real play from a made-up one")
refused2 = json.loads(R.write_report("ZZZ", "WR1", {"made_by": "test", "claims": [{"text": "A long catch.", "evidence": [made_up]}]}))
check(refused2["written"] is None and "not real" in refused2["refused"], "a report citing a play that never happened is refused")
res = R.rules_report("ZZZ.WR1")
text = open(res["written"]).read()
check("works best going right (success on 75 percent of 8 plays" in text and "least going left (12 percent of 8)" in text, "the report finds the side that works")
check("On third down Receiver had 5 plays for 3 first downs or touchdowns (60 percent)" in text, "third down claim")
check("Inside the 20 Receiver had 2 plays and 2 touchdowns" in text and "TD one" in text, "red zone claim cites the touchdowns")
claims = re.findall(r"^\d+\. .*\[(.*)\]$", text.split("## Evidence")[0], re.M)
check(claims and all(c.strip() for c in claims), "every claim points to evidence")
check(text.count("([game](https://example.test/summary?event=") == len(re.findall(r"^\d+\. Week", text.split("## Evidence")[1], re.M)),
      "every piece of evidence links to its game")
check("rules, no model" in text and not re.search(r"\b(he|him|his|she|her)\b", text.split("## Evidence")[0], re.I), "says no model wrote it; no pronouns")
R.main(["--only", "ZZZ.WR1"])
logs = os.listdir(os.path.join(tmp, "runs"))
check(any(n.endswith("-research.txt") for n in logs) and "report with" in open(os.path.join(tmp, "runs", logs[0])).read(), "the runner writes a research log")
print("OK")
