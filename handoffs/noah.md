# Handoff for Noah's agent

You work for **Noah**. GitHub username `nexodv`. Git email `88387649+nexodv@users.noreply.github.com`.
Lane: C, announcer and sound. You may edit only: `js/audio.js`, `js/announcer/`, and your own `board/nexodv.md`.

Read `CLAUDE.md` at the root first and follow it. Then do the steps below in order.

## Step 0: identity and hello (every session starts here)

1. Run `sh tools/setup.sh`. If it says NOT OK, run `git config user.name "nexodv"` and `git config user.email "88387649+nexodv@users.noreply.github.com"`, then run it again. It must say OK before you go on.
2. Switch to the branch `nexodv/work` (create it from `main` if it does not exist). If you cannot push a branch with that name, keep the branch you were given and say so in your READY post.
3. Run `sh tools/sync.sh`.
4. If `board/nexodv.md` has no READY line yet, run `sh tools/post.sh READY "hello from Noah"`.
5. Run `git log -1 --format='%an <%ae> | %cn <%ce> | %s'`. It must show `nexodv` as both names. If it shows anything else, STOP and tell Noah to tell Juan. Do nothing else.

## How to work

Follow the work loop in `CLAUDE.md` section 3: `sh tools/sync.sh`, `sh tools/next.sh`, CLAIM, do it, DONE, repeat, without waiting to be told. When there is no task, `sh tools/wait.sh`. Never guess a fact. If you could not check something, say so in the DONE post. The boss queue in `board/BOSS.md` decides the order; the sections below are the full descriptions.

## Task C1: the announcer

Create `js/announcer/lines.js` and `js/announcer/index.js`. Edit nothing outside `js/announcer/`.

Build `window.FF_ANNOUNCER` exactly as `docs/CONTRACT.md` section 3 describes: `line(res, ctx)`, `speak(text)`, `setStyle(name)`, `style`.

First read `js/rules.js` and `js/main.js` to see what a play result (`res`) contains and what the current `say()` lines are.

Write lines for every kind of result: touchdown, field goal good, field goal missed, extra point, interception, fumble, sack, a gain of 15 yards or more, an ordinary gain, incomplete pass, each of the four penalties, punt, turnover on downs, halftime, final. Two styles: `straight` (what happened and why it matters, in one sentence) and `fun` (the same fact with personality). At least three variants per kind and style, chosen so one game does not repeat itself.

The lines are about the game on the field only. Nothing about any real person's private life.

Add `js/announcer/check.js`, runnable with `node js/announcer/check.js`, that prints one line per kind and style so a person can read them all.

You cannot add the script tags yourself. After pushing, run `sh tools/post.sh ASK "boss: add script tags for js/announcer/lines.js and js/announcer/index.js to index.html and call FF_ANNOUNCER from js/main.js"`.

## Task C2: crowd and whistle

Edit only `js/audio.js`. Keep every existing sound name working.

Add a crowd made in code (no audio files): a low murmur during play, a swell on a gain of 15 yards or more, a roar on a touchdown, a groan on a turnover. Add names for them to the existing `play()` list in the same style. List the new names in your DONE post so the boss can call them from `js/main.js`.

## Task C3: soccer lines

Only after the boss posts that soccer is merged. Add a second set of lines in `js/announcer/` for soccer events (goal, save, shot wide, corner, free kick, foul, offside, halftime, full time), same two styles, same check file.

## Task C3: captions

Add `FF_ANNOUNCER.onLine(fn)`: `fn(text, kind, style)` is called every time a line is produced, whether or not it is spoken. Add `FF_ANNOUNCER.caption()` that returns the last line and when it was said. This lets the game show subtitles and lets the app list what was said. Extend `js/announcer/check.js` to cover it.

## Task C4: intro, halftime, wrap

Three longer pieces built from numbers, not from a model: `FF_ANNOUNCER.intro(ctx)` (the two teams and one thing to watch for each), `FF_ANNOUNCER.halftime(ctx)` (score, who leads in fantasy points, the best player so far), `FF_ANNOUNCER.wrap(ctx)` (final, the play that decided it, the top performer). `ctx` adds `leaders` (an array of `{ name, points }`) and `plays` (the list so far) to what `line` receives. Two styles each. Each returns two or three sentences.

