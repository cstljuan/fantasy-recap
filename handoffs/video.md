# Handoff: the Devpost video, and where everything stands

Written by Juan's laptop session in the night of 2026-11-14 to 2026-11-15 (Eastern). For the session that builds the video, and for Juan. Read `CLAUDE.md` and `board/ORDERS.md` first: every commit is authored and committed by `cstljuan`, no tool names anywhere, no secrets in any file.

**Deadline: Devpost closes Sunday 2026-11-15 at 8:00 AM Eastern.** The video must be under 2 minutes, uploaded to YouTube (or similar), and its link pasted into Devpost. The in-person demo is required as well.

## 0. Get the full build first (Peyton's session: do this before anything else)

You need the whole app running in front of you, not only the video files.

| What | How |
|---|---|
| The code | `git clone https://github.com/cstljuan/fantasy-recap` (or `git pull` on `main`). If `handoffs/video.md` is missing on `main`, it is on the branch `cstljuan/laptop`. Then `sh tools/setup.sh` and set your own person's identity (`Peypey-ryd`, the email on that row of `tools/roster.txt`) |
| The app, locally | `python3 -m http.server 8000`, open `http://localhost:8000/?intro=0`. No install, no build. Football opens on the real week 9 game; `?game=week11-football` opens the Jev game; the Soccer switch is in the header |
| The app, live | `https://fantasyrecap.club` (GitHub Pages from `main`; the older address `https://cstljuan.github.io/fantasy-recap/` redirects there). If the browser says "Not Secure", the certificate is still being issued: use it anyway for capture, or capture from localhost |
| The live service | `https://fantasy-recap-7uj5.onrender.com` (`/health`, `/league`, `/games/week09-gob-tur/momentum?bucket=300`). The hosted app calls it by itself; locally add `&api=https://fantasy-recap-7uj5.onrender.com` only if you need it, the service accepts localhost |
| The app on a phone, the fast way | Open `https://fantasyrecap.club` in Safari on the iPhone, Share, Add to Home Screen. It opens full screen with sound |
| The app on a phone, as a real app | The source is in `ios/` (a thin native shell around the live site). `cd ios`, put your own Apple team id in `project.yml` (`DEVELOPMENT_TEAM`), `xcodegen generate`, then `xcodebuild -project FantasyRecap.xcodeproj -scheme FantasyRecap -configuration Release -destination 'generic/platform=iOS' -derivedDataPath build -allowProvisioningUpdates build`, plug the phone in, `xcrun devicectl list devices` for its id, `xcrun devicectl device install app --device <id> build/Build/Products/Release-iphoneos/FantasyRecap.app`. Needs Xcode signed in to an Apple account and Developer Mode on the phone |
| Every check | `node data/checks/all.js` (about three minutes) |
| The motion graphics kit | `design/video-kit/` (renderer, scene template, recipes), described in section 2 |
| Truth files | `pitch/REAL-AND-SIMULATED.md`, `pitch/DEVPOST-FINAL.md`, the end of `pitch/QUESTIONS.md` |
| Brand | `design/tokens.css`, `design/fonts/`, `design/assets/mascot/`, `design/pitch/` (the pages the Devpost pictures were rendered from), `design/MOTION.md` |

## 1. Where everything stands (checked, not assumed)

