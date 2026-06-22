#!/usr/bin/env python3
"""Train the activity-vs-clean classifier (§9.6-§9.9).

Reproducible pipeline: manifest -> grouped split -> features (+augment) -> CNN
-> eval (real metrics on a grouped held-out set) -> SavedModel export.

Run after standardize.py has produced data/manifest.csv:
    pip install -r requirements-train.txt
    python -m train.train --manifest data/manifest.csv --esc50 data/esc50/audio

Honesty (§9.9): every number written to eval_report/ comes from this run on the
held-out test set. Nothing here invents a metric. If you train only on proxy
corpora, the reported numbers ARE the proxy numbers — model_card.md says so.
"""
from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import pandas as pd

from features.params import N_MELS, N_FRAMES, SR, CLIP_SAMPLES
from features.melspec import logmel_patch


# ─── Data loading + grouped split ────────────────────────────────────────────
def load_manifest(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df["y"] = (df["label"] == "activity").astype(int)
    return df


def grouped_split(df: pd.DataFrame, seed=42):
    """Split by recording_id so no clip leaks across splits (§9.4)."""
    from sklearn.model_selection import GroupShuffleSplit
    groups = df["recording_id"].values
    idx = np.arange(len(df))
    gss1 = GroupShuffleSplit(n_splits=1, test_size=0.30, random_state=seed)
    train_i, hold_i = next(gss1.split(idx, df["y"], groups))
    hold = df.iloc[hold_i]
    gss2 = GroupShuffleSplit(n_splits=1, test_size=0.50, random_state=seed)
    val_rel, test_rel = next(gss2.split(hold.index, hold["y"], hold["recording_id"].values))
    return df.iloc[train_i], hold.iloc[val_rel], hold.iloc[test_rel]


# ─── Augmentation (§9.6) ─────────────────────────────────────────────────────
def load_clip(path: str) -> np.ndarray:
    import librosa
    y, _ = librosa.load(path, sr=SR, mono=True)
    if len(y) < CLIP_SAMPLES:
        y = np.pad(y, (0, CLIP_SAMPLES - len(y)))
    return y[:CLIP_SAMPLES].astype(np.float32)


def mix_noise(clip: np.ndarray, noise: np.ndarray, snr_db: float) -> np.ndarray:
    n = noise[:len(clip)] if len(noise) >= len(clip) else np.pad(noise, (0, len(clip) - len(noise)))
    ps, pn = np.mean(clip ** 2) + 1e-9, np.mean(n ** 2) + 1e-9
    g = np.sqrt(ps / (pn * (10 ** (snr_db / 10))))
    return clip + g * n


def spec_augment(patch: np.ndarray, n_freq=2, n_time=2, max_f=6, max_t=5) -> np.ndarray:
    p = patch.copy()
    for _ in range(n_freq):
        f = random.randint(0, max_f); f0 = random.randint(0, max(0, N_MELS - f))
        p[f0:f0 + f, :] = p.mean()
    for _ in range(n_time):
        t = random.randint(0, max_t); t0 = random.randint(0, max(0, N_FRAMES - t))
        p[:, t0:t0 + t] = p.mean()
    return p


def featurize(df: pd.DataFrame, esc50_dir: str | None, augment: bool):
    noises = []
    if esc50_dir and Path(esc50_dir).exists():
        import librosa
        for wav in list(Path(esc50_dir).glob("*.wav"))[:200]:
            try:
                noises.append(librosa.load(str(wav), sr=SR, mono=True)[0])
            except Exception:
                pass
    X, Y = [], []
    for _, r in df.iterrows():
        y = load_clip(r["path"])
        if augment and noises and random.random() < 0.6:
            y = mix_noise(y, random.choice(noises), random.uniform(-5, 20))
        patch = logmel_patch(y)
        if augment and random.random() < 0.5:
            patch = spec_augment(patch)
        X.append(patch[..., None]); Y.append(r["y"])
    return np.asarray(X, "float32"), np.asarray(Y, "float32")


# ─── Train + evaluate ────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--esc50", default=None, help="dir of ESC-50 wavs for noise mixing")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--threshold", type=float, default=0.5, help="fixed operating point (used if --target-precision unset)")
    ap.add_argument("--target-precision", type=float, default=None,
                    help="if set, pick the precision-favoring threshold on VAL achieving this precision "
                         "(overrides --threshold); all reported metrics stay on the held-out TEST set")
    ap.add_argument("--out", default="export/saved_model")
    ap.add_argument("--version", default="cnn-proxy-v1",
                    help="model_version label (use a TOY-* label for toy-data runs)")
    ap.add_argument("--init-from", default=None,
                    help="Load weights from a prior .keras before training, to FINE-TUNE "
                         "a model PRETRAINED on another corpus (e.g. InsectSound1000 -> "
                         "ASPID, per docs/DATASET_SELECTION.md). Architecture must match.")
    args = ap.parse_args()

    import tensorflow as tf
    from train.model import build_model

    tf.keras.utils.set_random_seed(42)   # reproducible split-featurize-train-eval

    df = load_manifest(args.manifest)
    tr, va, te = grouped_split(df)
    print(f"[data] train={len(tr)} val={len(va)} test={len(te)} "
          f"(groups: {df['recording_id'].nunique()})")

    Xtr, Ytr = featurize(tr, args.esc50, augment=True)
    Xva, Yva = featurize(va, args.esc50, augment=False)
    Xte, Yte = featurize(te, None, augment=False)

    # Class weighting for imbalance
    pos = Ytr.sum(); neg = len(Ytr) - pos
    cw = {0: len(Ytr) / (2 * neg + 1e-9), 1: len(Ytr) / (2 * pos + 1e-9)}

    model = build_model()
    if args.init_from:
        # Two-stage transfer: load pretrained weights, then fine-tune here.
        model.load_weights(args.init_from)
        print(f"[train] fine-tuning from pretrained weights: {args.init_from}")
    es = tf.keras.callbacks.EarlyStopping(monitor="val_pr_auc", mode="max",
                                          patience=8, restore_best_weights=True)
    model.fit(Xtr, Ytr, validation_data=(Xva, Yva), epochs=args.epochs,
              batch_size=args.batch, class_weight=cw, callbacks=[es], verbose=2)

    # ── Evaluation on the grouped held-out test set (real numbers only) ──
    from sklearn.metrics import (roc_auc_score, average_precision_score,
                                 confusion_matrix, precision_recall_curve,
                                 precision_recall_fscore_support)

    # Operating point: precision-favoring threshold chosen on VAL (if --target-precision),
    # else the fixed --threshold. All reported metrics stay on the held-out TEST set.
    thr = float(args.threshold)
    thr_note = f"fixed {thr}"
    if args.target_precision is not None and len(set(Yva)) > 1:
        pv = model.predict(Xva, verbose=0).reshape(-1)
        prec_v, _rec_v, cut_v = precision_recall_curve(Yva, pv)
        ok = np.where(prec_v[:-1] >= args.target_precision)[0]   # drop degenerate no-positive tail
        thr = float(cut_v[ok[0]]) if len(ok) else 0.5
        thr_note = (f"precision-favoring: lowest VAL threshold with precision>="
                    f"{args.target_precision} (chosen on val, not test)")

    probs = model.predict(Xte, verbose=0).reshape(-1)
    preds = (probs >= thr).astype(int)
    roc = float(roc_auc_score(Yte, probs)) if len(set(Yte)) > 1 else None
    pr = float(average_precision_score(Yte, probs)) if len(set(Yte)) > 1 else None
    pr_, rc_, f1_, _ = precision_recall_fscore_support(Yte, preds, average="binary",
                                                       zero_division=0)
    cm = confusion_matrix(Yte, preds, labels=[0, 1]).tolist()

    # Per-noise-condition breakdown (support-gated): full metrics, not just ROC-AUC,
    # with n_recordings/n_clips so a low-support row is never mistaken for a stable one.
    per_cond = {}
    te_reset = te.reset_index(drop=True)
    for cond in te_reset["snr_condition"].unique():
        m = (te_reset["snr_condition"] == cond).values
        yc, pc = Yte[m], probs[m]
        row = {"n_recordings": int(te_reset.loc[m, "recording_id"].nunique()),
               "n_clips": int(m.sum())}
        if len(set(yc)) > 1:
            dc = (pc >= thr).astype(int)
            p2, r2, f2, _ = precision_recall_fscore_support(yc, dc, average="binary", zero_division=0)
            row.update(roc_auc=float(roc_auc_score(yc, pc)),
                       pr_auc=float(average_precision_score(yc, pc)),
                       precision=float(p2), recall=float(r2), f1=float(f2))
        per_cond[str(cond)] = row

    is_toy = "toy" in args.version.lower()
    rep = Path("eval_report"); rep.mkdir(exist_ok=True)
    metrics = {
        "model_version": args.version,
        "n_test": int(len(Yte)), "threshold": thr, "threshold_selection": thr_note,
        "target_precision": args.target_precision,
        "roc_auc": roc, "pr_auc": pr,
        "precision": float(pr_), "recall": float(rc_), "f1": float(f1_),
        "confusion_matrix": cm, "per_condition": per_cond,
        "note": ("TOY DATA — NOT REAL METRICS. Synthetic smoke-test of the "
                 "pipeline only; these numbers are meaningless." if is_toy else
                 "Proxy-validated metrics (§2/§9.2): trained largely on proxy "
                 "boring/feeding corpora, not real airborne RPW. Label as proxy."),
    }
    (rep / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("[eval]", json.dumps(metrics, indent=2))

    # Export both formats (Keras 3): native .keras for serving (full model,
    # supports .predict) + a SavedModel dir for TFLite int8 conversion.
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    keras_path = out.parent / "model.keras"
    model.save(str(keras_path))          # native Keras (served by ml/serve)
    model.export(str(out))               # SavedModel dir (for export_tflite.py)
    Path("export/model_version.txt").write_text(args.version)
    print(f"[export] saved -> {keras_path} (serve) + {out} (SavedModel for TFLite)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