## Task C5: voice and queue

Choose the best voice the browser has for each style (prefer an English voice; a different pitch and rate for `fun`). Queue lines so a new one never cuts the previous one mid-word, drop lines that are more than two plays old, and stay silent when speed is above 2. Expose `FF_ANNOUNCER.voices()` so a person can see what was chosen.

## Task C6: tendency lines

Read `data/profiles/<team>.json` when it is available (pass it in through `ctx.profiles`; do not fetch it yourself). When a play matches a player's known tendency, or goes against it, say so: "That is what he does best" or "You do not see him run that route often". Only when the tendency number is present; never invent one.

## Task C7: jingles

In `js/audio.js`, two short tunes made in code: a kickoff theme of about three seconds and a full-time theme of about four. Add names for them to `play()` and list the names in your DONE post.

## Task C9: fit the lines to the captions strip (with Peyton)

Peyton is building a one-line captions strip (task B11). Ask her how many characters fit at 375 wide: `sh tools/post.sh ASK "peyton: ..."`. Then make sure no line is longer than that: shorten the long ones, and add `FF_ANNOUNCER.maxLength` so the check file fails when a line is too long. Answer her questions about `onLine` when they reach your inbox.

## Task Q2: walk the reveal flow for Peyton

Open the app at 375 wide (headless is fine): opt in, watch at `?speed=20`, close and reopen the game, reach the final, open the recap, watch again. Send Peyton, in one or two NOTE posts, exactly what breaks or reads wrong, with the step that shows it: `sh tools/post.sh NOTE "peyton: ..."`. You do not edit her files.

## Task P2: shot list for the demo video

Create `pitch/VIDEO-SHOTS.md`: the shots for a one-minute demo video, in order, each with what is on screen, what is heard (which announcer lines and crowd sounds), and how long it runs. Use only what is on main.

## Task C10: ElevenLabs voice

Noah's decision, on Noah's account: the announcer speaks with ElevenLabs voices (football and soccer voices are in `js/announcer/voices.js`). Build three things. `js/announcer/voice/render.js`, run with node by a person who has `ELEVENLABS_API_KEY` in the environment: it replays a game file, collects every line the announcer will say in both styles, and saves one audio file per line under `assets/voice/<sport>/`, plus an index file that maps the line text to its file. `js/announcer/voice/play.js`: `FF_ANNOUNCER.speak(text)` plays the matching audio file when there is one and falls back to the browser voice when there is not. Keep the key out of every file, commit and post. Keep all audio under 15 MB. You cannot run the render without the key: say so, and post `ASK "noah: ..."` to your person for it to be run.

## Task C11: commentary that remembers the game

