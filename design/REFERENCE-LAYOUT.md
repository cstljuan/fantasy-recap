# Reference layout: how Juan's earlier Figma files are organized

Read on 2026-11-14 with the Figma tools, read only. Nothing in these three files was changed.
This is the structure the Fantasy Recap file follows. Sizes are width by height in pixels.

## File 1: Commit, "Brand and UI"

https://www.figma.com/design/9CZ4CF403AAcqcY3nV3tf5

Page names are `NN Name` with a space. Sub-pages use a letter (`04b`, `04c`). Page background is light grey (245) on every page.

| Page | Top-level frames |
|---|---|
| 00 Reference | `Reference board` 1644x678 |
| 01 Hachi (the mascot) | `Hachi, all 32 states` 1596x1959. Older work stays on the page, pushed below, with the name prefixed `[old]` (a component set and a note) |
| 01b Creatures | `Creatures, Hachi build` 1110x607, plus `[old] Creatures` |
| 02 Logo | `Commit wordmark` 910x1266, `App icon 1024` 1024x1024, `Splash Hachi` 1024x1024, three `[old] Lockup / <mode>` frames with a size test note (64, 32, 16 px) |
| 03 Colour lab | Three phone frames 390x844 side by side, 440 apart: `Swipe / Normal`, `Swipe / Women`, `Swipe / Hack` (the same screen in each colour mode) |
| 04 UI wireframes | 13 phone frames 390x844 named `01 Login` to `13 Lab numbers (dark)`, five per row, 450 apart, rows 1000 apart. A one or two line note in a text layer under each frame says what the screen is for. One shared component (`Tab bar`) above the grid |
| 04b Hi-fi screens (as built) | 27 phone frames 402x874 named `Screen / mode` (for example `Match moment / normal`). Six per row, 452 apart, rows 990 apart. A large text heading above each row group (`Match moment and Matches, all modes`, `Chat, Team, Profile`, `Security Lab, always dark`). New screens in a last row prefixed `New:` |
| 04c Motion spec | One frame `Motion spec` 1520x1552, dark. Title, one line of intent, then one row per motion: name, what it does, the numbers (duration, easing, stagger), the code file |
| 05 Final handoff | empty |
| 99 Archive | Ten `[old v1] Brand NN / Name` frames 1600x1000 in a 3 column grid |
| 06 Brand guide | 16 frames 1920x1080 named `Guide NN / Name`, four per row, 2040 apart, rows 1200 apart: Title, Contents, Overview, Mission, Values, Who it is for, Voice, Color, Three modes, Logo, Hachi and Hana, Type, In the product, Motion, Security honesty, Closing. Each has a small header line (version, file name, page number) and footer line (event, tracks) |
| 07 Devpost | 11 gallery frames 1500x1000 named `Devpost NN / Name`, in one row, 1600 apart: the name, what it is, the modes, the mascot, feature pages, how it is built, the team. Below: `Devpost banner / Thumbnail 3:2` 1500x1000, `GitHub banner / 1280x640`, `YouTube thumbnail / 1280x720`. Above the row: 17 small phone captures 240x522 used as sources |

## File 2: Seams, brand and UI

https://www.figma.com/design/Yo5XgVWg63QObYk53FQlqY

Page names are `NN-Name` with a hyphen. Dark page background (30) on the brand pages, light (245) on screens and handoff.

