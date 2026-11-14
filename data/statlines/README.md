# Stat lines

`week11.json` is INVENTED sample data. Every number was made up for the demo and none of it is a real result, even though the player names are real. The game maker reads this file to build a game, and `agents/scout/score.js` (task D5) turns each line into fantasy points.

## Shape

```
{ "invented": true, "note": "...", "week": 11,
  "teams": { "<team id>": { "players": { "<slot>": { "name": "...", "line": { ... } } },
                            "defense": { "name": "...", "line": { ... } } } } }
```

Slots: QB, RB, WR1, WR2, WR3, TE, K. Team ids: GOB, PYT. Every player line has all eleven fields below, as whole numbers, 0 when the player did nothing in that area.

## Player line fields

- `pass_yards`: passing yards.
- `pass_td`: passing touchdowns.
- `interceptions`: interceptions thrown.
- `rush_yards`: rushing yards.
- `rush_td`: rushing touchdowns.
- `receptions`: catches.
- `rec_yards`: receiving yards.
- `rec_td`: receiving touchdowns.
- `fg_made`: field goals made.
- `fg_missed`: field goals missed.
- `xp_made`: extra points made.

## Defense line fields

- `sacks`: sacks.
- `def_interceptions`: interceptions caught.
- `fumble_recoveries`: fumbles recovered.
- `def_td`: defensive touchdowns.
- `points_allowed`: points the opponent scored.

The scoring rules in D5 only list offense, so defense numbers are there for the game maker and are not scored yet.

## Real week

`week09-real.json` holds real week 9 numbers for the 14 players, read from Sleeper's public API on 2026-11-14 by `agents/scout/statlines.py`. It has `invented: false`, the source address and the date. Defense fields are `null` because the roster defenses are made up. The sums check does not apply to it: it holds 14 players, not whole teams.

## Weeks and the check

- `week11.json`: GOB 34, PYT 17. `week12.json`: GOB 27, PYT 31 (the Pythons win a high scoring game). Both are invented.
- Week 11 was changed on 2026-11-14 so its lines add up. The first version did not: receiving yards were more than the quarterback's passing yards. Anything that read the old numbers should read these.
- `node data/checks/statlines.js` checks every week file: a quarterback's passing yards and touchdowns equal the team's receiving yards and touchdowns, receptions fit the yards, extra points equal touchdowns, the other defense's points allowed equal the team's score, and the quarterback's interceptions equal the other defense's interceptions. Scores count 6 per touchdown, 1 per extra point, 3 per field goal. It prints OK or what is wrong.
