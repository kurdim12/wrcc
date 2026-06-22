#!/usr/bin/env python3
"""Train the WEAK ESC-50 proxy (insect-vs-non-insect) from cached features.

`dataset.md` no-download path. Consumes data/esc50_features.npz (written by
prepare.stream_esc50), trains the shared Palm Guard CNN (train.model.build_model
— identical 40x32 input as the firmware/serve path), evaluates on a held-out
ESC-50 fold, and writes REAL metrics to eval_report/metrics.json + exports the
model. Nothing here invents a number.

⚠️ WEAK PROXY. The positive class is ESC-50 'insects' (FLYING insects, wingbeats)
— NOT RPW larvae, NOT the activity-vs-clean task the rest of the repo targets.
Only ~40 positives exist (8 per fold), so the test fold has ~8 positives: every
number is a high-variance PROXY metric, reported as proxy and never as
"RPW accuracy." Source ESC-50 is CC BY-NC (non-commercial; demo/research only).

Split (leak-safe, grouped by ESC-50's official folds):
    train = folds {1,2,3}   val = fold 4 (threshold selection)   test = fold 5
The precision-favoring operating point is chosen on VAL (not on the test fold it
is then scored against) to avoid optimistic threshold selection on tiny n.

    python -m train.train_stream
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

TARGET_PRECISION = 0.8       # precision-favoring: a false dose pesticides a healthy palm
TRAIN_FOLDS = (1, 2, 3)
VAL_FOLD = 4
TEST_FOLD = 5
VERSION = "cnn-esc50-stream-v1"


def select_threshold(y_val, p_val, target=TARGET_PRECISION) -> float:
    """Lowest real threshold whose VAL precision >= target (highest recall meeting
    the precision floor); 0.5 if none reaches it. Degenerate no-positives point
    excluded so we never collapse to 'predict nothing'."""
    from sklearn.metrics import precision_recall_curve
    if len(set(y_val.tolist())) < 2:
        return 0.5
    prec, _rec, thr = precision_recall_curve(y_val, p_val)
    prec = prec[:-1]                              # align with thr (drop degenerate tail)
    cand = np.where(prec >= target)[0]
    return float(thr[cand[0]]) if len(cand) else 0.5


def main() -> int:
    import tensorflow as tf
    from sklearn.metrics import (average_precision_score, confusion_matrix,
                                 precision_recall_fscore_support, roc_auc_score)

    from train.model import build_model

    tf.keras.utils.set_random_seed(42)

    d = np.load("data/esc50_features.npz")
    X = d["X"][..., None].astype("float32"); y = d["y"].astype("int32"); g = d["groups"].astype("int32")
    tr = np.isin(g, TRAIN_FOLDS); va = g == VAL_FOLD; te = g == TEST_FOLD
    Xtr, ytr = X[tr], y[tr]; Xva, yva = X[va], y[va]; Xte, yte = X[te], y[te]
    print(f"[data] train={tr.sum()} (pos {int(ytr.sum())})  "
          f"val={va.sum()} (pos {int(yva.sum())})  test={te.sum()} (pos {int(yte.sum())})")
    if len(set(yte.tolist())) < 2:
        print("[train] test fold has a single class — STOP (cannot compute AUC honestly)"); return 1

    # Class weighting for the (downsampled) imbalance.
    pos = int(ytr.sum()); neg = int((ytr == 0).sum())
    cw = {0: len(ytr) / (2 * neg + 1e-9), 1: len(ytr) / (2 * pos + 1e-9)}

    model = build_model()
    es = tf.keras.callbacks.EarlyStopping(monitor="val_pr_auc", mode="max",
                                          patience=12, restore_best_weights=True)
    model.fit(Xtr, ytr, validation_data=(Xva, yva), epochs=80, batch_size=16,
              class_weight=cw, callbacks=[es], verbose=2)

    # Threshold on VAL, then report everything on the held-out TEST fold.
    p_val = model.predict(Xva, verbose=0).reshape(-1)
    T = select_threshold(yva, p_val)
    p_te = model.predict(Xte, verbose=0).reshape(-1)
    preds = (p_te >= T).astype(int)
    roc = float(roc_auc_score(yte, p_te))
    pr = float(average_precision_score(yte, p_te))
    prc, rcl, f1, _ = precision_recall_fscore_support(yte, preds, average="binary", zero_division=0)
    cm = confusion_matrix(yte, preds, labels=[0, 1]).tolist()    # [[TN,FP],[FN,TP]]

    metrics = {
        "model_version": VERSION,
        "proxy": True,
        "field_validated": False,
        "source": ("ESC-50 (ashraq/esc50 mirror; local clone) — CC BY-NC, demo/research only. "
                   "Positive = ESC-50 'insects' (FLYING insects). WEAK proxy: insect vs non-insect, "
                   "NOT RPW and NOT activity-vs-clean."),
        "feature": "40x32 HTK log-mel, first ~1.02 s of each clip, firmware-matched (features/melspec.py)",
        "split": f"grouped by ESC-50 fold: train={list(TRAIN_FOLDS)} val=[{VAL_FOLD}] test=[{TEST_FOLD}]",
        "threshold": T,
        "threshold_selection": f"lowest VAL threshold with precision>={TARGET_PRECISION} (chosen on val, not test)",
        "target_precision": TARGET_PRECISION,
        "roc_auc": roc, "pr_auc": pr,
        "precision": float(prc), "recall": float(rcl), "f1": float(f1),
        "confusion_matrix": cm,
        "n_train": int(tr.sum()), "n_val": int(va.sum()), "n_test": int(te.sum()),
        "n_test_pos": int(yte.sum()), "n_val_pos": int(yva.sum()),
        "note": ("WEAK PROXY — high variance: only ~8 positive clips in the test fold. "
                 "Real held-out numbers, but report as a proxy (insect-vs-non-insect on "
                 "ESC-50, CC BY-NC), never as RPW accuracy or field-validated."),
    }
    rep = Path("eval_report"); rep.mkdir(exist_ok=True)
    (rep / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("[eval]", json.dumps(metrics, indent=2))

    exp = Path("export"); exp.mkdir(exist_ok=True)
    model.save("export/model.keras")          # native Keras (served by ml/serve)
    model.export("export/saved_model")        # SavedModel (for export_tflite.py)
    (exp / "model_version.txt").write_text(VERSION)    # so serve reports cnn-esc50-stream-v1
    print(f"[export] export/model.keras + export/saved_model + model_version.txt ({VERSION})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
