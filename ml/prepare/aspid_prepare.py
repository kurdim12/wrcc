#!/usr/bin/env python3
"""ASPID / SPIDB adapter — metadata-driven ingest (not folder-driven).

ASPID ships as a flat set of WAVs + `aspids_log.csv`; the activity/clean label
and the noise condition live in CSV columns, NOT in the folder tree. This turns
that CSV into the repo's standard 16 kHz clip + manifest format (reusing
prepare/standardize.py's resample/window), grouped by source file so the
train/val/test split never leaks (§9.4).

Label policy (3 explicit buckets — no silent fall-through):
  clean     = target matches --clean-match            (e.g. "No Insects")
  clean|DROP = target matches a --negative-targets sub (non-insect distractors
              such as "Talking"/"Sweep") → folded into clean as HARD NEGATIVES
              by default (--negative-policy clean, precision-favoring: a loud
              non-insect sound must NOT read as activity) or dropped (drop)
  activity  = everything else (the insect-present recordings)

⚠️ The exact column names AND the target vocabulary depend on YOUR download.
Run --inspect FIRST: it now prints, per unique target value, how the CURRENT
settings would label it — so a stray "Talking → activity" is impossible to miss.
Adjust --clean-match / --negative-targets to the real header before ingesting.

Usage:
  python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv --inspect
  python -m prepare.aspid_prepare --log data/raw/aspid/aspids_log.csv \
      --root data/raw/aspid --file-col filename --target-col target \
      --noise-col noise --clean-match "No Insects" \
      --negative-targets "talking,sweep" --negative-policy clean \
      --manifest data/manifest_aspid.csv
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


def classify(target, clean_lc, neg_subs, neg_policy):
    """Map a raw target value to 'clean' | 'activity' | None (None => drop).

    Order matters: an explicit clean control wins, then non-insect distractors,
    then everything remaining is treated as insect activity.
    """
    t = str(target or "").lower()
    if clean_lc and clean_lc in t:
        return "clean"
    if any(sub and sub in t for sub in neg_subs):
        return "clean" if neg_policy == "clean" else None
    return "activity"


def resolve(root: Path, name: str) -> Path | None:
    for cand in (root / name, root / f"{name}.wav", *root.rglob(Path(name).name)):
        if cand.is_file():
            return cand
    return None


def inspect(rows, log, target_col, noise_col, clean_lc, neg_subs, neg_policy):
    if not rows:
        print(f"[aspid] {log} is empty"); return
    print(f"[aspid] {log}: {len(rows)} rows")
    print(f"[aspid] columns: {list(rows[0].keys())}")
    print("[aspid] first 3 rows:")
    for r in rows[:3]:
        print("   ", {k: r[k] for k in list(r)[:8]})
    # The honest bit: show how EVERY distinct target maps under current settings.
    if rows[0].get(target_col) is not None:
        counts = Counter(r.get(target_col) for r in rows)
        print(f"[aspid] target → label under current settings "
              f"(clean-match={clean_lc!r}, negative-targets={neg_subs}, policy={neg_policy}):")
        for val, n in counts.most_common():
            lbl = classify(val, clean_lc, neg_subs, neg_policy)
            print(f"     {str(val)[:34]:34} n={n:<6} -> {lbl or 'DROP'}")
        # Loud warning if any non-insect-looking target is about to become activity.
        suspicious = [v for v in counts if classify(v, clean_lc, neg_subs, neg_policy) == "activity"
                      and re.search(r"talk|sweep|silen|noise|background|footstep|voice|speech", str(v), re.I)]
        if suspicious:
            print(f"[aspid] ⚠️  these look NON-insect but map to 'activity' — add to --negative-targets: {suspicious}")
    else:
        print(f"[aspid] (no '{target_col}' column — set --target-col to the real header)")
    if rows[0].get(noise_col) is not None:
        print(f"[aspid] unique '{noise_col}': {dict(Counter(r.get(noise_col) for r in rows))}")


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
    ap.add_argument("--negative-targets", default="talking,sweep",
                    help="comma-sep substrings in target marking NON-INSECT distractors (e.g. talking,sweep)")
    ap.add_argument("--negative-policy", choices=("clean", "drop"), default="clean",
                    help="treat --negative-targets as hard-negative 'clean' (default, precision-favoring) or drop them")
    ap.add_argument("--start-col", default=None, help="optional segment start (seconds) column")
    ap.add_argument("--end-col", default=None, help="optional segment end (seconds) column")
    ap.add_argument("--overlap", type=float, default=0.5)
    ap.add_argument("--limit", type=int, default=0, help="process at most N rows (testing)")
    ap.add_argument("--inspect", action="store_true", help="print header + per-target label mapping, then exit")
    args = ap.parse_args()

    clean_lc = args.clean_match.lower()
    neg_subs = [s.strip().lower() for s in args.negative_targets.split(",") if s.strip()]

    log = Path(args.log)
    root = Path(args.root) if args.root else log.parent
    with log.open(newline="") as f:
        rows = list(csv.DictReader(f))
    if args.inspect:
        inspect(rows, log, args.target_col, args.noise_col, clean_lc, neg_subs, args.negative_policy)
        return 0

    import soundfile as sf
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    hop = max(1, int(CLIP_SAMPLES * (1.0 - args.overlap)))
    man = Path(args.manifest); man.parent.mkdir(parents=True, exist_ok=True)
    new = not man.exists()

    n_clips = 0; n_act = 0; n_clean = 0; n_drop = 0; missing = 0
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
            label = classify(row.get(args.target_col), clean_lc, neg_subs, args.negative_policy)
            if label is None:           # non-insect distractor, --negative-policy drop
                n_drop += 1; continue
            src = resolve(root, name)
            if src is None:
                missing += 1; continue
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

    print(f"[aspid] {n_clips} clips → {args.manifest}  "
          f"(activity files {n_act}, clean files {n_clean}, dropped {n_drop}, missing {missing})")
    if missing:
        print(f"[aspid] {missing} files unresolved — check --file-col / --root (run --inspect to see the header).")
    if n_drop:
        print(f"[aspid] {n_drop} rows dropped as non-insect distractors (--negative-policy drop).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
