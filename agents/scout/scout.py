"""Scout: a research agent built with LangChain's deepagents.

For each of the 28 players on the league's four football rosters it plans its own steps, calls tools to read a
public stats source, works out on-field tendencies, and writes data/profiles/<team>.json and
data/rosters/season-<year>.json. Then it researches each player's real plays (ESPN play-by-play read by
plays.py) with split and player_plays and writes a scouting report where every claim cites its plays
(data/profiles/notes/<team>-<slot>-report.md). Every step goes in a log in agents/scout/runs/.
Without a model key, python3 agents/scout/research.py writes the same reports with rules in a fixed order.

    python3 agents/scout/scout.py            (needs the packages in requirements.txt and a model key)
    python3 agents/scout/scout.py --dry-run  (builds the agent and prints the plan, makes no model call)

The model comes from the environment: GOOGLE_API_KEY (Gemini) if set, otherwise ANTHROPIC_API_KEY.
SCOUT_MODEL overrides the model name. No key is read from or written to any file.
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import research as R  # noqa: E402

GOOGLE_DEFAULT = "gemini-2.5-flash"
ANTHROPIC_DEFAULT = "claude-sonnet-5-5"


def rosters():
    """The football rosters: the two in js/data.js and the league's others in data/rosters/ (TUR, OWL), as {team id: {slot: name}}."""
    code = "var d=require('./js/data.js');console.log(JSON.stringify(d.TEAMS.map(function(t){return {id:t.id,roster:t.roster}})))"
    out = subprocess.check_output(["node", "-e", code], cwd=T.ROOT)
    ro = {t["id"]: t["roster"] for t in json.loads(out)}
    for team in ("TUR", "OWL"):
        f = os.path.join(T.ROOT, "data", "rosters", "%s.json" % team)
        if os.path.exists(f):
            with open(f, "r", encoding="utf-8") as fh:
                d = json.load(fh)
            if d.get("sport") == "football":
                ro[d["team"]] = d["roster"]
    return ro


def pick_model():
    """Returns (model object, label). Gemini if GOOGLE_API_KEY is set, otherwise Claude if ANTHROPIC_API_KEY is set."""
    name = os.environ.get("SCOUT_MODEL")
    if os.environ.get("GOOGLE_API_KEY"):
        from langchain_google_genai import ChatGoogleGenerativeAI
        name = name or GOOGLE_DEFAULT
        return ChatGoogleGenerativeAI(model=name), "google:" + name
    if os.environ.get("ANTHROPIC_API_KEY"):
        from langchain_anthropic import ChatAnthropic
        name = name or ANTHROPIC_DEFAULT
        return ChatAnthropic(model=name), "anthropic:" + name
    return None, None


# The functions below are what the agent sees. Their names and docstrings are the tool descriptions.
def find_player(name: str) -> str:
    """Find an NFL player by full name. Returns matches with player_id, position and team. Several may share a name, so check position and status."""
    return T.find_player(name)


def season_stats(player_id: str) -> str:
    """Season totals for one player id from the public stats source. Returns stat names and numbers plus the source address and date."""
    return T.season_stats(player_id)


def weekly_stats(player_id: str) -> str:
    """Week by week stats for one player id. Use it to see whether the season totals hide a recent change."""
    return T.weekly_stats(player_id)


def compute_tendencies(position: str, season_stats_json: str) -> str:
    """Work out 0 to 1 on-field tendencies from the JSON that season_stats returned. position is QB, RB, WR, TE or K. A value is null when the stat is missing."""
    return T.compute_tendencies_tool(position, season_stats_json)


def write_profile(team: str, slot: str, profile: dict) -> str:
    """Save one player. team is GOB, PYT, TUR or OWL, slot is QB RB WR1 WR2 WR3 TE or K. profile needs name, position, player_id, source (the season_stats source address), tendencies (exactly what compute_tendencies returned), season_stats (the raw stats object) and notes."""
    return T.write_profile(team, slot, profile)


def log_step(text: str) -> str:
    """Write one line to the research log. Call it before each step to say what you plan to do and why, and after to say what you learned."""
    return T.log_step(text)


