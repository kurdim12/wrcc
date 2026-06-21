#!/usr/bin/env python3
"""Standardize raw corpora into 16 kHz mono clips + a manifest (§9.3).

Walks a directory of source recordings, resamples each to 16 kHz mono, windows
into fixed CLIP_SAMPLES (~1.02 s) clips with 50% overlap, writes the clips, and
appends one manifest row per clip:

    path, source, label, recording_id, snr_condition

CRITICAL (§9.4): recording_id groups all clips from one jar/tree/session so the
train/val/test split never leaks a clip from the same recording across splits.

Usage:
    python -m prepare.standardize \
        --in data/raw/aspid/infested --label activity --source aspid \
        --out data/clips --manifest data/manifest.csv
    python -m prepare.standardize \
        --in data/raw/aspid/clean --label clean --source aspid \
        --out data/clips --manifest data/manifest.csv
"""
from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path

import numpy as np

from features.params import SR, CLIP_SAMPLES, HOP


def load_resampled(path: Path) -> np.ndarray:
    import librosa
    y, _ = librosa.load(str(path), sr=SR, mono=True)
    # Peak-normalize for consistent loudness; per-clip mean-var norm happens later.
    peak = np.max(np.abs(y)) or 1.0
    return (y / peak).astype(np.float32)


def window(y: np.ndarray, hop_clips: int):
    """Yield CLIP_SAMPLES windows with `hop_clips` sample stride (50% overlap)."""
    if len(y) < CLIP_SAMPLES:
        yield np.pad(y, (0, CLIP_SAMPLES - len(y)))
        return
    for start in range(0, len(y) - CLIP_SAMPLES + 1, hop_clips):
        yield y[start:start + CLIP_SAMPLES]


def main() -> int:
    ap = argparse.ArgumentParser(description="Standardize corpora -> 16 kHz clips + manifest")
    ap.add_argument("--in", dest="indir", required=True)
    ap.add_argument("--label", required=True, choices=["activity", "clean"])
    ap.add_argument("--source", required=True, help="corpus tag, e.g. aspid / treevibes / own")
    ap.add_argument("--out", default="data/clips")
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--snr", default="silent", help="snr_condition tag for these clips")
    ap.add_argument("--overlap", type=float, default=0.5)
    args = ap.parse_args()

    import soundfile as sf

    outdir = Path(args.out); outdir.mkdir(parents=True, exist_ok=True)
    hop_clips = max(1, int(CLIP_SAMPLES * (1.0 - args.overlap)))
    manifest = Path(args.manifest); manifest.parent.mkdir(parents=True, exist_ok=True)
    new_file = not manifest.exists()

    n = 0
    with manifest.open("a", newline="") as mf:
        w = csv.writer(mf)
        if new_file:
            w.writerow(["path", "source", "label", "recording_id", "snr_condition"])
        exts = {".wav", ".flac", ".ogg", ".mp3", ".m4a"}
        for root, _dirs, files in os.walk(args.indir):
            for fn in sorted(files):
                if Path(fn).suffix.lower() not in exts:
                    continue
                src = Path(root) / fn
                rec_id = f"{args.source}:{src.stem}"           # one recording = one group
                try:
                    y = load_resampled(src)
                except Exception as e:
                    print(f"  skip {src}: {e}")
                    continue
                for i, clip in enumerate(window(y, hop_clips)):
                    cp = outdir / f"{rec_id.replace(':', '_')}_{i:04d}.wav"
                    sf.write(str(cp), clip, SR, subtype="PCM_16")
                    w.writerow([str(cp), args.source, args.label, rec_id, args.snr])
                    n += 1
    print(f"[standardize] wrote {n} clips -> {args.manifest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
