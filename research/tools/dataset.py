"""Turns the raw cache (research/raw/, filled by pull.py) into one compact data file per player and one league file.

    python3 research/tools/dataset.py

Writes research/data/<TEAM>-<SLOT>.json (everything known about the player) and research/data/league.json
(schedule, lines, weather, and what every defense has allowed to every position in 2026).
Fantasy points use the repository's own rules in data/scoring.json.
"""
import csv
import datetime
import json
import os
import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = os.path.join(ROOT, "research", "raw")
OUT = os.path.join(ROOT, "research", "data")
SEASON = 2026
csv.field_size_limit(10 ** 9)

NUM = ["completions", "attempts", "passing_yards", "passing_tds", "passing_interceptions", "sacks_suffered",
       "passing_air_yards", "passing_first_downs", "passing_epa", "passing_cpoe", "carries", "rushing_yards",
       "rushing_tds", "rushing_first_downs", "rushing_epa", "receptions", "targets", "receiving_yards", "receiving_tds",
       "receiving_air_yards", "receiving_yards_after_catch", "receiving_first_downs", "receiving_epa", "target_share",
       "air_yards_share", "wopr", "fumbles_lost_total", "fg_made", "fg_att", "fg_made_0_19", "fg_made_20_29",
       "fg_made_30_39", "fg_made_40_49", "fg_made_50_59", "fg_made_60_", "fg_long", "pat_made", "pat_att"]
SHORT = {"completions": "cmp", "attempts": "att", "passing_yards": "pass_yd", "passing_tds": "pass_td",
         "passing_interceptions": "int", "sacks_suffered": "sacks", "passing_air_yards": "pass_air", "passing_first_downs": "pass_fd",
         "passing_epa": "pass_epa", "passing_cpoe": "cpoe", "carries": "car", "rushing_yards": "rush_yd", "rushing_tds": "rush_td",
         "rushing_first_downs": "rush_fd", "rushing_epa": "rush_epa", "receptions": "rec", "targets": "tgt",
         "receiving_yards": "rec_yd", "receiving_tds": "rec_td", "receiving_air_yards": "rec_air",
         "receiving_yards_after_catch": "yac", "receiving_first_downs": "rec_fd", "receiving_epa": "rec_epa",
         "target_share": "tgt_share", "air_yards_share": "air_share", "wopr": "wopr", "fumbles_lost_total": "fum_lost",
         "fg_made": "fgm", "fg_att": "fga", "fg_made_0_19": "fg_0_19", "fg_made_20_29": "fg_20_29", "fg_made_30_39": "fg_30_39",
         "fg_made_40_49": "fg_40_49", "fg_made_50_59": "fg_50_59", "fg_made_60_": "fg_60", "fg_long": "fg_long",
         "pat_made": "xpm", "pat_att": "xpa"}
TEAM_FIX = {"LAR": "LA", "WSH": "WAS", "OAK": "LV", "SD": "LAC", "STL": "LA", "JAC": "JAX"}


def tm(t):
    return TEAM_FIX.get(t, t)


