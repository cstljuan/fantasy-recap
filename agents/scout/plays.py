"""Scout reads the real play-by-play: every snap of our roster players this season, from ESPN's public JSON.

    python3 agents/scout/plays.py                     (live; all four football rosters)
    python3 agents/scout/plays.py --weeks 1-9 --roster-file <json {team: {slot: name}}> --out <file>

What it reads, all read by hand first on 2026-11-14:
    find the player and his NFL team  https://site.api.espn.com/apis/common/v3/search?query=<name>&limit=10&type=player
    the week's games                  https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=<n>&dates=<season>
    one game's play-by-play           https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=<id>
    Sleeper's season totals           https://api.sleeper.com/stats/nfl/player/<id>?season_type=regular&season=<season>

Each play is parsed from its text, not from ESPN's type field (a challenged pass can keep the type of the play it
was before). Players are found in the text by ESPN's short form of the name ("J.Allen", "A.St. Brown"), only in
games of the player's NFL team. A play wiped out by a penalty ("No Play") is kept with nullified: true and left out
of every total.

Writes data/rosters/plays-<season>.json:
  { season, date, weeks, sources, games: { <event id>: {week, home, away, source} },
    team_games: { <NFL team>: { <event id>: { pass_att, rush_att, plays, red_zone, third_down, rz_pass (passes inside the 20),
                                              third_pass, gl_rush (carries inside the 5), sy_rush (carries on 3rd or 4th and 2 or less) } } },
    players: { "<team>.<slot>": { name, short, nfl_team, espn_id, games: [event ids], plays: [play, ...],
                                  totals: {...}, sleeper: {...}, reconcile: {...} } },
    reconcile: { compared, exact, within_1, differ: [...] } }
  a play: { ev, wk, q, clk, dn, dist, ytg (yards to the end zone), kind, role, yds, td, depth, dir, gap,
            passer, target, rusher, kicker, dist_fg, good, nullified, text }
and a research log in agents/scout/runs/. No model is used.
"""
import argparse
import json
import os
import re
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import statlines as S  # noqa: E402

SEARCH_URL = "https://site.api.espn.com/apis/common/v3/search?query={q}&limit=10&type=player"
SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week={week}&dates={season}"
SUMMARY_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event={event}"
ESPN_POS = {"QB": "QB", "RB": "RB", "WR": "WR", "TE": "TE", "K": "PK"}

GAPS = ["left end", "left tackle", "left guard", "up the middle", "right guard", "right tackle", "right end"]
# ESPN's short names: "J.Allen", "A.St. Brown", "J.Smith-Njigba", "A.Van Ginkel", "D'.Hill" style first parts.
NAME = r"[A-Z][A-Za-z'\-]*\.\s?(?:(?:St\.|Van|Von|De|Le|La|Du|Da)\s)?[A-Z][A-Za-z'\-]+"


# ---------------------------------------------------------------- names
def short_name(name):
    """ESPN's short form: first initial, a dot, the last name (with St., Jr. and the like kept as ESPN writes them)."""
    parts = name.replace(".", ". ").split()
    parts = [p for p in parts if p]
    first = parts[0][0]
    rest = parts[1:]
    if rest and rest[-1].rstrip(".") in ("Jr", "Sr", "II", "III", "IV"):
        rest = rest[:-1]
    last = " ".join(rest).replace(". ", ".").replace("St.", "St. ").replace("  ", " ").strip()
    return "%s.%s" % (first, last)


def name_re(short):
    return re.compile(r"(?<![A-Za-z'])" + re.escape(short) + r"(?![A-Za-z'])")


# ---------------------------------------------------------------- reading
def _get(url, fixture_name):
    """T._get_json, plus an optional local cache (SCOUT_CACHE=<folder>) so a second run does not read every game again."""
    cache = os.environ.get("SCOUT_CACHE")
    if cache and not os.environ.get("SCOUT_FIXTURES"):
        path = os.path.join(cache, fixture_name)
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        d = T._get_json(url, fixture_name)
        os.makedirs(cache, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f)
        return d
    return T._get_json(url, fixture_name)