| Page | Top-level frames |
|---|---|
| 00-Reference | `Cover` 1920x1080 (logo lockup, name, tagline, one sentence, three small chips: event, challenge, file version and date; the mascot large on the right). `About this file` 1600x1842: a Pages table (page, what is on it), Sources, Decisions for Juan to review, and the wireframe mapped to the design |
| 01-Arc (the mascot) | The source export 3000x3000, the component set `Arc` (8 states as variants), and `Arc / Spec` 2000x1852 |
| 02-Logo | `Logo / Status and rules` 1600x1097 and the component set `Logo` |
| 03-Color | `Color tokens / Light` and `Color tokens / Dark` 1000x1352 side by side, `Overlap tier scale`, `Typography` 1400x1042, `Space, radius, elevation` 600x880 |
| 04-UI | Components grouped in Figma sections, stacked down the page: Icons, Map, Data labels, Controls, List, Sidebar, Basemaps. Each section starts with a title and a one line description, then the components and component sets |
| 05-Screens | Sections: `Desktop: core flow`, `Desktop: search and states`, `Narrow screens (proposal)`. Each section has a title, a one or two line description, then frames 1440x900 or 390x844 named `Desktop / Screen / Light` with a small text label next to each |
| 06-Handoff | One frame `Handoff` 1800x2968: colour token table (Figma variable, CSS variable, light, dark, status), type table, components to code table, layout specs, a checklist |
| 99-Exploration | A section `Exploration: not approved, not for handoff` and archived component sets |

## File 3: Seams brand guide

https://www.figma.com/design/cGnmFgNMXmcgNR7VOOaAhz

| Page | Top-level frames |
|---|---|
| Seams Brand Guide | 16 frames 1920x1080 named `NN Name`, four per row, 2040 apart, rows 1200 apart: Title, Contents, Overview, Mission, Values, Audience, Voice, Colour, Overlap tiers, Logo, Arc, Type, In the product, Dark mode, Data honesty, Closing |
| Symbols | The template's page layout components (dark, brand colour, light), title page, value layout and a few atoms |
| Brand Identity | The 33 frame brand guide template the guide was made from |

## What the three have in common

1. Numbered pages in a fixed order: reference and cover first, then mascot, logo, colour, UI, screens, motion, handoff, then the brand guide and the Devpost graphics, with an archive page numbered 99.
2. A cover frame 1920x1080 and an "About this file" frame that lists every page, the sources and the decisions waiting for Juan.
3. The mascot gets its own page, as a component set with one variant per state, plus a spec frame.
4. Colour is shown as token tables for each mode. Type, space and radius sit on the same page.
5. Components live in titled sections. Screens live in titled sections with a description line and a label by each frame. Frame names read `Size / Screen / State`.
6. Phone frames are 390x844 (402x874 for captures of the built app). Desktop frames are 1440x900.
7. The brand guide is always 16 frames 1920x1080 in a 4 by 4 grid with a 120 pixel gap: Title, Contents, Overview, Mission, Values, Audience, Voice, Colour, a product-specific page, Logo, Mascot, Type, In the product, a mode or motion page, an honesty page, Closing.
8. Devpost graphics are frames 1500x1000 in one row with a 100 pixel gap, numbered, then the 3:2 thumbnail, a GitHub banner 1280x640 and a video thumbnail 1280x720.
9. The motion spec is one dark frame with a row per motion: name, what it does, numbers, code file.
10. Old or unapproved work is never deleted: it is renamed `[old]` or moved to page 99.

## The page list used for Fantasy Recap

Numbering follows the Commit file (the one named "Brand and UI"), with the cover and section habits of the Seams file.

| Page | Contents |
|---|---|
| 00 Reference | Cover 1920x1080, About this file (pages, sources, decisions for Juan) |
| 01 Mascot | The mascot component set (five expressions and more), sizes, spec |
| 02 Logo | Three name and wordmark directions, the lockups, app icon 1024, splash |
| 03 Color | Colour tokens dark and light, type scale, space, corner and line rules, pixel-art rules |
| 04 UI | Components in sections |
| 04b Screens | Every screen at 390x844 and 1440x900, in sections |
| 04c Motion | Motion spec frame, storyboards, prototype frames |
| 05 Handoff | Token map, component map, rules for the coding agents |
| 06 Brand guide | 16 frames 1920x1080 |
| 07 Devpost | Gallery 1500x1000, thumbnail in three versions, video title card, architecture picture, GitHub banner |
| 99 Archive | Explorations that were not chosen |
