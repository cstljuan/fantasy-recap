#!/usr/bin/env python3
"""Build every player profile, team file and matchup file from the data files.

Reads  research/data/<KEY>.json, research/notes/<KEY>.json,
       research/data/league.json, research/data/projections.json
Writes research/players/<KEY>.md, research/teams/<TEAM>.md,
       research/matchups/GOB-vs-PYT.md, research/matchups/TUR-vs-OWL.md

Standard library only. The only model-written prose is the note's
"scouts_read" paragraph. Missing pieces print "not found"; a missing
projections.json prints "projection pending". Never writes an em dash.
Run from the repo root: python3 research/tools/write_profiles.py
"""
import json
import math
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
NOTES = os.path.join(ROOT, "notes")
OUT_PLAYERS = os.path.join(ROOT, "players")
OUT_TEAMS = os.path.join(ROOT, "teams")
OUT_MATCH = os.path.join(ROOT, "matchups")

TEAMS = ["GOB", "PYT", "TUR", "OWL"]
SLOTS = ["QB", "RB", "WR1", "WR2", "WR3", "TE", "K"]
KEYS = [t + "-" + s for t in TEAMS for s in SLOTS]
MATCHUPS = [("GOB", "PYT"), ("TUR", "OWL")]
NF = "not found"


def nz(x):
    """Value or "not found" when empty."""
    return NF if x is None or x == "" else x
PENDING = "projection pending"
EM = "\u2014"


# ---------------------------------------------------------------- helpers
def load(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def clean(s):
    """Text safe to write: no em dash."""
    if s is None:
        return ""
    s = str(s)
    return s.replace(" " + EM + " ", " - ").replace(EM, "-")


def g(d, *path, default=None):
    cur = d
    for p in path:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        elif isinstance(cur, list) and isinstance(p, int) and -len(cur) <= p < len(cur):
            cur = cur[p]
        else:
            return default
    return cur if cur is not None else default


def num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and not (isinstance(x, float) and math.isnan(x))


def f1(x, nd=1):
    if not num(x):
        return NF if x in (None, "") else clean(x)
    if nd == 0:
        return str(int(round(x)))
    return ("%." + str(nd) + "f") % x


def fi(x):
    if not num(x):
        return NF if x in (None, "") else clean(x)
    return "{:,}".format(int(round(x)))


def money(x):
    if not num(x):
        return NF
    if x >= 1e6:
        return "$%.1f million" % (x / 1e6)
    return "$%s" % fi(x)


def pct(x):
    """x may be 0..1 or 0..100."""
    if not num(x):
        return NF if x in (None, "") else clean(x)
    v = x * 100 if 0 <= x <= 1 else x
    return "%.0f%%" % v


def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join("---" for _ in headers) + "|"]
    for r in rows:
        out.append("| " + " | ".join(clean(c).replace("|", "/") for c in r) + " |")
    return "\n".join(out)


def bullets(items):
    return "\n".join("- " + clean(i) for i in items) if items else NF


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = clean(text)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.rstrip() + "\n")


# ------------------------------------------------------- projections access
def first(d, names, default=None):
    """First present key from names (case-insensitive) in dict d."""
    if not isinstance(d, dict):
        return default
    low = {str(k).lower(): k for k in d}
    for n in names:
        if n.lower() in low and d[low[n.lower()]] is not None:
            return d[low[n.lower()]]
    return default


def proj_index(proj):
    """Return {KEY: record} from several possible shapes."""
    idx = {}
    if not isinstance(proj, dict):
        return idx
    cand = first(proj, ["players", "projections", "records"])
    if cand is None:
        cand = {k: v for k, v in proj.items() if k in KEYS}
    if isinstance(cand, dict):
        for k, v in cand.items():
            if isinstance(v, dict):
                idx[k] = v
    elif isinstance(cand, list):
        for v in cand:
            if isinstance(v, dict) and v.get("key"):
                idx[v["key"]] = v
    return idx


def fp_parts(rec):
    """(mean, p10, p50, p90), tolerant of nesting."""
    if not isinstance(rec, dict):
        return (None,) * 4
    fp = first(rec, ["fantasy_points", "fp", "points", "fantasy"])
    if isinstance(fp, dict):
        return (first(fp, ["mean", "avg", "expected"]), first(fp, ["p10", "10", "low"]),
                first(fp, ["p50", "median", "50"]), first(fp, ["p90", "90", "high"]))
    mean = fp if num(fp) else first(rec, ["fp_mean", "mean", "points_mean"])
    return (mean, first(rec, ["fp_p10", "p10"]), first(rec, ["fp_p50", "p50", "median"]),
            first(rec, ["fp_p90", "p90"]))


def td_chance(rec):
    return first(rec, ["touchdown_chance", "td_chance", "td_prob", "anytime_td", "td_probability"])


def play_chance(rec):
    return first(rec, ["chance_of_playing", "play_chance", "p_play", "chance_playing"])


def stat_line(rec):
    sl = first(rec, ["projected_stat_line", "stat_line", "stats", "projected_stats"])
    if isinstance(sl, dict):
        items = [(k, v) for k, v in sl.items() if num(v) and v != 0]
        return ", ".join("%s %s" % (k.replace("_", " "), f1(v)) for k, v in items) or NF
    if isinstance(sl, str) and sl:
        return sl
    return NF


