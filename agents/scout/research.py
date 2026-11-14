"""Scout's research tools over the real plays, and a scouting report per player where every claim cites its plays.

    python3 agents/scout/research.py                 (no model: a fixed-order runner uses the tools with rules)
    python3 agents/scout/research.py --only GOB.WR1

The same functions are tools of the deepagents agent in scout.py. They read data/rosters/plays-2026.json
(agents/scout/plays.py) and data/profiles/<team>.json; no network.

    research_plan(player)                  the steps and splits that matter for the player's position
    player_plays(player, filters)          the plays, filtered by kind, role, week, down, zone, depth, direction, gap, quarter
    split(player, by)                      a table by down, quarter, zone, depth, direction, gap or week: plays, yards,
                                           success rate, touchdowns, first downs, with the plays behind each row
    team_context(team, week)               the NFL team's totals in a week (throws, carries, red zone, third down)
    write_report(team, slot, report)       writes data/profiles/notes/<team>-<slot>-report.md. A claim without
                                           evidence is refused.

Success, the usual football measure: a play gains 40 percent of the distance on first down, 60 percent on second,
all of it on third or fourth, or scores. Zones by yards to the end zone: own (more than 80), open (21 to 80),
red zone (6 to 20), goal line (5 or less).
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402

PLAYS_FILE = os.environ.get("SCOUT_PLAYS_FILE") or os.path.join(ROOT, "data", "rosters", "plays-2026.json")
SIDE = {"left end": "left", "left tackle": "left", "left guard": "left", "up the middle": "middle",
        "right guard": "right", "right tackle": "right", "right end": "right"}
_cache = {}


def _data():
    if "d" not in _cache:
        with open(PLAYS_FILE, "r", encoding="utf-8") as f:
            _cache["d"] = json.load(f)
    return _cache["d"]


def _player(player):
    """A player by "TEAM.SLOT" or by name."""
    d = _data()["players"]
    if player in d:
        return player, d[player]
    for k, p in d.items():
        if p["name"].lower() == str(player).lower():
            return k, p
    raise ValueError("no player %s in the plays file" % player)


def _live(p):
    return not p.get("nullified") and not (p.get("dpi") and p["kind"] == "inc")


def _touch(p, pos):
    """The plays that are this player's own snaps: throws and sacks for a quarterback (and his runs), targets for
    receivers, carries and targets for backs, kicks for kickers."""
    r, k = p["role"], p["kind"]
    if r == "passer":
        return k in ("pass", "inc", "int", "sack")
    if r == "rusher":
        return k in ("run", "scramble")
    if r == "target":
        return True
    if r == "kicker":
        return k == "fg"
    return False


def success(p):
    if p.get("td"):
        return True
    y, dn, dist = p.get("yds"), p.get("dn"), p.get("dist")
    if p["kind"] in ("inc", "int", "sack") or not isinstance(y, int) or not isinstance(dist, int) or dn not in (1, 2, 3, 4):
        return False
    need = {1: 0.4, 2: 0.6, 3: 1.0, 4: 1.0}[dn] * dist
    return y >= need


def zone(p):
    y = p.get("ytg")
    if not isinstance(y, int):
        return None
    return "goal line" if y <= 5 else "red zone" if y <= 20 else "open" if y <= 80 else "own end"


def cite(p):
    q = p.get("q")
    return {"event": p["ev"], "week": p["wk"], "q": "OT" if q == 5 else q, "clock": p.get("clk"), "text": p.get("text", "")[:160]}


def _group(p, by):
    if by == "down":
        return p.get("dn")
    if by == "quarter":
        return p.get("q")
    if by == "zone":
        return zone(p)
    if by == "depth":
        return p.get("depth")
    if by == "direction":
        return p.get("dir") or (SIDE.get(p.get("gap")) if p.get("gap") else None)
    if by == "gap":
        return p.get("gap")
    if by == "week":
        return p.get("wk")
    raise ValueError("by must be down, quarter, zone, depth, direction, gap or week")


# ---------------------------------------------------------------- tools
def research_plan(player: str) -> str:
    """The research plan for one player ("TEAM.SLOT" or name): which splits to look at for the position, and why."""
    key, p = _player(player)
    pos = p["position"]
    plans = {
        "QB": [("depth", "how often and how well the long ball works"), ("direction", "which side the throws go to"),
               ("down", "third down is where drives live or die"), ("zone", "red zone and goal line: touchdown or field goal"),
               ("week", "volume and form week by week")],
        "RB": [("gap", "where the carries go and which side works"), ("down", "short yardage and third down use"),
               ("zone", "goal line work is touchdown equity"), ("week", "workload trend")],
        "WR": [("depth", "deep threat or chain mover"), ("direction", "which side he is used on"),
               ("down", "third down trust"), ("zone", "red zone use"), ("week", "target trend")],
        "TE": [("depth", "short or seam"), ("down", "third down trust"), ("zone", "red zone use"), ("week", "target trend")],
        "K": [("zone", "where the kicks come from"), ("week", "attempts and makes by week")],
    }
    steps = [{"split": by, "why": why} for by, why in plans[pos]]
    T._log_call("research_plan(%s) -> %s" % (key, ", ".join(s["split"] for s in steps)))
    return json.dumps({"player": key, "name": p["name"], "position": pos, "games": len(p["games"]), "steps": steps,
                       "then": "compare the last three weeks with the rest; pick the biggest plays; write the report with evidence for every claim"})


def player_plays(player: str, filters: dict = None) -> str:
    """The real plays of one player. filters (all optional): kind (pass, inc, int, sack, run, scramble, fg), role
    (passer, target, rusher, kicker), week, down, zone (own end, open, red zone, goal line), depth, direction, gap,
    quarter, limit (default 20). Returns the count, the totals and up to limit plays with event, quarter, clock and text."""
    key, p = _player(player)
    f = dict(filters or {})
    limit = int(f.pop("limit", 20))
    out = []
    for x in p["plays"]:
        if not _live(x) or not _touch(x, p["position"]):
            continue
        ok = True
        for k, v in f.items():
            have = {"week": x.get("wk"), "down": x.get("dn"), "zone": zone(x), "quarter": x.get("q"),
                    "direction": x.get("dir") or (SIDE.get(x.get("gap")) if x.get("gap") else None)}.get(k, x.get(k))
            if have != v:
                ok = False
                break
        if ok:
            out.append(x)
    yds = sum(x.get("yds") or 0 for x in out if x["kind"] in ("pass", "run", "scramble"))
    T._log_call("player_plays(%s, %s) -> %d plays" % (key, json.dumps(filters or {}), len(out)))
    return json.dumps({"player": key, "count": len(out), "yards": yds, "touchdowns": sum(1 for x in out if x.get("td")),
                       "success": sum(1 for x in out if success(x)), "plays": [cite(x) for x in out[:limit]],
                       "source": _data()["sources"]["summary"]})


def split(player: str, by: str, role: str = "") -> str:
    """A split of one player's real plays: by is down, quarter, zone, depth, direction, gap or week; role (optional)
    keeps only passer, target, rusher or kicker plays. Each row: plays, yards, yards per play, success rate,
    touchdowns, first downs and up to 3 example plays."""
    key, p = _player(player)
    rows = {}
    for x in p["plays"]:
        if not _live(x) or not _touch(x, p["position"]) or (role and x["role"] != role):
            continue
        g = _group(x, by)
        if g is None:
            continue
        r = rows.setdefault(str(g), {"group": g, "plays": 0, "yards": 0, "success": 0, "td": 0, "first_downs": 0, "examples": []})
        r["plays"] += 1
        y = x.get("yds") if x["kind"] in ("pass", "run", "scramble") and isinstance(x.get("yds"), int) else 0
        r["yards"] += y
        r["success"] += 1 if success(x) else 0
        r["td"] += 1 if x.get("td") else 0
        if isinstance(x.get("dist"), int) and y >= x["dist"] and x["kind"] in ("pass", "run", "scramble"):
            r["first_downs"] += 1
        if len(r["examples"]) < 3 and x["kind"] in ("pass", "run", "scramble", "fg"):
            r["examples"].append(cite(x))
    table = []
    for r in sorted(rows.values(), key=lambda r: (str(type(r["group"])), r["group"])):
        r["yards_per_play"] = round(r["yards"] / r["plays"], 1) if r["plays"] else None
        r["success_rate"] = round(r["success"] / r["plays"], 3) if r["plays"] else None
        table.append(r)
    T._log_call("split(%s, %s) -> %d rows" % (key, by, len(table)))
    return json.dumps({"player": key, "by": by, "rows": table})


def team_context(team: str, week: int) -> str:
    """One NFL team's totals in one week (team is the NFL abbreviation, for example BUF): throws, carries, snaps,
    red zone and third down snaps, from the same play-by-play."""
    d = _data()
    games = [e for e, g in d["games"].items() if g["week"] == int(week) and team in (g["home"], g["away"])]
    tot = {}
    for e in games:
        for k, v in d["team_games"].get(team, {}).get(e, {}).items():
            tot[k] = tot.get(k, 0) + v
    T._log_call("team_context(%s, %s) -> %d games" % (team, week, len(games)))
    return json.dumps({"team": team, "week": int(week), "games": games, "totals": tot,
                       "sources": [d["games"][e]["source"] for e in games]})


def write_report(team: str, slot: str, report: dict) -> str:
    """Save a scouting report. report = {"title": str, "made_by": "model <name>" or "rules, no model",
    "claims": [{"text": one plain sentence, "evidence": [play citations from player_plays or split, at least one]}]}.
    A claim without evidence is refused."""
    if isinstance(report, str):
        report = json.loads(report)
    claims = report.get("claims") or []
    bad = [c.get("text", "")[:60] for c in claims if not c.get("evidence")]
    if not claims or bad:
        return json.dumps({"written": None, "refused": "every claim needs evidence; missing for: %s" % bad if bad else "no claims"})
    d = _data()
    key = "%s.%s" % (team, slot)
    p = d["players"].get(key, {})
    lines = ["# Scouting report: %s" % (report.get("title") or p.get("name", key)), "",
             "%s, %s. Made by %s on %s, from the real play-by-play in `data/rosters/plays-2026.json` (ESPN, %d games). "
             "Every claim lists the plays it rests on; each play links to its game." % (team, slot, report.get("made_by", "unknown"), T.today(),
                                                                                         len(p.get("games", []))), ""]
    refs = []
    for i, c in enumerate(claims, 1):
        nums = []
        for e in c["evidence"]:
            refs.append(e)
            nums.append(str(len(refs)))
        lines.append("%d. %s [%s]" % (i, c["text"], ", ".join(nums)))
    lines += ["", "## Evidence", ""]
    for n, e in enumerate(refs, 1):
        g = d["games"].get(str(e.get("event")), {})
        lines.append("%d. Week %s, Q%s %s: %s ([game](%s))" % (n, e.get("week"), e.get("q"), e.get("clock") or "", e.get("text", ""), g.get("source", "")))
    out = os.path.join(T.out_dir(), "profiles", "notes", "%s-%s-report.md" % (team, slot))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    T._log_call("write_report(%s) -> %d claims, %d plays cited" % (key, len(claims), len(refs)))
    return json.dumps({"written": out, "claims": len(claims), "evidence": len(refs)})


TOOLS = [research_plan, player_plays, split, team_context, write_report]


# ---------------------------------------------------------------- the runner without a model
def pct(x):
    return "%d percent" % round(100 * x)


def rules_report(key):
    """The fixed-order runner: the same tools, with rules in place of a model's judgment."""
    _, p = _player(key)
    pos, last = p["position"], p["name"].split()[-1] if p["name"].split()[-1] not in ("Jr.", "III", "II") else p["name"].split()[-2]
    if p["name"].endswith("St. Brown"):
        last = "St. Brown"
    plan = json.loads(research_plan(key))
    T.log_step("%s: plan %s" % (p["name"], ", ".join(s["split"] for s in plan["steps"])))
    claims = []
    splits = {s["split"]: json.loads(split(key, s["split"], "passer" if pos == "QB" and s["split"] in ("direction", "depth") else ""))["rows"]
              for s in plan["steps"]}

    def best_row(rows, min_plays=8):
        rows = [r for r in rows if r["plays"] >= min_plays]
        return max(rows, key=lambda r: (r["success_rate"], r["plays"])) if rows else None

    def worst_row(rows, min_plays=8):
        rows = [r for r in rows if r["plays"] >= min_plays]
        return min(rows, key=lambda r: (r["success_rate"], -r["plays"])) if rows else None

    total = sum(r["plays"] for r in splits.get("week", []))
    if total:
        wk = splits["week"]
        per = round(total / len(wk), 1)
        recent = wk[-3:]
        rec = round(sum(r["plays"] for r in recent) / len(recent), 1)
        word = {"QB": "dropbacks and runs", "RB": "carries and targets", "WR": "targets", "TE": "targets", "K": "field goal tries"}[pos]
        claims.append({"text": "%s had %d %s in %d games, %s a game; in the last three games played it was %s a game." % (
            last, total, word, len(wk), per, rec), "evidence": [e for r in recent for e in r["examples"][:1]]})
    for by in ("depth", "direction", "gap"):
        rows = splits.get(by)
        if not rows:
            continue
        b, w = best_row(rows), worst_row(rows)
        if b and w and b["group"] != w["group"] and b["success_rate"] - w["success_rate"] >= 0.1:
            claims.append({"text": "By %s, %s works best %s (success on %s of %d plays, %s yards a play) and least %s (%s of %d)." % (
                by, last, ("going " + str(b["group"])) if by != "gap" else "through " + str(b["group"]), pct(b["success_rate"]), b["plays"],
                b["yards_per_play"], ("going " + str(w["group"])) if by != "gap" else "through " + str(w["group"]), pct(w["success_rate"]), w["plays"]),
                "evidence": b["examples"][:2] + w["examples"][:1]})
    downs = {r["group"]: r for r in splits.get("down", [])}
    if 3 in downs and downs[3]["plays"] >= 5:
        r = downs[3]
        claims.append({"text": "On third down %s had %d plays for %d first downs or touchdowns (%s)." % (
            last, r["plays"], r["success"], pct(r["success_rate"])), "evidence": r["examples"][:3]})
    zones = {r["group"]: r for r in splits.get("zone", [])}
    rz = [zones[z] for z in ("red zone", "goal line") if z in zones]
    if rz and pos != "K":
        inside = [x for x in p["plays"] if _live(x) and _touch(x, pos) and zone(x) in ("red zone", "goal line")]
        tds = [cite(x) for x in inside if x.get("td")]
        n, td = len(inside), len(tds)
        claims.append({"text": "Inside the 20 %s had %d plays and %d touchdowns." % (last, n, td),
                       "evidence": (tds + [cite(x) for x in inside if not x.get("td")])[:3]})
    raw = [x for x in p["plays"] if _live(x) and _touch(x, pos) and x["kind"] in ("pass", "run", "scramble")]
    raw.sort(key=lambda x: -(x.get("yds") or 0))
    if raw and pos != "K":
        top = raw[:3]
        claims.append({"text": "The biggest plays: %s." % ", ".join("%d yards in week %d" % (x.get("yds") or 0, x["wk"]) for x in top),
                       "evidence": [cite(x) for x in top]})
    if pos == "K":
        fg = [x for x in p["plays"] if _live(x) and x["kind"] == "fg"]
        for lo, hi, name in ((0, 39, "under 40 yards"), (40, 49, "from 40 to 49"), (50, 99, "from 50 or more")):
            band = [x for x in fg if isinstance(x.get("dist_fg"), int) and lo <= x["dist_fg"] <= hi]
            if band:
                claims.append({"text": "%s %s: %d of %d made." % (last, name, sum(1 for x in band if x.get("good")), len(band)),
                               "evidence": [cite(x) for x in band][:3]})
        miss = [x for x in fg if not x.get("good")]
        if fg:
            claims.append({"text": "%s made %d of %d field goals; the misses were from %s yards." % (
                last, len(fg) - len(miss), len(fg), ", ".join(str(x.get("dist_fg")) for x in miss) or "no distance (none missed)"),
                "evidence": [cite(x) for x in (miss or fg)[:3]]})
    claims = [c for c in claims if c["evidence"]]
    team, slot = key.split(".")
    res = json.loads(write_report(team, slot, {"title": p["name"], "made_by": "rules, no model (agents/scout/research.py)", "claims": claims}))
    T.log_step("%s: report with %d claims and %d plays cited" % (p["name"], res.get("claims", 0), res.get("evidence", 0)))
    return res


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="one player, TEAM.SLOT")
    a = ap.parse_args(argv)
    log = T.start_run("research")
    T.log_step("research starts (no model: fixed order, rules in place of judgment), plays from %s" % os.path.relpath(PLAYS_FILE, ROOT)
               if PLAYS_FILE.startswith(ROOT) else PLAYS_FILE)
    keys = [a.only] if a.only else list(_data()["players"].keys())
    n = 0
    for k in keys:
        if _data()["players"][k]["plays"]:
            rules_report(k)
            n += 1
    T.log_step("research finished: %d reports" % n)
    print("log:", log)
    print("wrote %d reports" % n)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