def f(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def fnum(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def fantasy(g):
    """Points under data/scoring.json: 1 per 25 pass yards, 4 a pass touchdown, minus 2 an interception, 1 per 10 rush or
    receiving yards, 6 a rush or receiving touchdown, minus 2 a lost fumble, 3 a field goal (4 from 40, 5 from 50), 1 an extra point."""
    return round(0.04 * g.get("pass_yd", 0) + 4 * g.get("pass_td", 0) - 2 * g.get("int", 0) + 0.1 * g.get("rush_yd", 0)
                 + 6 * g.get("rush_td", 0) + 0.1 * g.get("rec_yd", 0) + 6 * g.get("rec_td", 0) - 2 * g.get("fum_lost", 0)
                 + 3 * g.get("fgm", 0) + g.get("fg_40_49", 0) + 2 * (g.get("fg_50_59", 0) + g.get("fg_60", 0)) + g.get("xpm", 0), 2)


def rd(path):
    with open(os.path.join(RAW, path), encoding="utf-8", errors="replace") as fh:
        return list(csv.DictReader(fh))


def jl(path, default=None):
    p = os.path.join(RAW, path)
    if not os.path.exists(p):
        return default
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def load_games():
    out = {}
    for r in rd("nflverse/games.csv"):
        if int(r["season"]) < 2016:
            continue
        out[r["game_id"]] = r
    return out


def game_ctx(g, team):
    """Context of one game from one team's side."""
    home = tm(g["home_team"]) == team
    hs, as_ = fnum(g["home_score"]), fnum(g["away_score"])
    spread, total = fnum(g["spread_line"]), fnum(g["total_line"])  # spread > 0: home favored by that much
    ctx = {"game_id": g["game_id"], "date": g["gameday"], "weekday": g["weekday"], "time": g["gametime"], "home": home,
           "opp": tm(g["away_team"] if home else g["home_team"]), "roof": g["roof"] or None, "surface": (g["surface"] or "").strip() or None,
           "temp": fnum(g["temp"]), "wind": fnum(g["wind"]), "div": g["div_game"] == "1", "stadium": g["stadium"],
           "rest": fnum(g["home_rest"] if home else g["away_rest"]), "type": g["game_type"]}
    if hs is not None and as_ is not None:
        mine, theirs = (hs, as_) if home else (as_, hs)
        ctx.update({"pts_for": mine, "pts_against": theirs, "result": "W" if mine > theirs else ("L" if mine < theirs else "T")})
    if spread is not None and total is not None:
        my_spread = spread if home else -spread  # > 0: my team favored
        ctx.update({"spread": my_spread, "total": total, "implied": round(total / 2 + my_spread / 2, 2)})
    return ctx


def load_weekly():
    """Every player-game since 2016, keyed by player id. Also the per-game rows by season for the defense tables."""
    by_player = defaultdict(list)
    by_season = defaultdict(list)
    for y in range(2016, SEASON + 1):
        p = "nflverse/stats_player_week_%d.csv" % y
        if not os.path.exists(os.path.join(RAW, p)):
            continue
        for r in rd(p):
            if r["position"] not in ("QB", "RB", "WR", "TE", "K", "FB"):
                continue
            g = {SHORT[k]: f(r.get(k)) for k in NUM}
            g.update({"season": y, "week": int(r["week"]), "stype": r["season_type"], "game_id": r["game_id"],
                      "team": tm(r["team"]), "opp": tm(r["opponent_team"]), "pos": r["position"], "pid": r["player_id"],
                      "name": r["player_display_name"]})
            g["fp"] = fantasy(g)
            by_player[r["player_id"]].append(g)
            by_season[y].append(g)
    return by_player, by_season


def agg(games, keys=None):
    keys = keys or ["cmp", "att", "pass_yd", "pass_td", "int", "sacks", "car", "rush_yd", "rush_td", "rec", "tgt", "rec_yd",
                    "rec_td", "fum_lost", "fgm", "fga", "fg_40_49", "fg_50_59", "fg_60", "xpm", "xpa", "fp"]
    n = len(games)
    t = {k: round(sum(g.get(k, 0) for g in games), 2) for k in keys}
    t["games"] = n
    t["fp_per_game"] = round(t["fp"] / n, 2) if n else None
    return t


def trim(t, pos):
    """Keep only the stats that matter for the position, so tables stay readable."""
    keep = {"QB": ["games", "cmp", "att", "pass_yd", "pass_td", "int", "sacks", "car", "rush_yd", "rush_td", "fum_lost", "fp", "fp_per_game"],
            "RB": ["games", "car", "rush_yd", "rush_td", "tgt", "rec", "rec_yd", "rec_td", "fum_lost", "fp", "fp_per_game"],
            "WR": ["games", "tgt", "rec", "rec_yd", "rec_td", "car", "rush_yd", "rush_td", "fum_lost", "fp", "fp_per_game"],
            "TE": ["games", "tgt", "rec", "rec_yd", "rec_td", "fum_lost", "fp", "fp_per_game"],
            "K": ["games", "fgm", "fga", "fg_40_49", "fg_50_59", "fg_60", "xpm", "xpa", "fp", "fp_per_game"]}[pos]
    return {k: t[k] for k in keep if k in t}


def splits(log, pos):
    """Career splits from the game log (regular season and playoffs)."""
    def grp(fn):
        d = defaultdict(list)
        for g in log:
            k = fn(g)
            if k is not None:
                d[k].append(g)
        return {k: trim(agg(v), pos) for k, v in sorted(d.items(), key=lambda kv: str(kv[0]))}

    def prime(g):
        t = g.get("time") or ""
        late = t >= "19:00"
        return "prime time" if (g.get("weekday") in ("Thursday", "Monday", "Saturday", "Friday", "Wednesday", "Tuesday") or late) else "day game"

    def roof(g):
        r = g.get("roof")
        return None if not r else ("indoors" if r in ("dome", "closed") else "outdoors")

    def surf(g):
        s = g.get("surface")
        return None if not s else ("grass" if "grass" in s else "turf")

    def temp(g):
        t = g.get("temp")
        return None if t is None else ("cold, under 40F" if t < 40 else ("hot, 80F or more" if t >= 80 else "40 to 79F"))

    def wind(g):
        w = g.get("wind")
        return None if w is None else ("wind 15 mph or more" if w >= 15 else "wind under 15 mph")

    def fav(g):
        s = g.get("spread")
        return None if s is None else ("favorite" if s > 0 else ("underdog" if s < 0 else "pick"))

    def tot(g):
        t = g.get("total")
        return None if t is None else ("total 47 or more" if t >= 47 else ("total under 42" if t < 42 else "total 42 to 46.5"))

    def rest(g):
        r = g.get("rest")
        return None if r is None else ("short rest, under 6 days" if r < 6 else ("long rest, 9 days or more" if r >= 9 else "normal rest"))

    return {"home_away": grp(lambda g: "home" if g.get("home") else "away"), "result": grp(lambda g: g.get("result")),
            "roof": grp(roof), "surface": grp(surf), "temperature": grp(temp), "wind": grp(wind), "spread": grp(fav),
            "total": grp(tot), "kickoff": grp(prime), "division": grp(lambda g: "division game" if g.get("div") else "other"),
            "rest": grp(rest), "month": grp(lambda g: (g.get("date") or "")[5:7] or None),
            "season_type": grp(lambda g: "playoffs" if g["stype"] == "POST" else "regular season"),
            "opponent": grp(lambda g: g["opp"]), "season": grp(lambda g: g["season"])}


def news_rss(path, last_name, limit=20):
    p = os.path.join(RAW, path)
    if not os.path.exists(p):
        return []
    try:
        root = ET.parse(p).getroot()
    except ET.ParseError:
        return []
    items = []
    for it in root.iter("item"):
        title = (it.findtext("title") or "").strip()
        if last_name.lower() not in title.lower():
            continue
        try:
            d = datetime.datetime.strptime((it.findtext("pubDate") or "")[:25].strip(), "%a, %d %b %Y %H:%M:%S").date().isoformat()
        except ValueError:
            d = None
        src = it.findtext("source") or ""
        items.append({"date": d, "title": re.sub(r"\s+-\s+%s$" % re.escape(src), "", title), "source": src})
    seen, out = set(), []
    for it in sorted(items, key=lambda x: x["date"] or "", reverse=True):
        k = re.sub(r"[^a-z]", "", it["title"].lower())[:50]
        if k in seen:
            continue
        seen.add(k)
        out.append(it)
    return out[:limit]


def wiki_sections(key):
    w = jl("%s/wiki.json" % key)
    if not w:
        return None
    pg = list(w["query"]["pages"].values())[0]
    text = pg.get("extract") or ""
    parts = re.split(r"\n(==+ [^=]+ ==+)\n", "\n== Intro ==\n" + text)
    sec = {}
    for i in range(1, len(parts) - 1, 2):
        sec[parts[i].strip("= ").strip()] = parts[i + 1].strip()
    want = {}
    for name, body in sec.items():
        low = name.lower()
        if low in ("intro", "early life", "early years", "early life and education", "personal life", "family", "high school career",
                   "college career", "player profile", "legacy", "philanthropy", "off the field", "legal issues", "business ventures",
                   "endorsements", "in popular culture", "early life and high school", "high school") and body:
            want[name] = body[:6000]
    return {"title": pg.get("title"), "length": len(text), "sections": want, "section_names": list(sec.keys())}


def play_tendencies(key):
    """Real 2026 plays from data/rosters/plays-2026.json (ESPN play-by-play, parsed by Ricky's lane)."""
    d = jl(os.path.join(ROOT, "data", "rosters", "plays-2026.json"))
    p = d["players"].get(key.replace("-", "."))
    if not p:
        return None
    plays = [x for x in p["plays"] if not x.get("nullified")]

    def table(rows, by):
        g = defaultdict(lambda: {"n": 0, "yds": 0, "td": 0, "cmp": 0})
        for x in rows:
            k = by(x)
            if k is None:
                continue
            t = g[k]
            t["n"] += 1
            t["yds"] += x.get("yds") or 0
            t["td"] += 1 if x.get("td") else 0
            t["cmp"] += 1 if x.get("kind") == "pass" else 0
        return {str(k): {"n": v["n"], "yds": v["yds"], "per": round(v["yds"] / v["n"], 1), "td": v["td"],
                         "catch_or_cmp_pct": round(100 * v["cmp"] / v["n"]) if v["cmp"] else None} for k, v in sorted(g.items(), key=lambda kv: -kv[1]["n"])}

    def zone(x):
        y = x.get("ytg")
        if y is None:
            return None
        return "inside the 5" if y <= 5 else ("6 to 20" if y <= 20 else ("21 to 50" if y <= 50 else "own half"))

    out = {"games": len(p.get("games") or []), "nfl_team": p.get("nfl_team"), "totals": p.get("totals")}
    throws = [x for x in plays if x.get("kind") in ("pass", "inc", "int") and x.get("role") in ("passer", "target")]
    runs = [x for x in plays if x.get("kind") in ("run", "scramble") and x.get("role") == "rusher"]
    kicks = [x for x in plays if x.get("kind") == "fg"]
    if throws:
        out["throws_or_targets"] = {"n": len(throws), "by_depth": table(throws, lambda x: x.get("depth")),
                                    "by_direction": table(throws, lambda x: x.get("dir")),
                                    "by_depth_and_direction": table(throws, lambda x: "%s %s" % (x.get("depth"), x.get("dir")) if x.get("depth") and x.get("dir") else None),
                                    "by_down": table(throws, lambda x: x.get("dn")), "by_field_zone": table(throws, zone),
                                    "by_quarter": table(throws, lambda x: x.get("q"))}
        if p["position"] == "QB":
            tg = table(throws, lambda x: x.get("target"))
            out["throws_or_targets"]["favorite_targets"] = dict(list(tg.items())[:8])
        else:
            out["throws_or_targets"]["passers"] = table(throws, lambda x: x.get("passer"))
    if runs:
        out["runs"] = {"n": len(runs), "by_kind": table(runs, lambda x: x.get("kind")), "by_direction": table(runs, lambda x: x.get("dir")),
                       "by_gap": table(runs, lambda x: x.get("gap")), "by_down": table(runs, lambda x: x.get("dn")),
                       "by_field_zone": table(runs, zone)}
    if kicks:
        def band(x):
            y = x.get("yds") or x.get("dist_yards") or 0
            return "under 30" if y < 30 else ("30 to 39" if y < 40 else ("40 to 49" if y < 50 else "50 or more"))
        g = defaultdict(lambda: [0, 0])
        for x in kicks:
            b = band(x)
            g[b][1] += 1
            g[b][0] += 1 if x.get("good", x.get("made")) else 0
        out["kicks"] = {k: {"made": v[0], "tried": v[1]} for k, v in g.items()}
    sacks = [x for x in plays if x.get("kind") == "sack"]
    if sacks:
        out["sacks_taken"] = len(sacks)
    big = sorted([x for x in plays if x.get("yds") and x.get("kind") in ("pass", "run", "scramble")], key=lambda x: -x["yds"])[:5]
    out["longest_plays"] = [{"week": x["wk"], "q": x["q"], "clock": x["clk"], "yards": x["yds"], "td": bool(x.get("td")), "text": x["text"].strip()[:220]} for x in big]
    tds = [x for x in plays if x.get("td")]
    out["touchdown_plays"] = [{"week": x["wk"], "yards": x.get("yds"), "kind": x.get("kind"), "from_yards_out": x.get("ytg"), "text": x["text"].strip()[:160]} for x in tds]
    return out


def teammates(rows):
    """Who threw the passes each week for this NFL team in 2026, and the season's top target and carry earners."""
    byweek = defaultdict(list)
    tg, ca = defaultdict(lambda: [0.0, 0.0, 0.0, 0.0]), defaultdict(lambda: [0.0, 0.0, 0.0])
    for r in rows:
        w = int(r["week"])
        if f(r["attempts"]) > 0 and r["position"] == "QB":
            byweek[w].append({"qb": r["player_display_name"], "attempts": int(f(r["attempts"]))})
        if f(r["targets"]) > 0:
            t = tg[(r["player_display_name"], r["position"])]
            t[0] += f(r["targets"]); t[1] += f(r["receptions"]); t[2] += f(r["receiving_yards"]); t[3] += 1
        if f(r["carries"]) > 0 and r["position"] != "QB":
            c = ca[(r["player_display_name"], r["position"])]
            c[0] += f(r["carries"]); c[1] += f(r["rushing_yards"]); c[2] += 1
    tot_t = sum(v[0] for v in tg.values()) or 1
    tot_c = sum(v[0] for v in ca.values()) or 1
    return {"passers_by_week": {str(w): sorted(v, key=lambda x: -x["attempts"]) for w, v in sorted(byweek.items())},
            "top_targets": [{"name": k[0], "pos": k[1], "targets": int(v[0]), "rec": int(v[1]), "rec_yd": int(v[2]), "games": int(v[3]), "share": round(v[0] / tot_t, 3)}
                            for k, v in sorted(tg.items(), key=lambda kv: -kv[1][0])[:5]],
            "top_rushers": [{"name": k[0], "pos": k[1], "carries": int(v[0]), "rush_yd": int(v[1]), "games": int(v[2]), "share": round(v[0] / tot_c, 3)}
                            for k, v in sorted(ca.items(), key=lambda kv: -kv[1][0])[:3]]}


def defense_tables(by_season, games):
    """What each defense has allowed, as a ratio of what those same players normally do (1.00 is average, above 1 is a soft
    matchup). Built for one season from the weeks before `upto` (so a backtest never sees the future)."""
    def build(season, upto=99):
        rows = [g for g in by_season.get(season, []) if g["stype"] == "REG" and g["week"] < upto]
        tot = defaultdict(lambda: defaultdict(float))
        cnt = defaultdict(int)
        for g in rows:
            cnt[g["pid"]] += 1
            for k in ("fp", "pass_yd", "pass_td", "int", "rush_yd", "rush_td", "rec_yd", "rec_td", "rec", "tgt", "car", "att", "fgm", "fga", "xpm"):
                tot[g["pid"]][k] += g.get(k, 0)
        out = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0, 0.0])))
        raw = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
        ngames = defaultdict(set)
        for g in rows:
            n = cnt[g["pid"]]
            if n < 2:
                continue
            pos = "RB" if g["pos"] == "FB" else g["pos"]
            ngames[g["opp"]].add(g["game_id"])
            for k in ("fp", "pass_yd", "pass_td", "int", "rush_yd", "rush_td", "rec_yd", "rec_td", "rec", "tgt", "car", "att", "fgm", "fga", "xpm"):
                others = (tot[g["pid"]][k] - g.get(k, 0)) / (n - 1)  # what he does against everyone else
                out[g["opp"]][pos][k][0] += g.get(k, 0)
                out[g["opp"]][pos][k][1] += others
                raw[g["opp"]][pos][k] += g.get(k, 0)
        res = {}
        for d, byp in out.items():
            res[d] = {"games": len(ngames[d])}
            for pos, byk in byp.items():
                res[d][pos] = {}
                for k, (a, e) in byk.items():
                    prior = {"fp": 60.0}.get(k, max(e, 1.0) * 0.5)  # shrink toward 1.00
                    res[d][pos][k] = round((a + prior) / (e + prior), 3) if e + prior > 0 else 1.0
                    res[d][pos][k + "_allowed_per_game"] = round(raw[d][pos][k] / max(len(ngames[d]), 1), 2)
        return res
    return build


