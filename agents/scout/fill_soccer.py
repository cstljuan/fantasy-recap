"""Soccer numbers that are real: fills the soccer profiles and one real round of stat lines from ESPN's public JSON.

    python3 agents/scout/fill_soccer.py                  (live, no model, no key)
    python3 agents/scout/fill_soccer.py --season 2026 --before 2026-11-14 --round-days 4

What it reads, for every player on the two soccer rosters (data/rosters/IRN.json and RHB.json):

    find the player     https://site.api.espn.com/apis/common/v3/search?query=<name>&limit=10&type=player
    club and matches    https://site.api.espn.com/apis/common/v3/sports/soccer/all/athletes/<id>/gamelog
    season totals       https://sports.core.api.espn.com/v2/sports/soccer/leagues/<league>/seasons/<season>/types/1/athletes/<id>/statistics

The player is the soccer player with the same name (accents ignored) and the same position letter (G, D, M, F).
When several match, the first one in ESPN's search order is taken and the note says how many there were. The
league is the one the game log is filtered to by default, which is the club's league (eng.1, esp.1, ...). When the
game log's season is not --season, ESPN has no current numbers for the player: his fields stay null and the note
says what was read.

What it writes:

  data/profiles/IRN.json, RHB.json   the tendencies, 0 to 1, with source, date and how for every number (formulas
                                     below), plus club and league. A number ESPN does not give stays null.
  data/rosters/soccer-season-<season>.json   the raw season numbers that were used
  data/statlines/soccer-real-<date>.json     one real round of league matches, in the shape of
                                     soccer/data/week11-lines.json. The round is the last --round-days days (default
                                     4) up to the latest league match any player played before --before (default
                                     today). A player with no league match in the round has an empty line (a
                                     fantasy manager gets nothing from him that week) and is listed in did_not_play.
                                     The match, date and address are next to every line.
  agents/scout/runs/<time>-fill-soccer.txt   the steps

The players of one fantasy team play for different clubs, so their real lines do not come from one match.
The match maker (soccer/engine/make-match.js) checks that a keeper's saves equal the other team's saved shots
and that a team has no more assists than goals; real lines usually break those rules. The lines file lists every
rule it breaks under "match_maker_rules"; nothing is changed to make it fit.
"""
import argparse
import datetime
import json
import os
import sys
import urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402

SEARCH_URL = "https://site.api.espn.com/apis/common/v3/search?query={q}&limit=10&type=player"
GAMELOG_URL = "https://site.api.espn.com/apis/common/v3/sports/soccer/all/athletes/{aid}/gamelog"
STATS_URL = ("https://sports.core.api.espn.com/v2/sports/soccer/leagues/{league}/seasons/{season}/types/1/"
             "athletes/{aid}/statistics")
POS_LETTER = {"GK": "G", "DEF": "D", "MID": "M", "FWD": "F"}
SLOT_POS = {"GK": "GK", "LB": "DEF", "CB1": "DEF", "CB2": "DEF", "RB": "DEF", "CM1": "MID", "CM2": "MID", "CM3": "MID",
            "LW": "FWD", "ST": "FWD", "RW": "FWD"}
LINE_FIELDS = ["goals", "assists", "sot", "saves", "yellow", "red"]


def _fx(name):
    return T._norm(name).replace(" ", "_")


def find(name, pos):
    """Returns (id, note) or (None, reason)."""
    url = SEARCH_URL.format(q=urllib.parse.quote(name))
    data = T._get_json(url, "soccer_%s_search.json" % _fx(name))
    want = POS_LETTER[pos]
    hits = [i for i in (data or {}).get("items", []) if i.get("sport") == "soccer"
            and T._norm(i.get("displayName", "")) == T._norm(name) and (i.get("position") or {}).get("abbreviation") == want]
    T._log_call("find(%s, %s) -> %d match(es)" % (name, want, len(hits)))
    if not hits:
        return None, "no soccer player named %s with position %s in ESPN's search" % (name, want)
    note = "" if len(hits) == 1 else "%d ESPN players named %s with position %s; took the first in ESPN's order (id %s). " % (
        len(hits), name, want, hits[0]["id"])
    return str(hits[0]["id"]), note


