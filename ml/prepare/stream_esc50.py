#!/usr/bin/env python3
"""Stream ESC-50 -> cached 40x32 log-mel features (no-download WEAK proxy path).

`dataset.md` path: train an insect(flying)-vs-non-insect classifier on ESC-50
WITHOUT a bulk local corpus. Streams `ashraq/esc50` from the Hugging Face Hub,
computes the firmware-matched 40x32 log-mel patch (features.melspec.logmel_patch
— the FIRST ~1.02 s of each 5 s clip) on the fly, and caches a tiny
`data/esc50_features.npz` (X, y, groups=fold). Audio is never persisted.

⚠️ HONESTY (read before quoting any number it produces). ESC-50's only insect
class is FLYING insects (wingbeats, 40 clips total) — acoustically nothing like
RPW larvae chewing INSIDE a trunk. So this is a deliberately WEAK proxy
("insect vs non-insect"), to be reported as a PROXY metric and NEVER as
"RPW accuracy" or activity-vs-clean. ESC-50 is CC BY-NC (non-commercial;
demo/research only): the cached features are gitignored and the audio is never
republished or presented as commercial validation.

Label:  y=1 if 'insect' in `category` (the ESC-50 'insects' class), else y=0.
Negatives are downsampled to --neg-per-pos per positive (seeded) to keep the
cache small and the base rate sane. Group key = ESC-50 'fold' (1..5); ESC-50's
official folds keep one source recording within a single fold, so a split by
fold downstream is leak-safe (§9.4).

Sources: HF streaming by default; falls back to the local ESC-50 clone at
--local (default data/raw/esc50) when streaming is unavailable, or force either
with --source {hf,local}. Run --inspect FIRST: it prints one example's schema
and exits; STOP and adjust field names if audio/category/fold are absent
(dataset.md rule 5).

Run from inside ml/ (so `features` imports):
    python -m prepare.stream_esc50 --inspect
    python -m prepare.stream_esc50
"""
from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np

from features.params import SR
from features.melspec import logmel_patch


def is_positive(category) -> int:
    """ESC-50 'insects' (flying) -> 1; everything else -> 0."""
    return int("insect" in str(category).lower())


def iter_hf(hf_id: str, split: str):
    """Yield (waveform float32 @SR, category, fold) by streaming from the Hub."""
    from datasets import Audio, load_dataset
    ds = load_dataset(hf_id, split=split, streaming=True).cast_column(
        "audio", Audio(sampling_rate=SR))
    for ex in ds:
        yield (np.asarray(ex["audio"]["array"], dtype=np.float32),
               ex.get("category"), int(ex.get("fold", 0)))


def iter_local(root: Path):
    """Yield (waveform float32 @SR, category, fold) from a local ESC-50 clone."""
    import librosa
    meta = root / "meta" / "esc50.csv"
    audio = root / "audio"
    for r in csv.DictReader(meta.open(newline="")):
        wav, _ = librosa.load(str(audio / r["filename"]), sr=SR, mono=True)
        yield (wav.astype(np.float32), r.get("category"), int(r.get("fold", 0)))


def iter_auto(args):
    """HF streaming, transparently falling back to the local clone on failure.

    `load_dataset(streaming=True)` often defers errors to the first iteration, so
    the fallback is triggered by trying to pull the first example, not at build.
    """
    try:
        gen = iter_hf(args.hf_id, args.split)
        first = next(gen)
    except Exception as e:  # network / dataset moved / schema / lib version
        print(f"[stream] HF streaming unavailable ({e}); using local clone {args.local}")
        yield from iter_local(Path(args.local))
        return
    yield first
    yield from gen


def source_iter(args):
    if args.source == "local":
        return iter_local(Path(args.local))
    if args.source == "hf":
        return iter_hf(args.hf_id, args.split)
    return iter_auto(args)


