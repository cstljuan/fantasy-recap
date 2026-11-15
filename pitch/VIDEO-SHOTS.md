# Demo video: shot list (one minute)

Refreshed 2026-11-15 against `main` (C34). Every shot uses only what is on `main`; a shot marked **(if merged)** needs work that was on a branch when this was written. The plays are those of the game the app plays now, `data/games/week11-football.json` (final Goblins 17, Pythons 14; fantasy 47.8 to 43.1). Record at phone width (375 by 812) with sound on.

## Before you record

- Open `index.html` fresh, or clear the site's data, so the opt-in card shows. Add `?intro=0` to skip the first-run walkthrough.
- The voice is ElevenLabs, from the recordings in `assets/voice/`: Ninja for football, Nathaniel for soccer. Every line of this game is recorded. One announcer style, in English.
- The announcer picks each line in the same order on every first viewing. The lines below are examples; reload and replay to get the same ones again.
- The voice speaks at 0.5x, 1x and 2x only. At 4x the crowd still plays and nobody talks: use 4x for the fast montage.
- Sound only starts after the first tap, which is "Watch the game" in shot 3.

## Shots

| # | Time | On screen | Heard | Length |
|---|---|---|---|---|
| 1 | 0:00 | League page: "Week 11 matchups", the Goblins against the Pythons card. Tap it. | Nothing yet. A browser plays no sound before the first tap. | 4 s |
| 2 | 0:04 | Matchup page: the card "Hide my score until the recap". Tap Opt in. Both fantasy totals turn into dashes. | Nothing. | 5 s |
| 3 | 0:09 | Tap "Watch the game". The stadium opens: pixel crowd in both teams' colors, boards, the field from above, the camera on the ball. | The kickoff jingle, then the intro, for example "Welcome in. It's the Goblins against the Pythons. Watch Allen for the Goblins, and Jackson for the Pythons." The stadium crowd starts underneath. | 7 s |
| 4 | 0:16 | The first plays at 1x. The captions strip shows each line as it is said. | The referee's whistle at the kickoff, the crowd, lines such as "Here's the kick..." | 10 s |
| 5 | 0:26 | Tap the field, tap Next big moment. The jump bar moves ahead; the game picks up there. | One catch-up line, for example "So far: Goblins TD, 7 to 0." | 5 s |
| 6 | 0:31 | A touchdown: the white flash and the camera shake. No points float up, because the viewer opted in. | The crowd erupts, the touchdown call, the air horn. | 7 s |
| 7 | 0:38 | Switch to 4x. The second half flies by. | No voice at 4x. The crowd rises on long gains and groans on turnovers. | 5 s |
| 8 | 0:43 | Back to 1x a few plays before the end. The FINAL board. | The full-time whistle, the cheer, the full-time jingle and the wrap. | 6 s |
| 9 | 0:49 | Tap it. The recap: "Gridiron Goblins WIN", 47.8 to 43.1, top performers, then Share result. | The end of the jingle. | 6 s |
| 10 | 0:55 | Tap Soccer in the header: the same stadium, a match playing. **(if merged)** Tap the field to show the soccer jump bar. | The soccer crowd and the soccer commentator. | 5 s |

Total: 60 seconds.

## What not to show or say

- Do not call the result real. The stat lines are invented for real player names (see `REAL-AND-SIMULATED.md`).
- There is no "Why this play" card; do not look for it.
- The announcer speaks English only. The ES switch changes the screens' labels, not the voice.
- Do not play the Turtles against Owls game: its lines are not recorded and use the browser's voice.
- The database is not used by the app in this setup. Leave it out of the video.