def miss_for(proj, pos):
    """Typical miss for a position from backtest_summary, as a number or None."""
    bs = first(proj, ["backtest_summary"]) if isinstance(proj, dict) else None
    if bs is None:
        return None
    found = [None]

    def walk(o):
        if found[0] is not None:
            return
        if isinstance(o, dict):
            for k, v in o.items():
                if str(k).upper() == pos:
                    if num(v):
                        found[0] = v
                        return
                    if isinstance(v, dict):
                        for kk in ("mae", "mean_abs_error", "typical_miss", "model_mae", "model"):
                            if num(v.get(kk)):
                                found[0] = v[kk]
                                return
                walk(v)
        elif isinstance(o, str):
            m = re.search(r"\b%s\b[^.;\n]{0,60}?(\d+(?:\.\d+)?)\s*(?:points|pts)" % pos, o)
            if m:
                found[0] = float(m.group(1))

    walk(bs)
    if found[0] is None and isinstance(bs, dict):
        for kk in ("mae", "mean_abs_error", "typical_miss", "model_mae"):
            v = bs.get(kk)
            if isinstance(v, dict) and num(v.get(pos)):
                return v[pos]
    return found[0]


def pos_of(key):
    s = key.split("-")[1]
    return "WR" if s.startswith("WR") else s


# ---------------------------------------------------------------- data load
def load_all():
    league = load(os.path.join(DATA, "league.json"))
    proj = load(os.path.join(DATA, "projections.json"))
    pdata = {k: load(os.path.join(DATA, k + ".json")) for k in KEYS}
    pnotes = {k: load(os.path.join(NOTES, k + ".json")) for k in KEYS}
    return league, proj, pdata, pnotes


# ------------------------------------------------------------ player pieces
def next_game_line(d):
    ng = g(d, "next_games", 0)
    if not ng:
        return NF
    ha = "home" if ng.get("home") else "away"
    s = "Week %s, %s %s (%s)" % (ng.get("week", NF), "vs" if ng.get("home") else "at", ng.get("opp", NF), ha)
    s += ", %s %s local, kickoff %s UTC" % (ng.get("weekday", ""), ng.get("time", ""), ng.get("kickoff_utc", NF))
    s += ", line %s, total %s" % (ng.get("line") or NF, f1(ng.get("over_under", ng.get("total"))))
    if num(ng.get("implied")):
        s += ", implied team points %s" % f1(ng["implied"])
    w = []
    if ng.get("weather"):
        w.append(str(ng["weather"]))
    if num(ng.get("temperature")):
        w.append("%s F" % fi(ng["temperature"]))
    if num(ng.get("wind")):
        w.append("wind %s mph" % fi(ng["wind"]))
    s += ", weather " + (", ".join(w) if w else NF)
    if ng.get("venue"):
        s += ", at %s" % ng["venue"]
    if ng.get("broadcast"):
        s += ", on %s" % ng["broadcast"]
    return s


def header(key, d):
    if not d:
        return ["# %s" % key, "", "Data file: %s" % NF]
    return ["# %s" % d.get("name", key), "", table(["Item", "Value"], [
        ["Key", key],
        ["NFL team", d.get("nfl_team", NF)],
        ["Position", d.get("position", NF)],
        ["Fantasy team and slot", "%s, %s" % (d.get("fantasy_team", NF), d.get("slot", NF))],
        ["Depth chart", g(d, "bio", "depth_chart", default=NF)],
        ["Next game", next_game_line(d)],
        ["Data built", d.get("built", NF)],
    ])]


def bio_section(d):
    b = g(d, "bio", default={}) or {}
    out = ["## Bio", ""]
    rows = [
        ["Age", b.get("age", NF)], ["Born", "%s, %s" % (b.get("born", NF), b.get("birthplace", NF))],
        ["Height and weight", "%s, %s lb" % (b.get("height", NF), f1(b.get("weight_lb"), 0))],
        ["High school", b.get("high_school", NF)],
        ["College", "%s (%s)" % (b.get("college", NF), b.get("college_conference", NF))],
        ["Draft", "%s, team %s" % (nz(b.get("draft")), nz(b.get("draft_team")))],
        ["Experience", "%s years, debut %s" % (nz(b.get("years_experience")), nz(b.get("debut_year")))],
        ["Jersey", b.get("jersey", NF)],
    ]
    out.append(table(["Item", "Value"], rows))
    aw = b.get("awards")
    if aw:
        out += ["", "Awards: " + "; ".join("%s %s (%s)" % (a.get("count", ""), a.get("name", ""),
                ", ".join(a.get("seasons", []))) for a in aw if isinstance(a, dict))]
    out += ["", "### Body and combine", ""]
    cb = b.get("combine")
    if cb:
        lab = {"forty": "40-yard dash", "vertical": "vertical", "broad_jump": "broad jump",
               "cone": "3-cone", "shuttle": "shuttle"}
        out.append(table(["Test", "Result"], [[lab.get(k, k), v] for k, v in cb.items()]))
    else:
        out.append("Combine numbers: " + NF)
    out += ["", "### Madden ratings", ""]
    m = b.get("madden")
    if m and isinstance(m.get("ratings"), dict):
        top = sorted(((k, v) for k, v in m["ratings"].items() if num(v) and k not in ("injury", "overall", "toughness")), key=lambda kv: -kv[1])[:8]
        out.append("Overall %s (%s). Top ratings: %s." % (m.get("overall", NF), m.get("edition", NF),
                   ", ".join("%s %s" % (k, v) for k, v in top)))
        if m.get("abilities"):
            out += ["", "Abilities: " + ", ".join(m["abilities"]) + "."]
    else:
        out.append("Madden ratings: " + NF)
    out += ["", "### Contract", ""]
    c = b.get("contract")
    if c:
        out.append("%s, signed %s for %s years, total %s, per year %s, guaranteed %s, active: %s. "
                   "Caution from the data file: extensions signed after 2022 may be missing."
                   % (c.get("team", NF), c.get("signed", NF), c.get("years", NF),
                      money(c.get("total_value_usd")), money(c.get("per_year_usd")),
                      money(c.get("guaranteed_usd")), c.get("active", NF)))
    else:
        out.append("Contract: " + NF)
    return out


