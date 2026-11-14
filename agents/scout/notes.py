"""Scout's notes as pages: one Markdown page per football player, from the data files only, no model.

    python3 agents/scout/notes.py
    python3 agents/scout/notes.py --teams GOB,PYT,TUR,OWL --out data/profiles/notes

For every player of every football team that has a profile in data/profiles/<team>.json it writes
data/profiles/notes/<team>-<slot>.md with:
  - the season tendencies, each with how it was worked out, its source address and date
  - recent form (the last three weeks played), next to the season number, with the weeks used and skipped
  - where Sleeper and ESPN disagree (data/rosters/crosscheck-2026.json), or that they agree, with both addresses
  - two plain sentences on what the numbers mean for play calling. They come from fixed rules on the numbers
    (RULES below), not from a model, and the page says so.
On-field numbers only. A number that is null is written as "not known". It also writes
data/profiles/notes/README.md with the list of pages.
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))

LABEL = {
    "deep_ball": "deep ball", "short_pass": "short passing", "scramble": "running as a quarterback",
    "run_share": "share of carries", "pass_catching": "catching passes", "red_zone_use": "red zone use",
    "catch_rate": "catch rate", "kicker_range": "long kicks", "accuracy": "accuracy",
    "target_share": "target share",
}
HOT = 0.15  # the same gap the announcer and the lineups screen use for hot and cold

# The rules for the two sentences. Each is (position, key, test, sentence). The first rule that matches gives the
# first sentence; the second sentence is about recent form when one tendency moved by HOT or more, else the next
# rule that matches on a different key.
RULES = [
    ("QB", "deep_ball", lambda v: v >= 0.7, "{last} pushes the ball downfield: a high deep ball number ({v}) says the long throw is a real option."),
    ("QB", "deep_ball", lambda v: v <= 0.55, "{last} gains little per throw ({v} on deep ball): expect short, quick passes."),
    ("QB", "short_pass", lambda v: v >= 0.68, "{last} completes a high share of passes ({v}): the short game is safe with this quarterback."),
    ("QB", "scramble", lambda v: v >= 0.12, "{last} runs a fair amount ({v} of the yards on the ground): a called run for the quarterback is in play."),
    ("QB", "scramble", lambda v: v < 0.06, "{last} rarely runs ({v}): plan for the pocket."),
    ("QB", "deep_ball", lambda v: True, "{last} throws at a middle depth ({v} on deep ball): a mix of short and long."),
    ("RB", "run_share", lambda v: v >= 0.85, "{last} is a runner first ({v} of touches are carries): give the ball on the ground."),
    ("RB", "run_share", lambda v: v <= 0.7, "{last} is used as a receiver almost as much as a runner ({v} carries share): passes to the back are normal."),
    ("RB", "red_zone_use", lambda v: v >= 0.2, "{last} gets a large share of carries near the goal line ({v}): a strong call inside the 20."),
    ("RB", "pass_catching", lambda v: v >= 0.8, "{last} catches most balls thrown to the back ({v}): a safe check-down."),
    ("RB", "run_share", lambda v: True, "{last} mostly runs ({v} of touches are carries) and catches some passes."),
    ("WR", "deep_ball", lambda v: v >= 0.75, "{last} gains a lot per catch ({v} on deep ball): the downfield target."),
    ("WR", "deep_ball", lambda v: v <= 0.55, "{last} gains little per catch ({v}): a short and middle target."),
    ("WR", "catch_rate", lambda v: v >= 0.75, "{last} catches most targets ({v}): a safe throw."),
    ("WR", "red_zone_use", lambda v: v >= 0.18, "{last} sees many red zone targets ({v}): a call near the goal line."),
    ("WR", "deep_ball", lambda v: True, "{last} is a middle depth target ({v} on deep ball)."),
    ("TE", "red_zone_use", lambda v: v >= 0.18, "{last} sees many red zone targets ({v}): a call near the goal line."),
    ("TE", "catch_rate", lambda v: v >= 0.75, "{last} catches most targets ({v}): a safe short throw."),
    ("TE", "deep_ball", lambda v: v >= 0.7, "{last} gains more per catch than most tight ends ({v}): can stretch the middle."),
    ("TE", "deep_ball", lambda v: True, "{last} is a short and middle target ({v} on deep ball)."),
    ("K", "kicker_range", lambda v: v >= 0.5, "{last} makes many field goals from 40 yards or more ({v}): long attempts are reasonable."),
    ("K", "kicker_range", lambda v: v < 0.3, "{last} makes few field goals from 40 yards or more ({v}): long attempts are a risk."),
    ("K", "accuracy", lambda v: v >= 0.9, "{last} is accurate ({v} of field goals made)."),
    ("K", "accuracy", lambda v: True, "{last} makes {v} of field goals attempted."),
    # neutral fallbacks, so the second sentence has something to say
    ("QB", "short_pass", lambda v: True, "{last} completes {v} of passes."),
    ("QB", "scramble", lambda v: True, "{last} gains {v} of the yards by running."),
    ("RB", "pass_catching", lambda v: True, "{last} catches {v} of passes thrown to the back."),
    ("RB", "red_zone_use", lambda v: True, "{last} gets {v} of carries inside the 20."),
    ("WR", "catch_rate", lambda v: True, "{last} catches {v} of targets."),
    ("WR", "red_zone_use", lambda v: True, "{last} sees {v} of targets in the red zone."),
    ("TE", "catch_rate", lambda v: True, "{last} catches {v} of targets."),
    ("TE", "red_zone_use", lambda v: True, "{last} sees {v} of targets in the red zone."),
    ("K", "kicker_range", lambda v: True, "{last} makes {v} of field goals from 40 yards or more."),
]


def _read(path, default=None):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def fmt(v):
    return "not known" if v is None else ("%.3f" % v).rstrip("0").rstrip(".") if isinstance(v, float) else str(v)


def last_name(name):
    parts = name.split()
    if len(parts) > 1 and parts[-1].rstrip(".") in ("Jr", "Sr", "II", "III", "IV"):
        parts = parts[:-1]
    if len(parts) > 2 and parts[-2] in ("St.", "St", "De", "Van", "Von"):
        return parts[-2] + " " + parts[-1]
    return parts[-1]


def sentences(p):
    """Two sentences from RULES and recent form. Returns (first, second)."""
    pos, t, last = p.get("position"), p.get("tendencies") or {}, last_name(p.get("name", ""))
    out, used = [], set()
    for rpos, key, test, text in RULES:
        v = t.get(key)
        if rpos != pos or v is None or key in used or not test(v):
            continue
        out.append(text.format(last=last, v=fmt(v)))
        used.add(key)
        break
    form = ((p.get("form") or {}).get("tendencies") or {})
    best = None
    for k, fv in form.items():
        sv = t.get(k)
        if fv is None or sv is None:
            continue
        d = fv - sv
        if abs(d) >= HOT - 1e-9 and (best is None or abs(d) > abs(best[1])):
            best = (k, d, sv, fv)
    if best:
        weeks = ", ".join(str(w) for w in (p.get("form") or {}).get("weeks", []))
        out.append("Lately %s's %s number is %s: %s in weeks %s against %s for the season, a small sample." % (
            last, LABEL.get(best[0], best[0]), "up" if best[1] > 0 else "down", fmt(best[3]), weeks, fmt(best[2])))
    else:
        for rpos, key, test, text in RULES:
            v = t.get(key)
            if rpos != pos or v is None or key in used or not test(v):
                continue
            out.append(text.format(last=last, v=fmt(v)))
            break
    while len(out) < 2:
        out.append("There are not enough numbers for %s to say more." % last)
    return out[0], out[1]


def page(team, slot, p, cross, date):
    name = p.get("name", "")
    lines = ["# %s" % name, "",
             "%s, %s (%s). Written by `agents/scout/notes.py` on %s from the data files, with no model: the two "
             "sentences under \"What it means\" come from fixed rules on the numbers below. On-field numbers only."
             % (team, slot, p.get("position", ""), date), ""]
    t, src = p.get("tendencies") or {}, p.get("tendency_sources") or {}
    lines += ["## Season tendencies", "", "| Tendency | Value | How | Source | Date |", "|---|---|---|---|---|"]
    for k, v in t.items():
        s = src.get(k) or {}
        lines.append("| %s | %s | %s | %s | %s |" % (LABEL.get(k, k), fmt(v), s.get("how") or "", s.get("source") or "none", s.get("date") or ""))
    if not t:
        lines.append("| none | not known | | | |")
    lines += [""]
    if p.get("notes"):
        lines += [p["notes"], ""]
    f = p.get("form")
    lines += ["## Recent form", ""]
    if f and f.get("weeks"):
        lines += ["Weeks used: %s. Weeks skipped (no stats): %s. Source: %s, read %s." % (
            ", ".join(str(w) for w in f["weeks"]), ", ".join(str(w) for w in f.get("skipped_weeks") or []) or "none",
            f.get("source") or "none", f.get("date") or ""), "",
            "| Tendency | Recent | Season | Change |", "|---|---|---|---|"]
        for k, v in (f.get("tendencies") or {}).items():
            sv = t.get(k)
            ch = "not known" if v is None or sv is None else ("%+.3f" % (v - sv))
            lines.append("| %s | %s | %s | %s |" % (LABEL.get(k, k), fmt(v), fmt(sv), ch))
    else:
        lines.append("No recent form: %s" % ((f or {}).get("notes") or "not filled."))
    lines += ["", "## Sleeper against ESPN", ""]
    c = cross.get("%s.%s" % (team, slot)) if cross else None
    if not c:
        lines.append("Not cross-checked.")
    else:
        dis = [(k, r) for k, r in (c.get("stats") or {}).items() if r.get("disagree")]
        compared = [k for k, r in (c.get("stats") or {}).items() if r.get("espn") is not None and r.get("sleeper") is not None]
        if not c.get("espn_id"):
            n = c.get("notes", "") or ""
            lines.append(n if n.startswith("Not compared") else "Not compared: " + n)
        elif dis:
            lines.append("They disagree on:")
            for k, r in dis:
                lines.append("- %s: Sleeper %s, ESPN %s" % (k.replace("_", " "), fmt(r["sleeper"]), fmt(r["espn"])))
        else:
            lines.append("All %d compared season totals agree (%s). Games played: Sleeper %s, ESPN %s." % (
                len(compared), ", ".join(k.replace("_", " ") for k in compared), fmt(c["games"].get("sleeper")), fmt(c["games"].get("espn"))))
        lines += ["", "Sleeper: %s, read %s. ESPN: %s, read %s." % (c.get("sleeper_source") or "none", c.get("sleeper_date") or "",
                                                                     c.get("espn_source") or "none", c.get("espn_date") or "")]
    s1, s2 = sentences(p)
    lines += ["", "## What it means for play calling", "", s1 + " " + s2, ""]
    return "\n".join(lines)


def main(argv):
    ap = argparse.ArgumentParser()
    ap.add_argument("--teams", default="GOB,PYT,TUR,OWL")
    ap.add_argument("--profiles", default=os.path.join(ROOT, "data", "profiles"))
    ap.add_argument("--crosscheck", default=os.path.join(ROOT, "data", "rosters", "crosscheck-2026.json"))
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "profiles", "notes"))
    ap.add_argument("--date", help="the date written on the pages (default: today)")
    a = ap.parse_args(argv)
    import datetime
    date = a.date or datetime.date.today().isoformat()
    cross = (_read(a.crosscheck, {}) or {}).get("players", {})
    os.makedirs(a.out, exist_ok=True)
    index = []
    for team in a.teams.split(","):
        prof = _read(os.path.join(a.profiles, "%s.json" % team))
        if not prof or "QB" not in prof.get("players", {}):
            print("skipped %s: no football profile" % team)
            continue
        for slot, p in prof["players"].items():
            fn = "%s-%s.md" % (team, slot)
            with open(os.path.join(a.out, fn), "w", encoding="utf-8") as f:
                f.write(page(team, slot, p, cross, date))
            index.append((team, slot, p.get("name", ""), fn))
    with open(os.path.join(a.out, "README.md"), "w", encoding="utf-8") as f:
        f.write("# Scout's notes\n\nOne page per player, written by `python3 agents/scout/notes.py` from `data/profiles/` and "
                "`data/rosters/crosscheck-2026.json`, with no model. Do not edit by hand: run the script again.\n\n")
        for team, slot, name, fn in index:
            f.write("- [%s %s, %s](%s)\n" % (team, slot, name, fn))
    print("wrote %d pages to %s" % (len(index), a.out))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