Give the announcer a memory. Keep a running record of the game inside `js/announcer/` (score, lead changes, each player's catches, yards and touchdowns so far, drives without a score, time since the last score) and use it to say things a real announcer would: a player's third catch of the drive, a player passing 100 yards, a team answering a score, a lead change, a red zone trip that ends with no points, a kicker's second make. Build it as setups and payoffs, not random extra lines, with a limit so it never talks over every play. Both styles. No model: rules and written lines. Extend `js/announcer/check.js` to replay the default game file and print the full commentary so a person can read the whole broadcast.

## Task C12: the soccer broadcast

`soccer/` is Juan's, so this lives in `js/announcer/soccer/`: a full set of soccer lines in both styles for every kind of soccer result (read the note from Juan's agent on the board for the shape), written the way a British football commentator talks, plus the same memory idea as C11 (a brace, a hat-trick, a late equaliser, a keeper's third save). Post a NOTE to juan with the exact function to call and the script tags to add.

## Task C13: the mix

In `js/audio.js`: one master volume and a mute, a separate level for crowd and for effects, the crowd ducking under the announcer while a line is being spoken, and everything silent when the page is hidden. `FF_AUDIO.setVolume(kind, 0 to 1)`, `FF_AUDIO.mute(true or false)`, remembered in `localStorage`. Post a NOTE to peyton with the calls so she can put a sound control in the game view.

## Task C14: rule explainers and the transcript (with Peyton)

Two things. First, `FF_ANNOUNCER.explain(kind)` returns one or two plain sentences that explain a football rule to someone who has never watched: kinds `first_down`, `downs`, `touchdown`, `extra_point`, `field_goal`, `punt`, `interception`, `fumble`, `sack`, `penalty`, `kickoff`, `halftime`; an unknown kind returns an empty string. `FF_ANNOUNCER.explainKinds` lists them, and `explainFor(res)` returns the kinds a finished play shows. Each explanation fits Peyton's rule card (B21): ask Peyton for the size, and post `NOTE "peyton: ..."` when it is on your branch. Do the same for soccer (`offside`, `corner`, `free_kick`, `penalty_kick`, `yellow`, `red`, `throw_in`, `goal_kick`, `extra_time`) if C8 is done. Second, `FF_ANNOUNCER.transcript()` returns every line said so far in this game as `[ { t, text, kind } ]`, emptied on restart, so the app can offer the broadcast as text. Extend `js/announcer/check.js` for both.

## Task C15: catch-up after a jump (with Peyton)

`FF_GAME.seek(index)` (docs/CONTRACT.md section 2) skips plays silently: the announcer is not asked for lines while it runs. Add `FF_ANNOUNCER.catchUp(results, ctx)`: given the result objects of the skipped plays (the `res` of each `result` event, in order) and the same ctx as `line`, return one or two spoken sentences that sum them up (score change, the biggest play, a turnover if there was one), or '' when nothing happened. Respect `ctx.hidden` exactly like `halftime` (no fantasy points while hidden). Add it to `js/announcer/check.js` with at least five cases, including no skipped plays, a touchdown, a turnover and hidden scores. Post `NOTE "peyton: ..."` with the call so her Watch this play button can speak it after a seek, and `NOTE "boss: ..."` if `js/main.js` should call it itself.

## Task C16: hot and cold (with Ricky)

Ricky's task D24 adds `form` to each player in `data/profiles/<team>.json`: the same tendencies from the last three weeks, next to the season ones. When a play matches a tendency where form is clearly above the season (0.15 or more higher), the announcer may add one short remark that the player has been hot lately; clearly below, cold. Same limits as C6: only real numbers, never null, at most once per player and tendency every 8 plays, only if the line still fits `maxLength`. Ask Ricky for the exact shape with `ASK "ricky: ..."` before you build, and use a fixture in `js/announcer/check.js` until his file is merged.

## Task C17: sound captions (with Peyton)

Every sound the game plays (crowd murmur, swell, roar, groan, whistle, jingles) gets a short caption text, the way television captions show [crowd roars]. Add `FF_AUDIO.captionFor(name)` returning the text or '' for sounds that need none, and fire it through the same `onLine` listeners as the announcer (kind `sound`) so Peyton's captions strip can show it. Respect mute: muted sounds still get captions, since the captions are for people who cannot hear them. Add a check. Post `NOTE "peyton: ..."` with the kind and the texts, for her screen reader pass (B20).


## Task C18: the big call (with Ricky and Peyton)

A game's top plays deserve more than the normal one line. Add `FF_ANNOUNCER.bigCall(res, ctx)`: two or three sentences in the chosen style for a touchdown, a turnover or a gain of 20 or more, naming the player, the distance, what it did to the score, and one fact from the game so far from the announcer's memory. Empty string for an ordinary play. `ctx.hidden` true means no fantasy points. Peyton's "this week in the league" screen (B18) and her share card (B23) can show it as text: post `NOTE "peyton: ..."` with the function and its longest length. Ask Ricky which plays his top plays module (D18) ranks first, so your idea of big and his agree. Add cases to `js/announcer/check.js`.

## Task C19: line audit

A script `js/announcer/audit.js` (run with node) that plays both football game files (`data/games/week11-football.json` and `data/games/sample-football.json`) through the announcer in both styles and reports: every line longer than `maxLength`, every line with `undefined`, `NaN`, `null`, a double space or an empty name, every kind of play that got no line, any line repeated word for word more than three times in one game, and, when `assets/voice/football/index.js` exists, every line the game says that has no recording and every recording no game says. It prints OK or the list, and exits non zero on a problem. Fix what it finds in your files. Post `NOTE "boss: ..."` with the command so it can join the review round.

## Task C20: soccer, same depth as football

Bring the soccer announcer in `js/announcer/soccer/` up to what football has: `SC_ANNOUNCER.explain(kind)` with one or two plain sentences for each soccer rule a newcomer needs (offside, corner, free kick, penalty, yellow and red card, throw in, goal kick, stoppage time, clean sheet for fantasy), `explainKinds` and `explainFor(res)`; `SC_ANNOUNCER.catchUp(results, ctx)` after a jump; and `SC_ANNOUNCER.bigCall(res, ctx)` for goals, red cards and saved penalties. Same argument shapes as the football ones so Juan's soccer app can use them the same way. Read `soccer/js/` to see the result kinds; do not edit it. Add cases to the soccer part of the check. Post `NOTE "juan: ..."` with the functions when done.

## Task C21: the broadcast as a page

`pitch/BROADCAST.md`: the full broadcast of `data/games/week11-football.json`, made by a script of yours (`js/announcer/transcript.js`, run with node) so it can be rebuilt: intro, every play's line with quarter and clock, the tendency and hot and cold lines where they fire, the halftime report, the big calls, the wrap, and the sound captions in brackets. Straight style first, then Fun. One short paragraph on top says honestly what it is: lines written by the team's announcer code from a game built by the engine, real player names, made-up stats. Judges read this instead of listening for two minutes.

## Task C22: sound check without ears

Nobody on the review side can hear the game. Write `js/audio-check.js` (node, no browser) that loads `js/audio.js` against a small fake AudioContext that records every node, gain and start time, plays a whole game's sounds through it, and reports: any gain above 1, voice and crowd at full level at the same time (ducking must lower the crowd while a line plays), anything that starts while muted, two jingles at once, and sounds left running after `crowd_stop` or the final. Prints OK or the list, exits non zero on a problem. Fix what it finds. Post `NOTE "boss: ..."` with the command.

## Task C23: the pre-game show (with Ricky and Peyton)

`FF_ANNOUNCER.preview(matchup, ctx)`: three or four sentences before a game, from what is known before kickoff only: each team's record and standing from `data/league.json` (D16), one hot and one cold player from recent form (D24, in the profiles), and one tendency worth watching. No score, no result, nothing from the game file. Both styles. Returns '' when it has nothing true to say. Peyton's league home can show it under each matchup: post `NOTE "peyton: ..."` with the function and arguments. Ask Ricky if a field you need is missing. Add cases to the check.

## Task C24: Spanish broadcast (with Peyton)

`FF_ANNOUNCER.lang = 'en'` or `'es'`. In Spanish every kind of line (plays, intro, halftime, wrap, catch-up, big call, tendency, hot and cold, rule explainers, sound captions) comes out in natural Spanish, the way a Spanish language football broadcast says it, Straight style at least, with the same variants count as the check asks for in English. Lines live in their own file (`js/announcer/lines-es.js`); ask the boss to load it. The audit (C19) and the check run in both languages. The browser voice uses a Spanish voice when one is installed. Tell Peyton the switch name for B28.

## Task C25: voice render dry run

Rendering spends Noah's ElevenLabs credits, so a person must see the bill first. Add `--dry-run` to `js/announcer/voice/render.js`: with no key and no network it prints every line it would render for the football game the app plays and the soccer sample (after the audit's rules: no repeats rendered twice), the count, the total characters, an estimate of the audio size against the 15 MB limit, and writes the list to `js/announcer/voice/render-list.json` so the real run renders exactly that list. Never call the service in this task. Post `NOTE "boss: ..."` with the numbers so they go under "Waiting for Juan" for Noah to approve.

