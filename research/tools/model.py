#!/usr/bin/env python3
"""Projection model for the 28 fantasy players, plus its backtest.

Run from the repo root:  python3 research/tools/model.py
Writes research/data/projections.json and research/BACKTEST.md. Standard library only, fixed seed, so the output is repeatable.

Inputs: research/data/<KEY>.json (game logs, RotoWire projections, status, next games), research/data/league.json (defense_2026)
and data/scoring.json (the scoring rules).

Method (see BACKTEST.md for the numbers):
  base      recency weighted average of the player's own per game stat line (exponential decay per game, half life in games)
  opponent  what the opposing defense allows to the player's position versus normal, shrunk toward 1.00
  game      the player's team implied points (total/2 + spread/2, spread is positive for the favorite) over the league average
  mean      base x opponent factor x game factor, scored with data/scoring.json
  spread    empirical ratio of a game's points to the player's own average (his last 30 games plus the position pool), scaled
  playing   chance of playing multiplies the mean and puts a mass at zero in the distribution
"""
import bisect
import json
import math
import os
import random
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(ROOT, "research", "data")
OUT_JSON = os.path.join(DATA, "projections.json")
OUT_MD = os.path.join(ROOT, "research", "BACKTEST.md")
TODAY = "2026-11-15"
TARGET_WEEK = 10
SEED = 20261115
DRAWS = 20000
WINDOW = 60          # most recent games used for the base
RATIO_WINDOW = 30    # games used for the spread
MIN_GAMES = 3
TEAMS = ["GOB", "PYT", "TUR", "OWL"]
SLOTS = ["QB", "RB", "WR1", "WR2", "WR3", "TE", "K"]
PAIRINGS = [("GOB", "PYT"), ("TUR", "OWL"), ("GOB", "TUR"), ("GOB", "OWL"), ("PYT", "TUR"), ("PYT", "OWL")]
STATS = ["pass_yd", "pass_td", "int", "rush_yd", "rush_td", "rec", "rec_yd", "rec_td", "fum_lost",
         "fg_0_19", "fg_20_29", "fg_30_39", "fg_40_49", "fg_50_59", "fg_60", "xpm"]

# Chance of playing for players who carry a game status. Stated by hand from the status text in the data files (2026-11-13/14).
PLAY_CHANCE = {
    "GOB-WR3": (0.85, "questionable with ribs, limited in practice, played through the same injury last week, expected to play"),
    "TUR-WR2": (0.85, "questionable after a concussion, full practice Friday, expected to clear the protocol"),
    "OWL-WR3": (0.50, "questionable with back spasms, played no snap last week, practice restricted, Monday night game"),
}

# ----------------------------------------------------------------------------------------------------------------- data


def load_scoring():
    with open(os.path.join(ROOT, "data", "scoring.json")) as fh:
        return json.load(fh)


SC = load_scoring()
PER = SC["per"]
BANDS = sorted(SC["field_goal_bands"], key=lambda b: -b["min_yards"])


def fg_pts(dist_low):
    """Points for one made field goal in a band, given the lowest distance of the band."""
    base = PER["fg_made"]
    for b in BANDS:
        if dist_low >= b["min_yards"]:
            return base + b["bonus"]
    return base


def score_line(s):
    """Fantasy points for a stat line keyed like the log rows."""
    pts = (s.get("pass_yd", 0) * PER["pass_yards"] + s.get("pass_td", 0) * PER["pass_td"] + s.get("int", 0) * PER["interceptions"]
           + s.get("rush_yd", 0) * PER["rush_yards"] + s.get("rush_td", 0) * PER["rush_td"] + s.get("rec", 0) * PER["receptions"]
           + s.get("rec_yd", 0) * PER["rec_yards"] + s.get("rec_td", 0) * PER["rec_td"] + s.get("fum_lost", 0) * PER["fumbles_lost"]
           + s.get("xpm", 0) * PER["xp_made"])
    for k, lo in (("fg_0_19", 0), ("fg_20_29", 20), ("fg_30_39", 30), ("fg_40_49", 40), ("fg_50_59", 50), ("fg_60", 60)):
        pts += s.get(k, 0) * fg_pts(lo)
    return pts


def rotowire_fp(st):
    """Fantasy points from a RotoWire stat projection, using our scoring."""
    s = {"pass_yd": st.get("pass_yd", 0), "pass_td": st.get("pass_td", 0), "int": st.get("pass_int", 0),
         "rush_yd": st.get("rush_yd", 0), "rush_td": st.get("rush_td", 0), "rec_yd": st.get("rec_yd", 0),
         "rec_td": st.get("rec_td", 0), "fum_lost": st.get("fum_lost", 0), "xpm": st.get("xpm", 0)}
    s["fg_20_29"] = st.get("fgm_20_29", 0)
    s["fg_30_39"] = st.get("fgm_30_39", 0)
    s["fg_40_49"] = st.get("fgm_40_49", 0)
    s["fg_50_59"] = st.get("fgm_50p", 0)
    return score_line(s)


