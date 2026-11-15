# Devpost video: what is in it

The video that was made from `handoffs/video.md` section 2. It replaces the older one-minute plan for the week 11 game. Length 1:53.5, 1920 by 1080, 30 frames a second, H.264 with AAC, captions burned in, loudness about -16.5 LUFS.

The product pictures are real screen recordings of the app at phone size (393 by 852) from a browser, taken from the same code that is on `main`, placed inside a phone frame drawn in code. Everything else is a motion graphic built in code with the renderer in `design/video-kit/`. The working files (scenes, recordings, audio, renders) stay out of the repository.

| Time | Scene | Picture |
|---|---|---|
| 0:00 | G1 | A dark phone drawn in code, a fantasy score ticking up, a notification |
| 0:04 | G2 | "You already know." Tusk's amber eyes open in steps and blink |
| 0:10.5 | G3 | The sealed scoreboard: flaps roll and lock into dashes, SEALED stamp |
| 0:14.5 | G4 | Title, extruded letters, light sweep, Tusk steps in |
| 0:19 | G5 | Recording: league, matchup, Opt in, the points turn into dashes |
| 0:25 | G6 | Recording: Watch the game, kickoff in week 9; real players listed; 4 second hold on the app's own sound (the recorded week 9 welcome line and the stadium crowd) |
| 0:39 | G7 | Recording: jump bar to play 92, the next play is Allen to Chase for 47 and a touchdown; banner and confetti |
| 0:47 | G8 | Recording: final whistle and recap; the big board counts up to Goblins 106.3, Turtles 108.7 |
| 0:54 | G9 | Wall of real play by play lines, counter to 3,177 |
| 1:01 | G10 | Game maker and rules engine: rows become drives, each stamped LEGAL |
| 1:06.8 | G11 | Jev: the odds stored on one real call in `data/games/week11-football.json` (Jefferson 62, Robinson 17, Kittle 10, Collins 7, Nabers 4), plus the week 11 card "Jev called the plays" |
| 1:11.9 | G12 | Tiger Data: rows group into time buckets (points by bucket in the week 9 game) |
| 1:16.2 | G13 | Scout: the Ja'Marr Chase report, claim 3 linked to its three real plays; 28 reports |
| 1:24.2 | G14 | Recording: soccer, a goal with its banner |
| 1:28 | G15 | Recording: the switch to Spanish; the app icon on a Home Screen drawn in code, opening into the app |
| 1:34.5 | G16 | The honest scoreboard: Real, Simulated, Not checked, the rows from the handoff |
| 1:47.5 | G17 | End card: wordmark, fantasyrecap.club, the four names |

## Before upload

- A person has to watch it once with sound: no session could hear the mix, levels were checked by numbers only.
- The narration is a scratch voice (an open source voice made on the session's machine) unless the final ElevenLabs lines arrived in time.
- A second export ends on `cstljuan.github.io/fantasy-recap` instead of `fantasyrecap.club`, for the case where the domain does not load.
- The phone shots come from a browser at phone size, not a phone screen recording, so the Home Screen is drawn in code.