STAT_COLS = ["games", "cmp", "att", "pass_yd", "pass_td", "int", "car", "rush_yd", "rush_td",
             "tgt", "rec", "rec_yd", "rec_td", "fgm", "fga", "xpm", "fum_lost", "fp", "fp_per_game"]


def stat_table(items, label):
    items = [(k, v) for k, v in items if isinstance(v, dict)]
    if not items:
        return NF
    cols = [c for c in STAT_COLS if c in ("games", "fp", "fp_per_game")
            or any(num(v.get(c)) and v.get(c) != 0 for _, v in items)]
    rows = []
    for k, v in items:
        rows.append([k] + [(f1(v.get(c)) if c in ("fp", "fp_per_game") else fi(v.get(c))) if num(v.get(c)) else "-"
                           for c in cols])
    return table([label] + cols, rows)


def career_section(d):
    out = ["## Career", ""]
    c = g(d, "career", default={}) or {}
    bs = c.get("by_season")
    if isinstance(bs, dict) and bs:
        out += ["Regular season totals by season.", "", stat_table(sorted(bs.items()), "season")]
    else:
        out.append("Season table: " + NF)
    reg = c.get("regular")
    if reg:
        out += ["", "Career regular season: %s games, %s fantasy points, %s per game."
                % (fi(reg.get("games")), f1(reg.get("fp")), f1(reg.get("fp_per_game")))]
    po = c.get("playoffs")
    if po and num(po.get("games")) and po.get("games"):
        out.append("Playoffs: %s games, %s fantasy points, %s per game."
                   % (fi(po.get("games")), f1(po.get("fp")), f1(po.get("fp_per_game"))))
    return out


def splits_section(d):
    out = ["## Splits", ""]
    sc = g(d, "splits_career", default={}) or {}
    s26 = g(d, "splits_2026", default={}) or {}
    opp = [(k, v) for k, v in (sc.get("opponent") or {}).items()
           if isinstance(v, dict) and num(v.get("fp_per_game")) and num(v.get("games")) and v["games"] >= 2]
    if opp:
        opp.sort(key=lambda kv: -kv[1]["fp_per_game"])
        out += ["### By opponent, career (opponents faced at least twice)", "",
                "Best:", "", stat_table(opp[:5], "opponent"), "",
                "Worst:", "", stat_table(list(reversed(opp[-5:])), "opponent"), ""]
    else:
        out += ["By opponent: " + NF, ""]
    nxt = g(d, "next_games", 0, "opp")
    if nxt and isinstance(sc.get("opponent"), dict) and nxt in sc["opponent"]:
        out += ["Against the next opponent (%s), career:" % nxt, "",
                stat_table([(nxt, sc["opponent"][nxt])], "opponent"), ""]
    for label, name in [("Home and away", "home_away"), ("Roof", "roof"), ("Surface", "surface"),
                        ("Temperature", "temperature"), ("Wind", "wind"), ("Favorite or underdog", "spread")]:
        v = sc.get(name)
        out += ["### %s, career" % label, "",
                stat_table(list(v.items()), "split") if isinstance(v, dict) and v else NF]
        v26 = s26.get(name)
        if isinstance(v26, dict) and v26 and name in ("home_away", "roof", "surface", "spread"):
            out += ["", "2026 only:", "", stat_table(list(v26.items()), "split")]
        out.append("")
    return out


def depth_lines(label, node, keys):
    out = []
    if not isinstance(node, dict):
        return out
    for k in keys:
        sub = node.get(k)
        if isinstance(sub, dict) and sub:
            rows = [(n, v) for n, v in sub.items() if isinstance(v, dict)]
            rows.sort(key=lambda nv: -(nv[1].get("n") or 0))
            trs = [[n, v.get("n"), v.get("yds"), v.get("per"), v.get("td"),
                    "-" if v.get("catch_or_cmp_pct") is None else "%s%%" % v.get("catch_or_cmp_pct")]
                   for n, v in rows]
            trs = [[str(c) for c in r] for r in trs]
            out += ["%s, %s:" % (label, k.replace("by_", "by ").replace("_", " ")), "",
                    table(["group", "plays", "yards", "per play", "TD", "catch or completion"], trs), ""]
    return out