def find(name, position):
    """(espn id, NFL team abbreviation, note) or (None, None, reason)."""
    url = SEARCH_URL.format(q=urllib.parse.quote(name))
    d = T._get_json(url, "plays_search_%s.json" % T._norm(name).replace(" ", "_"))
    want = ESPN_POS[position]
    hits = [i for i in (d or {}).get("items", []) if i.get("league") == "nfl"
            and (i.get("position") or {}).get("abbreviation") == want and T._norm(i.get("displayName", "")) == T._norm(name)]
    active = [i for i in hits if i.get("isActive")] or hits
    if len(active) != 1:
        return None, None, ("no NFL %s named %s on ESPN" % (want, name)) if not active else ("%d NFL %s named %s" % (len(active), want, name))
    rel = [r for r in active[0].get("teamRelationships", []) if r.get("type") == "team"]
    team = rel[0]["core"]["abbreviation"] if rel and rel[0].get("core") else None
    T._log_call("find(%s) -> ESPN %s, %s" % (name, active[0]["id"], team))
    return str(active[0]["id"]), team, ""


def week_games(week, season):
    url = SCOREBOARD_URL.format(week=week, season=season)
    d = _get(url, "plays_scoreboard_%d.json" % week)
    out = []
    for e in (d or {}).get("events", []):
        c = e["competitions"][0]
        if c.get("status", {}).get("type", {}).get("name") != "STATUS_FINAL":
            continue
        teams = {x["homeAway"]: x["team"]["abbreviation"] for x in c.get("competitors", [])}
        out.append({"event": str(e["id"]), "week": week, "home": teams.get("home"), "away": teams.get("away")})
    T._log_call("scoreboard(week %d) -> %d finished games" % (week, len(out)))
    return out, url


def game_plays(event):
    url = SUMMARY_URL.format(event=event)
    d = _get(url, "plays_game_%s.json" % event)
    ids = {}
    for comp in (d.get("header", {}).get("competitions") or [{}])[0].get("competitors", []):
        ids[str(comp["team"]["id"])] = comp["team"]["abbreviation"]
    plays = []
    for dr in (d.get("drives") or {}).get("previous", []):
        for p in dr.get("plays", []):
            st = p.get("start") or {}
            plays.append({"text": p.get("text") or "", "type": (p.get("type") or {}).get("text", ""),
                          "q": (p.get("period") or {}).get("number"), "clk": (p.get("clock") or {}).get("displayValue"),
                          "dn": st.get("down"), "dist": st.get("distance"), "ytg": st.get("yardsToEndzone"),
                          "off": ids.get(str((st.get("team") or {}).get("id")), None), "yds": p.get("statYardage"),
                          "scoring": bool(p.get("scoringPlay"))})
    T._log_call("game(%s) -> %d plays" % (event, len(plays)))
    return plays, url


def box_lines(event):
    """ESPN's own box score of a game: { espn athlete id: {stat: number} } (the same file as the plays)."""
    d = _get(SUMMARY_URL.format(event=event), "plays_game_%s.json" % event)
    out = {}
    def num(v):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0
    for team in (d.get("boxscore") or {}).get("players", []):
        for cat in team.get("statistics", []):
            keys = cat.get("keys") or []
            for a in cat.get("athletes", []):
                aid = str((a.get("athlete") or {}).get("id"))
                v = dict(zip(keys, a.get("stats") or []))
                o = out.setdefault(aid, {})
                n = cat.get("name")
                if n == "passing":
                    c, att = (v.get("completions/passingAttempts", "0/0").split("/") + ["0"])[:2]
                    o.update(pass_cmp=num(c), pass_att=num(att), pass_yd=num(v.get("passingYards")), pass_td=num(v.get("passingTouchdowns")),
                             pass_int=num(v.get("interceptions")))
                elif n == "rushing":
                    o.update(rush_att=num(v.get("rushingAttempts")), rush_yd=num(v.get("rushingYards")), rush_td=num(v.get("rushingTouchdowns")))
                elif n == "receiving":
                    o.update(rec=num(v.get("receptions")), rec_yd=num(v.get("receivingYards")), rec_td=num(v.get("receivingTouchdowns")),
                             rec_tgt=num(v.get("receivingTargets")))
                elif n == "kicking":
                    fg = (v.get("fieldGoalsMade/fieldGoalAttempts", "0/0").split("/") + ["0"])[:2]
                    xp = (v.get("extraPointsMade/extraPointAttempts", "0/0").split("/") + ["0"])[:2]
                    o.update(fgm=num(fg[0]), fga=num(fg[1]), xpm=num(xp[0]), xpa=num(xp[1]))
    return out


