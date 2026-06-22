#!/usr/bin/env python3
"""Grouped K-fold CV for the ASPID activity-vs-clean proxy — a STABLE metric on few groups.

A single grouped train/test split of this ASPID subset leaves only ~5 test
recordings, so its test ROC-AUC swings wildly with the training seed (observed
0.26 vs 0.85 on two runs of the same split). That is noise, not signal. Grouped
K-fold CV instead evaluates EVERY recording out-of-fold exactly once and pools the
predictions, giving one estimate over all recordings / clips, plus per-fold
variance so the (small-group) uncertainty stays visible. A final model is then
trained on ALL data and exported for serving.

Features are the clean firmware-matched 40x32 log-mel patches. ESC-50 noise
augmentation is intentionally OFF here: this measures the activity-vs-clean signal
itself (the ASPID recordings are all the 'silence' condition). Honesty (§9.9):
every number comes from held-out predictions; nothing is invented.

    python -m train.train_cv --manifest data/manifest_aspid.csv --version cnn-aspid-v1
"""
from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

import numpy as np

from train.model import build_model
from train.train import featurize, load_manifest


def select_threshold(y, p, target):
    """Lowest threshold whose precision >= target (degenerate tail dropped); 0.5 if none."""
    from sklearn.metrics import precision_recall_curve
    prec, _rec, cut = precision_recall_curve(y, p)
    ok = np.where(prec[:-1] >= target)[0]
    return float(cut[ok[0]]) if len(ok) else 0.5


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", default="data/manifest_aspid.csv")
    ap.add_argument("--version", default="cnn-aspid-v1")
    ap.add_argument("--folds", type=int, default=5)
    ap.add_argument("--epochs", type=int, default=15)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--target-precision", type=float, default=0.80)
    args = ap.parse_args()

    import tensorflow as tf
    from sklearn.metrics import (average_precision_score, confusion_matrix,
                                 precision_recall_fscore_support, roc_auc_score)
    from sklearn.model_selection import GroupKFold
    tf.keras.utils.set_random_seed(42)

    df = load_manifest(args.manifest).reset_index(drop=True)
    groups = df["recording_id"].values
    n_groups = df["recording_id"].nunique()
    print(f"[cv] {len(df)} clips, {n_groups} groups, "
          f"{int(df['y'].sum())} activity / {int((df['y'] == 0).sum())} clean")

    # Featurize all clips ONCE (clean, no aug); reused across folds + final model.
    X, Y = featurize(df, None, augment=False)
    print(f"[cv] featurized {len(X)} clips")

    gkf = GroupKFold(n_splits=args.folds)
    oof = np.full(len(df), np.nan)
    fold_auc = []
    for k, (tr_i, te_i) in enumerate(gkf.split(X, Y, groups)):
        pos = Y[tr_i].sum(); neg = len(tr_i) - pos
        cw = {0: len(tr_i) / (2 * neg + 1e-9), 1: len(tr_i) / (2 * pos + 1e-9)}
        m = build_model()
        m.fit(X[tr_i], Y[tr_i], epochs=args.epochs, batch_size=args.batch,
              class_weight=cw, verbose=0)
        p = m.predict(X[te_i], verbose=0).reshape(-1)
        oof[te_i] = p
        a = float(roc_auc_score(Y[te_i], p)) if len(set(Y[te_i])) > 1 else float("nan")
        fold_auc.append(a)
        print(f"[cv] fold {k}: test_groups={len(set(groups[te_i]))} clips={len(te_i)} roc_auc={a:.3f}")

    # Pooled out-of-fold metrics — every recording evaluated exactly once.
    roc = float(roc_auc_score(Y, oof))
    pr = float(average_precision_score(Y, oof))
    thr = select_threshold(Y, oof, args.target_precision)
    preds = (oof >= thr).astype(int)
    p2, r2, f2, _ = precision_recall_fscore_support(Y, preds, average="binary", zero_division=0)
    cm = confusion_matrix(Y, preds, labels=[0, 1]).tolist()
    clean_auc = [a for a in fold_auc if a == a]

    metrics = {
        "model_version": args.version,
        "eval": f"grouped {args.folds}-fold CV, pooled out-of-fold over all {n_groups} recordings",
        "proxy": True, "field_validated": False,
        "source": ("ASPID raw export (interval-aligned, channel Ch0, 'silence' condition) — activity vs "
                   "clean; MIT. Positives = stored-product insect larvae (Tenebrio/Tribolium/"
                   "Callosobruchus) chewing/feeding; negatives = No-Insects controls. PROXY for RPW "
                   "boring/feeding; NOT RPW and NOT field-validated."),
        "feature": "40x32 HTK log-mel, firmware-matched (features/melspec.py); no ESC-50 noise aug in this estimate",
        "n_clips": int(len(Y)), "n_groups": int(n_groups),
        "roc_auc": roc, "pr_auc": pr,
        "fold_roc_auc": fold_auc,
        "fold_roc_auc_mean": float(statistics.mean(clean_auc)) if clean_auc else None,
        "fold_roc_auc_std": float(statistics.pstdev(clean_auc)) if len(clean_auc) > 1 else None,
        "threshold": thr, "target_precision": args.target_precision,
        "threshold_selection": f"precision-favoring on pooled OOF (lowest threshold with precision>={args.target_precision})",
        "precision": float(p2), "recall": float(r2), "f1": float(f2),
        "confusion_matrix": cm,
        "note": ("Grouped-CV PROXY metrics. ASPID 'silence' condition only; 27 recordings (small group "
                 "count -> see fold_roc_auc variance). Operating point selected on the pooled OOF set "
                 "(mildly optimistic; ROC/PR-AUC are threshold-free). Report as proxy; never RPW "
                 "accuracy or field-validated."),
    }
    rep = Path("eval_report"); rep.mkdir(exist_ok=True)
    (rep / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("[cv]", json.dumps(metrics, indent=2))

    # Final model on ALL data -> export for serving (consistent recipe).
    pos = Y.sum(); neg = len(Y) - pos
    cw = {0: len(Y) / (2 * neg + 1e-9), 1: len(Y) / (2 * pos + 1e-9)}
    final = build_model()
    final.fit(X, Y, epochs=args.epochs, batch_size=args.batch, class_weight=cw, verbose=0)
    Path("export").mkdir(exist_ok=True)
    final.save("export/model.keras")
    final.export("export/saved_model")
    Path("export/model_version.txt").write_text(args.version)
    print(f"[cv] final model trained on all {len(Y)} clips -> export/model.keras ({args.version})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