| Thing | State | Where |
|---|---|---|
| Live site | Up, serves `main` | http://fantasyrecap.club (https pending), older address https://cstljuan.github.io/fantasy-recap/ redirects to it |
| Live service | Up on Render (free plan), talks to Tiger Data | https://fantasy-recap-7uj5.onrender.com |
| Service checked from outside | `/health` says database true; momentum answers `source: database`, `engine: time_bucket`; the live site's origin is allowed | `curl https://fantasy-recap-7uj5.onrender.com/health` |
| Live site uses the service | `live.js` with the address is on `main`. Works from an https origin the service allows; not verified from `fantasyrecap.club` yet because https was not on | `live.js`, `index.html` |
| Phone app | Installed and launched on Juan's iPhone 17 Pro Max. A native shell around the live site: full screen, sound without a first tap | source in `ios/` |
| Phone bugs | Fixed and on `main`: sound from the first tap, every announcer line plays, jump bar drags, a tap on the field no longer presses Close, soccer stays below the status bar, a second tap closes the menu | `js/phone.js`, `index.html` |
| Domain | `fantasyrecap.club` (Porkbun, through the MLH GoDaddy Registry offer) points at the site: DNS answers worldwide, GitHub Pages has it as its custom domain, `http://fantasyrecap.club` loads. HTTPS is NOT on yet: GitHub had not issued the certificate when this was written; when it has, turn on Enforce HTTPS | `gh api repos/cstljuan/fantasy-recap/pages` |
| Tiger Data | Whole service ran there: 22 steps OK, `time_bucket`, 19 real-database checks | `db/runs/laptop-2026-11-15-rerun.txt` |
| Jev | Chose 40 of 84 plays in `week11-football.json` and 97 of 184 in `week11-tur-owl.json` | `engine/jev.js`, `engine/make-game.js` |
| Scout | 28 reports and 4 team profiles written by hand with Scout's tools, every cited play verified; the agent itself ran once, one player, on Gemini | `data/profiles/`, `agents/scout/` |
| Devpost draft | Filled, NOT saved, NOT submitted. No video link yet | devpost.com, project "Fantasy Recap" |
| Practice page | Script by speaker with a timer, questions, real or simulated | `pitch/practice/index.html` |

### Open, in order

1. **Reset the database password** (Juan knows why; it is not in this repository, the board or any commit, which were scanned). Reset it in the Tiger console, then put the new string in `.env` on the laptop and in the Render service's `DATABASE_URL`. Juan does this; nobody else types that password.
2. **HTTPS for `fantasyrecap.club`.** DNS is done (an ALIAS on the bare domain and a CNAME `www`, both to `cstljuan.github.io`) and the custom domain is set. Wait for GitHub's certificate, then `gh api -X PUT repos/cstljuan/fantasy-recap/pages -F https_enforced=true`. Until then the old github.io address redirects to plain http, which the phone app refuses to load. After HTTPS is on: check `https://fantasyrecap.club` reads the league from the service (the service must allow that origin: the Render blueprint sync for `ALLOWED_ORIGINS` was approved), then reinstall the phone app, which now opens `https://fantasyrecap.club`.
3. **Boss merge** of `cstljuan/laptop`: this handoff, `ios/`, `design/video-kit/`.
4. **Devpost**: Juan presses Save, adds the video link, does the hackathon page, the boxes and Submit.
5. **Stale pictures** left out of Devpost: `pitch/assets/gallery-04-play-caller.png`, `gallery-06-real-and-simulated.png`, `architecture.png` (they say the main game is invented and the database was only a schema).

### The demo, as Juan wants it

- **MacBook:** the live site, in a private window: `https://fantasyrecap.club/?intro=0`. It opens on the real week 9 game (Goblins against Turtles, real plays, 204 plays, 27 to 30, fantasy 106.3 to 108.7, the Turtles win).
- **Phone:** the installed Fantasy Recap app, handed to the judges.
- **Open the app and the site one minute before a judge arrives.** The free Render service sleeps when idle and takes about a minute to wake; the app gives it 2 seconds and then stays on files for that page load.
- **Jev, for a judge who asks:** open `https://fantasyrecap.club/?intro=0&game=week11-football` (the card says "Jev called the plays"), or run the game maker live, about 4 seconds, it prints how many plays Jev chose: `node engine/make-game.js --from-sample --seed 7 --out /tmp/jev-demo.json` (needs the Jev key in `.env`, laptop only).
- Lines by speaker, with a timer: `pitch/practice/index.html`.

## 2. The video

### Rules

- Under 2:00. Target 1:55. 1920 by 1080, 16:9, H.264, captions burned in (judges often watch muted).
- No team member's voice. Narration is an AI voice: a scratch voice first, the final from ElevenLabs.
- Every claim must be true on `main`. The source of truth is `pitch/REAL-AND-SIMULATED.md` and `pitch/DEVPOST-FINAL.md`; the list of things not to say is at the end of `pitch/QUESTIONS.md`.
- Look: the app's own look. Near-black `#0b0d0e`, amber `#ffc21a`, off-white `#f3f0e8`, square corners, the pixel font for labels, the condensed display face for headlines, Tusk the scorekeeper. Tokens in `design/tokens.css`, fonts in `design/fonts/`, mascot in `design/assets/mascot/`, the pitch pages in `design/pitch/`. Motion rules in `design/MOTION.md`: pixel things move in steps, panels move once and stop, nothing spoils a hidden score.
- Not in the video: the hackathon's name in the graphics is fine on the end card only; no real team or league marks; no photos.