# ---------------------------------------------------------------- parsing one play
def _yards(text):
    if re.search(r"for no gain", text):
        return 0
    m = re.search(r"for (-?\d+) yards?", text)
    return int(m.group(1)) if m else None


def parse(p):
    """The football meaning of one play's text. Returns a dict, or None for plays with no snap (timeouts, ends)."""
    t = re.sub(r"\s+", " ", p["text"]).strip()
    # A replay that reversed the call: ESPN keeps the old text, then "...the play was REVERSED." and the final ruling.
    reversed_ = False
    if re.search(r"the play was REVERSED\.", t):
        t = re.split(r"the play was REVERSED\.", t)[-1].strip()
        reversed_ = True
    body = re.sub(r"^\([^)]*\)\s*", "", t)          # drop "(Shotgun)" and the like
    body = re.sub(r"^(?:[A-Z]\.[A-Za-z'\- ]+ reported in as eligible\.\s*)+", "", body)
    if body.upper().startswith("TWO-POINT CONVERSION"):
        return {"kind": "two_pt", "nullified": False, "td": False}
    out = {"nullified": bool(re.search(r"No Play\.?", t)), "td": "TOUCHDOWN" in t.split("TWO-POINT")[0] and "NULLIFIED" not in t.upper(),
           "reversed": reversed_}
    # A defensive pass interference that was accepted takes the attempt away, like a play that did not happen.
    out["dpi"] = bool(re.search(r"Defensive Pass Interference", t)) and "declined" not in t.split("Defensive Pass Interference")[1][:60].lower()
    # ESPN sometimes writes a play with full names, as in a scoring summary.
    FULL = r"[A-Z][A-Za-z'\-\.]+(?: [A-Z][A-Za-z'\.\-]+)+?"
    m = re.match(r"(%s) Pass Complete for (-?\d+) Yds to (%s)$" % (FULL, FULL), body.rstrip("."))
    if m:
        out.update(kind="pass", passer=short_name(m.group(1)), target=short_name(m.group(3)), yds=int(m.group(2)), depth=None, dir=None,
                   full_text=True)
        return out
    m = re.match(r"(%s) Incomplete Pass, Intended For (%s)$" % (FULL, FULL), body.rstrip("."))
    if m:
        out.update(kind="inc", passer=short_name(m.group(1)), target=short_name(m.group(2)), yds=0, depth=None, dir=None, full_text=True)
        return out
    m = re.match(r"(%s) (\d+) Yd pass from (%s) \(" % (FULL, FULL), body)
    if m:
        out.update(kind="pass", passer=short_name(m.group(3)), target=short_name(m.group(1)), yds=int(m.group(2)), td=True,
                   depth=None, dir=None, full_text=True)
        return out
    m = re.match(r"(%s) (\d+) Yd Run \(" % FULL, body)
    if m:
        out.update(kind="run", rusher=short_name(m.group(1)), yds=int(m.group(2)), td=True, gap=None, full_text=True)
        return out
    m = re.search(r"(%s) (\d+) yard field goal is (GOOD|No Good|BLOCKED)" % NAME, body)
    if m:
        out.update(kind="fg", kicker=m.group(1), dist_fg=int(m.group(2)), good=m.group(3) == "GOOD")
        return out
    m = re.search(r"(%s) sacked" % NAME, body)
    if m:
        out.update(kind="sack", passer=m.group(1), yds=_yards(body))
        return out
    m = re.search(r"(%s) pass (?:incomplete )?(short|deep) (left|middle|right)(?: (?:to|intended for) (%s)(?=[ .,;\[]|$))?" % (NAME, NAME), body)
    if m:
        passer, depth, direction, target = m.group(1), m.group(2), m.group(3), m.group(4)
        if "INTERCEPTED" in body:
            kind = "int"
        elif "pass incomplete" in body:
            kind = "inc"
        else:
            kind = "pass"
        out.update(kind=kind, passer=passer, target=target, depth=depth, dir=direction,
                   yds=(p.get("yds") if kind == "pass" else 0))
        if kind == "pass" and _yards(body) is not None:
            out["yds"] = _yards(body)
        out["fumble_lost"] = bool(re.search(r"FUMBLES.*RECOVERED by", body)) and kind == "pass"
        lat = re.search(r"Lateral to (%s)\b[^.]*? for (-?\d+) yards?" % NAME, body)
        if kind == "pass" and lat:
            out["lateral_to"], out["lateral_yds"] = lat.group(1), int(lat.group(2))
            first = re.search(r" for (-?\d+) yards?", body)
            if first:
                out["yds"] = int(first.group(1))
        return out
    m = re.search(r"(%s) (?:pass )?(?:incomplete|spiked)" % NAME, body)
    if m and "spike" in body.lower():
        out.update(kind="spike", passer=m.group(1))
        return out
    m = re.search(r"(%s) pass incomplete(?! (?:short|deep))" % NAME, body)
    if m:
        out.update(kind="inc", passer=m.group(1), target=None, depth=None, dir=None, yds=0)
        return out
    m = re.search(r"(%s) (scrambles )?(%s)\b[^.]*? for (?:-?\d+ yards?|no gain)" % (NAME, "|".join(GAPS)), body)
    if m:
        out.update(kind="scramble" if m.group(2) else "run", rusher=m.group(1), gap=m.group(3), yds=_yards(body))
        out["fumble_lost"] = bool(re.search(r"FUMBLES.*RECOVERED by", body))
        return out
    m = re.search(r"(%s) (?:scrambles|runs|rushes)?\s*(?:to|for)" % NAME, body)
    if m and p.get("type", "").startswith("Rush"):
        out.update(kind="run", rusher=m.group(1), gap=None, yds=_yards(body))
        return out
    m = re.match(r"(?:Direct snap to %s\.\s*)?(%s) (?:scrambles )?(?:to [A-Z]{2,3} -?\d+ |to the [A-Z]{2,3} -?\d+ |pushed ob at [A-Z]{2,3} -?\d+ |ran ob at [A-Z]{2,3} -?\d+ )?for (?:-?\d+ yards?|no gain)" % (NAME, NAME), body)
    if m:
        out.update(kind="run", rusher=m.group(1), gap=None, yds=_yards(body))
        out["fumble_lost"] = bool(re.search(r"FUMBLES.*RECOVERED by", body))
        return out
    m = re.search(r"(%s) FUMBLES \(Aborted\)" % NAME, body)
    if m:
        out.update(kind="aborted", rusher=m.group(1), yds=0)
        return out
    m = re.search(r"(%s) kneels" % NAME, body)
    if m:
        out.update(kind="kneel", rusher=m.group(1), yds=_yards(body))
        return out
    m = re.search(r"(%s) extra point is (GOOD|No Good|BLOCKED)" % NAME, t)
    if m:
        out.update(kind="xp", kicker=m.group(1), good=m.group(2) == "GOOD")
        return out
    return None


