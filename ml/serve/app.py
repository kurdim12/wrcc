"""Palm Guard ML scoring service (§9.11).

POST /score  {mel: [...1280 band-major floats], model_version?}
          -> {p_activity, model_version, calibrated}
GET  /health -> {ok, model_version, calibrated, model_loaded}

Model resolution:
  1. If a trained model exists at $PG_MODEL_PATH (a Keras SavedModel dir) AND
     TensorFlow is importable, use it (model_version from the sidecar
     export/model_version.txt; calibrated if export/calibration.json exists).
  2. Otherwise fall back to a TRANSPARENT HEURISTIC BASELINE — clearly reported
     as model_version="heuristic-baseline-v0", calibrated=false.

The honesty mandate (§2/§9): until a real model is trained on a real held-out
set, this service NEVER returns a calibrated probability or any fabricated
metric. The heuristic is a shape detector on the normalized mel patch, not a
validated classifier — the dashboard renders it with a "heuristic" badge.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

from features.params import N_MELS, N_FRAMES, PATCH_LEN, FEED_LO, FEED_HI

HEURISTIC_VERSION = "heuristic-baseline-v0"

app = FastAPI(title="Palm Guard ML", version="2.0.0")


# ─── Optional trained model ──────────────────────────────────────────────────
_model = None
_model_version = HEURISTIC_VERSION
_calibrated = False
_model_loaded = False


def _try_load_model() -> None:
    global _model, _model_version, _calibrated, _model_loaded
    model_path = os.environ.get("PG_MODEL_PATH", "export/saved_model")
    p = Path(model_path)
    if not p.exists():
        return
    try:
        import tensorflow as tf  # noqa: heavy, only when a model is present
        _model = tf.keras.models.load_model(str(p))
        ver = Path("export/model_version.txt")
        _model_version = ver.read_text().strip() if ver.exists() else "cnn-unversioned"
        cal = Path("export/calibration.json")
        _calibrated = cal.exists()
        _model_loaded = True
        print(f"[ml] loaded model {_model_version} (calibrated={_calibrated})")
    except Exception as e:  # pragma: no cover - depends on local TF install
        print(f"[ml] model present but failed to load ({e}); using heuristic")


_try_load_model()


# ─── Heuristic baseline ──────────────────────────────────────────────────────
def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + np.exp(-x))


def heuristic_score(patch: np.ndarray) -> float:
    """Shape detector on a (40,32) mean-var normalized log-mel patch.

    Measures how much the feeding-band rows (~0.5-4 kHz) stand out from the rest.
    NOT calibrated — a placeholder until a CNN is trained (see model_card.md).
    The sigmoid bias encodes the prior that most readings are clean.
    """
    feed = patch[FEED_LO:FEED_HI, :].mean()
    off_rows = np.concatenate([patch[:FEED_LO, :].reshape(-1), patch[FEED_HI:, :].reshape(-1)])
    off = off_rows.mean() if off_rows.size else 0.0
    diff = float(feed - off)
    return float(np.clip(_sigmoid(2.3 * diff - 1.7), 0.0, 1.0))


def model_score(patch: np.ndarray) -> float:
    x = patch.reshape(1, N_MELS, N_FRAMES, 1).astype("float32")
    p = float(_model.predict(x, verbose=0).reshape(-1)[0])
    return float(np.clip(p, 0.0, 1.0))


# ─── API ─────────────────────────────────────────────────────────────────────
class ScoreRequest(BaseModel):
    mel: list[float] = Field(..., description="band-major flattened 40×32 log-mel patch")
    model_version: str | None = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "palm-guard-ml",
        "model_version": _model_version,
        "calibrated": _calibrated,
        "model_loaded": _model_loaded,
        "patch_len": PATCH_LEN,
    }


@app.post("/score")
def score(req: ScoreRequest):
    mel = np.asarray(req.mel, dtype=np.float32)

    # Be forgiving about length: accept exact PATCH_LEN, or any multiple of
    # N_MELS (reshape to whatever frame count arrived), else report and bail safe.
    if mel.size == PATCH_LEN:
        patch = mel.reshape(N_MELS, N_FRAMES)
    elif mel.size % N_MELS == 0 and mel.size > 0:
        patch = mel.reshape(N_MELS, mel.size // N_MELS)
    else:
        return {"p_activity": 0.5, "model_version": _model_version,
                "calibrated": False, "note": "unexpected mel length"}

    if _model_loaded and patch.shape == (N_MELS, N_FRAMES):
        p = model_score(patch)
    else:
        p = heuristic_score(patch)

    return {"p_activity": p, "model_version": _model_version, "calibrated": _calibrated}
