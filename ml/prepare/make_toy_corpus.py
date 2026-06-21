#!/usr/bin/env python3
"""Generate a TINY synthetic corpus to smoke-test the ML pipeline (Tier 2 / Task 5).

⚠️  TOY DATA — NOT REAL RPW, NOT REAL METRICS. These are obviously-synthetic
WAVs whose only purpose is to prove prepare → features → train → export → serve
runs end-to-end. Any number a model trained on this produces is meaningless and
must be labelled TOY. Real corpora (ml/prepare/DATASETS.md) + your own INMP441
clips (§9.10) are the later drop-in.

Writes 16 kHz mono PCM16 WAVs (stdlib `wave`, no deps) into:
    data/raw/toy/activity/*.wav   — tone bursts in the feeding band + clicks + noise
    data/raw/toy/clean/*.wav      — low-level broadband noise only

Run:  python -m prepare.make_toy_corpus
"""
from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path

import random

SR = 16000
DUR_S = 3.0
N_PER_CLASS = 10            # distinct "recordings" per class (grouped split needs >1)


def _write_wav(path: Path, samples):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        frames = b"".join(struct.pack("<h", int(max(-1.0, min(1.0, s)) * 32767)) for s in samples)
        w.writeframes(frames)


def _noise(n, amp):
    return [random.uniform(-amp, amp) for _ in range(n)]


def activity_clip(seed):
    random.seed(seed)
    n = int(SR * DUR_S)
    # Feeding-band tones (1-3.5 kHz) + periodic "click" transients + low noise.
    f1, f2 = random.uniform(1100, 2200), random.uniform(2400, 3500)
    out = _noise(n, 0.02)
    for i in range(n):
        t = i / SR
        out[i] += 0.18 * math.sin(2 * math.pi * f1 * t) + 0.12 * math.sin(2 * math.pi * f2 * t)
    # clicks
    for c in range(int(DUR_S * random.uniform(6, 12))):
        start = random.randint(0, n - 200)
        for k in range(120):
            out[start + k] += 0.5 * math.exp(-k / 25) * math.sin(2 * math.pi * 3000 * k / SR)
    return out


def clean_clip(seed):
    random.seed(seed + 9999)
    n = int(SR * DUR_S)
    return _noise(n, 0.03)


def main():
    base = Path("data/raw/toy")
    for i in range(N_PER_CLASS):
        _write_wav(base / "activity" / f"toy_activity_{i:02d}.wav", activity_clip(i))
        _write_wav(base / "clean" / f"toy_clean_{i:02d}.wav", clean_clip(i))
    print(f"[toy] wrote {N_PER_CLASS} activity + {N_PER_CLASS} clean WAVs under {base}")
    print("[toy] ⚠  TOY DATA — NOT REAL RPW. For pipeline smoke-testing only.")


if __name__ == "__main__":
    main()