def text_abbr(raw_plays):
    """Each team's abbreviation as the play text writes it (BAL is "BLT" in ESPN's text), worked out from plays
    whose start, gain and end spot are all known."""
    votes = {}
    for r in raw_plays:
        m = re.search(r" to (?:the )?([A-Z]{2,3}) (\d{1,2}) for (-?\d+) yards?", r["text"])
        if not m or not isinstance(r.get("ytg"), int) or not r.get("off"):
            continue
        side, n, y = m.group(1), int(m.group(2)), int(m.group(3))
        start = 100 - r["ytg"]
        if start + y == n and n != 50:
            votes.setdefault(r["off"], {}).setdefault(side, 0)
            votes[r["off"]][side] += 1
    return {team: max(v, key=v.get) for team, v in votes.items()}


def spot_adjust(parsed, raw, abbr=None):
    """An offensive foul beyond the line on a run or a catch: the official yards stop at the spot of the foul.
    Changes parsed["yds"] in place and keeps the gain as written in yds_before_penalty."""
    if not parsed or parsed.get("nullified") or parsed.get("kind") not in ("run", "scramble", "pass"):
        return
    t = raw["text"].split("the play was REVERSED.")[-1]
    y, ytg = parsed.get("yds"), raw.get("ytg")
    if not isinstance(y, int) or not isinstance(ytg, int) or "PENALTY on" not in t or "enforced at" not in t:
        return
    start = 100 - ytg
    own = (abbr or {}).get(raw.get("off"))
    if own is None:
        m = re.search(r" (?:to|at) (?:the )?(?:([A-Z]{2,3}) )?(\d{1,2}) for -?\d+ yards?", t)
        if not m:
            return
        side, n = m.group(1), int(m.group(2))
        if side is None or n == 50:
            own = None
        elif start + y == n:
            own = side
        elif start + y == 100 - n:
            own = "!" + side      # the side named is the other team's
    if own is None:
        return
    def yard_of(abbr, num):
        if abbr is None or num == 50:
            return 50
        mine = abbr == own if not own.startswith("!") else abbr != own[1:]
        return num if mine else 100 - num
    for pen in re.finditer(r"PENALTY on ([A-Z]{2,3})-[^,]+, ([^,]+), (?:\d+ yards?, )?enforced at (?:the )?(?:([A-Z]{2,3}) )?(\d{1,2})", t):
        team, foul, sa, sn = pen.group(1), pen.group(2), pen.group(3), int(pen.group(4))
        on_offense = (team == own) if not own.startswith("!") else (team != own[1:])
        if not on_offense or "declined" in pen.group(0).lower():
            continue
        spot = yard_of(sa, sn)
        if start < spot < start + y:
            parsed["yds_before_penalty"] = y
            parsed["yds"] = spot - start
            return


