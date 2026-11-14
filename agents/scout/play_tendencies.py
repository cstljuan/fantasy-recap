"""Tendencies from real plays: what each football player actually did, snap by snap, worked out from
data/rosters/plays-2026.json (agents/scout/plays.py). No network, no model.

    python3 agents/scout/play_tendencies.py
    python3 agents/scout/play_tendencies.py --plays <file> --profiles <folder>

It adds two fields to each player in data/profiles/<team>.json and changes no other field, except that it fills
target_share in "tendencies" for receivers, tight ends and backs (it was null: season totals cannot give it):

    players.<slot>.play_tendencies         { key: 0 to 1 or null }
    players.<slot>.play_tendency_sources   { key: { how, n (the plays it rests on), of (the plays it is out of),
                                                    games: [ESPN event ids], source, date } }

Plays wiped out by a penalty are left out. A share needs at least MIN_N plays under it, or it stays null (too few to
say anything). Keys by position:
  QB  deep_share, left_share, middle_share, right_share, deep_completion, sack_rate, int_rate, scramble_rate,
      third_down_conversion, red_zone_td_rate
  WR, TE  target_share, deep_target_share, red_zone_target_share, third_down_target_share, catch_rate_short,
      catch_rate_deep, left_share, middle_share, right_share
  RB  carry_share, target_share, left_share, middle_share, right_share, goal_line_share, short_yardage_share,
      explosive_run_rate, stuff_rate
  K   make_rate_0_39, make_rate_40_49, make_rate_50_plus, long_attempt_share
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
MIN_N = 5
SIDE = {"left end": "left", "left tackle": "left", "left guard": "left", "up the middle": "middle",
        "right guard": "right", "right tackle": "right", "right end": "right"}


def _read(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def ratio(n, of, how, games, src, date):
    v = round(n / of, 3) if of >= MIN_N else None
    if v is not None:
        v = max(0.0, min(1.0, v))
    return v, {"how": how + ("" if of >= MIN_N else " (null: fewer than %d plays)" % MIN_N), "n": n, "of": of,
               "games": games, "source": src, "date": date}


def compute(player, team_games, src, date):
    """{key: (value, source)} for one player from plays.json."""
    pos = player["position"]
    plays = [p for p in player["plays"] if not p.get("nullified") and not (p.get("dpi") and p["kind"] == "inc")]
    games = sorted(set(p["ev"] for p in plays) | set(player.get("box", {}).keys()))
    team = team_games.get(player.get("nfl_team") or "", {})
    def tsum(k):
        return sum(team.get(g, {}).get(k, 0) for g in games)
    out = {}
    def put(key, n, of, how):
        out[key] = ratio(n, of, how, games, src, date)

    if pos == "QB":
        att = [p for p in plays if p["role"] == "passer" and p["kind"] in ("pass", "inc", "int")]
        dated = [p for p in att if p.get("depth")]
        deep = [p for p in dated if p["depth"] == "deep"]
        put("deep_share", len(deep), len(dated), "deep throws divided by throws with a depth in the play text")
        dirs = [p for p in att if p.get("dir")]
        for d in ("left", "middle", "right"):
            put(d + "_share", sum(1 for p in dirs if p["dir"] == d), len(dirs), "throws to the %s divided by throws with a direction" % d)
        put("deep_completion", sum(1 for p in deep if p["kind"] == "pass"), len(deep), "deep completions divided by deep throws")
        sacks = sum(1 for p in plays if p["role"] == "passer" and p["kind"] == "sack")
        put("sack_rate", sacks, len(att) + sacks, "sacks divided by throws plus sacks")
        put("int_rate", sum(1 for p in att if p["kind"] == "int"), len(att), "interceptions divided by throws")
        scr = sum(1 for p in plays if p["role"] == "rusher" and p["kind"] == "scramble")
        put("scramble_rate", scr, len(att) + sacks + scr, "scrambles divided by dropbacks (throws, sacks and scrambles)")
        third = [p for p in plays if p.get("dn") == 3 and (p["role"] == "passer" and p["kind"] in ("pass", "inc", "int", "sack")
                                                           or p["role"] == "rusher" and p["kind"] in ("run", "scramble"))]
        conv = sum(1 for p in third if p.get("td") or (isinstance(p.get("yds"), int) and isinstance(p.get("dist"), int)
                                                       and p["kind"] in ("pass", "run", "scramble") and p["yds"] >= p["dist"]))
        put("third_down_conversion", conv, len(third), "third down plays by the quarterback that gained the first down or scored")
        rz = [p for p in att if isinstance(p.get("ytg"), int) and p["ytg"] <= 20]
        put("red_zone_td_rate", sum(1 for p in rz if p.get("td")), len(rz), "touchdown throws inside the 20 divided by throws inside the 20")

    if pos in ("WR", "TE", "RB"):
        tg = [p for p in plays if p["role"] == "target"]
        put("target_share", len(tg), tsum("pass_att"), "targets divided by the team's throws in the games played")
        if pos != "RB":
            dated = [p for p in tg if p.get("depth")]
            deep = [p for p in dated if p["depth"] == "deep"]
            short = [p for p in dated if p["depth"] == "short"]
            put("deep_target_share", len(deep), len(dated), "deep targets divided by targets with a depth")
            put("red_zone_target_share", sum(1 for p in tg if isinstance(p.get("ytg"), int) and p["ytg"] <= 20), tsum("rz_pass"),
                "targets inside the 20 divided by the team's throws inside the 20")
            put("third_down_target_share", sum(1 for p in tg if p.get("dn") == 3), tsum("third_pass"),
                "third down targets divided by the team's third down throws")
            put("catch_rate_short", sum(1 for p in short if p["kind"] == "pass"), len(short), "short catches divided by short targets")
            put("catch_rate_deep", sum(1 for p in deep if p["kind"] == "pass"), len(deep), "deep catches divided by deep targets")
            dirs = [p for p in tg if p.get("dir")]
            for d in ("left", "middle", "right"):
                put(d + "_share", sum(1 for p in dirs if p["dir"] == d), len(dirs), "targets to the %s divided by targets with a direction" % d)

    if pos == "RB":
        car = [p for p in plays if p["role"] == "rusher" and p["kind"] in ("run", "scramble")]
        put("carry_share", len(car), tsum("rush_att"), "carries divided by the team's carries in the games played")
        gapped = [p for p in car if p.get("gap") in SIDE]
        for d in ("left", "middle", "right"):
            put(d + "_share", sum(1 for p in gapped if SIDE[p["gap"]] == d), len(gapped), "carries to the %s divided by carries with a gap" % d)
        put("goal_line_share", sum(1 for p in car if isinstance(p.get("ytg"), int) and p["ytg"] <= 5), tsum("gl_rush"),
            "carries inside the 5 divided by the team's carries inside the 5")
        put("short_yardage_share", sum(1 for p in car if p.get("dn") in (3, 4) and isinstance(p.get("dist"), int) and p["dist"] <= 2),
            tsum("sy_rush"), "carries on third or fourth and 2 or less divided by the team's")
        yd = [p for p in car if isinstance(p.get("yds"), int)]
        put("explosive_run_rate", sum(1 for p in yd if p["yds"] >= 10), len(yd), "carries of 10 yards or more divided by carries")
        put("stuff_rate", sum(1 for p in yd if p["yds"] <= 0), len(yd), "carries for no gain or a loss divided by carries")

    if pos == "K":
        fg = [p for p in plays if p["role"] == "kicker" and p["kind"] == "fg" and isinstance(p.get("dist_fg"), int)]
        for name, lo, hi in (("0_39", 0, 39), ("40_49", 40, 49), ("50_plus", 50, 99)):
            band = [p for p in fg if lo <= p["dist_fg"] <= hi]
            out["make_rate_" + name] = ratio(sum(1 for p in band if p.get("good")), len(band),
                                             "field goals made from %s yards divided by attempts" % name.replace("_", " to ").replace("to plus", "or more"),
                                             games, src, date)
        put("long_attempt_share", sum(1 for p in fg if p["dist_fg"] >= 40), len(fg), "attempts from 40 yards or more divided by attempts")
    return out


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--plays", default=os.path.join(ROOT, "data", "rosters", "plays-2026.json"))
    ap.add_argument("--profiles", default=os.path.join(ROOT, "data", "profiles"))
    a = ap.parse_args(argv)
    d = _read(a.plays)
    src = "%s (ESPN play-by-play, parsed by agents/scout/plays.py)" % os.path.relpath(a.plays, ROOT) if a.plays.startswith(ROOT) else a.plays
    date = d.get("date")
    by_team = {}
    for key, pl in d["players"].items():
        team, slot = key.split(".")
        by_team.setdefault(team, {})[slot] = pl
    filled = 0
    for team, slots in by_team.items():
        path = os.path.join(a.profiles, "%s.json" % team)
        if not os.path.exists(path):
            print("skipped %s: no profile file" % team)
            continue
        prof = _read(path)
        for slot, pl in slots.items():
            p = prof["players"].get(slot)
            if not p or p.get("name") != pl["name"]:
                print("skipped %s %s: the profile names %s" % (team, slot, p and p.get("name")))
                continue
            res = compute(pl, d.get("team_games", {}), src, date)
            p["play_tendencies"] = {k: v[0] for k, v in res.items()}
            p["play_tendency_sources"] = {k: v[1] for k, v in res.items()}
            if "target_share" in res and res["target_share"][0] is not None:
                p.setdefault("tendencies", {})["target_share"] = res["target_share"][0]
                p.setdefault("tendency_sources", {})["target_share"] = {"source": src, "date": date,
                                                                        "how": res["target_share"][1]["how"] + " (from the real plays)"}
            filled += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(prof, f, indent=2, ensure_ascii=False)
            f.write("\n")
    print("play tendencies for %d players" % filled)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