# Research over the real play-by-play (agents/scout/research.py; data/rosters/plays-2026.json from plays.py).
def research_plan(player: str) -> str:
    """The research plan for one player, as "TEAM.SLOT" (for example GOB.WR1) or full name: the splits that matter for the position and why."""
    return R.research_plan(player)


def player_plays(player: str, filters: dict = None) -> str:
    """The player's real plays this season from ESPN's play-by-play, filtered. filters (optional): kind, role, week, down, zone (own end, open, red zone, goal line), depth, direction, gap, quarter, limit. Returns counts and the plays with game, quarter, clock and text: use these as evidence."""
    return R.player_plays(player, filters)


def split(player: str, by: str, role: str = "") -> str:
    """The player's real plays split by down, quarter, zone, depth, direction, gap or week (role optional: passer, target, rusher, kicker). Each row has plays, yards, success rate, touchdowns and example plays to cite."""
    return R.split(player, by, role)


def team_context(team: str, week: int) -> str:
    """An NFL team's totals in one week (team is the NFL abbreviation like BUF): throws, carries, red zone and third down snaps."""
    return R.team_context(team, week)


def write_report(team: str, slot: str, report: dict) -> str:
    """Save the scouting report: {"title", "made_by": "model <name>", "claims": [{"text": one plain sentence, "evidence": [plays exactly as player_plays or split returned them]}]}. A claim without evidence is refused."""
    return R.write_report(team, slot, report)


TOOLS = [find_player, season_stats, weekly_stats, compute_tendencies, write_profile, log_step,
         research_plan, player_plays, split, team_context, write_report]

PROMPT = """You are Scout, a research agent for a fantasy football recap app. Your job: build an on-field profile for each player on two fantasy rosters from real public season numbers.

Rosters (team id, slot, name):
{roster_lines}

How to work:
1. First write a plan with the todo tool. Then call log_step with the plan.
2. For each player: find_player (pick the active player at the right position; if several match or none, say so with log_step and write the profile with null tendencies and a note), season_stats, weekly_stats if the season totals look odd, compute_tendencies with the season_stats JSON exactly as returned, then write_profile.
3. Call log_step before each player ("starting X, because ...") and after ("X: what I found").
4. Never invent or estimate a number. If a tendency is null, leave it null. If a source fails, log it and move on.
5. Use the season_stats source address as profile.source. Keep tendencies exactly as compute_tendencies returned them.
6. Then research the real plays for each player: research_plan, the splits it names, player_plays for the plays behind what you saw, and write_report. Every claim is one plain sentence about what happened on the field, and its evidence is plays exactly as the tools returned them. Look for what a play caller would want: where the player succeeds and fails, third down and red zone roles, how the last three weeks differ from the rest, the biggest plays. Do not claim anything a tool did not show you. Use the player's name, not pronouns.
7. Finish with a short summary: how many players were written, which have null tendencies and why, and how many reports.
Use a subagent only if it truly helps. Work on one team at a time."""


def main(argv):
    dry = "--dry-run" in argv
    ro = rosters()
    lines = "\n".join("%s %s: %s" % (t, s, n) for t, r in ro.items() for s, n in r.items())
    model, label = pick_model()
    if model is None and not dry:
        print("No model key. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY in the environment (not in a file).")
        return 2
    if dry and model is None:
        from langchain_anthropic import ChatAnthropic
        model, label = ChatAnthropic(model=ANTHROPIC_DEFAULT, api_key="dry-run-not-a-key"), "dry-run (no call is made)"
    from deepagents import create_deep_agent
    agent = create_deep_agent(model=model, tools=TOOLS, system_prompt=PROMPT.format(roster_lines=lines), name="scout")
    log = T.start_run("scout")
    T.log_step("Scout starts. model=%s season=%d players=%d" % (label, T.season(), sum(len(r) for r in ro.values())))
    print("log:", log)
    if dry:
        print("agent built with model", label)
        print("tools:", ", ".join(f.__name__ for f in TOOLS))
        print(lines)
        return 0
    result = agent.invoke({"messages": [{"role": "user", "content": "Build the profiles and the scouting reports for all %d players now." % sum(len(r) for r in ro.values())}]},
                          {"recursion_limit": 1200})
    last = result["messages"][-1]
    text = last.content if isinstance(last.content, str) else json.dumps(last.content)
    T.log_step("Scout finished: " + text[:500])
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