def game_short(full_name, default_short, texts):
    """ESPN writes a longer first part when two players of a game share the short name ("Bi.Robinson")."""
    last = default_short.split(".", 1)[1]
    first = full_name.split()[0].replace(".", "")
    seen = set(re.findall(r"(?<![A-Za-z'])([A-Z][a-z]{0,4})\." + re.escape(last) + r"(?![A-Za-z'])", texts))
    ours = [v for v in seen if first.startswith(v)]
    return (max(ours, key=len) + "." + last) if ours else default_short


def xp_of(p):
    """The extra point that ESPN writes at the end of a touchdown play: (kicker short name, good) or None.
    A scoring summary line ("James Mitchell 0 Yd Fumble Recovery (Brandon Aubrey Kick)") names the kicker in full."""
    m = re.search(r"(%s) extra point is (GOOD|No Good|BLOCKED)" % NAME, p["text"])
    if m:
        return (m.group(1).strip(), m.group(2) == "GOOD")
    m = re.search(r"\(([A-Z][A-Za-z'\-]+(?: [A-Z][A-Za-z'\.\-]+)+?) (?:Kick|PAT)(?: (failed|Failed|Blocked|blocked))?\)", p["text"])
    if m:
        return (short_name(m.group(1)), m.group(2) is None)
    return None


# ---------------------------------------------------------------- one player's plays
def involve(parsed, raw, short):
    """The role of the player on this play, or None."""
    rx = name_re(short)
    full = parsed.get("full_text")
    def same(x):
        if not x:
            return False
        if full:   # full names were turned into "F.Last": compare the last name and the first letter
            return x.split(".", 1)[1] == short.split(".", 1)[1] and x[0] == short[0]
        return bool(rx.fullmatch(x.strip()) or x.strip() == short)
    k = parsed["kind"]
    if k in ("pass", "inc", "int", "sack", "spike") and same(parsed.get("passer")):
        return "passer"
    if k in ("pass", "inc", "int") and same(parsed.get("target")):
        return "target"
    if k == "pass" and same(parsed.get("lateral_to")):
        return "lateral"
    if k in ("run", "scramble", "kneel", "aborted") and same(parsed.get("rusher")):
        return "rusher"
    if k in ("fg", "xp") and same(parsed.get("kicker")):
        return "kicker"
    return None


def compact(parsed, raw, role, event, week):
    keep = {"ev": event, "wk": week, "q": raw["q"], "clk": raw["clk"], "dn": raw["dn"], "dist": raw["dist"], "ytg": raw["ytg"],
            "kind": parsed["kind"], "role": role, "td": parsed.get("td", False), "nullified": parsed.get("nullified", False),
            "text": raw["text"][:220]}
    for k in ("yds", "depth", "dir", "gap", "passer", "target", "rusher", "kicker", "dist_fg", "good", "fumble_lost", "dpi", "reversed",
              "yds_before_penalty", "lateral_to", "lateral_yds", "full_text"):
        if parsed.get(k) is not None:
            keep[k] = parsed[k]
    return keep


