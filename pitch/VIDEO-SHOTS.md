# Demo video: shot list (one minute)

Draft by Noah's session, 2026-11-14. Every shot uses only what is on `main` today. The plays are those of the game the app plays now, `data/games/week11-football.json` (final Goblins 17, Pythons 14; halftime 17 to 7). Record at phone width (375 by 812) with sound on.

## Before you record

- Open `index.html` fresh, or clear the site's data, so the opt-in card shows.
- The announcer picks each line from several versions, in the same order on every first viewing. The lines below are examples of what you will hear, not a script. To get the same lines again, reload and replay.
- The voice is ElevenLabs: Ninja for football, from the recordings in `assets/voice/football/`. A line without a recording falls back to the browser's voice.
- The announcer only speaks at speeds 0.5x, 1x and 2x. At 4x the crowd and the jingles still play but nobody talks. Use that for the fast montage.
- Sound only starts after the first tap. That tap is "Watch the game" in shot 3.

## Shots

| # | Time | On screen | Heard | Length |
|---|---|---|---|---|
| 1 | 0:00 | League page: "Week 11 matchups", the Gridiron Goblins against the Pixel Pythons card. Tap Open. | Nothing yet. A browser plays no sound before the first tap. | 4 s |
| 2 | 0:04 | Matchup page: the card "Hide my score until the recap". Tap Opt in. Both fantasy totals turn into dashes. | Nothing. | 5 s |
| 3 | 0:09 | Tap "Watch the game". The field opens with the Goblins end zone at the top. | The kickoff jingle (`jingle_kickoff`, brass and drums, about 3 seconds), then the announcer's intro, for example "Welcome in. It's the Goblins against the Pythons. Watch Chase for the Goblins, and Jefferson for the Pythons." | 7 s |
| 4 | 0:16 | The opening kickoff and the first plays at 1x. The captions strip at the bottom shows each line as it is said. | The crowd murmur starts. Lines such as "Here's the kick. Brown brings it out to the GOB 27." and "Chase fights forward for 9 yards. First down!" | 13 s |
| 5 | 0:29 | Allen to Chase for 22, then Allen to Chase for 24 and the first touchdown of the week 11 game. No points float up, because the viewer opted in. | The crowd swells on the long gain and roars on the touchdown. A touchdown line such as "Chase goes up and gets it! Six for the Goblins!" | 7 s |
| 6 | 0:36 | Tap the field, tap Close. The matchup page shows Paused and "Keep watching". Tap it and the same drive carries on. | Silence while the game is closed: the game, the voice and the crowd all stop. The crowd comes back on the next snap. | 6 s |
| 7 | 0:42 | Back to the game and switch to 4x. The second half flies by: Nabers for 37, Robinson's touchdown run, Robinson's fumble, Allen's interception. | No voice at 4x. The crowd swells on the 37 yard catch, roars on the touchdown and groans on the fumble and the interception. | 6 s |
| 8 | 0:48 | The FINAL box: Goblins 17, Pythons 14. Tap it. | The crowd stops, the full-time jingle (`jingle_final`, about 4 seconds), and the wrap if the speed is back at 2x or below, for example "It ends Goblins 17, Pythons 14. The Goblins won it on Allen to Chase for 24." | 5 s |
| 9 | 0:53 | The recap: "Gridiron Goblins WIN", 47.8 to 43.1, top performers, then tap Share result. | The end of the jingle. | 5 s |
| 10 | 0:58 | Tap Soccer in the header for one second to show the second sport. | Nothing. | 2 s |

Total: 60 seconds.

## To set up shot 8

Switch back to 1x or 2x a few plays before the end, so the announcer says the final line. At 4x the jingle plays but the wrap is not spoken.

## What not to show or say

- Do not call the result real. The stat lines are invented for real player names (see `REAL-AND-SIMULATED.md`).
- Soccer is reachable from the sport switch and plays a full match built from invented lines. Show the switch only; it is not in the one-minute cut.
- The database is not used by the app yet. Leave it out of the video.
