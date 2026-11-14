"""Fills the profiles from real season numbers WITHOUT a model: the same tools Scout uses, called in a fixed order.

    python3 agents/scout/fill_profiles.py

This is not the agent. It is what the agent's tools can do on their own, so the profiles have real numbers
even when no model key is available. It writes data/profiles/GOB.json, PYT.json and data/rosters/season-<year>.json
and a log in agents/scout/runs/. A player it cannot resolve keeps null tendencies and a note saying why.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import scout_tools as T  # noqa: E402
import statlines as S  # noqa: E402


def main():
    log = T.start_run("fill-profiles")
    T.log_step("fill_profiles starts (no model, fixed order). season=%d" % T.season())
    rosters = S.rosters_from_js()
    done = 0
    for team, roster in rosters.items():
        for slot, name in roster.items():
            pos = S.SLOT_POS[slot]
            T.log_step("starting %s %s %s: find the player" % (team, slot, name))
            pid, why = S.resolve(name, pos)
            if not pid:
                T.log_step("%s: not resolved (%s), tendencies stay null" % (name, why))
                T.write_profile(team, slot, {"name": name, "position": pos, "player_id": None, "source": None,
                                             "tendencies": {}, "season_stats": {}, "notes": "Not filled: %s." % why})
                continue
            ss = T.season_stats(pid)
            stats = json.loads(ss)["stats"]
            t = T.compute_tendencies(pos, stats)
            missing = [k for k, v in t.items() if v["value"] is None]
            note = "Season %d numbers through game week %s (%s games). Filled by agents/scout/fill_profiles.py, no model." % (
                T.season(), stats.get("gms_active", stats.get("gp", "?")), stats.get("gp", "?"))
            if missing:
                note += " Null because the source has no value: %s." % ", ".join(missing)
            T.write_profile(team, slot, {"name": name, "position": pos, "player_id": pid, "source": json.loads(ss)["source"],
                                         "tendencies": t, "season_stats": stats, "notes": note})
            T.log_step("%s: wrote %s" % (name, ", ".join("%s=%s" % (k, v["value"]) for k, v in t.items())))
            done += 1
    T.log_step("fill_profiles finished: %d of 14 players filled" % done)
    print("log:", log)
    print("filled %d players" % done)
    return 0


if __name__ == "__main__":
    sys.exit(main())
