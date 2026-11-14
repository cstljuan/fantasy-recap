"""Optional check: runs Scout's tools through the real deepagents graph with a scripted stand-in model.
Needs the packages in requirements.txt. No network, no key. It proves the tools are wired into the agent and
callable by tool calls, not that any real model plans well.

    python3 agents/scout/check_agent.py
"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
tmp = tempfile.mkdtemp(prefix="scout-agent-check-")
os.environ.update(SCOUT_FIXTURES=os.path.join(HERE, "fixtures"), SCOUT_OUT_DIR=os.path.join(tmp, "data"),
                  SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")
sys.path.insert(0, HERE)
import scout  # noqa: E402
import scout_tools as T  # noqa: E402
from deepagents import create_deep_agent  # noqa: E402
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel  # noqa: E402
from langchain_core.messages import AIMessage  # noqa: E402


class Scripted(GenericFakeChatModel):
    def bind_tools(self, tools, **kwargs):
        return self


stats = {"stats": {"rush_att": 150, "rec_tgt": 50}}
calls = [
    ("log_step", {"text": "plan: one player"}),
    ("find_player", {"name": "Test Runner"}),
    ("season_stats", {"player_id": "FX2"}),
    ("compute_tendencies", {"position": "RB", "season_stats_json": json.dumps(stats)}),
    ("write_profile", {"team": "TST", "slot": "RB", "profile": {
        "name": "Test Runner", "position": "RB", "player_id": "FX2", "source": "fixture://season_FX2",
        "tendencies": {"run_share": {"value": 0.75, "how": "carries over carries plus targets"}},
        "season_stats": {"rush_att": 150}, "notes": ""}}),
]
msgs = [AIMessage(content="", tool_calls=[{"name": n, "args": a, "id": "c%d" % i}]) for i, (n, a) in enumerate(calls)]
msgs.append(AIMessage(content="done"))
agent = create_deep_agent(model=Scripted(messages=iter(msgs)), tools=scout.TOOLS, system_prompt="test")
T.start_run("agent-check")
out = agent.invoke({"messages": [{"role": "user", "content": "go"}]})
assert out["messages"][-1].content == "done"
prof = json.load(open(os.path.join(tmp, "data", "profiles", "TST.json")))
assert prof["players"]["RB"]["tendencies"]["run_share"] == 0.75
lines = open(T._run["log"]).read().strip().splitlines()
assert len(lines) == 5, lines
print("OK: 5 tool calls went through the deepagents graph, profile written, 5 log lines")
