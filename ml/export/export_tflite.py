#!/usr/bin/env python3
"""Full-integer (int8) TFLite export for the on-device stretch goal (§9.8).

Quantizes the trained SavedModel using a representative dataset drawn from real
clips, producing export/model_int8.tflite for esp-tflite-micro. Host inference
(v1) uses the float SavedModel directly via ml/serve — this is ONLY the edge
path and is not required for Baku.

    python -m export.export_tflite --saved export/saved_model --manifest data/manifest.csv
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

from features.params import N_MELS, N_FRAMES
from features.melspec import logmel_patch


def representative_gen(manifest: str, n: int = 200):
    import librosa
    df = pd.read_csv(manifest).sample(min(n, len(pd.read_csv(manifest))), random_state=0)

    def gen():
        for _, r in df.iterrows():
            y, _ = librosa.load(r["path"], sr=16000, mono=True)
            patch = logmel_patch(y).reshape(1, N_MELS, N_FRAMES, 1).astype("float32")
            yield [patch]
    return gen


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--saved", default="export/saved_model")
    ap.add_argument("--manifest", default="data/manifest.csv")
    ap.add_argument("--out", default="export/model_int8.tflite")
    args = ap.parse_args()

    import tensorflow as tf
    conv = tf.lite.TFLiteConverter.from_saved_model(args.saved)
    conv.optimizations = [tf.lite.Optimize.DEFAULT]
    conv.representative_dataset = representative_gen(args.manifest)
    conv.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    conv.inference_input_type = tf.int8
    conv.inference_output_type = tf.int8
    Path(args.out).write_bytes(conv.convert())
    print(f"[export] int8 tflite -> {args.out} ({Path(args.out).stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
