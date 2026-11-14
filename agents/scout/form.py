"""Recent form: the same tendencies as the season ones, worked out from the last three weeks each player played.

    python3 agents/scout/form.py                 (live, Sleeper's public API, rosters from js/data.js)
    python3 agents/scout/form.py --weeks 3 --latest 9 --roster-file <json {team: {slot: name}}>

For every roster player it reads weekly_stats (scout_tools.py), finds the last league week that has any numbers
(or --latest), walks back from there and keeps the last N weeks the player played. A week with no stats
(bye, injury, not played: the source has nothing or games played is 0) is skipped and listed. The stats of the
kept weeks are added up and turned into tendencies with the same formulas as the season ones
(scout_tools.compute_tendencies), so form and season can be compared key by key.

It adds one field to each player in data/profiles/<team>.json and changes nothing else:

    players.<slot>.form = {
      "tendencies": { same keys as tendencies, 0 to 1 or null },
      "tendency_sources": { key: { "source", "date", "how", "weeks" } },
      "weeks": [the weeks used, oldest first],
      "skipped_weeks": [weeks with no stats inside the span that was searched],
      "source": the weekly stats address, "date": the day it was read,
      "notes": text
    }

A player who cannot be resolved, or who has no week with stats, gets form with null tendencies and a note saying
why. The raw sums are saved in data/rosters/form-<season>.json. No model is used: this is a fixed order of tool
calls, logged step by step in agents/scout/runs/.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import statlines as S  # noqa: E402


def played(stats):
    """True when the week has stats and the player took part (games played above 0 when the source says)."""
    if not isinstance(stats, dict) or not stats:
        return False
    gp = stats.get("gp")
    if isinstance(gp, (int, float)):
        return gp > 0
    return True


def pick_weeks(weeks, latest, n=3):
    """Walk back from `latest`. Returns (used weeks oldest first, skipped weeks oldest first)."""
    used, skipped = [], []
    w = latest
    while w >= 1 and len(used) < n:
        if played(weeks.get(str(w))):
            used.append(w)
        else:
            skipped.append(w)
        w -= 1
    return sorted(used), sorted(skipped)


def add_up(weeks, used):
    total = {}
    for w in used:
        for k, v in (weeks.get(str(w)) or {}).items():
            if isinstance(v, (int, float)) and not isinstance(v, bool):
                total[k] = total.get(k, 0) + v
    return {k: round(v, 3) for k, v in total.items()}


def compute_form(position, weekly_json, latest, n=3):
    """From the JSON text weekly_stats returned: the form block (without writing it) and the summed stats."""
    data = json.loads(weekly_json)
    weeks = data.get("weeks", {})
    used, skipped = pick_weeks(weeks, latest, n)
    summed = add_up(weeks, used)
    date = data.get("date") or T.today()
    if used:
        t = T.compute_tendencies(position, summed)
    else:
        t = {k: {"value": None, "how": v["how"]} for k, v in T.compute_tendencies(position, {}).items()}
    form = {
        "tendencies": {k: v["value"] for k, v in t.items()},
        "tendency_sources": {k: {"source": data.get("source"), "date": date, "how": v["how"] + ", over the weeks listed",
                                 "weeks": used} for k, v in t.items()},
        "weeks": used,
        "skipped_weeks": skipped,
        "source": data.get("source"),
        "date": date,
        "notes": "",
    }
    missing = [k for k, v in form["tendencies"].items() if v is None]
    if not used:
        form["notes"] = "No week with stats from week %d back to week 1." % latest
    else:
        form["notes"] = "Season %d, weeks %s added up%s." % (
            T.season(), ", ".join(str(w) for w in used),
            (", weeks %s skipped (no stats in the source: a bye, an injury, or a game not played yet)" % ", ".join(str(w) for w in skipped)) if skipped else "")
        if len(used) < n:
            form["notes"] += " Only %d played weeks were found." % len(used)
        if missing:
            form["notes"] += " Null because the source has no value: %s." % ", ".join(missing)
    return form, summed


def latest_week(all_weeks):
    best = 0
    for weeks in all_weeks:
        for k, v in weeks.items():
            if str(k).isdigit() and played(v):
                best = max(best, int(k))
    return best


def write_form(team, slot, name, position, form):
    """Adds `form` to one player in data/profiles/<team>.json. Everything else in the file stays as it is."""
    path = os.path.join(T.out_dir(), "profiles", "%s.json" % team)
    doc = T._read(path, {"team": team, "source": "", "players": {}})
    for k, v in form["tendencies"].items():
        if v is not None and not (isinstance(v, (int, float)) and 0 <= v <= 1):
            raise ValueError("form tendency %s must be a number from 0 to 1 or null" % k)
    p = doc["players"].get(slot)
    if p is None:
        p = doc["players"][slot] = {"name": name, "position": position, "tendencies": {}, "tendency_sources": {},
                                    "notes": "Season tendencies not filled yet."}
    p["form"] = form
    T._write(path, doc)
    return path


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--weeks", type=int, default=3)
    ap.add_argument("--latest", type=int, help="the last week to look at (default: the last week with any stats)")
    ap.add_argument("--roster-file", help="JSON {team: {slot: name}} instead of js/data.js")
    a = ap.parse_args(argv)
    log = T.start_run("form")
    T.log_step("form starts (no model, fixed order). season=%d, weeks=%d" % (T.season(), a.weeks))
    rosters = json.load(open(a.roster_file)) if a.roster_file else S.rosters_from_js()

    found = []
    for team, roster in rosters.items():
        for slot, name in roster.items():
            pos = S.SLOT_POS[slot]
            T.log_step("starting %s %s %s: find the player" % (team, slot, name))
            pid, why = S.resolve(name, pos)
            weekly = T.weekly_stats(pid) if pid else None
            if not pid:
                T.log_step("%s: not resolved (%s)" % (name, why))
            found.append((team, slot, name, pos, pid, why, weekly))
    latest = a.latest or latest_week([json.loads(f[6])["weeks"] for f in found if f[6]])
    T.log_step("plan: last week with stats is %d; walk back from it to the last %d weeks each player played" % (latest, a.weeks))

    raw_path = os.path.join(T.out_dir(), "rosters", "form-%d.json" % T.season())
    raw = {"season": T.season(), "source": "Sleeper public API, weekly stats", "latest_week": latest,
           "weeks_wanted": a.weeks, "date": T.today(), "players": {}}
    filled = 0
    for team, slot, name, pos, pid, why, weekly in found:
        if not pid:
            form = {"tendencies": {k: None for k in T.compute_tendencies(pos, {})}, "tendency_sources": {},
                    "weeks": [], "skipped_weeks": [], "source": None, "date": T.today(),
                    "notes": "Not filled: %s." % why}
            summed = {}
        else:
            form, summed = compute_form(pos, weekly, latest, a.weeks)
            if form["weeks"]:
                filled += 1
        write_form(team, slot, name, pos, form)
        raw["players"]["%s.%s" % (team, slot)] = {"name": name, "player_id": pid, "weeks": form["weeks"],
                                                  "skipped_weeks": form["skipped_weeks"], "stats": summed,
                                                  "source": form["source"], "date": form["date"]}
        T.log_step("%s: form weeks %s, skipped %s, %s" % (
            name, form["weeks"], form["skipped_weeks"],
            ", ".join("%s=%s" % (k, v) for k, v in form["tendencies"].items())))
    T._write(raw_path, raw)
    T.log_step("form finished: %d of %d players have form" % (filled, len(found)))
    print("log:", log)
    print("form for %d of %d players, latest week %d" % (filled, len(found), latest))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
