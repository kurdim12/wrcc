#!/usr/bin/env python3
"""ASPID / SPIDB adapter — metadata-driven ingest (not folder-driven).

ASPID ships as a flat set of WAVs + `aspids_log.csv`; the activity/clean label
and the noise condition live in CSV columns, NOT in the folder tree. This turns
that CSV into the repo's standard 16 kHz clip + manifest format (reusing
prepare/standardize.py's resample/window), grouped by source file so the
train/val/test split never leaks (§9.4).

  label  = clean  if the target column matches --clean-match  else activity
  snr    = the noise column (Silence, Helicopter, Footsteps, …) → snr_condition

⚠️ The exact column names depend on YOUR download. Run --inspect FIRST and set
--file-col/--target-col/--noise-col to match the real header — don't assume.

Usage:
  python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv --inspect
  python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv \
      --root data/raw/aspid --file-col filename --target-col target \
      --noise-col noise --clean-match "No Insects" --manifest data/manifest_aspid.csv
"""
from __future__ import annotations

import argparse
import csv
import re
from collections import Counter
from pathlib import Path

from features.params import SR, CLIP_SAMPLES
from prepare.standardize import load_resampled, window   # reuse the proven path

slug = lambda s: re.sub(r"[^a-z0-9]+", "_", str(s).strip().lower()).strip("_") or "unknown"


def resolve(root: Path, name: str) -> Path | None:
    for cand in (root / name, root / f"{name}.wav", *root.rglob(Path(name).name)):
        if cand.is_file():
            return cand
    return None


def inspect(rows, log):
    if not rows:
        print(f"[aspid] {log} is empty"); return
    print(f"[aspid] {log}: {len(rows)} rows")
    print(f"[aspid] columns: {list(rows[0].keys())}")
    print("[aspid] first 3 rows:")
    for r in rows[:3]:
        print("   ", {k: r[k] for k in list(r)[:8]})
    for col in ("target", "noise"):
        if rows[0].get(col) is not None:
            print(f"[aspid] unique '{col}': {dict(Counter(r.get(col) for r in rows))}")


def main() -> int:
    ap = argparse.ArgumentParser(description="ASPID metadata → 16 kHz clips + manifest")
    ap.add_argument("--log", default="data/raw/aspid/aspids_log.csv")
    ap.add_argument("--root", default=None, help="dir holding the wavs (default: log's dir)")
    ap.add_argument("--out", default="data/clips")
    ap.add_argument("--manifest", default="data/manifest_aspid.csv")
    ap.add_argument("--file-col", default="filename")
    ap.add_argument("--target-col", default="target")
    ap.add_argument("--noise-col", default="noise")
    ap.add_argument("--clean-match", default="No Insects", help="substring in target marking a CLEAN control")
    ap.add_argument("--start-col", default=None, help="optional segment start (seconds) column")
    ap.add_argument("--end-col", default=None, help="optional segment end (seconds) column")
    ap.add_argument("--overlap", type=float, default=0.5)
    ap.add_argument("--limit", type=int, default=0, help="process at most N rows (testing)")
    ap.add_argument("--inspect", action="store_true", help="print header + label/noise distribution, then exit")
    args = ap.parse_args()

    log = Path(args.log)
    root = Path(args.root) if args.root else log.parent
    with log.open(newline="") as f:
        rows = list(csv.DictReader(f))
    if args.inspect:
        inspect(rows, log); return 0

    import soundfile as sf
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    hop = max(1, int(CLIP_SAMPLES * (1.0 - args.overlap)))
    man = Path(args.manifest); man.parent.mkdir(parents=True, exist_ok=True)
    new = not man.exists()

    clean_lc = args.clean_match.lower()
    n_clips = 0; n_act = 0; n_clean = 0; missing = 0
    if args.limit:
        rows = rows[: args.limit]

    with man.open("a", newline="") as mf:
        w = csv.writer(mf)
        if new:
            w.writerow(["path", "source", "label", "recording_id", "snr_condition"])
        for i, row in enumerate(rows):
            name = row.get(args.file_col)
            if not name:
                continue
            src = resolve(root, name)
            if src is None:
                missing += 1; continue
            label = "clean" if clean_lc in str(row.get(args.target_col, "")).lower() else "activity"
            snr = slug(row.get(args.noise_col, "unknown"))
            try:
                y = load_resampled(src)
            except Exception as e:
                print(f"  skip {src.name}: {e}"); continue
            if args.start_col and args.end_col and row.get(args.start_col) and row.get(args.end_col):
                a = int(float(row[args.start_col]) * SR); b = int(float(row[args.end_col]) * SR)
                if 0 <= a < b <= len(y):
                    y = y[a:b]
            rec = f"aspid:{src.stem}"     # group by source file — no split leakage
            for j, clip in enumerate(window(y, hop)):
                cp = out / f"{rec.replace(':', '_')}_{i:05d}_{j:03d}.wav"
                sf.write(str(cp), clip, SR, subtype="PCM_16")
                w.writerow([str(cp), "aspid", label, rec, snr])
                n_clips += 1
            n_act += label == "activity"; n_clean += label == "clean"

    print(f"[aspid] {n_clips} clips → {args.manifest}  (activity files {n_act}, clean files {n_clean}, missing {missing})")
    if missing:
        print(f"[aspid] {missing} files unresolved — check --file-col / --root (run --inspect to see the header).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
