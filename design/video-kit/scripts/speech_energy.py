#!/usr/bin/env python3
"""Print speech energy per frame so a landing can be set on the talent's real speech, not on a words file.

usage: speech_energy.py <recA> <recB> --wav dialogue.wav [--wav-start-frame 108000] [--words words.json]
       speech_energy.py <recA> <recB> --edl edl.json --audio-dir DIR --audio-pattern "TAKE{take}.WAV" [--words words.json]

Output is one row per 10 frames, in dB. An onset is the frame where the row jumps by 15 dB or more above the room level.
words.json is a list of {"rec": frame, "w": "word"}. Words files were off by up to 18 frames on the first job, and once had the wrong word order.
Needs numpy and ffmpeg. Frames are at 30000/1001.
"""
import argparse
import json
import os
import subprocess

import numpy as np

FPS = 30000 / 1001
SP = 48000 / FPS
ap = argparse.ArgumentParser()
ap.add_argument('A', type=int)
ap.add_argument('B', type=int)
ap.add_argument('--wav')
ap.add_argument('--wav-start-frame', type=int, default=None)
ap.add_argument('--edl')
ap.add_argument('--audio-dir', default='.')
ap.add_argument('--audio-pattern', default='{take}.wav')
ap.add_argument('--words')
a = ap.parse_args()


def read(path, start_frame, n):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start_frame / FPS), '-t', str(n / FPS), '-i', path, '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype='<f4')


env = np.full(a.B - a.A, -90.0)


def fill(x, offset, n):
    for i in range(n):
        q = x[int(i * SP):int((i + 1) * SP)]
        env[offset + i] = 20 * np.log10(np.sqrt((q ** 2).mean()) + 1e-9) if len(q) else -90


if a.edl:
    edl = json.load(open(os.path.expanduser(a.edl)))
    edl = edl if isinstance(edl, list) else edl['blocks']
    for b in edl:
        n = b['wavOut'] - b['wavIn']
        s, t = max(a.A, b['recIn']), min(a.B, b['recIn'] + n)
        if s < t:
            path = os.path.join(os.path.expanduser(a.audio_dir), a.audio_pattern.format(take=b['take']))
            fill(read(path, b['wavIn'] + s - b['recIn'], t - s), s - a.A, t - s)
else:
    start = a.A if a.wav_start_frame is None else a.wav_start_frame
    fill(read(os.path.expanduser(a.wav), a.A - start, a.B - a.A), 0, a.B - a.A)

if a.words:
    words = json.load(open(os.path.expanduser(a.words)))
    print('words (file timing, verify against the energy):', ' '.join(f"{w['w']}@{w['rec']}" for w in words if a.A - 10 <= w['rec'] < a.B))
line = ''
for i, v in enumerate(env):
    if i % 10 == 0:
        line += f'\n{a.A + i}: '
    line += '%4d' % v
print(line)
