# Demo script: two minutes

Refreshed 2026-11-15 against `main` (C34). Every claim below is something the app on `main` does today. A line marked **(if merged)** depends on work that was on a branch when this was written: say it only if it is on `main` and checked by demo time, otherwise skip it.

Total: 2:00. Problem 0:00 to 0:15, demo 0:15 to 1:25, how it works 1:25 to 1:45, what is next 1:45 to 2:00. About 150 spoken words a minute; the demo part leaves room for the game's own sound.

## Before you start

One tab is enough now: the jump bar takes you to any play, so nothing has to be parked in advance.

| What | How |
|---|---|
| Address | A private window on `http://<laptop>:8000/?intro=0`. A private window has no saved opt-in, so the opt-in card shows; `?intro=0` keeps the first-run walkthrough out of the way. |
| Game | `data/games/week11-football.json`: 84 plays, final Goblins 17, Pythons 14, fantasy 47.8 to 43.1. |
| Sound | Laptop volume up. Sound starts with the first tap ("Watch the game"). The voice speaks at 0.5x, 1x and 2x only; at 4x the crowd still plays. Every announcer line is a recording (ElevenLabs: Ninja for football, Nathaniel for soccer). |
| Rehearse | Once with sound on. The announcer picks each line in the same order on every first viewing, so a rehearsal tells you what will be said. |

## The script

| Time | On screen | Said |
|---|---|---|
| **0:00 to 0:15** | **The problem.** The League screen: "Week 11 matchups", our matchup first. | "Fantasy managers never get to watch their own team play. And once you know your score, there is nothing left to watch. We wanted the end of the week to feel like game day again." |
| **0:15 to 0:27** | **Opt in.** Tap our matchup. The card "Hide my score until the recap". Tap **Opt in**. The fantasy points turn into `--.-` and the stat lines disappear. Tap **Lineups**: every player at `--.-`. | "Both managers opt in when the matchup is set. From then on our scores stay hidden. These are real NFL players, and I can't see a single point." |
| **0:27 to 0:50** | **The game.** Tap **Watch the game**. The stadium: pixel crowd in both teams' colors, advertising boards, mown grass, the camera following the ball. The kickoff jingle, the announcer's intro, the crowd. Let two or three plays run at 1x with the captions strip at the bottom. | "At the end of the week our two rosters play each other, in a stadium, with an announcer." (pause for a call) "Every line the announcer says is also on screen." |
| **0:50 to 1:02** | **The jump bar.** Tap the field. Tap **Next big moment**: the game jumps ahead and the announcer catches you up in one line ("So far: ..."). Let the next touchdown play: the screen flashes, the camera shakes, the crowd roars. No points float up, because we opted in. | "You can jump to the big moments. It catches you up without telling you your score." |
| **1:02 to 1:10** | Tap the field, show **0.5x 1x 2x 4x**, pick 4x. Tap Close: the matchup screen says **Paused**. Tap **Keep watching**. | "Speed it up, and if you leave, the game waits for you." |
| **1:10 to 1:25** | **The reveal.** Drag the jump bar near the end and let the final come. The full-time jingle and the wrap. Tap the field: **GRIDIRON GOBLINS WIN**, 47.8 to 43.1, 17 to 14 on the field, top performers, every scoring play, Share result. | "Only at the final whistle do we find out." (pause) "Goblins win, 47.8 to 43.1. Top performers, every scoring play, and a card to share." |
| **1:25 to 1:37** | **How it works.** On the recap, tap **All plays** and scroll. | "The game isn't scripted by hand. A game maker takes a week of stat lines and builds a full, legal game. At each snap a play caller, Jev, gives every possible call a probability, and the play is drawn from those odds: Jev chose 40 of these 84 plays. A rules engine referees every play, and the game is replayed and has to match every player's stat line exactly before we keep it." |
| **1:37 to 1:45** | **Soccer.** Tap **Soccer** in the header: the same stadium, a match in progress, a goal with its banner. | "The same idea works for soccer, in the same app." **(if merged)** "With the same jump bar." |
| **1:45 to 2:00** | **What is next.** Back to the League screen. Optionally tap **ES** for a second to show the screens in Spanish, then **EN**. | "Today this is one viewer on one device, with invented stat lines for real players. Next: a real week of stats, the database we designed on Tiger Data, and real leagues with two managers watching together." |

## Claims to keep straight

- Say "invented stat lines for real players". The stat lines and every play are made up; the player names are real.
- One viewer, one device, no accounts. The opt-in is kept in the browser.
- The database schema runs on a real Tiger Data database, but this demo plays from a file and reads no plays from it. With `?api=` the page also sends the opt-in, reads the league and can use the commissioner and watch party routes; this demo does not use `?api=`. The momentum, trend and Scout routes exist in the service and no screen reads them. Nothing beyond the schema has run on Tiger Data itself. Say "next", not "built in".
- Scout: say "28 scouting reports with the plays behind every claim", not "an AI wrote them": they were written with Scout's tools in a Claude Code session, and the deepagents run itself has happened once, for one player.
- The announcer has one style and speaks English only. The screens can be switched to Spanish; the voice and captions stay English.
- The announcer's remarks about a player's season tendencies and recent form come from the player profiles. The game itself was built before the profiles were filled, so the profiles do not shape the play calls. Do not say they do.
- There is no "Why this play" card any more. Do not promise one.
- Soccer plays a full match built by its own match maker from invented lines. Jev was not used for soccer.
- Every announcer line has a recording. A line without one falls back to the browser's voice; the second football game (Turtles against Owls) is not recorded and uses the browser's voice, so do not demo that game.