class Player:
    pass


def load_players():
    players = {}
    for slot_team in TEAMS:
        for slot in SLOTS:
            key = "%s-%s" % (slot_team, slot)
            with open(os.path.join(DATA, key + ".json")) as fh:
                d = json.load(fh)
            p = Player()
            p.key, p.team, p.slot = key, slot_team, slot
            p.name, p.pos, p.nfl = d["name"], d["position"], d["nfl_team"]
            p.status = d.get("status") or {}
            p.next_games = d.get("next_games") or []
            rows = []
            for r in d["log"]:
                if r.get("stype") != "REG":
                    continue
                s = {k: float(r.get(k) or 0) for k in STATS}
                imp = r.get("implied")
                if imp is None and r.get("spread") is not None and r.get("total") is not None:
                    imp = r["total"] / 2.0 + r["spread"] / 2.0
                rows.append({"season": int(r["season"]), "week": int(r["week"]), "s": s, "fp": score_line(s), "fp_log": r.get("fp"),
                             "opp": r.get("opp"), "implied": imp, "home": r.get("home"),
                             "td": s["pass_td"] + s["rush_td"] + s["rec_td"]})
            rows.sort(key=lambda x: (x["season"], x["week"]))
            p.rows = rows
            p.rw = {}
            for k, v in (d.get("projections_rotowire") or {}).items():
                try:
                    p.rw[k] = rotowire_fp(v["stats"])
                except (KeyError, TypeError):
                    pass
            players[key] = p
    return players


def before(p, season, week):
    """Index of the first row at or after (season, week): rows[:i] is everything before that week."""
    keys = [(r["season"], r["week"]) for r in p.rows]
    return bisect.bisect_left(keys, (season, week))


# ---------------------------------------------------------------------------------------------------- model pieces


def weights(n, half_life):
    """Weight for each of n games, oldest first, newest has weight 1."""
    return [0.5 ** ((n - 1 - i) / half_life) for i in range(n)]


def wavg(vals, half_life):
    w = weights(len(vals), half_life)
    return sum(a * b for a, b in zip(vals, w)) / sum(w)


class Context:
    """Everything that depends only on (season, week): league average implied points and the defense table built from our 28 logs."""

    def __init__(self, players):
        self.players = players
        self._imp = {}
        self._def = {}
        self._pool = {}

    def league_implied(self, season, week):
        k = (season, week)
        if k not in self._imp:
            vals = []
            for p in self.players.values():
                for r in p.rows:
                    if r["implied"] is not None and season - 1 <= r["season"] and (r["season"], r["week"]) < k:
                        vals.append(r["implied"])
            self._imp[k] = sum(vals) / len(vals) if vals else 22.5
        return self._imp[k]

    def def_sums(self, season, upto):
        """Same idea as defense_tables.build in dataset.py, but only from the 28 logs we have: for each (defense, position) the
        points scored against it and what those players scored against everyone else in the same season (weeks before upto)."""
        k = (season, upto)
        if k in self._def:
            return self._def[k]
        out = defaultdict(lambda: [0.0, 0.0, 0])
        for p in self.players.values():
            rows = [r for r in p.rows if r["season"] == season and r["week"] < upto]
            n = len(rows)
            if n < 2:
                continue
            tot = sum(r["fp"] for r in rows)
            for r in rows:
                o = out[(r["opp"], p.pos)]
                o[0] += r["fp"]
                o[1] += (tot - r["fp"]) / (n - 1)
                o[2] += 1
        self._def[k] = out
        return out

    def opp_ratio(self, opp, pos, season, upto, prior):
        a, e, _n = self.def_sums(season, upto)[(opp, pos)] if (opp, pos) in self.def_sums(season, upto) else (0.0, 0.0, 0)
        return (a + prior) / (e + prior) if e + prior > 0 else 1.0

    def ratio_pool(self, pos, season, week):
        """Ratios of a game's points to the player's own mean over his last RATIO_WINDOW games, for every player at that position."""
        k = (pos, season, week)
        if k not in self._pool:
            vals = []
            for p in self.players.values():
                if p.pos == pos:
                    vals.extend(own_ratios(p, season, week))
            self._pool[k] = vals
        return self._pool[k]


def own_ratios(p, season, week):
    i = before(p, season, week)
    win = [r["fp"] for r in p.rows[max(0, i - RATIO_WINDOW):i]]
    if len(win) < MIN_GAMES:
        return []
    m = sum(win) / len(win)
    if m < 0.5:
        return []
    return [v / m for v in win]


