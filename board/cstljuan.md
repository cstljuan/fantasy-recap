# cstljuan

- 11-14 19:08 UTC | READY | cstljuan/soccer | hello from Juan
- 11-14 19:21 UTC | CLAIM | cstljuan/soccer | S1 soccer game: soccer/
- 11-14 19:33 UTC | DONE | cstljuan/soccer | S1 soccer game, checked: full match to FT 2-1 on 3 seeds with no errors, every play type seen, no network requests, restart, node soccer/check.js; not checked: real phone, sound (SC_SOUND hook is empty)
- 11-14 19:40 UTC | CLAIM | cstljuan/soccer | S2 fantasy soccer: soccer/js/fantasy.js, soccer/js/data.js, soccer/js/rules.js
- 11-14 19:44 UTC | DONE | cstljuan/soccer | S2 fantasy soccer, checked: node soccer/check.js (fp shape on all 45 events, totals add up, IRN 24 v RHB 14), full match in browser to FT 3-2 with no errors, floaters show, setFloaters works, full-time result carries clean sheets; not checked: pause while closed (hidden test pane never animates), real phone
- 11-14 19:44 UTC | NOTE | cstljuan/soccer | boss: soccer fantasy is on cstljuan/soccer. Every SC result has res.fp = [{team, role, pts, why}] like football. Lineup and scoring: SC_FANTASY.LINEUP, SCORING, breakdown(game, teams, SC_RULES). Clean sheets come as one last result (kind 'ft') before 'final'. SC_GAME now has setFloaters, setBackground, floaters, background. Load soccer/js/fantasy.js before rules.js
- 11-14 19:44 UTC | NOTE | cstljuan/soccer | ricky: for D7, soccer rosters are in soccer/js/data.js TEAMS[].roster, slots GK LB CB1 CB2 RB CM1 CM2 CM3 LW ST RW, real names written without accents. Fantasy lineup is GK CB1 CB2 CM2 LW ST RW (soccer/js/fantasy.js LINEUP)
- 11-14 19:44 UTC | NOTE | cstljuan/soccer | noah: for C8, a soccer result has kind (kickoff build shot pen corner freekick foul offside ft), text, say, calls [{text, sub, style}], goal, scorer, assist, card, saver, disallowed. Half time and full time are the half and final events, same as football
- 11-14 19:45 UTC | CLAIM | cstljuan/soccer | S3 soccer polish: soccer/js/sprites.js, plays.js, main.js
- 11-14 19:48 UTC | DONE | cstljuan/soccer | S3 soccer polish, checked: full match to FT 3-2 in browser with no errors, each goal replays in slow motion then the restart follows, camera stays with the scorer, set pieces open with a cut, free kick shows wall and spray with the referee, full time board shows scorers and fantasy points; not checked: real phone, how the replay pace feels at 1x
- 11-14 19:48 UTC | NOTE | cstljuan/soccer | boss: soccer SC_GAME.mode can now also be 'replay' (a slow replay after each goal, about 8 s at 1x). Nothing new to connect
- 11-14 20:01 UTC | ANSWER | cstljuan/soccer | ricky: one check from soccer: in soccer/js/data.js (branch cstljuan/soccer), TEAMS[].roster has 22 real footballers by slot (GK, LB, CB1, CB2, RB, CM1-3, LW, ST, RW). Is each one a real player who plays that position? Send back any that are wrong
- 11-14 20:03 UTC | CLAIM | cstljuan/soccer | S4 soccer match maker: soccer/engine/, soccer/data/, soccer/index.html, soccer/js/main.js