### Concept

The video is a broadcast. The app's own football announcer narrates it, and Tusk keeps it honest. Graphics first, then the real product, then how it is built, then the honest scoreboard.

Choices already made by this session because Juan asked for the handoff without changing them (he can still overrule any of them): the real week 9 game is the hero; the narrator is the app's football announcer voice; the tone is a sports broadcast promo; the database appears in "how it is built" as real and tested.

### Structure and script (about 215 spoken words)

| Time | Picture | Narration (exact words) |
|---|---|---|
| 0:00 to 0:12 | **Cold open, graphics only.** A phone lock screen made in code, a fantasy score ticking up. Cut to black. Tusk's eyes. | "Sunday night. You check the app. You already know how your fantasy week ended. So there is nothing left to watch." |
| 0:12 to 0:20 | **Title.** The sealed scoreboard, `--.-` against `--.-`, then the wordmark. | "What if you didn't know? Fantasy Recap. Don't check the score. Watch it." |
| 0:20 to 0:26 | **Product, phone capture in a frame.** League screen, tap the matchup, tap Opt in, the points turn into dashes. | "Opt in when your matchup is set, and your score is sealed." |
| 0:26 to 0:40 | Tap Watch the game. The stadium, kickoff. **Let the app's own sound play for 4 seconds** (jingle, crowd, one announcer call) with no narration over it. | "At the end of the week, your two rosters play each other. Real players. Real plays, from NFL week nine." |
| 0:40 to 0:48 | Tap the field, Next big moment, a touchdown with the flash and the crowd. | "Jump to the big moments. It catches you up without spoiling a single point." |
| 0:48 to 0:55 | Drag the bar to the end. Final whistle. The reveal: the Turtles win, 108.7 to 106.3. | "And only at the final whistle..." (the reveal lands) "...do you find out who won." |
| 0:55 to 1:25 | **How it is built, animated.** Five beats, one per sentence: play-by-play rows flying in; the game maker assembling drives; odds bars for a Jev call (week 11 game); rows landing in a table with time buckets; a scouting report with its plays linked. | "Under the hood: three thousand one hundred seventy-seven real plays, read from public play by play. A game maker fits them into a legal game, and a rules engine referees every snap. When there are only stat lines, a decision model called Jev picks the plays. Every play is a row in Tiger Data, bucketed by game time. And Scout, a LangChain deep agent team, backs twenty-eight scouting reports, every claim linked to real plays." |
| 1:25 to 1:38 | **Range.** Soccer match with a goal banner; the ES switch; the app icon on a phone Home Screen and the app opening. | "It plays soccer too. The screens switch to Spanish. And it installs on a phone." |
| 1:38 to 1:50 | **The honest scoreboard.** Three columns: Real, Simulated, Not checked, three short rows each. | "The scorekeeper does not lie about the score. Real: the plays, the players, the database. Simulated: the league, and a second manager." |
| 1:50 to 1:55 | **End card.** Tusk, the wordmark, the address, the four names. | "Fantasy Recap. Don't check the score. Watch it." |

Words to keep straight in the narration and captions:

- "Real plays", never "a real game" and never "real scores": the matchup and the score on the field are the game maker's.
- Jev: only over the week 11 pictures. Jev chose no play in the week 9 game.
- Scout: "backs 28 scouting reports", never "wrote" or "researched". The reports were written by hand with Scout's tools; the agent ran once, for one player, on Gemini.
- Database: "every play is a row in Tiger Data" is true (all 11 game files are in it). Do not say the app reads its plays from it; the app plays from a file and uses the service for opt-ins, the league and momentum.
- "Installs on a phone" is true for Juan's phone through a cable. Do not say "on the App Store".
- Honest scoreboard rows, use these: Real: real NFL players and their week 9 plays; a rules engine that referees every play; the database on Tiger Data. Simulated: the league and its teams; the second manager and the week of waiting; the soccer match and the Jev game's stat lines. Not checked: sound on every phone; the app reading plays from the database; the deep agent beyond one player.
- End card address: `fantasyrecap.club` only if it resolves to the site when the video is exported. Otherwise `cstljuan.github.io/fantasy-recap`.
- Names for the end card: Juan Castillo, Ricky, Noah, Peyton. Ask Juan for the three last names; do not guess them.