def ratio_samples(ctx, p, season, week):
    """Weighted samples (ratio, weight): half the weight on the player's own games, half on the position pool."""
    own = own_ratios(p, season, week)
    pool = ctx.ratio_pool(p.pos, season, week)
    out = []
    if own and pool:
        out += [(r, 0.5 / len(own)) for r in own]
        out += [(r, 0.5 / len(pool)) for r in pool]
    elif own:
        out += [(r, 1.0 / len(own)) for r in own]
    elif pool:
        out += [(r, 1.0 / len(pool)) for r in pool]
    else:
        out = [(1.0, 1.0)]
    return out


def wquant(samples, q):
    """Weighted quantile of (value, weight) samples."""
    s = sorted(samples)
    tot = sum(w for _, w in s)
    acc = 0.0
    for v, w in s:
        acc += w
        if acc >= q * tot - 1e-12:
            return v
    return s[-1][0]


def mean_fp(p, i, ctx, season, week, opp, implied, prm, ratio=None):
    """Model mean for the game at (season, week). i is the number of rows before it. Returns (mean, base, opp_factor, game_factor)."""
    hist = p.rows[max(0, i - WINDOW):i]
    base = wavg([r["fp"] for r in hist], prm["half_life"])
    if ratio is None:
        ratio = ctx.opp_ratio(opp, p.pos, season, week, prm["prior"])
    of = min(1.25, max(0.8, ratio)) ** prm["gamma"]
    gf = 1.0
    if implied is not None:
        gf = (implied / ctx.league_implied(season, week)) ** prm["beta"]
    return base * of * gf, base, of, gf


# ------------------------------------------------------------------------------------------------------- backtest


def build_rows(players, ctx, first, last):
    """One backtest row per player game with (season, week) in [first, last], with at least MIN_GAMES games before it."""
    out = []
    for p in players.values():
        for j, r in enumerate(p.rows):
            k = (r["season"], r["week"])
            if k < first or k > last or j < MIN_GAMES:
                continue
            same = [x["fp"] for x in p.rows[:j] if x["season"] == r["season"]]
            prev = [x["fp"] for x in p.rows[:j]]
            savg = sum(same) / len(same) if same else sum(prev[-17:]) / len(prev[-17:])
            out.append({"p": p, "i": j, "season": r["season"], "week": r["week"], "opp": r["opp"], "implied": r["implied"],
                        "actual": r["fp"], "savg": savg, "rw": p.rw.get("%d-%d" % k), "pos": p.pos, "td": r["td"],
                        "rs": None})
    return out


def model_pred(row, ctx, prm):
    return mean_fp(row["p"], row["i"], ctx, row["season"], row["week"], row["opp"], row["implied"], prm)[0]


def mae(pairs):
    return sum(abs(a - b) for a, b in pairs) / len(pairs) if pairs else float("nan")


def bias(pairs):
    return sum(a - b for a, b in pairs) / len(pairs) if pairs else float("nan")


def tune(rows, ctx):
    best = None
    grid = []
    for hl in (3, 5, 8, 12, 20, 40, 80, 200):
        for prior in (20, 50, 100, 200):
            for gamma in (0.0, 0.5, 1.0):
                for beta in (0.0, 0.5, 1.0):
                    prm = {"half_life": hl, "prior": prior, "gamma": gamma, "beta": beta}
                    e = mae([(model_pred(r, ctx, prm), r["actual"]) for r in rows])
                    grid.append((e, prm))
                    if best is None or e < best[0] - 1e-12:
                        best = (e, prm)
    return best[1], best[0], grid


def band_ratios(ctx, rows):
    for r in rows:
        smp = ratio_samples(ctx, r["p"], r["season"], r["week"])
        r["rlo"], r["rhi"] = wquant(smp, 0.10), wquant(smp, 0.90)


def coverage(rows, preds, s):
    inside = 0
    for r, m in zip(rows, preds):
        lo = m * (1 + s * (r["rlo"] - 1))
        hi = m * (1 + s * (r["rhi"] - 1))
        if lo <= r["actual"] <= hi:
            inside += 1
    return inside / len(rows)


def tune_spread(rows, preds):
    best = None
    for k in range(40, 241, 5):
        s = k / 100.0
        c = coverage(rows, preds, s)
        if best is None or abs(c - 0.80) < abs(best[1] - 0.80) - 1e-12:
            best = (s, c)
    return best


def evaluate(rows, ctx, prm, w_blend, s):
    """Add predictions of every method to the rows and return summary numbers."""
    preds = []
    for r in rows:
        m = model_pred(r, ctx, prm)
        r["model"] = m
        r["blend"] = w_blend * m + (1 - w_blend) * r["rw"] if r["rw"] is not None else None
        preds.append(m)
    return preds