def usage_section(d):
    out = ["## 2026 usage", ""]
    pos = d.get("position")
    s = g(d, "season_2026", "totals")
    if isinstance(s, dict):
        out += ["Season totals through the games played so far:", "", stat_table([("2026", s)], "season")]
    else:
        out.append("Season totals: " + NF)
    team = g(d, "season_2026", "team")
    if isinstance(team, dict):
        out += ["", "His team: record %s, %s points per game scored, %s allowed."
                % (team.get("record", NF), f1(team.get("points_for")), f1(team.get("points_against")))]
    ss = g(d, "season_2026", "sleeper_sums", default={}) or {}
    snaps = [(k, ss[k]) for k in ss if "snap" in k.lower() and num(ss[k])]
    rz = [(k, ss[k]) for k in ss if ("rz" in k.lower() or "red" in k.lower()) and num(ss[k])]
    out += ["", "Snaps: " + (", ".join("%s %s" % (k.replace("_", " "), f1(v)) for k, v in snaps[:6]) if snaps else NF)]
    out += ["", "Red zone (weekly sums): " + (", ".join("%s %s" % (k.replace("_", " "), f1(v)) for k, v in rz[:8]) if rz else NF), ""]
    ts = g(d, "teammates_2026", "top_targets")
    if isinstance(ts, list) and ts:
        out.append("Team target leaders: " + "; ".join("%s %s targets (%s share)" % (
            t.get("name"), t.get("targets"), pct(t.get("share"))) for t in ts[:5]) + ".")
        me = [t for t in ts if t.get("name") == d.get("name")]
        if me:
            out += ["", "His own target share: %s." % pct(me[0].get("share"))]
    else:
        out.append("Team target shares: " + NF)
    tr = g(d, "teammates_2026", "top_rushers")
    if isinstance(tr, list) and tr and pos in ("RB", "QB"):
        out += ["", "Team rushing leaders: " + "; ".join(
            "%s %s carries, %s yards" % (t.get("name"), t.get("carries", t.get("car", NF)), t.get("rush_yd", t.get("yards", NF)))
            for t in tr[:4]) + "."]
    p = g(d, "plays_2026", default={}) or {}
    out += ["", "### Play tendencies, 2026 play-by-play", ""]
    if p:
        t = p.get("throws_or_targets")
        if isinstance(t, dict):
            label = "Throws" if pos == "QB" else "Targets"
            out += ["%s: %s in %s games." % (label, t.get("n", NF), p.get("games", NF)), ""]
            out += depth_lines(label, t, ("by_depth", "by_direction", "by_field_zone"))
        r = p.get("runs")
        if isinstance(r, dict):
            out += ["Rushing plays: %s." % r.get("n", NF), ""]
            out += depth_lines("Runs", r, ("by_kind", "by_gap", "by_field_zone"))
        k = p.get("kicks")
        if isinstance(k, dict):
            out += ["Kicks by distance band: " + "; ".join("%s: %s of %s" % (n, v.get("made"), v.get("tried"))
                    for n, v in k.items() if isinstance(v, dict)) + ".", ""]
        if p.get("sacks_taken") is not None:
            out += ["Sacks taken: %s." % p["sacks_taken"], ""]
        lp = p.get("longest_plays")
        if lp:
            out += ["Longest plays:", ""] + ["- Week %s: %s yards%s. %s" % (x.get("week"), x.get("yards"),
                    ", touchdown" if x.get("td") else "", x.get("text", "")) for x in lp[:3]] + [""]
        tds = p.get("touchdown_plays")
        if isinstance(tds, list) and tds:
            kinds, yo = {}, []
            for x in tds:
                kinds[x.get("kind", "other")] = kinds.get(x.get("kind", "other"), 0) + 1
                if num(x.get("from_yards_out")):
                    yo.append(x["from_yards_out"])
            out += ["Touchdowns in the play log: %d (%s). From inside the 20: %d of %d."
                    % (len(tds), ", ".join("%s %d" % (k, v) for k, v in kinds.items()),
                       len([y for y in yo if y <= 20]), len(yo)), ""]
    else:
        out.append("Play-by-play: " + NF)
    return out


def health_section(d, note):
    out = ["## Health", ""]
    st = g(d, "status", default={}) or {}
    out.append("Sleeper status: %s. Injury status: %s. Body part: %s." % (
        st.get("sleeper_status") or NF, st.get("injury_status") or "none listed", st.get("injury_body_part") or NF))
    if st.get("injury_notes"):
        out += ["", "Notes: %s" % st["injury_notes"]]
    e = st.get("espn")
    if isinstance(e, dict):
        out += ["", "ESPN report (%s): %s. %s" % (e.get("date", NF), e.get("status", NF), e.get("short", ""))]
        if e.get("long"):
            out += ["", e["long"]]
        rd = g(e, "details", "returnDate")
        if rd:
            out += ["", "Listed return date: %s." % rd]
    else:
        out += ["", "ESPN report: " + NF]
    av = g(note, "availability")
    out += ["", "### Availability from the research note", ""]
    if isinstance(av, dict):
        out.append("Status: %s. %s Expected return: %s. Source: %s (%s)." % (
            av.get("status", NF), av.get("detail", ""), nz(av.get("expected_return")), nz(av.get("source")),
            av.get("date") or "date not shown"))
    else:
        out.append("Note availability: " + NF)
    irs = g(d, "injury_reports", default=[]) or []
    out += ["", "### Injury report history", ""]
    if irs:
        recent = irs[-8:]
        out += ["%d reports in the data file; the latest %d:" % (len(irs), len(recent)), "",
                table(["season", "week", "injury", "game status", "practice"],
                      [[r.get("season"), r.get("week"), r.get("injury"), r.get("game_status") or "none",
                        r.get("practice") or NF] for r in recent])]
    else:
        out.append("Injury reports: none in the data file.")
    return out


def facts(items):
    out = []
    for it in items or []:
        if not isinstance(it, dict):
            out.append(clean(it))
            continue
        s = "%s (source: %s; date: %s" % (it.get("fact", ""), it.get("source") or NF, it.get("date") or "date not shown")
        if it.get("confidence"):
            s += "; %s" % it["confidence"]
        out.append(s + ")")
    return out


