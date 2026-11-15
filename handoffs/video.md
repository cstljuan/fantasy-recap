# Handoff: the Devpost video, and where everything stands

Written by Juan's laptop session in the night of 2026-11-14 to 2026-11-15 (Eastern). For the session that builds the video, and for Juan. Read `CLAUDE.md` and `board/ORDERS.md` first: every commit is authored and committed by `cstljuan`, no tool names anywhere, no secrets in any file.

**Deadline: Devpost closes Sunday 2026-11-15 at 8:00 AM Eastern.** The video must be under 2 minutes, uploaded to YouTube (or similar), and its link pasted into Devpost. The in-person demo is required as well.

## 1. Where everything stands (checked, not assumed)

| Thing | State | Where |
|---|---|---|
| Live site | Up, serves `main` | https://cstljuan.github.io/fantasy-recap/ |
| Live service | Up on Render (free plan), talks to Tiger Data | https://fantasy-recap-7uj5.onrender.com |
| Service checked from outside | `/health` says database true; momentum answers `source: database`, `engine: time_bucket`; the live site's origin is allowed | `curl https://fantasy-recap-7uj5.onrender.com/health` |
| Live site uses the service | Only after `live.js` with the address is on `main` (pushed on `cstljuan/laptop`, waiting for the boss's merge). Until then the site plays from files | `live.js`, `index.html` |
| Phone app | Installed and launched on Juan's iPhone 17 Pro Max. A native shell around the live site: full screen, sound without a first tap | project in `~/Projects/fantasy-recap-ios/` (not in this repository) |
| Phone bugs | Fixed and on `main`: sound from the first tap, every announcer line plays, jump bar drags, a tap on the field no longer presses Close, soccer stays below the status bar, a second tap closes the menu | `js/phone.js`, `index.html` |
| Domain | `fantasyrecap.club` registered at Porkbun through the MLH GoDaddy Registry offer. DNS is NOT pointed yet: the placeholder record is gone, the GitHub records are not in. `CNAME` file pushed on `cstljuan/laptop` | Porkbun, DNS for the domain |
| Tiger Data | Whole service ran there: 22 steps OK, `time_bucket`, 19 real-database checks | `db/runs/laptop-2026-11-15-rerun.txt` |
| Jev | Chose 40 of 84 plays in `week11-football.json` and 97 of 184 in `week11-tur-owl.json` | `engine/jev.js`, `engine/make-game.js` |
| Scout | 28 reports and 4 team profiles written by hand with Scout's tools, every cited play verified; the agent itself ran once, one player, on Gemini | `data/profiles/`, `agents/scout/` |
| Devpost draft | Filled, NOT saved, NOT submitted. No video link yet | devpost.com, project "Fantasy Recap" |
| Practice page | Script by speaker with a timer, questions, real or simulated | `pitch/practice/index.html` |

### Open, in order

1. **Reset the database password** (Juan knows why; it is not in this repository, the board or any commit, which were scanned). Reset it in the Tiger console, then put the new string in `.env` on the laptop and in the Render service's `DATABASE_URL`. Juan does this; nobody else types that password.
2. **DNS for `fantasyrecap.club`** at Porkbun: four A records on the bare domain (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`) and a CNAME `www` to `cstljuan.github.io`. Remove the wildcard record that points at Porkbun's placeholder. Then set the custom domain on GitHub Pages (the `CNAME` file must already be on `main`, committed from a session, never typed into the Pages settings box) and turn on "Enforce HTTPS" once the certificate exists.
3. **Boss merge** of `cstljuan/laptop`: `live.js` (the service address), `render.yaml` (allows the domain), `CNAME`.
4. **Devpost**: Juan presses Save, adds the video link, does the hackathon page, the boxes and Submit.
5. **Stale pictures** left out of Devpost: `pitch/assets/gallery-04-play-caller.png`, `gallery-06-real-and-simulated.png`, `architecture.png` (they say the main game is invented and the database was only a schema).

### The demo, as Juan wants it

- **MacBook:** the live site, in a private window: `https://cstljuan.github.io/fantasy-recap/?intro=0`. It opens on the real week 9 game (Goblins against Turtles, real plays, 204 plays, 27 to 30, fantasy 106.3 to 108.7, the Turtles win).
- **Phone:** the installed Fantasy Recap app, handed to the judges.
- **Open the app and the site one minute before a judge arrives.** The free Render service sleeps when idle and takes about a minute to wake; the app gives it 2 seconds and then stays on files for that page load.
- **Jev, for a judge who asks:** open `https://cstljuan.github.io/fantasy-recap/?intro=0&game=week11-football` (the card says "Jev called the plays"), or run the game maker live, about 4 seconds, it prints how many plays Jev chose: `node engine/make-game.js --from-sample --seed 7 --out /tmp/jev-demo.json` (needs the Jev key in `.env`, laptop only).
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

### How to make it

1. **Working folder.** `.video/` at the repository root, listed in `.git/info/exclude` so nothing in it is ever committed (raw recordings are large). Subfolders `raw/`, `build/`, `out/`.
2. **Scratch voice first.** Render the narration above line by line with an open-source voice that runs on the laptop (Kokoro or Piper; macOS `say` is the fallback if neither installs in ten minutes). Save one WAV per line. Their lengths set the timing; adjust the picture to the voice, not the other way round.
3. **Animatic.** Lay the scratch lines on a timeline with placeholder cards and check the total is under 1:58. Send it to Juan before building graphics.
4. **Product capture, on the real phone.** Record the installed app with the iPhone's own screen recording: it records the app's sound. Juan does the taps from the table above, twice, with the ringer on and the volume up. AirDrop the files to the Mac, into `.video/raw/`. Capture soccer, the ES switch and the Home Screen icon the same way. Backup if the phone is not available: the iPhone simulator on the Mac with the live site (picture only) and the app's recorded lines from `assets/voice/`.
5. **Graphics, in code.** HTML pages drawn with the tokens and fonts above, rendered frame by frame in a headless browser and piped to ffmpeg, the way the pictures in `design/pitch/` are rendered (`design/src/render-pitch.js`). One page per graphic section: cold open, title, how it is built (five beats), honest scoreboard, end card. Phone captures sit in a simple dark phone frame at about 40 percent of the frame width, never stretched.
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
