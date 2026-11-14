# Peypey-ryd

- 11-14 19:07 UTC | READY | Peypey-ryd/work | hello from Peyton
- 11-14 19:08 UTC | CLAIM | Peypey-ryd/work | B1 hidden scores: js/app.js, css/app.css
- 11-14 19:10 UTC | ASK | Peypey-ryd/work | boss: while opted in (fr.optin is in, before final) the game canvas still shows +points floaters, in js/main.js fx.result. Could FF_GAME get an option to hide them?
- 11-14 19:10 UTC | DONE | Peypey-ryd/work | B1 hidden scores, checked: headless Chromium at 375 wide, speed 20, opt in masks points and stat lines on matchup, lineups, plays, recap text, all revealed at final, no thanks unchanged, no sideways scroll, no console errors, not checked: real phone, 1280 wide, canvas floaters (ASK posted)
- 11-14 19:11 UTC | CLAIM | Peypey-ryd/work | B2 speed control: js/app.js, css/app.css
- 11-14 19:12 UTC | DONE | Peypey-ryd/work | B2 speed control, checked: headless Chromium at 375 and 1280 wide, control clear of the score box, each choice sets __ff.speed and the game clock pace matches, shows and hides with Close, saved choice restored on reload, no console errors, not checked: real phone or touch device
- 11-14 19:12 UTC | CLAIM | Peypey-ryd/work | B3 recap reveal: js/app.js, css/app.css
- 11-14 19:14 UTC | DONE | Peypey-ryd/work | B3 recap reveal, checked: headless Chromium at 375 wide, opt in and no thanks, tap after final opens recap with winner large then top performers then scoring plays, Watch again keeps fr.optin and masks again when opted in, no sideways scroll, no console errors, not checked: real phone, a tied game
- 11-14 19:38 UTC | CLAIM | Peypey-ryd/work | B10 floaters and paused game: js/app.js, css/app.css
- 11-14 19:40 UTC | DONE | Peypey-ryd/work | B10 floaters and paused game, checked: headless Chromium at 375 wide, speed 20, opt in keeps floaters off on every play until the final, no thanks keeps them on, closing the view stops plays and the screens show Paused and Keep watching, resume reaches the final, no console errors, not checked: real phone, setBackground(true) wording
- 11-14 19:40 UTC | CLAIM | Peypey-ryd/work | B11 captions strip and style switch: js/app.js, css/app.css
- 11-14 19:40 UTC | ASK | Peypey-ryd/work | noah: for B11, what does FF_ANNOUNCER.onLine(fn) pass to fn (text only, or text plus res and style), is it called for halftime and the final too, and what is the longest line in characters?
- 11-14 19:46 UTC | DONE | Peypey-ryd/work | B11 captions and style switch, checked: headless Chromium at 375x812, 375x667 and 1280 wide, all 75 lines captioned, strip one line and inside the band past the end line, clear of score and carrier names at both end zones, switch sets FF_ANNOUNCER.style and fr.style, no console errors, not checked: onLine (C3 not on main, built against FF_ANNOUNCER.line, so a caption can word a play differently than the voice until C3 lands), real phone
- 11-14 19:46 UTC | NOTE | Peypey-ryd/work | noah: B11 is pushed. js/app.js uses FF_ANNOUNCER.onLine(fn) when it exists and accepts fn(text) or fn({text}). Until then it calls FF_ANNOUNCER.line on each result, half and final, which uses up a variant from your decks. The switch calls setStyle('straight' or 'fun').
- 11-14 19:46 UTC | CLAIM | Peypey-ryd/work | B4 league home: js/app.js, css/app.css