def background_section(d, note):
    out = ["## Family and background", ""]
    if not note:
        out.append("Research note: " + NF)
    else:
        for title, sec in [("Background", "background"), ("Family", "family"), ("Style of play", "style"),
                           ("Recent events", "recent_events"), ("Team context", "team_context"),
                           ("Next opponent", "next_opponent"), ("Quotes", "quotes")]:
            out += ["### " + title, "", bullets(facts(note.get(sec))), ""]
    nw = g(d, "news", "recent", default=[]) or []
    if nw:
        out += ["### Recent headlines from the data file (outlet and date; no address stored)", "",
                bullets("%s: %s (%s)" % (n.get("date", NF), n.get("title", ""), n.get("source", NF)) for n in nw[:8])]
    return out


def prediction_section(key, note, proj, pidx):
    out = ["## Prediction", ""]
    if proj is None:
        out.append(PENDING)
    else:
        rec = pidx.get(key)
        if not rec:
            out.append("Projection for this player: " + NF)
        else:
            mean, p10, p50, p90 = fp_parts(rec)
            ha = first(rec, ["home_away"])
            if ha is None:
                h = first(rec, ["home"])
                ha = "home" if h is True else "away" if h is False else ""
            tdc, pc = td_chance(rec), play_chance(rec)
            out.append(table(["Item", "Value"], [
                ["Week and opponent", "week %s, %s %s" % (first(rec, ["week"], NF), ha, first(rec, ["opponent", "opp"], NF))],
                ["Projected stat line", stat_line(rec)],
                ["Fantasy points, mean", f1(mean)],
                ["Fantasy points, 10th to 90th range", "%s to %s" % (f1(p10), f1(p90))],
                ["Fantasy points, median", f1(p50)],
                ["Chance of a touchdown", pct(tdc) if tdc is not None else NF],
                ["Chance of playing", pct(pc) if pc is not None else NF],
                ["Method", first(rec, ["method", "method_used"], NF)],
                ["Reason", first(rec, ["reason", "one_line_reason"], NF)],
            ]))
            miss = miss_for(proj, pos_of(key))
            out.append("")
            bs = first(proj, ["backtest_summary"]) if isinstance(proj, dict) else None
            bs = bs if isinstance(bs, dict) else {}
            test = bs.get("test") or "the backtest period"
            cov = bs.get("band_10_90_coverage_2026")
            cov_txt = (", and the 10th to 90th range held the real score %s of the time" % pct(cov)) if num(cov) else ""
            if miss is not None:
                out.append("How sure this is: in the backtest on %s the model missed by about %s fantasy points on a "
                           "typical %s%s." % (test, f1(miss), pos_of(key), cov_txt))
            else:
                ov = g(bs, "mae_2026_all_rows", "model")
                if num(ov):
                    out.append("How sure this is: in the backtest on %s the model missed by about %s fantasy points on a "
                               "typical player (all positions together; no per-position figure)%s." % (test, f1(ov), cov_txt))
                else:
                    out.append("How sure this is: typical miss from the backtest: %s." % NF)
            out.append("Treat the 10th to 90th range as the realistic spread, not a promise.")
    out += ["", "### Scout's read", ""]
    ol = g(note, "outlook_next_game")
    if isinstance(ol, dict):
        out += ["Lean from the note: %s (confidence %s)." % (ol.get("lean", NF), ol.get("confidence", NF)), ""]
    out.append(clean(g(note, "scouts_read", default=NF)))
    oq = g(note, "open_questions")
    if oq:
        out += ["", "Open questions:", ""] + [("- " + clean(q if isinstance(q, str) else json.dumps(q))) for q in oq]
    return out


def sources_section(key, d, note):
    urls = []

    def add(u):
        u = (u or "").strip() if isinstance(u, str) else ""
        if u and u != "not found" and u not in urls:
            urls.append(u)

    if note:
        for sec in ("background", "family", "recent_events", "quotes", "team_context", "next_opponent", "style"):
            for it in note.get(sec) or []:
                if isinstance(it, dict):
                    add(it.get("source"))
        add(g(note, "availability", "source"))
        for s in note.get("searches") or []:
            if isinstance(s, dict):
                add(s.get("url") or s.get("source"))
            elif isinstance(s, str) and s.startswith("http"):
                add(s)
    if d:
        t = g(d, "wikipedia", "title")
        if t:
            add("https://en.wikipedia.org/wiki/" + str(t).replace(" ", "_"))
        add("research/data/%s.json" % key)
    add("research/data/league.json")
    return ["## Sources", ""] + ["- " + clean(u) for u in urls]


def player_md(key, proj, pidx, d, note):
    parts = header(key, d)
    if d:
        for sec in (bio_section(d), career_section(d), splits_section(d), usage_section(d), health_section(d, note)):
            parts += [""] + sec
    else:
        parts += ["", "Data file: " + NF]
    parts += [""] + background_section(d, note)
    parts += [""] + prediction_section(key, note, proj, pidx)
    parts += [""] + sources_section(key, d, note)
    return "\n".join(str(p) for p in parts)


# ------------------------------------------------------------- team files
def team_players(team, pdata, pidx):
    rows = []
    for s in SLOTS:
        k = team + "-" + s
        d, rec = pdata.get(k), pidx.get(k)
        mean, p10, p50, p90 = fp_parts(rec)
        rows.append({"key": k, "slot": s, "d": d, "rec": rec, "name": g(d, "name", default=NF),
                     "nfl": g(d, "nfl_team", default=NF), "mean": mean if num(mean) else None,
                     "p10": p10 if num(p10) else None, "p90": p90 if num(p90) else None})
    return rows