def totals(plays, role_pos):
    """Season totals from a player's own plays (nullified plays left out)."""
    t = {"pass_att": 0, "pass_cmp": 0, "pass_yd": 0, "pass_td": 0, "pass_int": 0, "sacks": 0, "rush_att": 0, "rush_yd": 0,
         "rush_td": 0, "rec_tgt": 0, "rec": 0, "rec_yd": 0, "rec_td": 0, "fga": 0, "fgm": 0, "xpa": 0, "xpm": 0, "games": 0}
    t["games"] = len(set(p["ev"] for p in plays))
    for p in plays:
        if p.get("nullified"):
            continue
        k, r, y = p["kind"], p["role"], p.get("yds") or 0
        if p.get("dpi") and k == "inc":
            continue   # an accepted defensive pass interference: no attempt and no target in the official count
        if r == "passer":
            if k in ("pass", "inc", "int"):
                t["pass_att"] += 1
            if k == "pass":
                t["pass_cmp"] += 1; t["pass_yd"] += y + (p.get("lateral_yds") or 0); t["pass_td"] += 1 if p.get("td") else 0
            if k == "int":
                t["pass_int"] += 1
            if k == "sack":
                t["sacks"] += 1
        elif r == "target":
            t["rec_tgt"] += 1
            if k == "pass":
                t["rec"] += 1; t["rec_yd"] += y; t["rec_td"] += 1 if p.get("td") else 0
        elif r == "lateral":
            t["rec_yd"] += p.get("lateral_yds") or 0
        elif r == "rusher" and k in ("run", "scramble", "kneel", "aborted"):
            t["rush_att"] += 1; t["rush_yd"] += y; t["rush_td"] += 1 if p.get("td") else 0
        elif r == "kicker" and k == "fg":
            t["fga"] += 1; t["fgm"] += 1 if p.get("good") else 0
        elif r == "kicker" and k == "xp":
            t["xpa"] += 1; t["xpm"] += 1 if p.get("good") else 0
    return t


RECONCILE = [("pass_att", "pass_att"), ("pass_cmp", "pass_cmp"), ("pass_yd", "pass_yd"), ("pass_td", "pass_td"),
             ("pass_int", "pass_int"), ("rush_att", "rush_att"), ("rush_yd", "rush_yd"), ("rush_td", "rush_td"),
             ("rec_tgt", "rec_tgt"), ("rec", "rec"), ("rec_yd", "rec_yd"), ("rec_td", "rec_td"), ("fga", "fga"), ("fgm", "fgm"),
             ("xpm", "xpm")]
RELEVANT = {"QB": {"pass_att", "pass_cmp", "pass_yd", "pass_td", "pass_int", "rush_att", "rush_yd", "rush_td"},
            "RB": {"rush_att", "rush_yd", "rush_td", "rec_tgt", "rec", "rec_yd", "rec_td"},
            "WR": {"rec_tgt", "rec", "rec_yd", "rec_td", "rush_att", "rush_yd", "rush_td"},
            "TE": {"rec_tgt", "rec", "rec_yd", "rec_td"},
            "K": {"fga", "fgm", "xpm"}}


def reconcile(mine, sleeper, pos):
    rows = {}
    for ours, theirs in RECONCILE:
        if ours not in RELEVANT[pos]:
            continue
        sv = sleeper.get(theirs)
        sv = float(sv) if isinstance(sv, (int, float)) else (0.0 if sleeper.get("gp") else None)
        rows[ours] = {"plays": mine.get(ours), "sleeper": sv, "difference": None if sv is None else round(mine.get(ours, 0) - sv, 1)}
    return rows