## Task C26: the spoken recap (with Ricky and Peyton)

After the reveal the announcer reads the story of the game: `FF_ANNOUNCER.recap(story, ctx)` takes Ricky's story data (D30: lead changes, longest drive, biggest swing, best fantasy players, the deciding play) and returns four to six sentences, both styles, that also go to the captions. Fantasy points are allowed here because the reveal has happened; with `ctx.hidden` true it returns ''. Peyton's written story (B27) and your spoken one must agree on the facts: both read the same data, neither invents. Post `NOTE "peyton: ..."` with the call. Add cases to the check.

## Task C27: say it right

The browser voice misreads football text. Add one function every spoken line passes through before `speak` (captions keep the written form): names (`St. Brown`, `Ja'Marr`, initials), downs (`2nd & 10` as "second and ten"), scores (`17-14` as "seventeen to fourteen"), yard lines, clock times, team abbreviations (`GOB`, `PYT`) and decimals in fantasy points. Cover every player on both football rosters and both soccer rosters. A check runs every line the audit produces through it and fails on any leftover symbol or abbreviation a voice would spell out.

## Task C28: test lead

Run every check in the repo (`node js/announcer/audit.js`, `node js/audio-check.js`, `node soccer/check.js`, `node server/test.js`, `sh tools/smoke.sh`, the flow test, everything under `data/checks/`). Walk the football and soccer apps start to finish in headless Chromium at 375 and 1280 wide: opt-in and hidden scores, reveal, recap, sport switch, jump bar, Spanish. You own a new folder `tests/`: put one command there that runs everything (`tests/run-all.sh`) plus new browser tests. Each bug in someone else's files goes as ASK to its owner (peyton, ricky, juan) with file, steps and what you saw. Fix your own lane's bugs. DONE with a pass and fail list.