def total_range(rows):
    if not any(r["mean"] is not None for r in rows):
        return None
    mean = sum(r["mean"] for r in rows if r["mean"] is not None)
    lo = hi = 0.0
    for r in rows:
        if r["mean"] is None:
            continue
        lo += (r["mean"] - (r["p10"] if r["p10"] is not None else r["mean"])) ** 2
        hi += ((r["p90"] if r["p90"] is not None else r["mean"]) - r["mean"]) ** 2
    return mean, mean - math.sqrt(lo), mean + math.sqrt(hi)


def top_group(node, key):
    sub = (node or {}).get(key)
    if not isinstance(sub, dict):
        return None
    items = [(k, v) for k, v in sub.items() if isinstance(v, dict) and num(v.get("n"))]
    items.sort(key=lambda kv: -kv[1]["n"])
    return items[0] if items else None


def tendencies(d):
    """Plain sentences on how a player gets his points."""
    if not d:
        return NF
    p = g(d, "plays_2026", default={}) or {}
    pos = d.get("position")
    bits = []
    t, r = p.get("throws_or_targets"), p.get("runs")
    if pos == "K":
        tot = g(d, "season_2026", "totals", default={}) or {}
        return "kicks: %s of %s field goals and %s of %s extra points this season" % (
            fi(tot.get("fgm")), fi(tot.get("fga")), fi(tot.get("xpm")), fi(tot.get("xpa")))
    if isinstance(t, dict) and t.get("n"):
        dp = (t.get("by_depth") or {}).get("deep") or {}
        if pos == "QB":
            bits.append("%s of %s throws (%d%%) go deep" % (dp.get("n", 0), t["n"], round(100.0 * dp.get("n", 0) / t["n"])))
        else:
            bits.append("%s targets, %s of them deep" % (t["n"], dp.get("n", 0)))
        tg = top_group(t, "by_direction")
        if tg:
            bits.append("most often to the %s side" % tg[0])
        fz = (t.get("by_field_zone") or {})
        rzn = sum((fz.get(z) or {}).get("n", 0) for z in ("6 to 20", "inside the 5"))
        bits.append("%s red zone looks" % rzn)
    if isinstance(r, dict) and r.get("n"):
        tg = top_group(r, "by_gap")
        if tg:
            bits.append("%s carries, most often %s (%s yards per carry)" % (r["n"], tg[0], f1(tg[1].get("per"))))
        sc = (r.get("by_kind") or {}).get("scramble")
        if sc and pos == "QB":
            bits.append("%s scrambles for %s yards" % (sc.get("n"), sc.get("yds")))
    tds = p.get("touchdown_plays")
    if isinstance(tds, list) and tds:
        near = [x for x in tds if num(x.get("from_yards_out")) and x["from_yards_out"] <= 10]
        bits.append("%d of %d touchdowns came from inside the 10" % (len(near), len(tds)))
    return "; ".join(bits) if bits else NF


def current_week(pdata):
    wk = [g(d, "next_games", 0, "week") for d in pdata.values() if d]
    wk = [w for w in wk if num(w)]
    return min(wk) if wk else None


def risk_note(d, cw):
    if not d:
        return NF
    flags = []
    st = g(d, "status", default={}) or {}
    s = st.get("injury_status") or g(st, "espn", "status")
    if s and str(s).lower() not in ("active", "none"):
        part = st.get("injury_body_part")
        flags.append("%s%s" % (s, " (%s)" % part if part else ""))
    ng = g(d, "next_games", 0)
    if ng:
        if cw and num(ng.get("week")) and ng["week"] > cw:
            flags.append("no game this week (bye or already played), next is week %s" % ng["week"])
        elif ng.get("status") not in (None, "STATUS_SCHEDULED"):
            flags.append("game status %s" % str(ng["status"]).replace("STATUS_", "").lower())
    return "; ".join(flags) if flags else "none found"