def team_offense(by_season, games, season=SEASON):
    """Per team: points a game, pass and rush volume, from the schedule file and the weekly rows."""
    pts = defaultdict(list)
    for g in games.values():
        if int(g["season"]) != season or g["game_type"] != "REG" or g["home_score"] in ("", None, "NA"):
            continue
        pts[tm(g["home_team"])].append((f(g["home_score"]), f(g["away_score"])))
        pts[tm(g["away_team"])].append((f(g["away_score"]), f(g["home_score"])))
    out = {}
    for t, v in pts.items():
        out[t] = {"games": len(v), "points_for": round(sum(a for a, _ in v) / len(v), 1), "points_against": round(sum(b for _, b in v) / len(v), 1),
                  "record": "%d-%d" % (sum(1 for a, b in v if a > b), sum(1 for a, b in v if a < b))}
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    roster = jl("roster.json")
    games = load_games()
    by_player, by_season = load_weekly()
    nplayers = {r["espn_id"]: r for r in rd("nflverse/players.csv") if r.get("espn_id")}
    sleeper = jl("sleeper-players.json")
    combine = {r["pfr_id"]: r for r in rd("nflverse/combine.csv") if r.get("pfr_id")}
    contracts = defaultdict(list)
    for r in rd("nflverse/contracts.csv"):
        contracts[r["otc_id"]].append(r)
    cgroup = {"QB": {"QB"}, "RB": {"RB", "FB"}, "WR": {"WR"}, "TE": {"TE"}, "K": {"K"}}
    # 2026 passers, targets and carries by NFL team, for the teammates_2026 block
    tm_rows = defaultdict(list)
    for r in rd("nflverse/stats_player_week_%d.csv" % SEASON):
        if r["season_type"] == "REG":
            tm_rows[tm(r["team"])].append(r)
    snaps = defaultdict(list)
    adv = {"rec": defaultdict(list), "rush": defaultdict(list), "pass": defaultdict(list)}
    for y in (SEASON - 1, SEASON):
        for r in rd("nflverse/snap_counts_%d.csv" % y):
            snaps[r["pfr_player_id"]].append(r)
        for kind in adv:
            for r in rd("nflverse/adv_%s_%d.csv" % (kind, y)):
                adv[kind][r["pfr_player_id"]].append(r)
    ngs = {k: defaultdict(list) for k in ("passing", "receiving", "rushing")}
    for k in ngs:
        for r in rd("nflverse/ngs_%s.csv" % k):
            if int(r["season"]) >= SEASON - 1:
                ngs[k][r["player_gsis_id"]].append(r)
    injuries = defaultdict(list)
    for y in (SEASON - 2, SEASON - 1, SEASON):
        for r in rd("nflverse/injuries_%d.csv" % y):
            injuries[r["gsis_id"]].append(r)
    espn_inj = {}
    for t in (jl("espn-injuries.json") or {}).get("injuries", []):
        for i in t.get("injuries", []):
            a = i.get("athlete") or {}
            aid = str(a.get("id") or "")
            if not aid:
                for l in a.get("links", []):
                    m = re.search(r"/id/(\d+)", l.get("href", ""))
                    if m:
                        aid = m.group(1)
                        break
            if aid:
                espn_inj[aid] = {"status": i.get("status"), "date": (i.get("date") or "")[:10], "short": i.get("shortComment"),
                                 "long": i.get("longComment"), "details": {k: v for k, v in (i.get("details") or {}).items() if k in ("type", "location", "detail", "side", "returnDate")}}
    weather = {}
    for w in range(1, 19):
        sb = jl("espn-scoreboard-w%02d.json" % w) or {}
        for e in sb.get("events", []):
            c = e["competitions"][0]
            teams = {x["homeAway"]: tm(x["team"]["abbreviation"]) for x in c["competitors"]}
            o = (c.get("odds") or [{}])[0]
            weather[(w, teams["home"])] = {"kickoff_utc": e["date"], "venue": (c.get("venue") or {}).get("fullName"),
                                           "indoor": (c.get("venue") or {}).get("indoor"), "weather": (e.get("weather") or {}).get("displayValue"),
                                           "temperature": (e.get("weather") or {}).get("temperature"), "line": o.get("details"), "over_under": o.get("overUnder"),
                                           "status": c["status"]["type"]["name"], "broadcast": ", ".join(b for x in c.get("broadcasts", []) for b in x.get("names", []))}
    dbuild = defense_tables(by_season, games)
    dnow = dbuild(SEASON)
    offense = team_offense(by_season, games)
    today = datetime.date.today().isoformat()
    league = {"season": SEASON, "built": today, "defense_2026": dnow, "team_2026": offense, "players": {}}

    for p in roster:
        key, pos = p["key"], p["position"]
        nv = nplayers.get(p["espn_id"]) or {}
        gsis, pfr, otc = nv.get("gsis_id"), nv.get("pfr_id"), nv.get("otc_id")
        sl = sleeper.get(p["sleeper_id"]) or {}
        core = jl("%s/espn-core.json" % key) or {}
        bio = jl("%s/espn-bio.json" % key) or {}
        team = tm(sl.get("team") or nv.get("latest_team") or "")
        log = []
        for g in sorted(by_player.get(gsis, []), key=lambda x: (x["season"], 0 if x["stype"] == "REG" else 1, x["week"])):
            gg = dict(g)
            gm = games.get(g["game_id"])
            if gm:
                gg.update(game_ctx(gm, g["team"]))
            for k in ("pid", "name", "pos"):
                gg.pop(k, None)
            log.append(gg)
        # snaps and advanced, by game id
        sn = {r["game_id"]: r for r in snaps.get(pfr, [])}
        for g in log:
            s = sn.get(g["game_id"])
            if s:
                g["snaps"] = f(s["offense_snaps"])
                g["snap_pct"] = round(f(s["offense_pct"]) * (100 if f(s["offense_pct"]) <= 1 else 1), 1)
        advs = {}
        for kind in adv:
            rows = [r for r in adv[kind].get(pfr, []) if int(r["season"]) == SEASON]
            if rows:
                t = {}
                for k in rows[0]:
                    if k in ("game_id", "pfr_game_id", "season", "week", "game_type", "team", "opponent", "pfr_player_name", "pfr_player_id") or k.endswith("_pct") or k.endswith("_avg") or k.endswith("_rat"):
                        continue
                    t[k] = round(sum(f(r[k]) for r in rows), 1)
                t["games"] = len(rows)
                advs[kind] = t
        tracking = {}
        for k in ngs:
            for r in ngs[k].get(gsis, []):
                if r["week"] == "0" and r["season_type"] == "REG":
                    tracking.setdefault(k, {})[r["season"]] = {a: fnum(b) for a, b in r.items() if fnum(b) is not None and a not in ("season", "week", "player_jersey_number")}
        inj_rows = sorted(injuries.get(gsis, []), key=lambda r: (int(r["season"]), int(r["week"])))
        inj_hist = [{"season": int(r["season"]), "week": int(r["week"]), "injury": r["report_primary_injury"] or r["practice_primary_injury"],
                     "game_status": r["report_status"] or None, "practice": r["practice_status"] or None} for r in inj_rows]
        # same person id AND same position group; the newest signing wins, an active deal first
        con = sorted([r for r in contracts.get(otc, []) if r["position"] in cgroup[pos]],
                     key=lambda r: (1 if r["is_active"] == "TRUE" else 0, f(r["year_signed"])))
        cb = combine.get(pfr) or {}
        md = (jl("%s/madden.json" % key) or {}).get("items") or []
        md = [m for m in md if ("%s %s" % (m.get("firstName"), m.get("lastName"))).lower().replace(".", "") == p["name"].lower().replace(".", "")] or md[:1]
        madden = None
        if md:
            m = md[0]
            madden = {"overall": m.get("overallRating"), "edition": (m.get("iteration") or {}).get("label"),
                      "abilities": [a.get("label") or a.get("name") for a in (m.get("playerAbilities") or [])],
                      "ratings": {k: v.get("value") for k, v in (m.get("stats") or {}).items() if isinstance(v, dict)}}
        last = p["name"].split()[-1] if not p["name"].endswith("St. Brown") else "St. Brown"
        en = []
        for a in (jl("%s/espn-news.json" % key) or {}).get("articles", []):
            text = "%s %s" % (a.get("headline") or "", a.get("description") or "")
            if last.lower() in text.lower() or p["name"].lower() in text.lower():
                en.append({"date": (a.get("published") or "")[:10], "type": a.get("type"), "headline": a.get("headline"), "description": a.get("description")})
        # Sleeper season sums for 2026 (red zone, snaps, drops, broken tackles and so on)
        sw = jl("%s/sleeper-weeks-%d.json" % (key, SEASON)) or {}
        ssum = defaultdict(float)
        for wk, v in sw.items():
            for k, x in ((v or {}).get("stats") or {}).items():
                if isinstance(x, (int, float)) and not k.startswith(("pos_rank", "rank", "pts_")) and not k.endswith(("_pct", "_lng", "_ypa", "_ypc", "_ypr", "_ypt", "_rtg")):
                    ssum[k] += x
        proj = {}
        for y in (SEASON - 1, SEASON):
            pj = jl("%s/sleeper-proj-%d.json" % (key, y)) or {}
            for wk, v in pj.items():
                if v and v.get("stats"):
                    proj["%d-%s" % (y, wk)] = {"stats": v["stats"], "opp": v.get("opponent"), "date": v.get("date"), "company": v.get("company")}
        # next games
        nxt = []
        for g in sorted(games.values(), key=lambda r: r["gameday"]):
            if int(g["season"]) == SEASON and g["game_type"] == "REG" and team in (tm(g["home_team"]), tm(g["away_team"])) and g["home_score"] in ("", None, "NA"):
                c = game_ctx(g, team)
                c["week"] = int(g["week"])
                c.update(weather.get((int(g["week"]), tm(g["home_team"])), {}))
                nxt.append(c)
        reg = [g for g in log if g["stype"] == "REG"]
        cur = [g for g in reg if g["season"] == SEASON]
        d = {
            "key": key, "fantasy_team": p["team"], "slot": p["slot"], "name": p["name"], "position": pos, "nfl_team": team,
            "ids": {"sleeper": p["sleeper_id"], "espn": p["espn_id"], "gsis": gsis, "pfr": pfr},
            "built": today,
            "bio": {
                "height_in": core.get("height") or fnum(sl.get("height")), "height": core.get("displayHeight"), "weight_lb": core.get("weight") or fnum(sl.get("weight")),
                "age": core.get("age") or sl.get("age"), "born": (core.get("dateOfBirth") or "")[:10] or sl.get("birth_date"),
                "birthplace": ", ".join(x for x in [(core.get("birthPlace") or {}).get("city"), (core.get("birthPlace") or {}).get("state"), (core.get("birthPlace") or {}).get("country")] if x),
                "high_school": sl.get("high_school"), "college": sl.get("college") or nv.get("college_name"), "college_conference": nv.get("college_conference"),
                "jersey": core.get("jersey") or sl.get("number"), "debut_year": core.get("debutYear"), "years_experience": (core.get("experience") or {}).get("years"),
                "draft": (core.get("draft") or {}).get("displayText"), "draft_team": nv.get("draft_team"),
                "depth_chart": "%s%s" % (sl.get("depth_chart_position") or "", sl.get("depth_chart_order") or ""),
                "awards": [{"name": a.get("name"), "count": a.get("displayCount"), "seasons": a.get("seasons")} for a in bio.get("awards", [])],
                "teams": [{"team": t.get("displayName"), "seasons": t.get("seasons")} for t in bio.get("teamHistory", [])],
                "combine": {k: cb.get(k) for k in ("forty", "bench", "vertical", "broad_jump", "cone", "shuttle") if cb.get(k) not in (None, "", "NA")},
                "contract": ({"signed": con[-1]["year_signed"], "years": con[-1]["years"], "total_value_usd": f(con[-1]["value"]),
                              "per_year_usd": f(con[-1]["apy"]), "guaranteed_usd": f(con[-1]["guaranteed"]), "team": con[-1]["team"],
                              "active": con[-1]["is_active"] == "TRUE",
                              "note": "dollars, not millions; the contract file's newest signing year is 2022, so extensions signed later are missing"} if con else None),
                "madden": madden,
            },
            "status": {"sleeper_status": sl.get("status"), "injury_status": sl.get("injury_status"), "injury_body_part": sl.get("injury_body_part"),
                       "injury_notes": sl.get("injury_notes"), "injury_start": sl.get("injury_start_date"), "espn": espn_inj.get(p["espn_id"])},
            "injury_reports": inj_hist,
            "career": {"regular": trim(agg(reg), pos), "playoffs": trim(agg([g for g in log if g["stype"] == "POST"]), pos),
                       "by_season": {str(y): trim(agg([g for g in reg if g["season"] == y]), pos) for y in sorted({g["season"] for g in reg})}},
            "season_2026": {"totals": trim(agg(cur), pos), "sleeper_sums": {k: round(v, 2) for k, v in sorted(ssum.items())}, "advanced": advs, "tracking": tracking,
                            "team": offense.get(team)},
            "splits_career": splits(log, pos),
            "splits_2026": {k: v for k, v in splits(cur, pos).items() if k in ("home_away", "result", "roof", "surface", "spread", "total", "kickoff", "opponent")},
            "plays_2026": play_tendencies(key),
            "teammates_2026": teammates(tm_rows.get(team, [])),
            "log": log,
            "next_games": nxt[:3],
            "projections_rotowire": proj,
            "news": {"espn": en[:25], "recent": news_rss("%s/gnews.xml" % key, last, 25), "quotes": news_rss("%s/gnews-quotes.xml" % key, last, 15),
                     "family": news_rss("%s/gnews-family.xml" % key, last, 12)},
            "wikipedia": wiki_sections(key),
        }
        with open(os.path.join(OUT, key + ".json"), "w", encoding="utf-8") as fh:
            json.dump(d, fh, indent=1)
        league["players"][key] = {"name": p["name"], "position": pos, "nfl_team": team, "gsis": gsis,
                                  "next": [{"week": n["week"], "opp": n["opp"], "home": n["home"]} for n in nxt[:2]]}
        print("%-8s %-22s %-3s gsis=%s games=%3d  2026=%2d  fp/g=%5s  next=%s  news=%d/%d  wiki=%s" % (
            key, p["name"], team, bool(gsis), len(log), len(cur), d["season_2026"]["totals"].get("fp_per_game"),
            ("wk%d %s%s" % (nxt[0]["week"], "" if nxt[0]["home"] else "@", nxt[0]["opp"])) if nxt else "none",
            len(en), len(d["news"]["recent"]), bool(d["wikipedia"])))
    with open(os.path.join(OUT, "league.json"), "w", encoding="utf-8") as fh:
        json.dump(league, fh, indent=1)


if __name__ == "__main__":
    main()
