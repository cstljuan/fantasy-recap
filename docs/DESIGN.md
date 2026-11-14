# Design rules

Copied as written from the comment at the top of `css/app.css` (Peyton's lane) on 2026-11-14. The tokens it names are on `:root` in that file, so the code is the source of truth: if the two disagree, `css/app.css` wins and this file is updated.

```
Fantasy Recap: one look for the whole app.

THE LOOK. A dark scoreboard: flat panels, hairline rules, condensed numerals and
one amber signal color. Modern and tough, not cute. No gradients for decoration,
no shadows, no rounded cards. Team colors appear only as edges, tiles and bars.

COLOR. Use only the tokens on :root. Surfaces go --bg, --panel, --inset; lines are
--rule; text is --text or --dim; --ink is text on light fills. --amber is the one
signal (primary buttons, the selected tab, focus, "yours", scores in the film room).
--flag is penalties only, --alert is turnovers and losses only. --t0 and --t1 are
the two teams. The game view has its own: --field, --field-deep, --overlay and
--on-field for controls drawn over the field.

TYPE. Two families: --display (condensed, uppercase, for numbers, team names and
buttons) and --body (everything else). --mono only for tiles and controls over the
field. Sizes come from the scale, nothing in between:
  --fs-micro 10  tags, units        --fs-body  15  body text
  --fs-label 11  labels, eyebrows,  --fs-lead  17  team names, card lead text
                 chip buttons       --fs-title 20  primary buttons, brand, stats
  --fs-meta  12  meta lines, notes  --fs-num   28  points in rows
  --fs-small 13  secondary text     --fs-big   34  totals, big stats
The scoreboard numbers and the winner use the display sizes (--fs-score,
--fs-hero), which scale with the screen.
Labels and eyebrows: --fs-label, weight 700, letter-spacing 0.12em, uppercase, --dim.

SPACING. Steps of 4, 8, 12, 16 and 24 pixels (--sp-1 to --sp-5). Inside a card the
side inset is always 14 (--inset-x). Cards and grids are 16 apart.

CARDS. Two kinds, both square-cornered with a 1px --rule border on --panel:
  1. Panel: a plain card, with an optional panel head (label left, link right).
  2. Edge card: a panel with a 3px colored edge (--edge). The edge is on top for
     cards that head a screen (scoreboard, recap, lineup heads, opt in, dialogs)
     and on the left for items in a list (plays, your matchup, your players, notes).
     Its color says what it is: a team color, --amber for yours or for a call to
     act, --rule when it is neutral.

BUTTONS. Three kinds, all at least 44 pixels tall, 2px corners:
  1. Primary (.cta): amber fill, --ink text, --display at --fs-title, uppercase.
     One per card at most.
  2. Secondary (.cta.ghost): the same shape, transparent with a --rule border.
  3. Toggle (chips: filters, week picker, team choice, sport, film steps): --fs-label,
     700, 0.1em, uppercase, --rule border, --dim text; pressed means a light fill
     (--text) with --ink text, or --amber when it marks "yours".
  Controls over the field (Close, speed, announcer style) are toggles in --mono on
  --overlay with --on-field lines.

MOTION. Short and functional (0.25s or less), and none with reduced motion.
```
