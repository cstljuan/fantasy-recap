# Demo script: two minutes

Written 2026-11-14 from `README.md`, `pitch/REAL-AND-SIMULATED.md` and the board. Every claim below is something those say is built. Anything marked **(if ready)** is not built today: say it only if it is merged and checked by demo time, otherwise skip the line.

Total: 2:00. Problem 0:00 to 0:15, demo 0:15 to 1:15, how it works 1:15 to 1:40, what is next 1:40 to 2:00. About 150 spoken words a minute; the demo part leaves room for the game's own sound.

## Before you start (set up three tabs)

The game pauses whenever its view is closed, so two tabs can be parked just before the moments we want. Timings below were measured on the current game (`data/games/week11-football.json`, 84 plays, final GOB 17, PYT 14, fantasy 47.8 to 43.1).

| Tab | Address | How to park it |
|---|---|---|
| 1 | Private window, `http://<laptop>:8000/?intro=0` | Nothing. A private window has no saved opt-in, so the opt-in card shows. `?intro=0` keeps the first-run walkthrough out of the way. |
| 2 | `http://<laptop>:8000/?speed=2&intro=0#matchup` | Opt in, Watch the game, then press Escape (or tap and Close) during Barkley's runs on the Goblins' first drive. The Plays tab must say **12 of 84 plays** (11 is fine). If fewer, Keep watching for a moment and close again. From play 12, the touchdown comes in about 10 seconds at 2x. |
| 3 | `http://<laptop>:8000/?speed=4&intro=0#matchup` | Opted in (it shares the saved choice with tab 2). Watch, and close the view late in the game so the Plays tab says **81 of 84 plays**. From there the final comes in about 5 seconds at 4x. |

Notes: the voice only speaks at 2x or slower (it is quiet at 4x), which is why tab 2 is at 2x. Turn the laptop volume up. Phone or laptop both work; at phone width the tabs are at the bottom.

## The script

| Time | On screen | Said |
|---|---|---|
| **0:00 to 0:15** | **The problem.** Tab 1, the League screen: "Week 11 matchups", our matchup first, "Recap drops Tuesday". | "Fantasy managers never get to watch their own team play. And once you know your score, there is nothing left to watch. We wanted the end of the week to feel like game day again." |
| **0:15 to 0:27** | **Opt in.** Tap our matchup. The card "Hide my score until the recap". Tap **Opt in**. The fantasy points turn into `--.-` and the stat lines disappear. | "Both managers opt in when the matchup is set. From then on, our scores stay hidden. No points, no stat lines, nothing to spoil it." |
| **0:27 to 0:33** | Tap **Lineups**: every player at `--.-`. | "This is my lineup. Real NFL players. I can't see a single point." |
| **0:33 to 0:52** | **The game, the announcer, a touchdown.** Switch to tab 2, tap **Keep watching**. 8-bit players on the field, the captions strip at the bottom, the announcer voice and the crowd. Allen to Chase, then the touchdown pass to Chase. "TOUCHDOWN GOBLINS!" No point numbers float up, because we opted in. | "At the end of the week we watch our two rosters play each other." (pause for the touchdown call) "Every line the announcer says is also on screen." |
| **0:52 to 0:58** | Tap the field, show **0.5x 1x 2x 4x** and **Straight or Fun**. Tap Close. The matchup screen says **Paused**. | "Speed it up, change the announcer's style, and if you leave, the game waits for you." |
| **0:58 to 1:15** | **The reveal.** Switch to tab 3, tap **Keep watching** (4x). The final whistle, then the FINAL banner. Tap the field. The recap opens: **GRIDIRON GOBLINS WIN**, 47.8 to 43.1, 17 to 14 on the field, then the top performers and the scoring plays. | "And only at the final whistle do we find out." (pause) "Goblins win, 47.8 to 43.1. Top performers, every scoring play, and a card to share." |
| **1:15 to 1:28** | **How it works.** On the recap, tap **All plays**. Scroll to the Pythons' first play and open **Why this play**: options named by player, "Pass to Jefferson" marked **Called** at 62 percent, "Chosen by the play caller from these odds". | "The game isn't scripted by hand. A game maker takes a week of stat lines and builds a full, legal game. At each snap a play caller, Jev, gives every possible call a probability, and the play is drawn from those odds. Jev chose 40 of these 84 plays." |
| **1:28 to 1:40** | Stay on the Plays list (scoring plays visible). | "A rules engine referees every play: downs, distance, possession, score. Then the game is replayed and has to match every player's stat line exactly before we keep it. Each team also has a player profile file." **(if ready)** "and the profiles now carry real tendencies that shape the calls." |
| **1:40 to 2:00** | **What is next.** Tab 1 or the League screen again. | "Today this is one viewer, one device, and invented stat lines for real players. Next: feed it a real week of stats, connect the database we designed on Tiger Data, bring in soccer, which already plays on its own page, and real leagues with two managers watching together." |

## Claims to keep straight

- Say "invented stat lines for real players". The stat lines and every play are made up; the player names are real.
- One viewer, one device, no accounts. The opt-in is kept in the browser.
- The database schema runs on a real Tiger Data database, but the app plays from a file and reads nothing from it (the opt-in goes to the service only when the page is opened with `?api=`, which this demo does not do). Say "next", not "built in".
- Soccer is reachable from the sport switch in the header and plays a full match built by its own match maker from invented lines. Jev was not used for soccer.
- The profiles now hold real season tendencies and recent form, and the Lineups screen shows hot, cold or steady marks from them. But the game was built before they were filled, so they do not shape the calls: do not say the **(if ready)** line until a game is rebuilt with them.
- Now in the game view: the spoken pre-game intro, halftime report and full-time wrap, and the kickoff and final jingles. Still not in the app: the announcer's tendency and hot or cold remarks (the game view does not pass the profiles to it), and any ElevenLabs audio (nothing has been rendered; the voice is the browser's).
- The voice and crowd were checked by scripts, not by ear on the demo machine. Rehearse once with sound on.