## Task C29: stadium sound for football

Peyton is rebuilding the football field to look like the soccer stadium (B35). Make the football crowd, whistle and stadium ambience match the soccer broadcast, and make sure lines and captions still fit. Coordinate with peyton by ASK.

## Task C30: soccer voice and captions

Your half of S6: every soccer event speaks and captions the same way football does, in both styles and in Spanish.

## Task C32: soccer seek and hold, and the soccer extras

Boss task S7 is moved to you. For this task you may edit `soccer/js/main.js` and `soccer/index.html`. Add `SC_GAME.seek(index)` and `SC_GAME.hold(true or false)` (with `held`), same meaning as `FF_GAME` in `docs/CONTRACT.md` section 2: seek runs the skipped events at once with listeners still called and no sound, voice, floater or banner, then says `SC_ANNOUNCER.catchUp(...)`; hold stops the clock with the view open. Then attach Peyton's extras on the soccer page as her NOTE says (`FR_EXTRAS.attach({ game: SC_GAME, announcer: SC_ANNOUNCER, stage, isOpen, isMasked })`), so the jump bar, rule cards and share card work for soccer. Check: `node soccer/check.js`, a full soccer match plus seek to the middle and to the end in headless Chromium with no errors, `sh tools/smoke.sh page=soccer/index.html`. NOTE peyton when done.

## Task C33: voice for the second football game

When Ricky's `data/games/week11-tur-owl.json` (D46) is on main, add its lines to the render list, check them with `node js/announcer/audit.js`, and render the new clips on Noah's ElevenLabs account only if Noah approves the credit count in your chat (post the count first). Keep the total under 15 MB.

## Task C34: demo script and shot list, refreshed

`pitch/DEMO-SCRIPT.md` and the video shot list were written before tonight. Update them against main as it is now: the football stadium built from the soccer stadium, soccer inside the same tab bar, every line recorded, one announcer style, no Why this play card. Ask peyton which screens she wants shown. Keep it to two minutes with timings.

## Task C35: sound on a real phone

Phones block sound until a tap, iPhones respect the silent switch for some audio paths, and a backgrounded tab can suspend the AudioContext. Make sure the first tap anywhere unlocks the announcer clips, the crowd and the whistles on both sports, that sound resumes when the tab comes back, and that mute stays muted. Add the cases to `js/audio-check.js` where a fake context can show them, and test in headless Chromium with a phone profile. Write what was not testable without a real iPhone in your DONE.

## Task C36: the second game with the browser voice

`data/games/week11-tur-owl.json` uses the browser voice (C33 dropped). Run the announcer over it: every line fits the captions strip, every Turtles and Owls name and number is said right (your C27 say-it-right check), nothing blank or repeated too often. Change `UNVOICED` in `js/announcer/voice/render.js` however you like as long as `node js/announcer/audit.js` covers this game's lines too.