def team_md(team, pdata, pnotes, proj, pidx, cw):
    rows = team_players(team, pdata, pidx)
    ph = PENDING if proj is None else NF
    out = ["# Fantasy team %s" % team, "", "## Roster and projections", ""]
    trs = []
    for r in rows:
        rec = r["rec"]
        tdc, pc = td_chance(rec), play_chance(rec)
        trs.append([r["slot"], r["name"], r["nfl"],
                    f1(r["mean"]) if r["mean"] is not None else ph,
                    ("%s to %s" % (f1(r["p10"]), f1(r["p90"]))) if r["p10"] is not None and r["p90"] is not None else ph,
                    pct(tdc) if tdc is not None else ph, pct(pc) if pc is not None else ph,
                    g(r["d"], "next_games", 0, "opp", default=NF)])
    out.append(table(["Slot", "Player", "NFL", "Projected mean", "10th to 90th", "TD chance", "Chance of playing", "Opponent"], trs))
    tr = total_range(rows)
    out += ["", "## Projected team total", ""]
    if tr:
        out.append("Projected total %s fantasy points, approximate 10th to 90th range %s to %s "
                   "(player ranges combined as if independent, so the real range may differ a little)."
                   % (f1(tr[0]), f1(tr[1]), f1(tr[2])))
    else:
        out.append(ph)
    out += ["", "## How this team scores", ""]
    ms = sorted([r for r in rows if r["mean"] is not None], key=lambda r: -r["mean"])
    if ms and tr and tr[0] > 0:
        out.append(table(["Player", "Slot", "Projected mean", "Share of team total"],
                         [[r["name"], r["slot"], f1(r["mean"]), pct(r["mean"] / tr[0])] for r in ms]))
        out += ["", "The team leans on " + ", ".join("%s (%s)" % (r["name"], pct(r["mean"] / tr[0])) for r in ms[:3]) + "."]
    else:
        out.append("Shares by projected points: " + ph)
        s26 = [(r["name"], g(r["d"], "season_2026", "totals", "fp")) for r in rows]
        s26 = [(n, v) for n, v in s26 if num(v)]
        if s26:
            tot = sum(v for _, v in s26) or 1
            out += ["", "Share of 2026 fantasy points so far: " + "; ".join(
                "%s %s" % (n, pct(v / tot)) for n, v in sorted(s26, key=lambda x: -x[1]))]
    out += ["", "## Likely ways each player gets his points", ""]
    out += ["- %s, %s: %s" % (r["slot"], r["name"], clean(tendencies(r["d"]))) for r in rows]
    s26 = sorted([(r, g(r["d"], "season_2026", "totals", "fp_per_game")) for r in rows
                  if num(g(r["d"], "season_2026", "totals", "fp_per_game"))], key=lambda x: -x[1])
    out += ["", "## Strengths", "", bullets(["%s (%s): %s fantasy points per game in 2026" % (r["name"], r["slot"], f1(v))
                                            for r, v in s26[:3]])]
    out += ["", "## Weaknesses", "", bullets(["%s (%s): %s fantasy points per game in 2026" % (r["name"], r["slot"], f1(v))
                                              for r, v in s26[-2:]] if len(s26) >= 4 else [])]
    rzl = []
    for r in rows:
        tds = g(r["d"], "plays_2026", "touchdown_plays")
        if isinstance(tds, list) and tds:
            near = len([x for x in tds if num(x.get("from_yards_out")) and x["from_yards_out"] <= 10])
            rzl.append("%s: %d touchdowns this season, %d from inside the 10" % (r["name"], len(tds), near))
    out += ["", "## Red zone", "", bullets(rzl)]
    flags = ["%s (%s, %s): %s" % (r["name"], r["slot"], r["nfl"], risk_note(r["d"], cw)) for r in rows
             if risk_note(r["d"], cw) != "none found"]
    out += ["", "## Who is missing or at risk", "", bullets(flags) if flags else "No player flagged."]
    out += ["", "## Availability from the research notes", ""]
    for r in rows:
        av = g(pnotes.get(r["key"]), "availability", "status")
        out.append("- %s: %s" % (r["name"], av if av else "research note " + NF))
    out += ["", "Player files: " + ", ".join("research/players/%s.md" % r["key"] for r in rows)]
    return "\n".join(out)


# ------------------------------------------------------------ matchup files
def flatten(o, pre=""):
    out = []
    if isinstance(o, dict):
        for k, v in o.items():
            out += flatten(v, (pre + "." if pre else "") + str(k))
    elif isinstance(o, list):
        if all(not isinstance(x, (dict, list)) for x in o):
            out.append((pre, ", ".join(str(x) for x in o)))
        else:
            for i, v in enumerate(o):
                out += flatten(v, "%s[%d]" % (pre, i))
    else:
        out.append((pre, o))
    return out


def find_matchup(proj, a, b):
    m = first(proj, ["matchups"]) if isinstance(proj, dict) else None
    if m is None:
        return None
    items = list(m.items()) if isinstance(m, dict) else [(None, x) for x in m]
    for k, v in items:
        if str(k) in ("%s vs %s" % (a, b), "%s vs %s" % (b, a)):
            return v if isinstance(v, dict) else {"value": v}
    return None


def window(ng, cw):
    wd, tm, wk = ng.get("weekday", ""), ng.get("time", "") or "", ng.get("week")
    if cw and num(wk) and wk > cw:
        return "Not this week (bye or already played)"
    if wd == "Thursday":
        return "Thursday night"
    if wd in ("Friday", "Saturday"):
        return wd
    if wd == "Monday":
        return "Monday night"
    if wd == "Sunday":
        try:
            h = int(tm.split(":")[0])
        except (ValueError, IndexError):
            return "Sunday"
        return "Sunday early window" if h < 15 else ("Sunday late window" if h < 19 else "Sunday night")
    return wd or "time " + NF


