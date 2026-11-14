"""Offline check for plays.py. No network, no key, no packages.   python3 agents/scout/check_plays.py"""
import json
import os
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "plays")
tmp = tempfile.mkdtemp(prefix="plays-check-")
os.environ.update(SCOUT_FIXTURES=fx, SCOUT_OUT_DIR=os.path.join(tmp, "data"), SCOUT_RUNS_DIR=os.path.join(tmp, "runs"), SCOUT_SEASON="2026")
sys.path.insert(0, HERE)
import plays as P  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


check(P.short_name("Amon-Ra St. Brown") == "A.St. Brown" and P.short_name("Ja'Marr Chase") == "J.Chase"
      and P.short_name("Kenneth Walker III") == "K.Walker", "ESPN short names, with St., apostrophes and suffixes")
check(P.parse({"text": "Official Timeout at 06:17.", "type": "Official Timeout"}) is None, "a timeout is not a snap")
check(P.parse({"text": "J.Cook right end pushed ob at BUF 29 for 11 yards (J.Pierre).", "type": "Rush"})["gap"] == "right end",
      "a run pushed out of bounds keeps its gap")
x = P.parse({"text": "C.Wentz pass incomplete short right to J.Jefferson.Buffalo challenged the forward pass ruling", "type": "Fumble Recovery (Opponent)"})
check(x["kind"] == "inc" and x["target"] == "J.Jefferson", "the text decides, not ESPN's type field")
out = os.path.join(tmp, "plays.json")
P.main(["--roster-file", os.path.join(fx, "rosters.json"), "--out", out])
d = json.load(open(out))
check(list(d["games"]) == ["900"] and d["weeks"] == [1], "only games of our NFL teams are read, and the weeks stop at the first empty one")
qb, wr, rb, k = (d["players"]["TST." + s] for s in ("QB", "WR1", "RB", "K"))
t = qb["totals"]
check((t["pass_att"], t["pass_cmp"], t["pass_yd"], t["pass_td"], t["pass_int"], t["sacks"]) == (7, 3, 55, 1, 1, 1),
      "quarterback: 7 attempts with a throwaway and a full-name play, 3 completions, 55 yards with the lateral, 1 touchdown, 1 interception, 1 sack")
w = wr["totals"]
check((w["rec_tgt"], w["rec"], w["rec_yd"], w["rec_td"]) == (5, 2, 52, 1),
      "receiver with St. in the name: 5 targets (one written with full names), 2 catches, 52 yards with 15 after a lateral, 1 touchdown")
r = rb["totals"]
check((r["rush_att"], r["rush_yd"], r["rec"], r["rec_yd"]) == (2, 20, 1, 3),
      "running back: the run wiped out by a penalty and the two-point try do not count; the catch before the lateral keeps 3 yards")
check(any(p.get("nullified") for p in rb["plays"]), "the wiped-out run is kept and marked")
kt = k["totals"]
check((kt["fga"], kt["fgm"], kt["xpa"], kt["xpm"]) == (1, 1, 1, 1), "kicker: the field goal and the extra point written inside the touchdown play")
td = [p for p in wr["plays"] if p.get("td")][0]
check((td["depth"], td["dir"], td["dn"], td["ytg"], td["q"]) == ("deep", "middle", 3, 25, 1), "a play keeps depth, direction, down and field position")
runs = [p.get("gap") for p in rb["plays"] if not p.get("nullified") and p["role"] == "rusher"]
check(runs == ["left tackle", "right end"], "run gaps")
check(d["team_games"]["TST"]["900"]["pass_att"] == 7 and d["team_games"]["OPP"]["900"]["rush_att"] == 1, "each team's totals per game, for shares")
rc = qb["reconcile"]["pass_yd"]
check(rc == {"plays": 55, "sleeper": 58.0, "difference": -3.0}, "the planted difference with Sleeper is found")
check(d["reconcile"]["differ"] == [{"player": "TST.QB", "name": "Test Quarterback", "stat": "pass_yd", "plays": 55, "sleeper": 58.0}]
      and d["reconcile"]["exact"] == d["reconcile"]["compared"] - 1, "every other number equals Sleeper")
check(all(g["source"].startswith("https://site.api.espn.com/") for g in d["games"].values()), "every game keeps its address")
b = d["reconcile_box"]
check([(x["player"], x["stat"], x["plays"], x["box"]) for x in b["differ"]] == [("TST.QB", "pass_att", 7, 8)] and b["exact"] == b["compared"] - 1,
      "game by game against ESPN's box score: only the planted attempt differs")
check(qb["box"]["900"]["pass_yd"] == 55 and k["box"]["900"]["fgm"] == 1, "each player's box score line is kept per game")
check(any(n.endswith("-plays.txt") for n in os.listdir(os.path.join(tmp, "runs"))), "a research log is written")
print("OK")