def summarize(rows, s):
    res = {}
    common = [r for r in rows if r["rw"] is not None]
    res["n_all"], res["n_common"] = len(rows), len(common)
    res["tables"] = {}
    for label, subset in (("all", rows), ("common", common)):
        t = {}
        for pos in ["ALL", "QB", "RB", "WR", "TE", "K"]:
            sub = [r for r in subset if pos == "ALL" or r["pos"] == pos]
            e = {"n": len(sub)}
            for meth, f in (("season_avg", lambda r: r["savg"]), ("rotowire", lambda r: r["rw"]), ("model", lambda r: r["model"]),
                            ("blend", lambda r: r["blend"])):
                pairs = [(f(r), r["actual"]) for r in sub if f(r) is not None]
                e[meth] = (mae(pairs), bias(pairs), len(pairs))
            t[pos] = e
        res["tables"][label] = t
    cov = {}
    for pos in ["ALL", "QB", "RB", "WR", "TE", "K"]:
        sub = [r for r in rows if pos == "ALL" or r["pos"] == pos]
        cov[pos] = (coverage(sub, [r["model"] for r in sub], s) if sub else float("nan"), len(sub))
    res["coverage"] = cov
    below = [r for r in rows if r["actual"] < r["model"] * (1 + s * (r["rlo"] - 1))]
    above = [r for r in rows if r["actual"] > r["model"] * (1 + s * (r["rhi"] - 1))]
    res["below"], res["above"] = len(below) / len(rows), len(above) / len(rows)
    return res


def td_calibration(rows, ctx, prm):
    """Predicted versus real share of games with at least one touchdown (not kickers)."""
    pr, ac, n, brier = 0.0, 0.0, 0, 0.0
    for r in rows:
        if r["pos"] == "K":
            continue
        p = r["p"]
        m, base, of, gf = mean_fp(p, r["i"], ctx, r["season"], r["week"], r["opp"], r["implied"], prm)
        hist = p.rows[max(0, r["i"] - WINDOW):r["i"]]
        lam = wavg([x["td"] for x in hist], prm["half_life"]) * of * gf
        pt = 1 - math.exp(-lam)
        hit = 1.0 if r["td"] >= 1 else 0.0
        pr += pt
        ac += hit
        brier += (pt - hit) ** 2
        n += 1
    return pr / n, ac / n, brier / n, n


# ---------------------------------------------------------------------------------------------------- production


def pick_game(p):
    """First game from week 10 on, from next_games (a team on bye or already done this week lists a later week first)."""
    for g in p.next_games:
        if int(g["week"]) >= TARGET_WEEK:
            return g
    return None


def availability(p):
    st = p.status or {}
    inj = (st.get("injury_status") or "")
    sl = st.get("sleeper_status")
    esp = st.get("espn") or {}
    if inj.upper() == "IR" or esp.get("status") == "Injured Reserve":
        ret = (esp.get("details") or {}).get("returnDate")
        return 0.0, "on injured reserve (%s)" % (("ESPN return date %s" % ret) if ret else "return date not found"), "IR"
    if p.key in PLAY_CHANCE:
        c, why = PLAY_CHANCE[p.key]
        return c, why, "Questionable"
    if sl is None and not inj and not esp:
        return 1.0, "status not found, assumed to play", "status not found"
    if inj or esp.get("status") not in (None, "Active"):
        return 1.0, "listed %s, treated as playing" % (inj or esp.get("status")), inj or esp.get("status")
    return 1.0, "active (Sleeper)" + ("" if esp else ", no ESPN note found"), "Active"


