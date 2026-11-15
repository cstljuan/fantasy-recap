#!/usr/bin/env python3
"""Mix the talent's real dialogue under a scene's review video, with the scene's SFX, so a human can judge timing.

usage, from the project root, with out/<SCENE>/<SCENE>_REVIEW_silent.mp4 and out/<SCENE>/<SCENE>_SFX_48k24.wav in place:
  One audio file:  mux_review.py <SCENE> <recFrame0> <seconds> <out.mp4> --wav dialogue.wav [--wav-start-frame 108000]
  Cut from an EDL: mux_review.py <SCENE> <recFrame0> <seconds> <out.mp4> --edl edl.json --audio-dir DIR --audio-pattern "TAKE{take}.WAV"

An EDL is a JSON list of blocks: {"take":2,"wavIn":1335,"wavOut":1589,"recIn":108000,"lufs":-21.5}. wavIn and wavOut are frames into the
source audio, recIn is the record frame, lufs (optional) levels each block to about -24 LUFS for review only. Frames are at 30000/1001.
"""
import argparse
import json
import os
import subprocess

FPS = 30000 / 1001
ap = argparse.ArgumentParser()
ap.add_argument('scene')
ap.add_argument('rec0', type=int)
ap.add_argument('seconds', type=float)
ap.add_argument('name')
ap.add_argument('--wav')
ap.add_argument('--wav-start-frame', type=int, default=None, help='record frame at which the wav starts; default rec0')
ap.add_argument('--edl')
ap.add_argument('--audio-dir', default='.')
ap.add_argument('--audio-pattern', default='{take}.wav')
a = ap.parse_args()

frames = int(round(a.seconds * FPS))
parts = []  # file, seek frames, length frames, offset frames into the scene, gain dB
if a.edl:
    edl = json.load(open(os.path.expanduser(a.edl)))
    edl = edl if isinstance(edl, list) else edl['blocks']
    for b in edl:
        r0, r1 = b['recIn'], b['recIn'] + b['wavOut'] - b['wavIn']
        s, t = max(r0, a.rec0), min(r1, a.rec0 + frames)
        if s < t:
            f = os.path.join(os.path.expanduser(a.audio_dir), a.audio_pattern.format(take=b['take']))
            parts.append((os.path.abspath(f), b['wavIn'] + s - r0, t - s, s - a.rec0, (-24 - b['lufs']) if 'lufs' in b else 0))
elif a.wav:
    start = a.rec0 if a.wav_start_frame is None else a.wav_start_frame
    parts.append((os.path.abspath(os.path.expanduser(a.wav)), a.rec0 - start, frames, 0, 0))

os.chdir(f'out/{a.scene}')
cmd = ['ffmpeg', '-v', 'error', '-y', '-i', f'{a.scene}_REVIEW_silent.mp4', '-i', f'{a.scene}_SFX_48k24.wav']
fc = ''
mix = ''
for k, (f, seek, n, off, g) in enumerate(parts):
    cmd += ['-ss', str(seek / FPS), '-t', str(n / FPS), '-i', f]
    ms = int(off * 1001 / 30)
    fc += f'[{k + 2}:a]aformat=channel_layouts=stereo:sample_rates=48000,volume={g:.1f}dB,adelay={ms}|{ms}[d{k}];'
    mix += f'[d{k}]'
fc += f'[1:a]{mix}amix=inputs={len(parts) + 1}:normalize=0:duration=longest,afade=t=out:st={a.seconds - .2}:d=0.2[a]'
cmd += ['-filter_complex', fc, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-t', str(a.seconds), '-movflags', '+faststart', a.name]
subprocess.run(cmd, check=True)
print(a.name, len(parts), 'dialogue parts')