def gamelog(aid):
    """Club, league, season and the league matches with this player's line in each."""
    url = GAMELOG_URL.format(aid=aid)
    d = T._get_json(url, "soccer_gamelog_%s.json" % aid)
    f = {x.get("name"): x.get("value") for x in d.get("filters", [])}
    names = d.get("names", [])
    matches = []
    for st in d.get("seasonTypes", []):
        for cat in st.get("categories", []):
            for ev in cat.get("events", []):
                e = (d.get("events") or {}).get(ev.get("eventId"), {})
                vals = {}
                for k, v in zip(names, ev.get("stats", [])):
                    try:
                        vals[k] = int(float(v))
                    except (TypeError, ValueError):
                        vals[k] = None
                team = (e.get("team") or {}).get("abbreviation")
                matches.append({"event_id": ev.get("eventId"), "date": e.get("gameDate"), "score": e.get("score"),
                                "opponent": (e.get("opponent") or {}).get("displayName"), "team": team,
                                "league": e.get("leagueName"), "stats": vals})
    matches.sort(key=lambda m: m["date"] or "")
    club = None
    for o in next((x.get("options", []) for x in d.get("filters", []) if x.get("name") == "team"), []):
        if o.get("value") == f.get("team"):
            club = o.get("displayValue")
    T._log_call("gamelog(%s) -> %s, %s, %d league matches" % (aid, club, f.get("league"), len(matches)))
    return {"club": club, "league": f.get("league"), "season": f.get("season"), "matches": matches, "source": url}


def season_stats(league, season, aid):
    url = STATS_URL.format(league=league, season=season, aid=aid)
    d = T._get_json(url, "soccer_stats_%s.json" % aid)
    flat = {}
    for c in ((d or {}).get("splits") or {}).get("categories", []):
        for s in c.get("stats", []):
            flat["%s.%s" % (c.get("name"), s.get("name"))] = s.get("value")
    T._log_call("season_stats(%s, %s) -> %d stats" % (league, aid, len(flat)))
    return flat, url


def _r(a, b):
    if a is None or b is None or b <= 0:
        return None
    return max(0.0, min(1.0, round(a / b, 3)))


def tendencies(pos, s):
    """{key: (value, how)}. A value is null when a stat it needs is missing or its denominator is 0."""
    g = lambda k: s.get(k) if isinstance(s.get(k), (int, float)) else None
    apps = g("general.appearances")
    t = {}
    if pos == "GK":
        sv, faced, ga = g("goalKeeping.saves"), g("goalKeeping.shotsFaced"), g("goalKeeping.goalsConceded")
        if faced:
            t["save_rate"] = (_r(sv, faced), "saves divided by shots faced")
        else:
            t["save_rate"] = (_r(sv, (sv + ga) if sv is not None and ga is not None else None),
                              "saves divided by saves plus goals conceded (ESPN gives no shots faced)")
        t["pen_save_rate"] = (_r(g("goalKeeping.penaltyKicksSaved"), g("goalKeeping.penaltyKicksFaced")),
                              "penalties saved divided by penalties faced, null when none were faced")
    elif pos == "DEF":
        t["tackle_rate"] = (_r(g("defensive.effectiveTackles"), g("defensive.totalTackles")), "tackles won divided by tackles")
        t["aerial_win_rate"] = (None, "null: ESPN gives all duels together, not aerial duels")
        t["goal_share"] = (_r(g("offensive.totalGoals"), apps), "goals per appearance, capped at 1")
    elif pos == "MID":
        t["pass_share"] = (_r(g("offensive.accuratePasses"), g("offensive.totalPasses")), "accurate passes divided by passes")
        sh = g("offensive.totalShots")
        t["shot_share"] = (_r(sh / apps if sh is not None and apps else None, 5.0), "shots per appearance divided by 5, capped at 1")
        t["assist_share"] = (_r(g("offensive.goalAssists"), apps), "assists per appearance, capped at 1")
    elif pos == "FWD":
        sh, gl = g("offensive.totalShots"), g("offensive.totalGoals")
        t["shot_share"] = (_r(sh / apps if sh is not None and apps else None, 5.0), "shots per appearance divided by 5, capped at 1")
        t["shot_conversion"] = (_r(gl, sh), "goals divided by shots")
        t["assist_share"] = (_r(g("offensive.goalAssists"), apps), "assists per appearance, capped at 1")
        t["header_share"] = (_r(g("offensive.headedGoals"), gl), "headed goals divided by goals, null with no goals")
    return t