### This is a motion graphics video. A lot of motion graphics.

Juan's direction, word for word in spirit: cool motion graphics, a lot of them, plus real screen recordings. Not slides, not fades between screenshots. Every second of the video is either a real capture of the app or a built graphic, and the captures themselves sit inside graphics (a phone frame, callouts, a lower strip with the caption). Aim for a new move every 1.5 to 2.5 seconds.

**The kit: `design/video-kit/`.** It is the renderer Juan's sessions use for broadcast graphics, copied into this repository for you.

- `scripts/render.mjs`: drives headless Chrome, seeks to each exact frame, grabs a PNG and pipes it to ffmpeg. `scripts/stage2d.js`: the canvas stage. `scripts/scene-template.js`: copy it for every new scene. `scripts/qrender.sh`: the render queue (use it if more than one session renders on the machine). `scripts/qa_sheet.sh`: a contact sheet of a render, to look for gaps and cut-off glows. `scripts/sfx_shot.py`, `scripts/mux_review.py`: synthesized sound effects and the review mux. `scripts/speech_energy.py`: finds where words really land in an audio file.
- `motion-recipes.md`: springs, true motion blur, per-character type, camera moves. `render-contract.md`: the setup, once per project. `crashes-and-pitfalls.md`: what breaks. `qa-sfx-review.md`: checks and sound.
- Setup is in `render-contract.md`: `npm i playwright-core`, set `CHROME_PATH` if you are not on a Mac. The kit was tested on a Mac; on another system say what you could not run.

**Rules for every scene** (from the kit, they are the difference between broadcast and PowerPoint):

1. A scene is a pure function of time `t`. No `Date.now`, no state carried between frames, seeded randomness only. Any frame renders correctly alone.
2. All text and timing sit in a `DATA` block at the top of the scene. Never bake text into an image. Check every word and number against the script above.
3. Real motion: damped springs, true sub-frame motion blur, layered depth, a camera that moves. No linear slides, no cross-dissolves as the only idea.
4. Slow enough to read. Never land the last element just before the cut. If a slot cannot hold a graphic, make the slot longer or the graphic simpler, and say so.
5. Pixel things (Tusk, the scoreboard digits, banners) move in steps, like the app (`design/MOTION.md`). Panels and type can be smooth. Mixing the two is the look.
6. Stills first (three frames per scene, look at them), then one video render per scene, then the contact sheet.
7. Each graphic gets its own move. Do not repeat the same entrance twice in a row.
8. Essential type stays inside a 5 percent inset and above the caption strip.

**The graphics to build (17 scenes).** Screen recordings are marked REC; everything else is built in code.

