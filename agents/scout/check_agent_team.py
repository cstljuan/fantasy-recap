"""Optional check: Scout's whole team (main agent, film-room and fact-checker subagents) through the real deepagents
graph, with a scripted stand-in model. No network, no key. It proves the wiring: the main agent delegates with the
task tool, the film room uses its tools and returns structured findings, the fact-checker's first report with a
made-up play is refused, and the report with real plays is written. It does not prove that a real model reasons well.
Needs the packages in requirements.txt.

    python3 agents/scout/check_agent_team.py
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp(prefix="scout-team-check-")
plays_file = os.path.join(tmp, "plays.json")
os.environ.update(SCOUT_PLAYS_FILE=plays_file, SCOUT_OUT_DIR=os.path.join(tmp, "data"), SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")


def P(i, **k):
    base = {"ev": "1", "wk": 1, "q": 1, "clk": "%d:00" % (14 - i), "dn": 3, "dist": 5, "ytg": 40, "td": False, "nullified": False,
            "role": "target", "kind": "pass", "depth": "short", "dir": "right", "yds": 8, "text": "Q.Back pass short right to T.Receiver for 8 yards (play %d)." % i}
    base.update(k)
    return base


json.dump({"date": "2026-11-14", "sources": {"summary": "https://example.test/summary?event={event}"},
           "games": {"1": {"week": 1, "home": "AAA", "away": "BBB", "source": "https://example.test/summary?event=1"}},
           "team_games": {}, "players": {"ZZZ.WR1": {"name": "Test Receiver", "position": "WR", "nfl_team": "AAA", "games": ["1"],
                                                    "plays": [P(i) for i in range(6)], "box": {}}}}, open(plays_file, "w"))
sys.path.insert(0, HERE)
import scout  # noqa: E402
import research as R  # noqa: E402
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402


class Scripted(GenericFakeChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


real = json.loads(R.player_plays("ZZZ.WR1", {"limit": 2}))["plays"]
made_up = dict(real[0], text="Test Receiver catches a 99 yard touchdown")
claim = {"text": "On third down Receiver had 6 plays for 6 first downs.", "evidence": real}
findings = {"player": "ZZZ.WR1", "claims": [claim]}
seen = []


def call(name, args, i):
    seen.append(name)
    return AIMessage(content="", tool_calls=[{"name": name, "args": args, "id": "t%d" % i}])


script = [
    call("task", {"subagent_type": "film-room", "description": "ZZZ.WR1"}, 1),                  # main
    call("split", {"player": "ZZZ.WR1", "by": "down"}, 2),                                     # film room
    call("Findings", findings, 3),                                                              # film room: structured findings
    call("task", {"subagent_type": "fact-checker", "description": "ZZZ.WR1 " + json.dumps(findings) + " made_by: model test"}, 4),  # main
    call("verify_evidence", {"player": "ZZZ.WR1", "evidence": [made_up] + real}, 5),           # fact-checker
    call("write_report", {"team": "ZZZ", "slot": "WR1", "report": {"made_by": "model test", "claims": [dict(claim, evidence=[made_up])]}}, 6),
    call("write_report", {"team": "ZZZ", "slot": "WR1", "report": {"made_by": "model test", "claims": [claim]}}, 7),
    AIMessage(content="report written with 1 claim"),                                          # fact-checker done
    AIMessage(content="done: 1 report"),                                                       # main done
]
model = Scripted(messages=iter(script))
agent = scout.build_agent(model, "test", {"ZZZ": {"WR1": "Test Receiver"}})
import scout_tools as T  # noqa: E402
T.start_run("team-check")
out = agent.invoke({"messages": [{"role": "user", "content": "go"}]}, {"recursion_limit": 100})
assert out["messages"][-1].content == "done: 1 report", out["messages"][-1].content
report = os.path.join(tmp, "data", "profiles", "notes", "ZZZ-WR1-report.md")
assert os.path.exists(report), "no report written"
text = open(report).read()
assert "Made by model test" in text and "99 yard" not in text and "(play 0)" in text, text
log = open(T._run["log"]).read()
assert "refused" in log and "verify_evidence(ZZZ.WR1) -> 2 of 3 real" in log, log
assert "split(ZZZ.WR1, down)" in log
print("OK: main agent -> film-room (split, structured findings) -> fact-checker (verify, a made-up play refused, real report written); calls: " + ", ".join(seen))
