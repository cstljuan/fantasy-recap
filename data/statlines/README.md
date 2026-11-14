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