def inspect(args) -> int:
    """Print one example's schema and exit (STOP if expected fields are absent)."""
    if args.source in ("auto", "hf"):
        try:
            from datasets import Audio, load_dataset
            ds = load_dataset(args.hf_id, split=args.split, streaming=True).cast_column(
                "audio", Audio(sampling_rate=SR))
            ex = next(iter(ds))
            print(f"[stream] HF {args.hf_id} split={args.split} — one example:")
            print("   fields:", {k: type(v).__name__ for k, v in ex.items()})
            print(f"   category={ex.get('category')!r} fold={ex.get('fold')} "
                  f"label={is_positive(ex.get('category'))}")
            missing = {"audio", "category", "fold"} - set(ex.keys())
            print(f"[stream] ⚠️ missing fields {missing} — STOP and adjust (dataset.md rule 5)"
                  if missing else "[stream] ok — audio/category/fold present")
            return 0
        except Exception as e:
            print(f"[stream] HF inspect failed ({e}); inspecting local clone instead")
    meta = Path(args.local) / "meta" / "esc50.csv"
    rows = list(csv.DictReader(meta.open(newline="")))
    if not rows:
        print(f"[stream] {meta} empty/missing — STOP"); return 1
    print(f"[stream] local {meta}: {len(rows)} rows; columns={list(rows[0].keys())}")
    print(f"   first row category={rows[0].get('category')!r} fold={rows[0].get('fold')}")
    missing = {"filename", "category", "fold"} - set(rows[0].keys())
    print(f"[stream] ⚠️ missing columns {missing} — STOP and adjust (dataset.md rule 5)"
          if missing else "[stream] ok — filename/category/fold present")
    return 1 if missing else 0


def build(args) -> int:
    X, y, groups, npos = [], [], [], 0
    for wav, cat, fold in source_iter(args):
        X.append(logmel_patch(wav))
        lab = is_positive(cat)
        y.append(lab); groups.append(int(fold)); npos += lab
    n = len(y)
    if n == 0:
        print("[stream] no examples read — STOP (source unavailable?)"); return 1
    X = np.asarray(X, np.float32); y = np.asarray(y, np.int32); groups = np.asarray(groups, np.int32)
    print(f"[stream] read {n} clips ({npos} positive, {n - npos} negative) "
          f"across folds {sorted(set(groups.tolist()))}")
    if npos == 0:
        print("[stream] ⚠️ 0 positive (insect) clips — STOP (label/field mismatch?)"); return 1

    # Downsample negatives to NEG_PER_POS per positive (seeded -> reproducible).
    rng = np.random.default_rng(args.seed)
    neg = np.where(y == 0)[0]
    keep_neg = rng.choice(neg, size=min(len(neg), args.neg_per_pos * npos), replace=False)
    keep = np.concatenate([np.where(y == 1)[0], keep_neg]); keep.sort()
    Xk, yk, gk = X[keep], y[keep], groups[keep]

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    np.savez(out, X=Xk, y=yk, groups=gk)
    print(f"[stream] cached {keep.size} clips ({int(yk.sum())} positive) -> {out}")
    for fo in sorted(set(gk.tolist())):    # per-fold support -> model-card tiny-n caveat
        m = gk == fo
        print(f"   fold {fo}: n={int(m.sum()):4d}  pos={int(yk[m].sum()):3d}  neg={int((yk[m] == 0).sum()):3d}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="Stream ESC-50 -> cached 40x32 log-mel features (weak proxy)")
    ap.add_argument("--hf-id", default="ashraq/esc50")
    ap.add_argument("--split", default="train")
    ap.add_argument("--local", default="data/raw/esc50", help="local ESC-50 clone (fallback / --source local)")
    ap.add_argument("--source", choices=("auto", "hf", "local"), default="auto")
    ap.add_argument("--neg-per-pos", type=int, default=3)
    ap.add_argument("--out", default="data/esc50_features.npz")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--inspect", action="store_true", help="print one example's schema and exit")
    args = ap.parse_args()
    return inspect(args) if args.inspect else build(args)


if __name__ == "__main__":
    raise SystemExit(main())
