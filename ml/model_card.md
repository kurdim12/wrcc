# Model Card — Palm Guard acoustic activity detector

**Task:** binary, acoustic-primary — `activity` (boring/feeding present) vs
`clean` (no insect activity) from a ~1 s window → `p_activity ∈ [0,1]`.
Species ID is explicitly **out of scope** for v1 (we don't have labelled RPW
audio to support it honestly).

---

## ⚠️ Current status: NO TRAINED MODEL YET — heuristic baseline in use

As of this commit there is **no `.tflite` and no trained `saved_model/` in the
repo**, and therefore **no real evaluation metrics exist**. The serving service
(`ml/serve/app.py`) runs a **transparent heuristic baseline**
(`model_version = "heuristic-baseline-v0"`, `calibrated = false`): it measures
how much the feeding-band mel rows (~0.5–4 kHz) stand out from the rest of a
per-clip-normalized log-mel patch. It is a shape detector, **not** a validated
classifier.

Per the honesty mandate (§2/§9): **the dashboard shows a probability with a
"heuristic"/"proxy-validated" badge and never a fabricated accuracy number.**
This card will be filled with real numbers only after `train.py` runs on a real
held-out set and writes `eval_report/metrics.json`.

## Intended use / limits (read before quoting any number)

- **Airborne mic ≠ guaranteed larvae detection.** INMP441 is an airborne MEMS
  mic; RPW larvae feed *inside* the trunk (structure-borne sound). Reliable
  mainly in **quiet / close / night** conditions. Not a farm-wide, all-weather
  detector.
- **Proxy validation only.** No large open dataset of airborne real-RPW exists
  (see `prepare/DATASETS.md`). v1 trains on **functional proxies** (stored-grain
  weevils, wood borers boring/feeding) + ambient-noise augmentation. Any metric
  produced is a **proxy metric** and must be labelled as such everywhere.
- **Operating point favors precision** — a false dose is costly (it pesticides a
  healthy palm). Dosing is human-armed + confirmed regardless (§3).

## Data (to be recorded here after training)

| split | source(s) | recordings | clips | activity:clean |
|-------|-----------|-----------:|------:|---------------:|
| train | _tbd_ | | | |
| val   | _tbd_ | | | |
| test  | _tbd_ | | | |

Splits are grouped by `recording_id` (no clip from one recording in two splits).

## Features

HTK-mel log-mel patch, **40 × 32**, `sr=16000, n_fft=1024, hop=512, fmin=200,
fmax=8000`, per-clip mean-var normalization. Identical filterbank in
`ml/features/melspec.py` and `firmware/.../acoustic.cpp` (and mirrored in
`config.h`). See `ml/features/params.py`.

## Metrics (populated by `train.py` on the grouped test set)

_None yet._ When trained, report: ROC-AUC, PR-AUC, confusion matrix,
precision/recall/F1 at the chosen threshold, and a **per-SNR breakdown** — all
on the held-out grouped test set, all labelled **proxy**.

## Pipeline smoke-test on TOY data (Tier 2 / Task 5)

The full `prepare → features → train → export → serve` path has been run
end-to-end on a **tiny synthetic corpus** (`ml/prepare/make_toy_corpus.py`):
obviously-fake tone-burst "activity" vs noise "clean" WAVs. This produced
`export/model.keras`, a SavedModel, and `export/model_int8.tflite`, and the
serving service auto-loaded the trained model (`/health` → `model_loaded:true`,
`model_version:"TOY-DATA-not-real-v0"`, `calibrated:false`) with `/score`
returning from it.

> ⚠️ **TOY DATA — NOT REAL METRICS.** This only proves the pipeline runs; any
> number from it is meaningless and is labelled TOY everywhere (the UI badge,
> `eval_report/metrics.json` note, and `model_version`). All toy artifacts are
> gitignored/regenerable. Real corpora (`prepare/DATASETS.md`) + your own
> INMP441 clips are the drop-in replacement — same commands, real numbers.

## Highest-value next step (§9.10)

Record **your own INMP441 clips** (palm log + mic, controlled activity if
available, plenty of clean farm ambient) and (a) fine-tune and (b) **validate**
on them. Metrics on *your* mic in *your* conditions are far more credible to a
judge than any proxy AUC.