| # | Time | Scene | What moves |
|---|---|---|---|
| G1 | 0:00 to 0:05 | A fantasy app score, drawn in code on a dark phone | The number ticks up digit by digit, a notification slides in, the camera pushes in slowly |
| G2 | 0:05 to 0:12 | "You already know." Black. Tusk's two amber eyes open in steps | Per-character type lands on the narration; the eyes blink once; grain |
| G3 | 0:12 to 0:16 | The sealed scoreboard: two team panels, `--.-` and `--.-` | Split-flap digits roll and lock into dashes; a stamp "SEALED" slams in with motion blur and a one-frame flash |
| G4 | 0:16 to 0:20 | Title: FANTASY RECAP, "Don't check the score. Watch it." | Extruded amber letters assemble per character on a spring, a light sweep crosses the wordmark, Tusk steps into the corner |
| G5 + REC1 | 0:20 to 0:26 | Phone frame with the opt-in capture | The phone flies in on a spring and settles at an angle, then squares up; an amber callout line traces to the Opt in button; the dashes on the phone are echoed big behind it |
| G6 + REC2 | 0:26 to 0:40 | Kickoff capture, full height in the phone frame | Stadium lights sweep the background; the label "REAL PLAYS, NFL WEEK 9" types on in the pixel font; the announcer's caption from the app is lifted into a lower strip; hold 4 seconds on the app's own sound |
| G7 + REC3 | 0:40 to 0:48 | Jump bar and touchdown capture | A timeline bar outside the phone mirrors the app's jump bar and its playhead leaps; at the touchdown the whole frame shakes, a pixel banner TOUCHDOWN crosses in steps, confetti in both teams' colors falls with seeded randomness |
| G8 + REC4 | 0:48 to 0:55 | The reveal capture | Everything goes dark except the scoreboard; the dashes flip to 108.7 and 106.3 with a count-up; the winning side floods with its color; Tusk nods |
| G9 | 0:55 to 1:01 | Real plays: a wall of play-by-play lines | Hundreds of small text rows stream in three depth layers with motion blur; the counter rolls to 3,177; four rows light up amber |
| G10 | 1:01 to 1:07 | The game maker and the rules engine | Lit rows drop onto a top-down pixel field and snap into drives; a referee whistle icon stamps each one "LEGAL"; down and distance markers slide |
| G11 + REC5 | 1:07 to 1:13 | Jev: odds bars for one real Jev call from `data/games/week11-football.json` (use the odds stored on a play, do not invent them) | Five bars grow on springs to their percentages, the chosen one pulses and gets a "CALLED" tag; a small capture of the week 11 card "Jev called the plays" slides in |
| G12 | 1:13 to 1:19 | Tiger Data: every play a row | Rows fall into a table, then group into time buckets that rise as a momentum chart for both teams; the label `time_bucket` in the pixel font |
| G13 | 1:19 to 1:25 | Scout: a scouting report | A report card unfolds, one claim highlights, thin lines fan out from it to three play cards ("every claim linked to real plays"); the counter 28 |
| G14 + REC6 | 1:25 to 1:31 | Soccer capture in the phone frame | The phone flips over on its vertical axis from the football screen to the soccer match; a pixel GOAL banner; the pitch stripes continue outside the phone |
| G15 + REC7, REC8 | 1:31 to 1:38 | Spanish switch and the Home Screen | The EN and ES labels swap with a slot-machine roll and the capture cuts on it; then the app icon drops onto a Home Screen grid drawn in code and zooms open into REC8 (the app launching) |
| G16 | 1:38 to 1:50 | The honest scoreboard, three columns | The columns rise like a stadium board, rows flip in one by one in step with the narration, a green lamp, an amber lamp and a red lamp light per column; Tusk stands beside it |
| G17 | 1:50 to 1:55 | End card | The wordmark, the address typed on, the four names, Tusk's eyes close in steps on the last frame |

**Screen recordings to capture (8).** Record each one twice. Portrait, the phone's own screen recording, ringer on, volume up, Do Not Disturb on so no notification lands in the take.

| # | What to record | Length |
|---|---|---|
| REC1 | League screen, tap your matchup, tap Opt in, points turn into dashes, tap Lineups | 12 s |
| REC2 | Tap Watch the game, kickoff, three plays at 1x with the captions strip | 25 s |
| REC3 | Tap the field, Next big moment, the next touchdown | 15 s |
| REC4 | Drag the jump bar to the last plays, the final whistle, tap the field, the recap | 20 s |
| REC5 | The address with `&game=week11-football`: the League card that says "Jev called the plays", then the Plays screen | 10 s |
| REC6 | Tap Soccer, Watch the match, a goal with its banner (use the jump bar to reach one) | 20 s |
| REC7 | Tap ES, the screens in Spanish, tap EN | 6 s |
| REC8 | The Home Screen with the Fantasy Recap icon, tap it, the app opens | 6 s |

If no phone is at hand: record a desktop browser at 393 by 852 with the same taps (picture only) and lay the app's own recorded lines from `assets/voice/` under it; `node js/announcer/transcript.js` prints which lines a first viewing says, in order.

**Sound.** Whooshes, hits and risers are synthesized in code with `scripts/sfx_shot.py` (one hit per landing, low level). The 8-bit music bed is made in code. The app's own sound comes from the recordings. No session can hear: check levels by numbers, and tell Peyton and Juan that a person has to listen once before upload.

**If more than one session renders:** one scene per session, all through `scripts/qrender.sh`, never two renders at once on one machine.

### How to make it