# ---------------------------------------------------------------- the run
def parse_weeks(text):
    if "-" in text:
        a, b = text.split("-")
        return list(range(int(a), int(b) + 1))
    return [int(x) for x in text.split(",")]


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", help="weeks to read, like 1-10 (default: every week with finished games)")
    ap.add_argument("--roster-file", help="JSON {team: {slot: name}} instead of js/data.js and data/rosters/TUR.json, OWL.json")
    ap.add_argument("--out")
    a = ap.parse_args(argv)
    season = T.season()
    log = T.start_run("plays")
    T.log_step("plays starts (no model, fixed order). season=%d" % season)
    if a.roster_file:
        rosters = json.load(open(a.roster_file))
    else:
        rosters = S.rosters_from_js()
        extra = [os.path.join(T.ROOT, "data", "rosters", "%s.json" % t) for t in ("TUR", "OWL")]
        rosters.update(S.rosters_from_files([p for p in extra if os.path.exists(p)]))

    # 1. who, and for which NFL team
    people = []
    for team, roster in rosters.items():
        for slot, name in roster.items():
            pos = S.SLOT_POS[slot]
            aid, nfl, why = find(name, pos)
            sid, swhy = S.resolve(name, pos)
            people.append({"key": "%s.%s" % (team, slot), "name": name, "pos": pos, "short": short_name(name), "espn": aid,
                           "nfl": nfl, "sleeper": sid, "why": why or swhy})
            T.log_step("%s %s: ESPN %s (%s), short name %s, Sleeper %s%s" % (team, slot, aid, nfl, short_name(name), sid,
                                                                          (" - " + (why or swhy)) if (why or swhy) else ""))
    nfl_teams = sorted(set(p["nfl"] for p in people if p["nfl"]))
    T.log_step("plan: read every finished game of %d NFL teams week by week, keep the snaps of our 28 players, then compare "
               "with Sleeper's season totals" % len(nfl_teams))

    # 2. the games
    weeks = parse_weeks(a.weeks) if a.weeks else list(range(1, 19))
    games, team_games, done_weeks = {}, {}, []
    by_player = {p["key"]: [] for p in people}
    box_by_player = {}
    for wk in weeks:
        wg, sb_url = week_games(wk, season)
        if not wg:
            if not a.weeks:
                T.log_step("week %d has no finished games: stop" % wk)
                break
            continue
        done_weeks.append(wk)
        for g in wg:
            if g["home"] not in nfl_teams and g["away"] not in nfl_teams:
                continue
            raw, url = game_plays(g["event"])
            alltext = " ".join(r["text"] for r in raw)
            abbr = text_abbr(raw)
            box = box_lines(g["event"])
            shorts = {pp["key"]: game_short(pp["name"], pp["short"], alltext) for pp in people if pp["nfl"] in (g["home"], g["away"])}
            games[g["event"]] = {"week": wk, "home": g["home"], "away": g["away"], "source": url, "scoreboard": sb_url}
            ctx = {}
            for r in raw:
                pr = parse(r)
                spot_adjust(pr, r, abbr)
                off = r["off"]
                if pr and off and not pr.get("nullified"):
                    c = ctx.setdefault(off, {"pass_att": 0, "rush_att": 0, "plays": 0, "red_zone": 0, "third_down": 0,
                                             "rz_pass": 0, "third_pass": 0, "gl_rush": 0, "sy_rush": 0})
                    is_pass = pr["kind"] in ("pass", "inc", "int") and not (pr.get("dpi") and pr["kind"] == "inc")
                    is_rush = pr["kind"] in ("run", "scramble")
                    ytg = r["ytg"] if isinstance(r["ytg"], int) else None
                    if is_pass and ytg is not None and ytg <= 20:
                        c["rz_pass"] += 1
                    if is_pass and r["dn"] == 3:
                        c["third_pass"] += 1
                    if is_rush and ytg is not None and ytg <= 5:
                        c["gl_rush"] += 1
                    if is_rush and r["dn"] in (3, 4) and isinstance(r["dist"], int) and r["dist"] <= 2:
                        c["sy_rush"] += 1
                    if pr["kind"] in ("pass", "inc", "int") and not (pr.get("dpi") and pr["kind"] == "inc"):
                        c["pass_att"] += 1
                    if pr["kind"] in ("run", "scramble"):
                        c["rush_att"] += 1
                    if pr["kind"] in ("pass", "inc", "int", "run", "scramble", "sack"):
                        c["plays"] += 1
                        if isinstance(r["ytg"], int) and r["ytg"] <= 20:
                            c["red_zone"] += 1
                        if r["dn"] == 3:
                            c["third_down"] += 1
                for person in people:
                    if person["nfl"] not in (g["home"], g["away"]):
                        continue
                    if pr:
                        role = involve(pr, r, shorts[person["key"]])
                        if role and (r["off"] in (None, person["nfl"]) or role == "kicker"):
                            by_player[person["key"]].append(compact(pr, r, role, g["event"], wk))
                    xp = xp_of(r) if not (pr and pr.get("kind") == "xp") else None
                    if xp and person["pos"] == "K" and name_re(shorts[person["key"]]).fullmatch(xp[0]):
                        by_player[person["key"]].append({"ev": g["event"], "wk": wk, "q": r["q"], "clk": r["clk"], "kind": "xp",
                                                          "role": "kicker", "good": xp[1], "nullified": bool(pr and pr.get("nullified")),
                                                          "text": r["text"][:220]})
            for t, c in ctx.items():
                team_games.setdefault(t, {})[g["event"]] = c
            for person in people:
                if person["nfl"] in (g["home"], g["away"]) and person["espn"] in box:
                    box_by_player.setdefault(person["key"], {})[g["event"]] = box[person["espn"]]
        T.log_step("week %d: read %d games of our NFL teams" % (wk, sum(1 for e in games.values() if e["week"] == wk)))

    # 3. reconcile with Sleeper
    doc = {"season": season, "date": T.today(), "weeks": done_weeks,
           "sources": {"search": SEARCH_URL, "scoreboard": SCOREBOARD_URL.replace("{season}", str(season)), "summary": SUMMARY_URL,
                       "sleeper": T.SEASON_URL.replace("{season}", str(season))},
           "note": "Real plays read from ESPN's public play-by-play and parsed from the play text by agents/scout/plays.py. "
                   "Totals are compared with Sleeper's season totals read in the same run.",
           "games": games, "team_games": team_games, "players": {}, "reconcile": {}}
    compared = exact = near = 0
    differ = []
    for person in people:
        pl = sorted(by_player[person["key"]], key=lambda x: (x["wk"], x["q"] or 0, -(int(x["clk"].split(":")[0]) * 60 + int(x["clk"].split(":")[1])) if x.get("clk") and ":" in x["clk"] else 0))
        mine = totals(pl, person["pos"])
        slp = json.loads(T.season_stats(person["sleeper"]))["stats"] if person["sleeper"] else {}
        rec = reconcile(mine, slp, person["pos"])
        for k, r in rec.items():
            if r["sleeper"] is None:
                continue
            compared += 1
            if r["difference"] == 0:
                exact += 1
            elif abs(r["difference"]) <= 1:
                near += 1
                differ.append({"player": person["key"], "name": person["name"], "stat": k, "plays": r["plays"], "sleeper": r["sleeper"]})
            else:
                differ.append({"player": person["key"], "name": person["name"], "stat": k, "plays": r["plays"], "sleeper": r["sleeper"]})
        doc["players"][person["key"]] = {"name": person["name"], "short": person["short"], "position": person["pos"],
                                        "nfl_team": person["nfl"], "espn_id": person["espn"], "sleeper_id": person["sleeper"],
                                        "games": sorted(set(p["ev"] for p in pl)), "totals": mine,
                                        "sleeper": {k: slp.get(k) for k in ("gp",) + tuple(x[1] for x in RECONCILE)},
                                        "reconcile": rec, "notes": person["why"] or "", "plays": pl}
        bad = [k for k, r in rec.items() if r["difference"] not in (0, None)]
        T.log_step("%s: %d plays in %d games; %s" % (person["name"], len(pl), mine["games"],
                                                     "matches Sleeper on every stat" if not bad else "differs on " + ", ".join(
                                                         "%s (%s v %s)" % (k, rec[k]["plays"], rec[k]["sleeper"]) for k in bad)))
    doc["reconcile"] = {"compared": compared, "exact": exact, "within_1": near, "differ": differ,
                        "against": "Sleeper's season totals, read in the same run"}
    # game by game against ESPN's own box score (the same provider and the same game file as the plays)
    bc = bx = 0
    bdiff = []
    for person in people:
        entry = doc["players"][person["key"]]
        lines = box_by_player.get(person["key"], {})
        entry["box"] = lines
        for ev, line in lines.items():
            mine = totals([p for p in entry["plays"] if p["ev"] == ev], person["pos"])
            for k in RELEVANT[person["pos"]]:
                if k not in line:
                    continue
                bc += 1
                if mine[k] == line[k]:
                    bx += 1
                else:
                    bdiff.append({"player": person["key"], "name": person["name"], "event": ev, "week": games[ev]["week"],
                                  "stat": k, "plays": mine[k], "box": line[k]})
    doc["reconcile_box"] = {"compared": bc, "exact": bx, "differ": bdiff,
                            "against": "ESPN's box score of each game, from the same summary file as the plays"}
    T.log_step("against ESPN's box scores, game by game: %d of %d numbers equal" % (bx, bc))
    out = a.out or os.path.join(T.out_dir(), "rosters", "plays-%d.json" % season)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    T.log_step("plays finished: %d games, %d plays kept; %d of %d numbers equal Sleeper exactly, %d within 1" % (
        len(games), sum(len(p["plays"]) for p in doc["players"].values()), exact, compared, near))
    print("log:", log)
    print("wrote %s: %d games, %d of %d numbers equal Sleeper (%d within 1); %d of %d game lines equal ESPN's box scores" % (
        out, len(games), exact, compared, near, doc["reconcile_box"]["exact"], doc["reconcile_box"]["compared"]))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
