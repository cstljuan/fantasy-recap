#!/usr/bin/env python3
"""Subtle synthesized SFX for a graphic: an air pass into each landing, a soft thump and tick on it, a two-note chime on the last.
48 kHz, 24-bit stereo, peak capped at about -7.5 dBFS. Needs numpy.

usage (from the project root): sfx_shot.py <ID> <out.wav> [--no-chime]
Reads shots/<ID>.js, which must contain exactly:
  window.SHOTS = Object.assign(window.SHOTS || {}, { <ID>: { duration: D, at: [t1, t2] } });
at[] holds the spring start of each landing. The hit lands about 0.17 s later, which matches the sprite springs.

This was never auditioned by an agent. It only prints peak level. A human must listen before delivery.
"""
import re
import sys
import wave

import numpy as np

sid, out = sys.argv[1], sys.argv[2]
chime = '--no-chime' not in sys.argv
src = open(f'shots/{sid}.js').read()
m = re.search(sid + r':\s*\{\s*duration:\s*([\d.]+),\s*at:\s*\[([^\]]+)\]', src)
dur = float(m[1])
at = [float(x) for x in m[2].split(',')]

sr = 48000
n = int(dur * sr)
L = np.zeros(n)
R = np.zeros(n)
rng = np.random.default_rng(11)


def put(buf, i, s):
    i = max(i, 0)
    e = min(n, i + len(s))
    if e > i:
        buf[i:e] += s[:e - i]


for k, a in enumerate(at):
    land = a + .17
    # Air pass: filtered noise that swells into the hit and pans across the sequence.
    m2 = int(.20 * sr)
    nz = np.convolve(rng.normal(0, 1, m2), np.ones(40) / 40, 'same')
    nz -= np.convolve(nz, np.ones(400) / 400, 'same')
    s = nz * np.linspace(0, 1, m2) ** 2.2 * .10
    pan = -.5 + k / max(len(at) - 1, 1)
    put(L, int((land - .20) * sr), s * (1 - pan * .6))
    put(R, int((land - .20) * sr), s * (1 + pan * .6))
    # Thump plus tick.
    m3 = int(.14 * sr)
    x = np.arange(m3) / sr
    th = .10 * np.sin(2 * np.pi * (120 - 180 * x) * x) * np.exp(-x * 34) + .028 * np.sin(2 * np.pi * 2300 * x) * np.exp(-x * 300)
    put(L, int(land * sr), th)
    put(R, int(land * sr), th)


def bell(t0, f, a):
    i = int(t0 * sr)
    if i >= n:
        return
    x = np.arange(n - i) / sr
    s = a * (np.sin(2 * np.pi * f * x) + .42 * np.sin(2 * np.pi * f * 2 * x) * np.exp(-x * 5) + .18 * np.sin(2 * np.pi * f * 3.01 * x) * np.exp(-x * 8)) * np.exp(-x * 3.3) * (1 - np.exp(-x * 420))
    L[i:] += s
    R[i:] += s


if chime:
    last = at[-1] + .17
    bell(last + .02, 1318.5, .075)
    bell(last + .18, 1760, .085)

x = np.stack([L, R], 1)
pk = np.abs(x).max()
x = x * (.42 / pk if pk > .42 else 1)
print(sid, 'peak dBFS', round(20 * np.log10(np.abs(x).max() + 1e-9), 1))
b = (x * (2 ** 31 - 1)).astype('<i4').tobytes()
o = b''.join(b[i + 1:i + 4] for i in range(0, len(b), 4))
w = wave.open(out, 'wb')
w.setnchannels(2)
w.setsampwidth(3)
w.setframerate(sr)
w.writeframes(o)
w.close()
