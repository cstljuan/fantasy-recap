"""Offline check for statlines.py. No network, no key, no packages.   python3 agents/scout/check_statlines.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "week5")
tmp = tempfile.mkdtemp(prefix="statlines-check-")
os.environ.update(SCOUT_FIXTURES=fx, SCOUT_OUT_DIR=tmp, SCOUT_SEASON="2026")
sys.path.insert(0, HERE)
import statlines as S  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


out = os.path.join(tmp, "week05-real.json")
S.main(["--week", "5", "--out", out, "--roster-file", os.path.join(fx, "rosters.json")])
d = json.load(open(out))
ref = json.load(open(os.path.join(HERE, "..", "..", "data", "statlines", "week11.json")))
check(set(ref) <= set(d), "all top-level fields of week11.json are present")
check(list(ref["teams"]["GOB"]) == list(d["teams"]["GOB"]), "each team has players and defense, like week11.json")
check(list(ref["teams"]["GOB"]["defense"]["line"]) == list(d["teams"]["GOB"]["defense"]["line"]), "defense has the same five fields")
qb = d["teams"]["GOB"]["players"]["QB"]
check(list(qb["line"]) == list(ref["teams"]["GOB"]["players"]["QB"]["line"]), "a player line has the same eleven fields in the same order")
check(qb["line"]["pass_yards"] == 280 and qb["line"]["pass_td"] == 2 and qb["line"]["interceptions"] == 1, "QB passing numbers map from Sleeper names")
check(d["teams"]["GOB"]["players"]["RB"]["line"]["rush_td"] == 1 and d["teams"]["GOB"]["players"]["RB"]["line"]["receptions"] == 3, "RB numbers map")
k = d["teams"]["GOB"]["players"]["K"]["line"]
check(k["fg_made"] == 2 and k["fg_missed"] == 1 and k["xp_made"] == 3, "kicker numbers map")
check(qb["line"]["receptions"] == 0, "a stat the source does not list for a player who played is 0")
wr = d["teams"]["GOB"]["players"]["WR1"]["line"]
check(all(v is None for v in wr.values()), "a player with no entry for the week gets null, not zeros")
check(any(u["slot"] == "WR1" and "no stats listed" in u["reason"] for u in d["unresolved"]), "that player is listed as unresolved with a reason")
check(any(u["name"] == "Nobody Here" for u in d["unresolved"]), "a name the source does not know is listed as unresolved")
check(d["invented"] is False and d["source"] and d["date"], "file says it is not invented and carries source and date")
print("OK")
