"""Tools for Scout. Plain Python, no framework needed to import this file.

Online, the tools read Sleeper's public API (no key). With SCOUT_FIXTURES=<dir> they read saved
sample files instead, so they can be checked with no network. See README.md.

Every function returns a JSON string, which is what an agent tool call hands back to a model.
"""
import datetime
import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HERE = os.path.dirname(os.path.abspath(__file__))
PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
SEASON_URL = "https://api.sleeper.com/stats/nfl/player/{pid}?season_type=regular&season={season}"
WEEKLY_URL = "https://api.sleeper.com/stats/nfl/player/{pid}?season_type=regular&season={season}&grouping=week"

_players_cache = {}
_run = {"log": None}


def season():
    return int(os.environ.get("SCOUT_SEASON", "2026"))


def out_dir():
    """Where profiles and the season file are written. Defaults to the repository's data/ folder."""
    return os.environ.get("SCOUT_OUT_DIR", os.path.join(ROOT, "data"))


def today():
    return datetime.date.today().isoformat()


def _fixtures():
    return os.environ.get("SCOUT_FIXTURES")


def _get_json(url, fixture_name):
    fx = _fixtures()
    if fx:
        with open(os.path.join(fx, fixture_name), "r", encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(url, headers={"User-Agent": "scout-research-agent"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def _norm(name):
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]", "", s.lower().replace(".", "")).strip()


# ---------------------------------------------------------------- log
def start_run(label="run"):
    """Opens a research log in agents/scout/runs/ (or SCOUT_RUNS_DIR). Returns its path."""
    d = os.environ.get("SCOUT_RUNS_DIR", os.path.join(HERE, "runs"))
    os.makedirs(d, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%d-%H%M%S")
    path = os.path.join(d, "%s-%s.txt" % (stamp, label))
    _run["log"] = path
    open(path, "w", encoding="utf-8").close()
    return path


def log_step(text):
    """Write one line to the research log: what Scout is about to do or just learned."""
    line = "%s | %s" % (datetime.datetime.now(datetime.timezone.utc).strftime("%H:%M:%S"), " ".join(str(text).split()))
    if _run["log"]:
        with open(_run["log"], "a", encoding="utf-8") as f:
            f.write(line + "\n")
    return json.dumps({"logged": True})


def _log_call(text):
    if _run["log"]:
        log_step(text)


# ---------------------------------------------------------------- source tools
def find_player(name):
    """Find a player by name. Returns a list of matches with player_id, full_name, position, team."""
    if "all" not in _players_cache:
        _players_cache["all"] = _get_json(PLAYERS_URL, "players.json")
    want = _norm(name)
    hits = []
    for pid, p in _players_cache["all"].items():
        full = p.get("full_name") or ("%s %s" % (p.get("first_name", ""), p.get("last_name", ""))).strip()
        if _norm(full) == want:
            hits.append({"player_id": pid, "full_name": full, "position": p.get("position"),
                         "team": p.get("team"), "status": p.get("status")})
    _log_call("find_player(%s) -> %d match(es)" % (name, len(hits)))
    return json.dumps({"query": name, "matches": hits, "source": PLAYERS_URL, "date": today()})


def season_stats(player_id):
    """Season totals for a player: dict of Sleeper stat names to numbers."""
    url = SEASON_URL.format(pid=urllib.parse.quote(str(player_id)), season=season())
    data = _get_json(url, "season_%s.json" % player_id)
    stats = (data or {}).get("stats", data) or {}
    _log_call("season_stats(%s) -> %d stat keys" % (player_id, len(stats)))
    return json.dumps({"player_id": player_id, "season": season(), "stats": stats, "source": url, "date": today()})


def weekly_stats(player_id):
    """Week by week stats for a player: a dict from week number to a dict of stat names."""
    url = WEEKLY_URL.format(pid=urllib.parse.quote(str(player_id)), season=season())
    data = _get_json(url, "weekly_%s.json" % player_id)
    weeks = {}
    for k, v in (data or {}).items():
        if v and str(k).isdigit():
            weeks[str(k)] = (v.get("stats") if isinstance(v, dict) and "stats" in v else v)
    _log_call("weekly_stats(%s) -> %d weeks" % (player_id, len(weeks)))
    return json.dumps({"player_id": player_id, "season": season(), "weeks": weeks, "source": url, "date": today()})


# ---------------------------------------------------------------- tendencies
def _ratio(a, b):
    if a is None or b is None or b <= 0:
        return None
    return max(0.0, min(1.0, round(a / b, 3)))


def _num(stats, key):
    v = stats.get(key)
    return float(v) if isinstance(v, (int, float)) else None


def compute_tendencies(position, stats):
    """Turn season totals into 0 to 1 tendencies. Returns {name: {"value": number or None, "how": text}}.

    A tendency is None when the stat it needs is not in the data. Nothing is estimated.
    Formulas are in README.md. Stat names are Sleeper's.
    """
    g = lambda k: _num(stats, k)
    t = {}
    if position == "QB":
        pa, py, ry = g("pass_att"), g("pass_yd"), g("rush_yd")
        t["deep_ball"] = (_ratio(py / pa if (py is not None and pa) else None, 12.0),
                          "pass yards per attempt divided by 12, capped at 1")
        t["short_pass"] = (_ratio(g("pass_cmp"), pa), "completions divided by attempts")
        t["scramble"] = (_ratio(ry, (py + ry) if (py is not None and ry is not None) else None),
                         "rush yards divided by pass plus rush yards")
    elif position == "RB":
        ra, tg = g("rush_att"), g("rec_tgt")
        t["run_share"] = (_ratio(ra, (ra + tg) if (ra is not None and tg is not None) else None),
                          "carries divided by carries plus targets")
        t["pass_catching"] = (_ratio(g("rec"), tg), "catches divided by targets")
        t["red_zone_use"] = (_ratio(g("rush_rz_att"), ra), "red zone carries divided by carries")
    elif position in ("WR", "TE"):
        rec, ry, tg = g("rec"), g("rec_yd"), g("rec_tgt")
        t["deep_ball"] = (_ratio(ry / rec if (ry is not None and rec) else None, 20.0),
                          "receiving yards per catch divided by 20, capped at 1")
        t["catch_rate"] = (_ratio(rec, tg), "catches divided by targets")
        t["red_zone_use"] = (_ratio(g("rec_rz_tgt"), tg), "red zone targets divided by targets")
    elif position == "K":
        fm = g("fgm")
        long_ = (g("fgm_40_49") or 0) + (g("fgm_50p") or 0) if (g("fgm_40_49") is not None or g("fgm_50p") is not None) else None
        t["kicker_range"] = (_ratio(long_, fm), "field goals made from 40 yards or more divided by field goals made")
        t["accuracy"] = (_ratio(fm, g("fga")), "field goals made divided by attempted")
    return {k: {"value": v[0], "how": v[1]} for k, v in t.items()}


def compute_tendencies_tool(position, stats_json):
    """Compute tendencies from the JSON text that season_stats returned. Returns tendencies with how each was made."""
    stats = json.loads(stats_json).get("stats", {})
    res = compute_tendencies(position, stats)
    _log_call("compute_tendencies(%s) -> %s" % (position, ", ".join("%s=%s" % (k, v["value"]) for k, v in res.items())))
    return json.dumps(res)


# ---------------------------------------------------------------- write tools
def _read(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def write_profile(team, slot, profile):
    """Save one player's profile into data/profiles/<team>.json and the raw numbers into data/rosters/season-2026.json.

    profile = {"name", "position", "player_id", "source": url, "tendencies": {name: {"value", "how"}},
               "season_stats": {...raw numbers...}, "notes"}
    A tendency whose value is null stays null. The source address and the date are stored next to every number.
    """
    if isinstance(profile, str):
        profile = json.loads(profile)
    d = out_dir()
    date = today()
    path = os.path.join(d, "profiles", "%s.json" % team)
    doc = _read(path, {"team": team, "source": "", "players": {}})
    tend, tsrc = {}, {}
    for k, v in (profile.get("tendencies") or {}).items():
        val = v.get("value") if isinstance(v, dict) else v
        if val is not None and not (isinstance(val, (int, float)) and 0 <= val <= 1):
            raise ValueError("tendency %s must be a number from 0 to 1 or null" % k)
        tend[k] = val
        tsrc[k] = {"source": profile.get("source"), "date": date, "how": v.get("how") if isinstance(v, dict) else None}
    # Merge into what is already there: recent form (players.<slot>.form), tendencies from real plays and any other field
    # that a run did not compute stay as they were. Only the numbers this run computed are replaced.
    old = doc["players"].get(slot) or {}
    merged = dict(old)
    merged.update({"name": profile["name"], "position": profile["position"], "notes": profile.get("notes", "")})
    # A null never replaces a number that is already there (a failed or partial computation must not erase real data).
    kept = {k: v for k, v in tend.items() if v is not None or (old.get("tendencies") or {}).get(k) is None}
    merged["tendencies"] = dict(old.get("tendencies") or {}, **kept)
    merged["tendency_sources"] = dict(old.get("tendency_sources") or {}, **{k: v for k, v in tsrc.items() if k in kept})
    doc["players"][slot] = merged
    doc["source"] = ("Scout, season %d numbers from Sleeper's public stats API, read on %s. "
                     "The address and date of every number are in tendency_sources." % (season(), date))
    _write(path, doc)
    raw_path = os.path.join(d, "rosters", "season-%d.json" % season())
    raw = _read(raw_path, {"season": season(), "source": "Sleeper public API", "players": {}})
    raw["players"]["%s.%s" % (team, slot)] = {"name": profile["name"], "player_id": profile.get("player_id"),
                                              "stats": profile.get("season_stats", {}),
                                              "source": profile.get("source"), "date": date}
    _write(raw_path, raw)
    _log_call("write_profile(%s %s %s)" % (team, slot, profile["name"]))
    return json.dumps({"written": path, "also": raw_path})