def matchup_md(a, b, pdata, pnotes, proj, pidx, cw):
    ra, rb = team_players(a, pdata, pidx), team_players(b, pdata, pidx)
    ph = PENDING if proj is None else NF
    ta, tb = total_range(ra), total_range(rb)
    out = ["# %s vs %s" % (a, b), "", "## Expected score", ""]
    m = find_matchup(proj, a, b) if proj is not None else None
    if proj is None:
        out.append(PENDING)
    elif m is None:
        out.append("Matchup entry in projections.json: " + NF)
    if ta and tb:
        out += ["", table(["Side", "Sum of player means", "Approx. 10th to 90th"],
                          [[a, f1(ta[0]), "%s to %s" % (f1(ta[1]), f1(ta[2]))],
                           [b, f1(tb[0]), "%s to %s" % (f1(tb[1]), f1(tb[2]))]]),
                "", "On player means alone, %s is ahead by %s points." % (a if ta[0] >= tb[0] else b, f1(abs(ta[0] - tb[0])))]
    if m:
        wa, wb, tie = m.get("win_chance_" + a), m.get("win_chance_" + b), m.get("tie_chance")
        if num(wa) and num(wb):
            lead, lw = (a, wa) if wa >= wb else (b, wb)
            out += ["", "## Win chance and margin", "",
                    "In the simulation %s wins %s of the time." % (lead, pct(lw)), ""]
            def pc1(x):
                return ("%.1f%%" % (x * 100)) if num(x) else NF
            rows_ = [["Win chance", pc1(wa), pc1(wb)],
                     ["Tie chance", pc1(tie), ""],
                     ["Mean score", f1(m.get("mean_score_" + a)), f1(m.get("mean_score_" + b))],
                     ["Median score", f1(m.get("median_score_" + a)), f1(m.get("median_score_" + b))]]
            note = m.get("margin_note") or ""
            rows_.append(["Margin, 10th to 90th range (%s)" % (clean(note) if note else NF),
                          "%s to %s" % (f1(m.get("margin_p10")), f1(m.get("margin_p90"))), ""])
            dr = m.get("draws")
            rows_.append(["Simulated draws", str(int(dr)) if num(dr) else NF, ""])
            out.append(table(["Item", a, b], rows_))
    out += ["", "## Position battles", ""]
    brows = []
    for s in SLOTS:
        x, y = [r for r in ra if r["slot"] == s][0], [r for r in rb if r["slot"] == s][0]
        dd = (x["mean"] - y["mean"]) if x["mean"] is not None and y["mean"] is not None else None
        fa, fb = g(x["d"], "season_2026", "totals", "fp_per_game"), g(y["d"], "season_2026", "totals", "fp_per_game")
        if dd is not None:
            edge = "%s by %s" % (a if dd >= 0 else b, f1(abs(dd)))
        elif num(fa) and num(fb):
            edge = "2026 points per game: %s vs %s" % (f1(fa), f1(fb))
        else:
            edge = NF
        brows.append([s, "%s (%s)" % (x["name"], x["nfl"]), f1(x["mean"]) if x["mean"] is not None else ph,
                      "%s (%s)" % (y["name"], y["nfl"]), f1(y["mean"]) if y["mean"] is not None else ph, edge])
    out.append(table(["Slot", a, "Mean", b, "Mean", "Edge"], brows))
    out += ["", "## Who swings the result most (widest ranges)", ""]
    wide = sorted([(r["p90"] - r["p10"], r, t) for t, rr in ((a, ra), (b, rb)) for r in rr
                   if r["p90"] is not None and r["p10"] is not None], key=lambda x: -x[0])
    out.append(bullets(["%s (%s, %s): range %s to %s, width %s" % (r["name"], t, r["slot"], f1(r["p10"]), f1(r["p90"]), f1(w))
                        for w, r, t in wide[:5]]) if wide else ph)
    out += ["", "## How the weekend would unfold, in kickoff order", ""]
    keys = [r["key"] for r in ra + rb]
    games = {}
    for k in keys:
        ng = g(pdata.get(k), "next_games", 0)
        if ng:
            gid = ng.get("game_id") or (str(ng.get("date")) + str(ng.get("opp")))
            games.setdefault(gid, {"ng": ng, "players": []})["players"].append(k)
    ordered = sorted(games.values(), key=lambda x: (x["ng"].get("kickoff_utc") or x["ng"].get("date") or ""))
    if not ordered:
        out.append(NF)
    for grp in ordered:
        ng = grp["ng"]
        first_p = pdata[grp["players"][0]]
        ps = "; ".join("%s %s (%s)" % (k.split("-")[0], pdata[k].get("name"), k.split("-")[1]) for k in grp["players"])
        out.append("- %s (%s %s local): %s %s %s. Fantasy players: %s. Game status: %s." % (
            window(ng, cw), ng.get("weekday", ""), ng.get("time", ""), first_p.get("nfl_team"),
            "vs" if ng.get("home") else "at", ng.get("opp", NF), ps,
            str(ng.get("status", NF)).replace("STATUS_", "").lower()))
    flags = ["%s %s (%s, %s): %s" % (k.split("-")[0], g(pdata[k], "name"), k.split("-")[1], g(pdata[k], "nfl_team"),
             risk_note(pdata[k], cw)) for k in keys if pdata.get(k) and risk_note(pdata[k], cw) != "none found"]
    out += ["", "## Missing or at risk", "", bullets(flags) if flags else "No player flagged."]
    return "\n".join(out)


# --------------------------------------------------------------------- main
def main():
    league, proj, pdata, pnotes = load_all()
    pidx = proj_index(proj)
    cw = current_week(pdata)
    for k in KEYS:
        write(os.path.join(OUT_PLAYERS, k + ".md"), player_md(k, proj, pidx, pdata[k], pnotes[k]))
    for t in TEAMS:
        write(os.path.join(OUT_TEAMS, t + ".md"), team_md(t, pdata, pnotes, proj, pidx, cw))
    for a, b in MATCHUPS:
        write(os.path.join(OUT_MATCH, "%s-vs-%s.md" % (a, b)), matchup_md(a, b, pdata, pnotes, proj, pidx, cw))
    print("wrote %d players, %d teams, %d matchups (projections %s, %d notes found)" % (
        len(KEYS), len(TEAMS), len(MATCHUPS), "found" if proj is not None else "missing",
        sum(1 for v in pnotes.values() if v)))


if __name__ == "__main__":
    main()
