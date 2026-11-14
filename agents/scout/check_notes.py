"""Offline check for notes.py. No network, no key, no packages.   python3 agents/scout/check_notes.py"""
import os
import re
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
fx = os.path.join(HERE, "fixtures", "notes")
out = tempfile.mkdtemp(prefix="notes-check-")
sys.path.insert(0, HERE)
import notes as N  # noqa: E402


def check(c, m):
    if not c:
        print("FAIL:", m)
        sys.exit(1)
    print("ok:", m)


N.main(["--teams", "TST,SOC", "--profiles", fx, "--crosscheck", os.path.join(fx, "crosscheck.json"), "--out", out, "--date", "2026-11-14"])
files = sorted(os.listdir(out))
check(files == ["README.md", "TST-K.md", "TST-QB.md", "TST-WR1.md"], "one page per football player and an index; the soccer profile is skipped")
qb = open(os.path.join(out, "TST-QB.md")).read()
check("with no model" in qb and "fixed rules" in qb, "the page says no model wrote it")
check("| deep ball | 0.8 | made up for the check | https://example.test/season/FX1 | 2026-11-14 |" in qb, "every season number has how, source and date")
check("| running as a quarterback | not known |" in qb, "a null number is written as not known")
check("Weeks used: 7, 8, 9. Weeks skipped (no stats): 10." in qb and "| deep ball | 0.6 | 0.8 | -0.200 |" in qb, "recent form with weeks and the change")
check("They disagree on:" in qb and "pass yards: Sleeper 2000, ESPN 2100" in qb and "https://example.test/espn/901" in qb, "a Sleeper and ESPN disagreement with both sources")
means = qb.split("## What it means for play calling")[1].strip()
check(len(re.findall(r"[.!?](\s|$)", means)) == 2, "exactly two sentences")
check(means.startswith("Quarterback pushes the ball downfield") and "deep ball number is down: 0.6 in weeks 7, 8, 9 against 0.8" in means,
      "the rules: a high deep ball first, then the form that moved the most")
k = open(os.path.join(out, "TST-K.md")).read()
check("Not compared: no NFL PK" in k and "Not compared: Not compared" not in k, "a player not found on ESPN says so, once")
km = k.split("## What it means for play calling")[1]
check("not enough numbers for Kicker" in km and "No recent form" in k, "no numbers: says so instead of inventing (and Jr. is not used as the name)")
wr = open(os.path.join(out, "TST-WR1.md")).read()
check("Not cross-checked." in wr and "Van Receiver" in wr.split("## What it means")[1], "no cross-check, and a two-word last name")
for f in files:
    t = open(os.path.join(out, f)).read()
    check(not re.search(r"\b(he|him|his|she|her)\b", t, re.I) and "—" not in t, f + ": no pronouns and no em dashes")
check("TST-QB.md" in open(os.path.join(out, "README.md")).read(), "the index lists the pages")
print("OK")