def project_player(p, ctx, defense, prm, s, rw_ok, use_blend):
    g = pick_game(p)
    i = len(p.rows)
    rec = {"key": p.key, "name": p.name, "nfl_team": p.nfl, "position": p.pos}
    if g is None:
        return None, None
    week = int(g["week"])
    opp = g["opp"]
    implied = g.get("implied")
    if implied is None and g.get("spread") is not None and g.get("total") is not None:
        implied = g["total"] / 2.0 + g["spread"] / 2.0
    d = defense.get(opp, {})
    ratio = (d.get(p.pos) or {}).get("fp")
    dgames = d.get("games", 0)
    chance, why_av, status = availability(p)
    mean_if, base, of, gf = mean_fp(p, i, ctx, 2026, week, opp, implied, prm, ratio=ratio if ratio is not None else 1.0)
    # projected stat line: weighted average of each stat, scaled by the same factors, same decay
    hist = p.rows[max(0, i - WINDOW):i]
    line = {}
    for k in STATS:
        v = wavg([r["s"][k] for r in hist], prm["half_life"]) * of * gf
        if abs(v) >= 0.005:
            line[k] = round(v, 2)
    if p.pos == "K":
        line["fg_made"] = round(sum(line.get("fg_%s" % b, 0) for b in ("0_19", "20_29", "30_39", "40_49", "50_59", "60")), 2)
    method = "model"
    rwv = p.rw.get("2026-%d" % week)
    if use_blend and rwv is not None:
        method = "blend"
        mean_if = prm["w_blend"] * mean_if + (1 - prm["w_blend"]) * rwv
    # distribution if he plays
    smp = ratio_samples(ctx, p, 2026, week)
    vals = [(mean_if * (1 + s * (r - 1)), w) for r, w in smp]
    mix = [(v, w * chance) for v, w in vals]
    if chance < 1:
        mix.append((0.0, 1 - chance))
    mean_all = chance * mean_if
    lam = wavg([r["td"] for r in hist], prm["half_life"]) * of * gf
    tdc = 0.0 if p.pos == "K" else chance * (1 - math.exp(-lam))
    rec.update({"week": week, "game_date": g.get("date"), "opponent": opp, "home_or_away": "home" if g.get("home") else "away",
                "implied_team_points": implied, "opponent_factor": round(of, 3), "game_factor": round(gf, 3),
                "chance_of_playing": chance, "status": status, "status_note": why_av,
                "projected_stat_line": line, "projected_fp_if_plays": round(mean_if, 2),
                "fantasy_points": {"mean": round(mean_all, 2), "p10": round(wquant(mix, 0.10), 2),
                                   "p50": round(wquant(mix, 0.50), 2), "p90": round(wquant(mix, 0.90), 2)},
                "touchdown_chance": round(tdc, 3), "method": method})
    own_avg = sum(r["fp"] for r in hist[-8:]) / max(1, len(hist[-8:]))
    if chance == 0:
        rec["reason"] = "Projected zero: %s." % why_av
    else:
        game_txt = "no betting line yet" if implied is None else "implied %.1f points" % implied
        rec["reason"] = ("Week %d %s %s, %s; own recent form %.1f, weighted base %.1f, defense factor %.2f (%s games), game factor %.2f%s." %
                         (week, "vs" if g.get("home") else "at", opp, game_txt, own_avg, base, of, dgames, gf,
                          "" if chance == 1 else "; plays with chance %.0f%% (%s)" % (chance * 100, why_av)))
    return rec, mix


def draw(mix, rng):
    vals = [v for v, _ in mix]
    cum, acc = [], 0.0
    for _, w in mix:
        acc += w
        cum.append(acc)
    return vals, cum, acc


def simulate(mixes, rng):
    """mixes: {team: [mix per player]}. Returns {pair: stats}."""
    prep = {t: [draw(m, rng) for m in ms] for t, ms in mixes.items()}
    out = {}
    for n, (a, b) in enumerate(PAIRINGS):
        r = random.Random(SEED + n)
        diffs, sa, sb = [], [], []
        for _ in range(DRAWS):
            tot = {}
            for t in (a, b):
                x = 0.0
                for vals, cum, acc in prep[t]:
                    x += vals[min(bisect.bisect_left(cum, r.random() * acc), len(vals) - 1)]
                tot[t] = x
            sa.append(tot[a])
            sb.append(tot[b])
            diffs.append(tot[a] - tot[b])
        diffs_s = sorted(diffs)
        q = lambda arr, f: sorted(arr)[min(len(arr) - 1, int(f * len(arr)))]
        out["%s vs %s" % (a, b)] = {
            "teams": [a, b], "draws": DRAWS, "seed": SEED + n,
            "win_chance_%s" % a: round(sum(1 for d in diffs if d > 0) / DRAWS, 4),
            "win_chance_%s" % b: round(sum(1 for d in diffs if d < 0) / DRAWS, 4),
            "tie_chance": round(sum(1 for d in diffs if d == 0) / DRAWS, 4),
            "mean_score_%s" % a: round(sum(sa) / DRAWS, 2), "mean_score_%s" % b: round(sum(sb) / DRAWS, 2),
            "median_score_%s" % a: round(q(sa, 0.5), 2), "median_score_%s" % b: round(q(sb, 0.5), 2),
            "margin_p10": round(diffs_s[int(0.10 * DRAWS)], 2), "margin_p90": round(diffs_s[int(0.90 * DRAWS)], 2),
            "margin_note": "margin is %s minus %s" % (a, b)}
    return out


# ------------------------------------------------------------------------------------------------------- report


def f1(x):
    return "n/a" if x is None or (isinstance(x, float) and math.isnan(x)) else "%.2f" % x