1. **Working folder.** `.video/` at the repository root, listed in `.git/info/exclude` so nothing in it is ever committed (raw recordings are large). Subfolders `raw/`, `build/`, `out/`.
2. **Scratch voice first.** Render the narration above line by line with an open-source voice that runs on the laptop (Kokoro or Piper; macOS `say` is the fallback if neither installs in ten minutes). Save one WAV per line. Their lengths set the timing; adjust the picture to the voice, not the other way round.
3. **Animatic.** Lay the scratch lines on a timeline with placeholder cards and check the total is under 1:58. Send it to Juan before building graphics.
4. **Product capture, on a real phone.** The eight recordings in the table above, on Peyton's iPhone (the app from the Home Screen, see section 0) or Juan's. The phone's own screen recording captures the app's sound. AirDrop the files into `.video/raw/`.
5. **Graphics, in code, with the kit.** The 17 scenes in the table above, each a scene file rendered with `design/video-kit/scripts/render.mjs`. Stills first, then one render each, then the contact sheet. Phone captures sit inside the phone frame scene, never stretched, never full-bleed without a frame.
6. **Music.** An 8-bit bed made in code (square and triangle waves, about 100 beats a minute), ducked under the narration and under the app's own sound. Nothing licensed.
7. **Final voice.** When the picture is locked, the same lines go to ElevenLabs in the app's football announcer voice. That is Noah's lane (`js/announcer/voice/`, his key and his credits): post `ASK "boss: ..."` with the frozen lines and ask for one MP3 per line; do not assign Noah work directly. If the files are not back one hour before export, ship with the scratch voice.
8. **Captions.** Burned in, bottom, off-white on a dark strip, the exact narration, at most two lines.
9. **Export.** `.video/out/fantasy-recap-video-final.mp4`, 1920 by 1080, H.264, AAC, under 1:58. Watch it once start to finish with sound and once muted before calling it done.
10. **Hand to Juan.** He uploads it to YouTube as unlisted, pastes the link into the Devpost draft's "Video demo link", and saves.

### Checks before export

- Total length under 1:58.
- Every number on screen and in the narration matches `pitch/DEVPOST-FINAL.md`: 3,177 plays, 28 reports, 40 of 84, 204 plays, 108.7 to 106.3.
- No fantasy number visible while the score is sealed in the product section.
- No frame shows the Home Screen hint, a browser address bar, a debug line or a notification.
- Captions match the audio word for word.
- `pitch/VIDEO-SHOTS.md` describes the older one-minute plan for the week 11 game; replace it with this plan when the video is done.

### Timeline to the 8:00 AM deadline

| By | Done |
|---|---|
| 1:00 AM | Scratch voice lines and the animatic, sent to Juan |
| 2:00 AM | Phone captures in `.video/raw/` |
| 4:00 AM | All graphics rendered, rough cut with scratch voice and music |
| 5:00 AM | Final voice lines in, or the decision to ship the scratch voice |
| 6:00 AM | Final export, watched twice |
| 6:30 AM | Uploaded, link in Devpost |
| 7:00 AM | Devpost saved and submitted by Juan, an hour of slack |

## 3. What this session changed tonight (for whoever picks up the code)

- `js/phone.js` (new): wakes sound on every real tap, drops the click that follows a touch on the field, `?debug=sound` shows the state of each sound part on screen.
- `js/announcer/voice/play.js`: one shared audio player for every recorded line.
- `js/audio.js`, `js/screens/stadium-sound.js`: resume from the iPhone's `interrupted` state.
- `js/app.js`, `js/screens/extras.js`: the jump bar no longer resets while it is dragged; a second tap on the field closes the menu.
- `index.html`: loads `live.js` and `js/phone.js`; adds `?api=` on a hosted page; keeps the soccer frame inside the safe area.
- `server/index.js`: `ALLOWED_ORIGINS`. `render.yaml`, `live.js`, `CNAME`, `.nojekyll` at the root.
- `data/games/week11-tur-owl.json`: rebuilt with Jev. `data/profiles/`: 28 profiles, 28 reports, 4 team profiles.
- `pitch/`: `DEVPOST-FINAL.md`, `QUESTIONS.md`, `REAL-AND-SIMULATED.md`, `DEMO-SCRIPT.md` brought up to date; `pitch/practice/index.html` new.
- `db/runs/`: both Tiger Data run reports.

To rebuild and reinstall the phone app: `cd ~/Projects/fantasy-recap-ios`, build the `FantasyRecap` scheme for `generic/platform=iOS` with automatic signing, then `xcrun devicectl device install app --device <the phone's id> <path to FantasyRecap.app>`. The phone must be unlocked.
