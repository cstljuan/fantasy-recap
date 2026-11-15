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

GOOGLE_DEFAULT = "gemini-3.5-flash"
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
        return ChatGoogleGenerativeAI(model=name, max_retries=8), "google:" + name
    if os.environ.get("ANTHROPIC_API_KEY"):
        from langchain_anthropic import ChatAnthropic
        name = name or ANTHROPIC_DEFAULT
        return ChatAnthropic(model=name), "anthropic:" + name
    return None, None


def safe(f):
    """A tool that fails (bad JSON from the model, an unknown player, a refused report) answers with the error text, so the
    model can read it and try again, instead of ending the whole run."""
    import functools

    @functools.wraps(f)
    def wrapper(*a, **k):
        try:
            return f(*a, **k)
        except Exception as e:
            msg = "%s failed: %s: %s" % (f.__name__, type(e).__name__, str(e)[:300])
            try:
                T.log_step("tool error: " + msg)
            except Exception:
                pass
            return json.dumps({"error": msg, "hint": "check the arguments and call the tool again"})
    return wrapper


# The functions below are what the agent sees. Their names and docstrings are the tool descriptions.
@safe
def find_player(name: str) -> str:
    """Find an NFL player by full name. Returns matches with player_id, position and team. Several may share a name, so check position and status."""
    return T.find_player(name)


@safe
def season_stats(player_id: str) -> str:
    """Season totals for one player id from the public stats source. Returns stat names and numbers plus the source address and date."""
    return T.season_stats(player_id)


@safe
def weekly_stats(player_id: str) -> str:
    """Week by week stats for one player id. Use it to see whether the season totals hide a recent change."""
    return T.weekly_stats(player_id)


@safe
def compute_tendencies(position: str, season_stats_json: str) -> str:
    """Work out 0 to 1 on-field tendencies from the JSON that season_stats returned. position is QB, RB, WR, TE or K. A value is null when the stat is missing."""
    return T.compute_tendencies_tool(position, season_stats_json)


@safe
def write_profile(team: str, slot: str, profile: dict) -> str:
    """Save one player. team is GOB, PYT, TUR or OWL, slot is QB RB WR1 WR2 WR3 TE or K. profile needs name, position, player_id, source (the season_stats source address), tendencies (exactly what compute_tendencies returned), season_stats (the raw stats object) and notes."""
    return T.write_profile(team, slot, profile)


@safe
def log_step(text: str) -> str:
    """Write one line to the research log. Call it before each step to say what you plan to do and why, and after to say what you learned."""
    return T.log_step(text)


# Research over the real play-by-play (agents/scout/research.py; data/rosters/plays-2026.json from plays.py).
@safe
def research_plan(player: str) -> str:
    """The research plan for one player, as "TEAM.SLOT" (for example GOB.WR1) or full name: the splits that matter for the position and why."""
    return R.research_plan(player)


@safe
def player_plays(player: str, filters: dict = None) -> str:
    """The player's real plays this season from ESPN's play-by-play, filtered. filters (optional): kind, role, week, down, zone (own end, open, red zone, goal line), depth, direction, gap, quarter, limit. Returns counts and the plays with game, quarter, clock and text: use these as evidence."""
    return R.player_plays(player, filters)


@safe
def split(player: str, by: str, role: str = "") -> str:
    """The player's real plays split by down, quarter, zone, depth, direction, gap or week (role optional: passer, target, rusher, kicker). Each row has plays, yards, success rate, touchdowns and example plays to cite."""
    return R.split(player, by, role)


@safe
def team_context(team: str, week: int) -> str:
    """An NFL team's totals in one week (team is the NFL abbreviation like BUF): throws, carries, red zone and third down snaps."""
    return R.team_context(team, week)


@safe
def verify_evidence(player: str, evidence: list) -> str:
    """Check plays you want to cite: each must be one of the player's real plays exactly as player_plays or split returned it. Returns which are real."""
    return R.verify_evidence(player, evidence)


@safe
def write_report(team: str, slot: str, report: dict) -> str:
    """Save the scouting report: {"title", "made_by": "model <name>", "claims": [{"text": one plain sentence, "evidence": [plays exactly as player_plays or split returned them]}]}. A claim without evidence is refused."""
    return R.write_report(team, slot, report)


TOOLS = [find_player, season_stats, weekly_stats, compute_tendencies, write_profile, log_step,
         research_plan, player_plays, split, team_context, verify_evidence, write_report]

STATS_TOOLS = [find_player, season_stats, weekly_stats, compute_tendencies, write_profile, log_step]
FILM_TOOLS = [research_plan, split, player_plays, team_context, log_step]
CHECK_TOOLS = [player_plays, split, verify_evidence, write_report, log_step]