def table_methods(res, label):
    lines = ["| Group | Rows | Season average MAE | RotoWire MAE | Model MAE | Blend MAE | Season average bias | RotoWire bias | Model bias | Blend bias |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for pos in ["ALL", "QB", "RB", "WR", "TE", "K"]:
        e = res["tables"][label][pos]
        lines.append("| %s | %d | %s | %s | %s | %s | %s | %s | %s | %s |" % (
            "All" if pos == "ALL" else pos, e["n"], *[f1(e[m][0]) for m in ("season_avg", "rotowire", "model", "blend")],
            *[f1(e[m][1]) for m in ("season_avg", "rotowire", "model", "blend")]))
    return "\n".join(lines)


def write_report(prm, tune_info, res25, res26, td25, td26, s_info, w_info, matchups, use_blend, ctx_note):
    L = []
    A = L.append
    A("# Backtest of the projection model")
    A("")
    A("Generated %s by `python3 research/tools/model.py`. Same command regenerates this file." % TODAY)
    A("")
    A("Every player game from 2025 week 3 to 2026 week 9 is predicted using only games before that week. Parameters are tuned on 2025 only "
      "(weeks 3 to 18), and 2026 (weeks 1 to 9) is the test nobody tuned on. Points use `data/scoring.json` (no point per catch). "
      "MAE is the mean absolute error in fantasy points. Bias is the average of prediction minus real result (positive means too high).")
    A("")
    A("Limits to know first:")
    A("")
    A("- Only the 28 players' logs are committed. `research/tools/dataset.py` cannot run here (the league wide `games.csv` is missing), "
      "so the league wide `defense_tables.build(season, upto)` is not available. In the backtest the opponent factor is rebuilt with the same "
      "idea from the 28 logs alone (what a defense gave our players at that position compared with what those players scored against everyone "
      "else that season, shrunk toward 1.00). That is a thin sample, so the backtest probably understates what the real league wide "
      "`defense_2026` table is worth. The 2026 projections use `defense_2026` from `league.json`, which is not what was backtested.")
    A("- Games a player missed are not in his log, so the backtest only scores games he played. It says nothing about injury surprises.")
    A("- The RotoWire files cover only some rows (counts below). RotoWire is converted to our scoring from its stat lines.")
    A("- RotoWire has no week 10 or 11 entry in the data, so the real week 10 projections come from the model alone.")
    A("")
    A("## Tuned parameters (chosen on 2025 only)")
    A("")
    A("| Parameter | Value | Meaning |")
    A("|---|---|---|")
    A("| half_life | %d games | weight halves every this many games back |" % prm["half_life"])
    A("| prior | %d | shrinkage of the opponent factor toward 1.00 (bigger is more shrinkage) |" % prm["prior"])
    A("| gamma | %.1f | how much of the opponent factor is used (0 off, 1 full) |" % prm["gamma"])
    A("| beta | %.1f | how much of the game factor (implied points over league average) is used |" % prm["beta"])
    A("| spread scale | %.2f | multiplies the width of the 10 to 90 band around the mean |" % s_info[0])
    A("| blend weight | %.2f | weight on the model in the model and RotoWire blend |" % prm["w_blend"])
    A("")
    A("2025 model MAE for the chosen settings was %.3f. The same grid with the opponent factor and game factor both switched off "
      "(gamma 0, beta 0) and the best half life gave %.3f, so the two factors %s on 2025." % (
          tune_info["best"], tune_info["plain"], "helped" if tune_info["best"] < tune_info["plain"] - 1e-9 else "did not help"))
    A("")
    for title, res in (("2025 weeks 3 to 18 (tuning year, so these numbers are optimistic)", res25), ("2026 weeks 1 to 9 (the honest test)", res26)):
        A("## " + title)
        A("")
        A("Rows: %d player games. RotoWire covers %d of them (%.0f percent)." % (res["n_all"], res["n_common"], 100.0 * res["n_common"] / res["n_all"]))
        A("")
        A("Rows where RotoWire exists (all four methods on the same games):")
        A("")
        A(table_methods(res, "common"))
        A("")
        A("All rows (RotoWire and blend only where RotoWire exists):")
        A("")
        A(table_methods(res, "all"))
        A("")
        A("Band: share of real results inside the model's 10 to 90 band (target about 80 percent).")
        A("")
        A("| Group | Rows | Inside band |")
        A("|---|---|---|")
        for pos in ["ALL", "QB", "RB", "WR", "TE", "K"]:
            c, n = res["coverage"][pos]
            A("| %s | %d | %.1f percent |" % ("All" if pos == "ALL" else pos, n, 100 * c))
        A("")
        A("Below the 10th percentile: %.1f percent, above the 90th: %.1f percent (each should be near 10)." % (100 * res["below"], 100 * res["above"]))
        A("")
    A("## Band width, what I changed")
    A("")
    A("With the raw spread (scale 1.00) the 2025 band held %.1f percent of real results. I searched the scale in steps of 0.05 and kept the one "
      "closest to 80 percent on 2025: scale %.2f, which gives %.1f percent on 2025 and %.1f percent on 2026 (not tuned). Raw ratio quantiles "
      "come from the player's own last %d games plus the pool of his position, so a scale above 1 means games are wilder than the history "
      "shows, which is expected because the mean itself carries error." % (100 * s_info[2], s_info[0], 100 * s_info[1], 100 * res26["coverage"]["ALL"][0], RATIO_WINDOW))
    A("")
    A("## Blend of model and RotoWire")
    A("")
    A("Weight on the model tuned on 2025 rows where RotoWire exists: %.2f (RotoWire gets %.2f). On 2025 the blend had MAE %s against %s for the model "
      "and %s for RotoWire. On 2026 (same kind of rows) the blend had MAE %s against %s for the model and %s for RotoWire. "
      "Blend wins on 2026: **%s**. %s" % (
          prm["w_blend"], 1 - prm["w_blend"], f1(res25["tables"]["common"]["ALL"]["blend"][0]), f1(res25["tables"]["common"]["ALL"]["model"][0]),
          f1(res25["tables"]["common"]["ALL"]["rotowire"][0]), f1(res26["tables"]["common"]["ALL"]["blend"][0]),
          f1(res26["tables"]["common"]["ALL"]["model"][0]), f1(res26["tables"]["common"]["ALL"]["rotowire"][0]), "yes" if use_blend else "no",
          "projections.json uses the blend where a RotoWire projection exists for the target week." if use_blend else
          "projections.json uses the model alone."))
    A("")
    A("## Touchdown chance check")
    A("")
    A("Chance of at least one touchdown (Poisson from the projected touchdown rate), non kickers. Predicted average versus real share, and the Brier score (lower is better; always saying the average rate scores about p(1-p)).")
    A("")
    A("| Period | Games | Predicted | Real | Brier |")
    A("|---|---|---|---|---|")
    A("| 2025 | %d | %.3f | %.3f | %.3f |" % (td25[3], td25[0], td25[1], td25[2]))
    A("| 2026 | %d | %.3f | %.3f | %.3f |" % (td26[3], td26[0], td26[1], td26[2]))
    A("")
    A("## Week %d matchups (20,000 draws each, seed %d)" % (TARGET_WEEK, SEED))
    A("")
    A("Each player's points are drawn from his distribution (zero for injured reserve, a coin flip on playing for questionable players with the stated chance). "
      "Players are treated as independent. Margin is the first team minus the second.")
    A("")
    A("| Pairing | Win chance first | Win chance second | Mean score first | Mean score second | Median first | Median second | Margin p10 | Margin p90 |")
    A("|---|---|---|---|---|---|---|---|---|")
    for k, m in matchups.items():
        a, b = m["teams"]
        A("| %s%s | %.1f percent | %.1f percent | %.1f | %.1f | %.1f | %.1f | %.1f | %.1f |" % (
            k, " (real game)" if k in ("GOB vs PYT", "TUR vs OWL") else "", 100 * m["win_chance_" + a], 100 * m["win_chance_" + b],
            m["mean_score_" + a], m["mean_score_" + b], m["median_score_" + a], m["median_score_" + b], m["margin_p10"], m["margin_p90"]))
    A("")
    A("## What to expect")
    A("")
    t = res26["tables"]["all"]
    A("Looking at 2026, the model's typical miss on a single player game is about %s points for a QB, %s for a RB, %s for a WR, %s for a TE and %s for a kicker (mean absolute error; a bad game is much worse, and about 1 in 5 real results lands outside the stated 10 to 90 band). "
      "Season average to date misses by %s overall against %s for the model; RotoWire (%d of %d rows) misses by %s against %s for the model on the same rows. "
      "Add up seven players and the team total is far less certain than any single number, so read the win chances as rough odds, not promises. "
      "Treat the opponent factor and the three questionable players (St. Brown, Wilson, McConkey) as the least trustworthy parts: the first is rebuilt from a thin sample in the backtest and the second is a judgement call from news text." % (
          f1(t["QB"]["model"][0]), f1(t["RB"]["model"][0]), f1(t["WR"]["model"][0]), f1(t["TE"]["model"][0]), f1(t["K"]["model"][0]),
          f1(t["ALL"]["season_avg"][0]), f1(t["ALL"]["model"][0]), res26["n_common"], res26["n_all"],
          f1(res26["tables"]["common"]["ALL"]["rotowire"][0]), f1(res26["tables"]["common"]["ALL"]["model"][0])))
    A("")
    with open(OUT_MD, "w") as fh:
        fh.write("\n".join(L))


def main():
    players = load_players()
    ctx = Context(players)
    # sanity: our scoring reproduces the fp column in the logs
    bad = sum(1 for p in players.values() for r in p.rows if r["fp_log"] is not None and abs(r["fp_log"] - r["fp"]) > 0.06)
    print("rows where scoring.json disagrees with the log fp column:", bad)

    rows25 = build_rows(players, ctx, (2025, 3), (2025, 99))
    rows26 = build_rows(players, ctx, (2026, 1), (2026, 9))
    prm, best, grid = tune(rows25, ctx)
    plain = min(e for e, q in grid if q["gamma"] == 0.0 and q["beta"] == 0.0)
    print("tuned", prm, "2025 model MAE %.3f" % best, "plain %.3f" % plain)

    for rows in (rows25, rows26):
        band_ratios(ctx, rows)
    preds25 = [model_pred(r, ctx, prm) for r in rows25]
    raw_cov = coverage(rows25, preds25, 1.0)
    s, cov25 = tune_spread(rows25, preds25)
    s_info = (s, cov25, raw_cov)

    # blend weight on 2025 rows with RotoWire
    com = [r for r in rows25 if r["rw"] is not None]
    bestw = None
    for k in range(0, 101, 5):
        w = k / 100.0
        e = mae([(w * model_pred(r, ctx, prm) + (1 - w) * r["rw"], r["actual"]) for r in com])
        if bestw is None or e < bestw[1] - 1e-12:
            bestw = (w, e)
    prm["w_blend"] = bestw[0]

    evaluate(rows25, ctx, prm, prm["w_blend"], s)
    evaluate(rows26, ctx, prm, prm["w_blend"], s)
    res25, res26 = summarize(rows25, s), summarize(rows26, s)
    use_blend = res26["tables"]["common"]["ALL"]["blend"][0] < res26["tables"]["common"]["ALL"]["model"][0] - 1e-9 and \
        res26["tables"]["common"]["ALL"]["blend"][0] <= res26["tables"]["common"]["ALL"]["rotowire"][0]
    td25, td26 = td_calibration(rows25, ctx, prm), td_calibration(rows26, ctx, prm)
    print("2026 MAE all rows: season avg %.2f model %.2f; common rows rotowire %.2f model %.2f blend %.2f; band %.1f%%" % (
        res26["tables"]["all"]["ALL"]["season_avg"][0], res26["tables"]["all"]["ALL"]["model"][0],
        res26["tables"]["common"]["ALL"]["rotowire"][0], res26["tables"]["common"]["ALL"]["model"][0],
        res26["tables"]["common"]["ALL"]["blend"][0], 100 * res26["coverage"]["ALL"][0]))

    # production projections
    with open(os.path.join(DATA, "league.json")) as fh:
        defense = json.load(fh)["defense_2026"]
    recs, mixes = [], defaultdict(list)
    for key in [t + "-" + sl for t in TEAMS for sl in SLOTS]:
        rec, mix = project_player(players[key], ctx, defense, prm, s, True, use_blend)
        if rec is None:
            print("no next game for", key)
            continue
        recs.append(rec)
        mixes[players[key].team].append(mix)
    matchups = simulate(mixes, None)
    summary = {
        "tuned_on": "2025 weeks 3 to 18", "test": "2026 weeks 1 to 9", "parameters": {k: v for k, v in prm.items()}, "spread_scale": s,
        "mae_2026_all_rows": {m: round(res26["tables"]["all"]["ALL"][m][0], 3) for m in ("season_avg", "model")},
        "mae_2026_rotowire_rows": {m: round(res26["tables"]["common"]["ALL"][m][0], 3) for m in ("season_avg", "rotowire", "model", "blend")},
        "rotowire_rows_2026": "%d of %d" % (res26["n_common"], res26["n_all"]),
        "band_10_90_coverage_2025": round(res25["coverage"]["ALL"][0], 3), "band_10_90_coverage_2026": round(res26["coverage"]["ALL"][0], 3),
        "blend_wins_2026": use_blend, "details": "research/BACKTEST.md",
        "limit": "backtest opponent factor is rebuilt from the 28 logs, production uses defense_2026 from league.json"}
    out = {"generated": TODAY, "target_week": TARGET_WEEK, "seed": SEED,
           "scoring": "data/scoring.json (1 per 25 pass yards, 4 pass TD, -2 INT, 1 per 10 rush or receiving yards, 6 per rush or receiving TD, "
                      "no point per catch, -2 per lost fumble, FG 3 / 4 from 40 / 5 from 50, 1 per extra point)",
           "players": recs, "matchups": matchups, "backtest_summary": summary}
    with open(OUT_JSON, "w") as fh:
        json.dump(out, fh, indent=1, sort_keys=False)
        fh.write("\n")
    write_report(prm, {"best": best, "plain": plain}, res25, res26, td25, td26, s_info, bestw, matchups, use_blend, "")
    print("wrote", OUT_JSON, "and", OUT_MD)
    for k, m in matchups.items():
        a, b = m["teams"]
        print(k, "win %.1f%% / %.1f%%" % (100 * m["win_chance_" + a], 100 * m["win_chance_" + b]))


if __name__ == "__main__":
    sys.exit(main())
