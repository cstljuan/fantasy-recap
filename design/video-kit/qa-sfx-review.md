# QA, SFX and the review mux

## QA, in order

1. **Stills at the moments that matter.** Every reveal, every landing, the settled frame.
2. **Compare with the reference side by side** and fix what is off.
3. **Spelling, character by character,** against the client's document.
4. **One video render, then a QA sheet:** `tools/qa_sheet.sh out/ID/ID_REVIEW_silent.mp4 out/ID/qa.jpg`, a 9 frame sheet across the motion. To target exact frames: `QA_FRAMES="6 14 25 32 40 55 62 71 106" tools/qa_sheet.sh in.mp4 out.jpg`. Look at it for ghosts, gaps, cut-off glows and unreadable text.
5. **Safe areas:** 5 percent inset, bottom 20 percent caption band, no must-read text below about 34 px on the grid. A clearance check on the 1920 grid: number baseline at least 66 px above a banner's top edge, counting the extrude.
6. **Timing:** every landing against `tools/speech_energy.py`.
7. **On the timeline, after placement:** export frames at every join and look at them. Identical sized stills mean the offline slate.

The main session reads each agent's QA sheet before the owner sees anything, and sends back faults. That caught the dark patches the owner had already rejected.

## Reading speech energy

```
tools/speech_energy.py 125842 125960 --wav dialogue.wav --wav-start-frame 108000
```

Prints dB per frame, 10 frames to a row. An onset is where the row jumps 15 dB or more above the room level. Long words and words after pauses are where a words file is usually wrong. Spring start is about 0.17 s before the visual hit, so set `at = onset - 0.17`.

## SFX

`shots/<ID>.js` must be exactly:

```js
window.SHOTS = Object.assign(window.SHOTS || {}, { <ID>: { duration: D, at: [t1, t2] } });
```

Then `tools/sfx_shot.py <ID> out/<ID>/<ID>_SFX_48k24.wav`. For each landing it makes an air pass of filtered noise that swells into the hit and pans across the sequence, plus a soft low thump and a small tick. The last one gets a two-note chime unless `--no-chime`. 48 kHz, 24-bit stereo, peak capped at about -7.5 dBFS. Everything is synthesized, so there are no licensing questions and no credits.

**It has never been auditioned by an agent.** Checks are level only. On the job the SFX sat on their own track (A3), for the owner to judge. A disclosure gets no SFX.

## Review mux

The owner judges a graphic with the talent's voice under it, never silent:

```
tools/mux_review.py ID <recFrame0> <duration> Client_ID_name_v1_REVIEW_1080p.mp4 --wav dialogue.wav --wav-start-frame 108000
tools/mux_review.py ID <recFrame0> <duration> Client_ID_name_v1_REVIEW_1080p.mp4 --edl edl.json --audio-dir AUDIO --audio-pattern "TAKE{take}.WAV"
```

Each EDL block is levelled to about -24 LUFS for review only. Never use a review's audio as a mix. After a recut, point `--edl` at the new EDL, or the voice will be wrong under the picture.

Report: scene file, review path, recFrame0, duration, what could not be matched, anything unfinished, and "not heard" for sound.