def findings_schema():
    """What the film-room subagent hands back: claims, each with the plays behind it."""
    from typing import List
    from pydantic import BaseModel, Field

    class Play(BaseModel):
        event: str = Field(description="ESPN event id, exactly as the tool returned it")
        week: int
        q: object = Field(description="quarter as the tool returned it")
        clock: str
        text: str = Field(description="the play text exactly as the tool returned it")

    class Claim(BaseModel):
        text: str = Field(description="one plain sentence about what happened on the field, with the numbers from the tools")
        evidence: List[Play] = Field(description="the plays this sentence rests on, copied from player_plays or split")

    class Findings(BaseModel):
        player: str = Field(description="TEAM.SLOT")
        claims: List[Claim]

    return Findings


STATS_PROMPT = """You build one player's season profile from real public numbers. Steps: find_player (the active player at the right position; if none or several, say so and write the profile with null tendencies and a note), season_stats, weekly_stats if the totals look odd, compute_tendencies with the season_stats JSON exactly as returned, write_profile. Call log_step before and after. Never invent or estimate a number."""

FILM_PROMPT = """You are the film room. For one player (given as TEAM.SLOT) study the real play-by-play: call research_plan, then every split it names, then player_plays for the plays behind anything notable. Look for what a play caller would want: where the player succeeds and fails (success rate: 40 percent of the distance on first down, 60 on second, all of it on third and fourth), the third down and red zone roles, how the last three weeks differ from the rest, the biggest plays. Return findings: each claim one plain sentence with the numbers the tools gave, and its evidence the plays copied exactly from the tool output. Use the player's name, never pronouns. Never claim anything a tool did not show. Call log_step with what you found."""

CHECK_PROMPT = """You are the fact-checker. You get findings for one player (TEAM.SLOT): claims with evidence. For each claim: call verify_evidence on its evidence; re-run the split or player_plays the numbers came from and compare. Drop a claim whose evidence is not real or whose numbers do not match the tools, and say which in log_step. Then call write_report with the claims that survived, made_by set to the model name you are told. write_report refuses any claim without real evidence; if it refuses, fix the claim or drop it and try again."""

PROMPT = """You are Scout, the research lead for a fantasy football recap app. You run three specialists through the task tool:
- stats-researcher: builds one player's season profile from public season numbers (Sleeper).
- film-room: studies one player's real plays (ESPN play-by-play) and returns findings with evidence.
- fact-checker: checks findings against the plays and writes the scouting report.

Players (team id, slot, name):
{roster_lines}

How to work:
1. Write a plan with the todo tool, then log_step with it.
2. For each player, in order: task stats-researcher ("TEAM.SLOT name"), then task film-room ("TEAM.SLOT"), then task fact-checker with the film room's findings and "made_by: model {model}". One player at a time.
3. Call log_step after each player with what the reports say and any claim the fact-checker dropped.
4. Never invent or estimate a number. Never write a claim yourself: claims come from the film room and pass the fact-checker.
5. Finish with a short summary: profiles written, reports written, claims dropped and why."""


def subagents(model=None):
    spec = [
        {"name": "stats-researcher", "description": "Builds one football player's season profile (tendencies 0 to 1 with sources) from public season numbers. Give it TEAM.SLOT and the name.",
         "system_prompt": STATS_PROMPT, "tools": STATS_TOOLS},
        {"name": "film-room", "description": "Studies one player's real play-by-play (splits by down, zone, depth, direction, gap, week) and returns findings: claims with the plays behind them. Give it TEAM.SLOT.",
         "system_prompt": FILM_PROMPT, "tools": FILM_TOOLS, "response_format": findings_schema()},
        {"name": "fact-checker", "description": "Checks a player's findings against the real plays, drops what does not hold, and writes the scouting report. Give it TEAM.SLOT, the findings JSON and the model name.",
         "system_prompt": CHECK_PROMPT, "tools": CHECK_TOOLS},
    ]
    if model is not None:
        for sp in spec:
            sp["model"] = model
    return spec


def build_agent(model, label, ro):
    from deepagents import create_deep_agent
    lines = "\n".join("%s.%s: %s" % (t, sl, n) for t, r in ro.items() for sl, n in r.items())
    return create_deep_agent(model=model, tools=[log_step], subagents=subagents(model),
                             system_prompt=PROMPT.format(roster_lines=lines, model=label), name="scout")


HOSTS = [("api.sleeper.app", "https://api.sleeper.app/v1/state/nfl"), ("site.api.espn.com", "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard")]