def line_of(match, pos):
    """One match line in the soccer lines shape. A stat the game log does not have for this player is left out."""
    s = match["stats"]
    line = {}
    for ours, theirs in (("goals", "totalGoals"), ("assists", "goalAssists"), ("sot", "shotsOnTarget"),
                         ("saves", "saves"), ("yellow", "yellowCards"), ("red", "redCards")):
        v = s.get(theirs)
        if v:
            line[ours] = v
    return line


def rules_broken(lines_teams):
    """The match maker's rules (soccer/engine/make-match.js completeTargets) that these lines break."""
    out = []
    for i, T_ in enumerate(lines_teams):
        P = T_["players"]
        goals = sum(p.get("goals", 0) for p in P.values())
        for k, p in P.items():
            if p.get("sot", 0) < p.get("goals", 0):
                out.append("team %d %s: fewer shots on target than goals" % (i, k))
            if p.get("yellow", 0) > 1:
                out.append("team %d %s: two yellows" % (i, k))
            if k != "GK" and p.get("saves"):
                out.append("team %d %s: saves by a player who is not the keeper" % (i, k))
            if k == "GK" and (p.get("goals") or p.get("sot")):
                out.append("team %d GK: the keeper shot or scored" % i)
        assists = sum(p.get("assists", 0) for p in P.values())
        if assists > goals:
            out.append("team %d: %d assists but %d goals" % (i, assists, goals))
    for i, T_ in enumerate(lines_teams):
        O = lines_teams[1 - i]["players"]
        saved = sum(p.get("sot", 0) - p.get("goals", 0) for p in O.values())
        sv = T_["players"].get("GK", {}).get("saves", 0)
        if sv != saved:
            out.append("team %d keeper: %d saves, but the other team had %d saved shots" % (i, sv, saved))
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", help="last date for the real round, YYYY-MM-DD (default today)")
    ap.add_argument("--teams", default="IRN,RHB")
    ap.add_argument("--season", default="2026", help="the season ESPN calls it (2026 is 2026-27)")
    ap.add_argument("--round-days", type=int, default=4)
    a = ap.parse_args(argv)
    before = a.before or T.today()
    log = T.start_run("fill-soccer")
    T.log_step("fill_soccer starts (no model, fixed order). Last date for the round: %s" % before)
    T.log_step("plan: for each player find him on ESPN, read his game log (club, league, matches), read his league "
               "season totals, compute tendencies, take his last league match before %s as his line" % before)
    date = T.today()
    raw = {"source": "ESPN public JSON", "date": date, "players": {}}
    lines_doc = {"invented": False, "note": "", "before": before, "date": date,
                 "sources": {"search": SEARCH_URL, "gamelog": GAMELOG_URL, "stats": STATS_URL},
                 "teams": [], "matches": {}, "missing": [], "match_maker_rules": []}
    pending = []
    filled = 0
    for team in a.teams.split(","):
        rpath = os.path.join(T.out_dir(), "rosters", "%s.json" % team)
        roster = T._read(rpath, {}).get("roster", {})
        ppath = os.path.join(T.out_dir(), "profiles", "%s.json" % team)
        prof = T._read(ppath, {"team": team, "players": {}})
        team_lines = {}
        for slot, name in roster.items():
            pos = SLOT_POS[slot]
            key = "%s.%s" % (team, slot)
            T.log_step("starting %s %s: find on ESPN" % (key, name))
            p = prof["players"].setdefault(slot, {"name": name, "position": pos, "tendencies": {}})
            aid, note = find(name, pos)
            if not aid:
                p["notes"] = "Tendencies are null: %s (checked %s)." % (note, date)
                p["tendencies"] = {k: None for k in tendencies(pos, {})}
                p["tendency_sources"] = {}
                lines_doc["missing"].append({"player": key, "name": name, "why": note})
                team_lines[slot] = {}
                T.log_step("%s: %s" % (name, note))
                continue
            gl = gamelog(aid)
            stats, surl = ({}, None)
            if str(gl["season"]) != str(a.season):
                why = ("ESPN's game log for this player only has season %s (%s, %s), not %s, so ESPN gives no current "
                       "numbers" % (gl["season"], gl["club"], gl["league"], a.season))
                p["notes"] = note + "Tendencies are null: %s (read %s on %s). Nothing was estimated." % (why, gl["source"], date)
                p["tendencies"] = {k: None for k in tendencies(pos, {})}
                p["tendency_sources"] = {}
                lines_doc["missing"].append({"player": key, "name": name, "why": why})
                team_lines[slot] = {}
                T.log_step("%s: %s" % (name, why))
                continue
            if gl["league"]:
                stats, surl = season_stats(gl["league"], gl["season"], aid)
            t = tendencies(pos, stats)
            p["tendencies"] = {k: v[0] for k, v in t.items()}
            p["tendency_sources"] = {k: {"source": surl, "date": date, "how": v[1]} for k, v in t.items()}
            p["club"], p["league"], p["espn_id"] = gl["club"], gl["league"], aid
            nulls = [k for k, v in t.items() if v[0] is None]
            p["notes"] = (note + "Season %s league numbers from ESPN (%s, %s), %s appearances, read on %s. No model." % (
                gl["season"], gl["club"], gl["league"], stats.get("general.appearances"), date)
                + (" Null: %s." % ", ".join(nulls) if nulls else ""))
            raw["players"][key] = {"name": name, "espn_id": aid, "club": gl["club"], "league": gl["league"],
                                   "season": gl["season"], "stats": stats, "source": surl, "date": date}
            filled += 1
            played = [m for m in gl["matches"] if m["date"] and m["date"][:10] < before]
            pending.append((team, slot, key, name, gl, played))
            T.log_step("%s: %s %s, %s" % (name, gl["club"], gl["league"], ", ".join("%s=%s" % (k, v[0]) for k, v in t.items())))
        prof["source"] = ("Soccer numbers from ESPN's public JSON (season totals of each player's club league), read on %s "
                          "by agents/scout/fill_soccer.py. The address, date and formula of every number are in "
                          "tendency_sources. Nothing was estimated: a number ESPN does not give is null." % date)
        T._write(ppath, prof)
        lines_doc["teams"].append({"team": team, "players": team_lines})
    # The round: the last --round-days days up to the latest league match any player played.
    last = max([m[-1]["date"][:10] for (_, _, _, _, _, m) in pending if m] or [None]) if pending else None
    first = None
    if last:
        first = (datetime.date.fromisoformat(last) - datetime.timedelta(days=a.round_days - 1)).isoformat()
    lines_doc["round"] = {"from": first, "to": last}
    lines_doc["did_not_play"] = []
    by_team = {t["team"]: t["players"] for t in lines_doc["teams"]}
    for team, slot, key, name, gl, played in pending:
        inside = [m for m in played if first <= m["date"][:10] <= last] if last else []
        if inside:
            m = inside[-1]
            by_team[team][slot] = line_of(m, SLOT_POS[slot])
            lines_doc["matches"][key] = {"name": name, "event_id": m["event_id"], "date": m["date"], "club": gl["club"],
                                         "opponent": m["opponent"], "score": m["score"], "league": m["league"],
                                         "source": gl["source"], "line": by_team[team][slot]}
        else:
            by_team[team][slot] = {}
            lines_doc["did_not_play"].append({"player": key, "name": name, "club": gl["club"],
                                              "last_league_match": played[-1]["date"][:10] if played else None})
        T.log_step("%s: round line %s" % (name, json.dumps(by_team[team][slot]) if inside else "{} (no league match in the round)"))
    lines_doc["match_maker_rules"] = rules_broken(lines_doc["teams"])
    lines_doc["note"] = ("Real numbers, not invented: each player's line is from his own league match in the round %s to %s, "
                         "read from ESPN's public game logs on %s. A player with no league match in the round has an empty line "
                         "(listed in did_not_play). The players of a fantasy team play for different clubs, so these lines are "
                         "not one match. The rules of soccer/engine/make-match.js they break are listed in match_maker_rules; "
                         "nothing was changed to make them fit." % (first, last, date))
    out = os.path.join(T.out_dir(), "statlines", "soccer-real-%s.json" % (last or before))
    T._write(out, lines_doc)
    T._write(os.path.join(T.out_dir(), "rosters", "soccer-season-%s.json" % (
        next((v["season"] for v in raw["players"].values() if v.get("season")), "unknown"))), raw)
    T.log_step("fill_soccer finished: %d players filled, lines in %s, %d match maker rules broken" % (
        filled, os.path.basename(out), len(lines_doc["match_maker_rules"])))
    print("log:", log)
    print("filled %d players; lines: %s; rules broken: %d" % (filled, out, len(lines_doc["match_maker_rules"])))
    for r in lines_doc["match_maker_rules"]:
        print("  " + r)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
