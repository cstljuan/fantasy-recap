# Handoff for Juan's design agent

You work for **Juan**. GitHub username `cstljuan`. Git email `68199309+cstljuan@users.noreply.github.com`.
Lane: G, design and brand. You may edit only: `design/`, `pitch/assets/`, and your status posts. Branch: `cstljuan/design`.

Read `CLAUDE.md` and `board/ORDERS.md` first. Juan is away for hours: never ask him anything, never stop. Do Step 0 exactly as in `handoffs/juan-soccer.md` (with the branch `cstljuan/design`), then work through the tasks below in order, posting CLAIM and DONE for each with `sh tools/post.sh`. When they are all done, keep improving the weakest page, then run `sh tools/wait.sh 540 G` in a loop.

## What this is

A full brand and UI file in Figma for this project, the way Juan did for his earlier hackathon projects, plus the same thing mirrored into the repository so the coding agents can build from it. The product: a fantasy sports recap you watch. Two managers opt in, their scores stay hidden all week, and at the end they watch their two rosters play each other in an 8-bit game (football and soccer) to find out who won. A decision model picks each play and the app shows the odds.

Juan's taste: modern, tough, not cute, not generic. A dark scoreboard feel. He always wants one memorable mascot and a standout interface. The app today: dark panels, hairline rules, square corners, one amber signal color, condensed numerals, pixel-art players. Look at `css/app.css`, `js/sprites.js` and `soccer/` before designing anything.

## Follow the layout of his earlier files

Juan's earlier Figma files are the template for how this one is organized. Open each with the Figma tools, list its pages and the frames on each page, and mirror that structure (page names, page order, how frames are grouped and titled, cover page, sizes) for this project:

- Commit, "Brand and UI": https://www.figma.com/design/9CZ4CF403AAcqcY3nV3tf5
- https://www.figma.com/design/Yo5XgVWg63QObYk53FQlqY
- https://www.figma.com/design/cGnmFgNMXmcgNR7VOOaAhz

Write what you found in `design/REFERENCE-LAYOUT.md` first (page list and frame list of each file), so the structure you follow is on record. Read them only. Never edit those three files.

## Tasks

**Light duty right now (order 8 in `board/ORDERS.md`): do G1 only, as structure. List the pages of the three reference files (page names and top-level frame names only, no deep reading), create the new file, set up its pages and empty titled frames to match, write `design/REFERENCE-LAYOUT.md` and `design/README.md`, post DONE, then stop and end your turn. Do not start G2.**

- **G1. The file.** Create one new Figma design file named "Fantasy Recap | Brand and UI" in Juan's drafts. Set up the pages following the reference layout. Put the file's address in `design/README.md` and in your DONE post.
- **G2. Brand guide.** Name options are open (the working name is Fantasy Recap): show three name and wordmark directions on one page and build the rest on the working name. Logo and app icon, color tokens for dark and light, type scale with the condensed numeral face, spacing, corner and line rules, the pixel-art rules for players, do and do not examples. One mascot, tough and not cute, in the 8-bit style, with five expressions.
- **G3. Every screen.** High fidelity, phone size (390 by 844) and laptop size (1440 by 900): league, matchup before and after opt-in, lineups masked and revealed, plays feed with the "why this play" card open, the game view for football and for soccer with score, captions, speed control and sound control, the reveal, the recap, the film room (drive chart and play caller panel), the season and standings, first run walkthrough, the sport switch, empty and paused states. Use components and variables, not loose shapes.
- **G4. Motion.** A motion page: the reveal sequence, a touchdown, a goal, the odds bars filling, the opt-in lock, screen transitions. Storyboard frames with timing notes, and where the Figma tools allow it, real prototype animations. Also write each one as a short spec in `design/MOTION.md` with durations and easing so it can be built in CSS.
- **G5. Devpost and pitch graphics.** The Devpost thumbnail (3 to 2, at least 1500 by 1000) in three versions, a gallery set of six images that tell the story, a title card for the demo video, and a one-page architecture picture (profiles, the play caller, the rules engine, the game, the database). Export them as PNG into `pitch/assets/`.
- **G6. Hand it to the builders.** `design/DESIGN.md` as the single source of truth for the coding agents (tokens as CSS variables, components, rules), `design/tokens.css`, and a NOTE to peyton, noah and the boss saying what changed and where. Do not edit their files.

## Rules

- If the Figma tools are not available in this session, do not stop and do not ask: build the same brand guide, screens and graphics as HTML and SVG pages under `design/` (one page per Figma page), export the Devpost images from them, and say so in your first DONE post with `ASK "boss: the Figma connector is not available here"`.
- Only invented or drawn art. No real team logos, no photos of players, no league marks.
- Never publish, share publicly or invite anyone to the Figma file. Juan does that.
- Commit authorship as in `CLAUDE.md`: every commit is `cstljuan` only.