def preflight(network=True):
    """Returns a list of plain-language problems that stop a real run. Empty means ready. Makes no model call."""
    problems = []
    for mod, pkg in (("deepagents", "deepagents"), ("langchain_anthropic", "langchain-anthropic"), ("langchain_google_genai", "langchain-google-genai")):
        try:
            __import__(mod)
        except ImportError:
            problems.append("package %s is not installed. Run: pip install -r agents/scout/requirements.txt (or sh agents/scout/run.sh)" % pkg)
    if not (os.environ.get("GOOGLE_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")):
        problems.append("no model key. Set GOOGLE_API_KEY (Gemini) or ANTHROPIC_API_KEY (Claude) in the environment, never in a file.")
    pf = os.path.join(T.ROOT, "data", "rosters", "plays-2026.json")
    if not os.path.exists(pf) and not os.environ.get("SCOUT_PLAYS_FILE"):
        problems.append("data/rosters/plays-2026.json is missing. Run: python3 agents/scout/plays.py")
    if subprocess.call(["node", "--version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) != 0:
        problems.append("node is not installed; Scout reads the rosters from js/data.js with it.")
    if network:
        import urllib.request
        for host, url in HOSTS:
            try:
                urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "scout"}), timeout=15).read(1)
            except Exception as e:
                problems.append("cannot reach %s (%s). Check the network or proxy; the stats tools need it." % (host, type(e).__name__))
    return problems


def explain(e):
    """A short plain message for the errors a real run can hit, or None for an error that should show its traceback."""
    name, msg = type(e).__name__, str(e)
    low = (name + " " + msg).lower()
    if any(w in low for w in ("authentication", "api key", "api_key", "permission_denied", "unauthorized", "401", "403", "invalid x-api-key")):
        return "The model refused the key (%s). Check GOOGLE_API_KEY or ANTHROPIC_API_KEY." % name
    if any(w in low for w in ("notfound", "model not found", "404", "is not found")):
        return "The model name was not accepted (%s). Set SCOUT_MODEL to a model your key can use." % name
    if any(w in low for w in ("connection", "timeout", "timed out", "resolve", "unreachable", "ssl")):
        return "The network failed during the run (%s). Run again; the log in agents/scout/runs/ shows how far it got." % name
    if any(w in low for w in ("rate", "quota", "429", "overloaded", "529")):
        return "The model service is rate limiting or overloaded (%s). Wait and run again." % name
    return None


def main(argv):
    dry = "--dry-run" in argv
    if "--preflight" in argv:
        probs = preflight()
        for p in probs:
            print("NOT READY:", p)
        print("ready for a real run" if not probs else "%d problem(s)" % len(probs))
        return 1 if probs else 0
    only = None
    if "--players" in argv:
        only = set(argv[argv.index("--players") + 1].split(","))
    ro = rosters()
    if only:
        ro = {t: {sl: n for sl, n in r.items() if "%s.%s" % (t, sl) in only} for t, r in ro.items()}
        ro = {t: r for t, r in ro.items() if r}
    n = sum(len(r) for r in ro.values())
    model, label = pick_model()
    if not dry:
        probs = preflight()
        if probs:
            for p in probs:
                print("NOT READY:", p)
            return 2
    if model is None and not dry:
        print("No model key. Set GOOGLE_API_KEY or ANTHROPIC_API_KEY in the environment (not in a file).")
        print("Without a model, python3 agents/scout/research.py writes the reports with rules, and fill_profiles.py the profiles.")
        return 2
    if dry and model is None:
        from langchain_anthropic import ChatAnthropic
        model, label = ChatAnthropic(model=ANTHROPIC_DEFAULT, api_key="dry-run-not-a-key"), "dry-run (no call is made)"
    agent = build_agent(model, label, ro)
    log = T.start_run("scout")
    T.log_step("Scout starts. model=%s season=%d players=%d subagents=%s" % (label, T.season(), n, ", ".join(sp["name"] for sp in subagents())))
    print("log:", log)
    if dry:
        print("agent built with model", label)
        for sp in subagents():
            print("subagent %s: %s" % (sp["name"], ", ".join(f.__name__ for f in sp["tools"])))
        return 0
    try:
        result = agent.invoke({"messages": [{"role": "user", "content": "Build the profiles and the scouting reports for all %d players now." % n}]},
                              {"recursion_limit": 2000})
    except Exception as e:
        why = explain(e)
        if why is None:
            raise
        T.log_step("Scout stopped: " + why)
        print("STOPPED:", why)
        print("log:", log)
        return 3
    last = result["messages"][-1]
    text = last.content if isinstance(last.content, str) else json.dumps(last.content)
    T.log_step("Scout finished: " + text[:500])
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
