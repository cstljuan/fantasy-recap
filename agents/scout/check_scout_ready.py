"""Offline check, no network, no key: Scout's readiness errors, its three subagents, and the made-up-evidence guard.
Needs the packages in requirements.txt.   python3 agents/scout/check_scout_ready.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp(prefix="scout-ready-")
pf = os.path.join(tmp, "plays.json")
os.environ.update(SCOUT_PLAYS_FILE=pf, SCOUT_OUT_DIR=os.path.join(tmp, "data"), SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")
os.environ.pop("GOOGLE_API_KEY", None)
os.environ.pop("ANTHROPIC_API_KEY", None)
play = {"ev": "1", "wk": 1, "q": 1, "clk": "9:00", "dn": 3, "dist": 5, "ytg": 40, "td": False, "nullified": False, "role": "target",
        "kind": "pass", "depth": "short", "dir": "right", "yds": 8, "text": "Q.Back pass short right to T.Receiver for 8 yards."}
json.dump({"date": "2026-11-14", "sources": {"summary": "https://example.test/summary?event={event}"}, "games": {"1": {"week": 1, "home": "A", "away": "B", "source": "https://example.test/game/1"}},
           "team_games": {}, "players": {"ZZZ.WR1": {"name": "Test Receiver", "position": "WR", "nfl_team": "A", "games": ["1"], "plays": [dict(play, clk="9:0%d" % i, text=play["text"][:-1] + " (play %d)." % i) for i in range(3)], "box": {}}}},
          open(pf, "w"))
sys.path.insert(0, HERE)
import scout  # noqa: E402
import scout_tools as T  # noqa: E402
import research as R  # noqa: E402

T.start_run("ready-check")

# 1. readiness: without a key the problem is named, and nothing else is wrongly reported
probs = scout.preflight(network=False)
assert any("no model key" in p and "GOOGLE_API_KEY" in p for p in probs), probs
assert not any("package" in p for p in probs), probs
os.environ["ANTHROPIC_API_KEY"] = "not-a-real-key"
assert not any("no model key" in p for p in scout.preflight(network=False))
# an unreachable network is reported by host name
scout.HOSTS = [("unreachable.invalid", "http://unreachable.invalid/")]
net = scout.preflight(network=True)
assert any("cannot reach unreachable.invalid" in p for p in net), net
os.environ.pop("ANTHROPIC_API_KEY")

# 2. run errors become plain messages; unknown errors are not hidden
class AuthenticationError(Exception): pass
class APIConnectionError(Exception): pass
assert "refused the key" in scout.explain(AuthenticationError("401 invalid x-api-key"))
assert "network failed" in scout.explain(APIConnectionError("Connection error."))
assert scout.explain(ValueError("a real bug")) is None

# 3. the team: three subagents, each with only its own tools, the checker is the only one that writes reports
sp = {s["name"]: [f.__name__ for f in s["tools"]] for s in scout.subagents()}
assert set(sp) == {"stats-researcher", "film-room", "fact-checker"}, sp
assert "write_report" in sp["fact-checker"] and "verify_evidence" in sp["fact-checker"]
assert "write_report" not in sp["film-room"] and "write_report" not in sp["stats-researcher"]
assert "write_profile" in sp["stats-researcher"] and "write_profile" not in sp["film-room"]

# 4. the guard, called directly
real = json.loads(R.player_plays("ZZZ.WR1", {"limit": 1}))["plays"]
made_up = dict(real[0], text="Test Receiver catches a 99 yard touchdown")
def write(claims):
    return json.loads(R.write_report("ZZZ", "WR1", {"made_by": "model test", "claims": claims}))
assert write([])["written"] is None
assert "needs evidence" in write([{"text": "Receiver is great.", "evidence": []}])["refused"]
assert "not real" in write([{"text": "Receiver scored.", "evidence": [made_up]}])["refused"]
assert "not real" in write([{"text": "Mixed.", "evidence": real + [made_up]}])["refused"]
assert "not real" in write([{"text": "Bare made up text.", "evidence": ["Test Receiver catches a 99 yard touchdown"]}])["refused"]
assert not os.path.exists(os.path.join(tmp, "data", "profiles", "notes", "ZZZ-WR1-report.md")), "a refused report was written"
bare = write([{"text": "Receiver caught 8 yards, cited by its text.", "evidence": [real[0]["text"]]}])
assert bare["written"] and bare["evidence"] == 1 and "https://example.test/game/1" in open(bare["written"]).read(), bare
os.remove(bare["written"])
ok = write([{"text": "Receiver caught 8 yards on third down.", "evidence": real}])
assert ok["written"] and ok["evidence"] == 1, ok
text = open(ok["written"]).read()
assert "https://example.test/game/1" in text and "Made by model test" in text and "99 yard" not in text, text
# 5. write_profile keeps what a run did not compute (recent form, other tendencies)
pd = os.path.join(tmp, "data", "profiles"); os.makedirs(pd, exist_ok=True)
json.dump({"team": "ZZZ", "source": "x", "players": {"WR1": {"name": "Test Receiver", "position": "WR", "tendencies": {"target_share": 0.3, "catch_rate": 0.1},
           "tendency_sources": {"target_share": {"source": "s"}}, "form": {"weeks": [7, 8, 9]}, "notes": ""}}}, open(os.path.join(pd, "ZZZ.json"), "w"))
T.write_profile("ZZZ", "WR1", {"name": "Test Receiver", "position": "WR", "player_id": "1", "source": "https://example.test/s",
                               "tendencies": {"catch_rate": {"value": 0.75, "how": "catches over targets"}}, "season_stats": {}})
kept = json.load(open(os.path.join(pd, "ZZZ.json")))["players"]["WR1"]
assert kept["form"] == {"weeks": [7, 8, 9]} and kept["tendencies"] == {"target_share": 0.3, "catch_rate": 0.75}, kept
assert "target_share" in kept["tendency_sources"] and kept["tendency_sources"]["catch_rate"]["how"] == "catches over targets"

T.write_profile("ZZZ", "WR1", {"name": "Test Receiver", "position": "WR", "player_id": "1", "source": "x", "tendencies": {"catch_rate": {"value": None, "how": "h"}}, "season_stats": {}})
assert json.load(open(os.path.join(pd, "ZZZ.json")))["players"]["WR1"]["tendencies"]["catch_rate"] == 0.75, "a null erased a number"
bad = json.loads(R.verify_evidence("ZZZ.WR1", [{"ev": "1", "text": "made up"}]))
assert bad["real"] == 0 and "first one rejected" in bad["why"], bad

print("OK: a null never erases a number, rejected evidence says why; write_profile keeps form and other tendencies; no-key and no-network errors named; 3 subagents with their own tools; report guard refuses no evidence, made-up plays and mixed lists; the written report links each play's game")
