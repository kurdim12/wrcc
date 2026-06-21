# Palm Guard — ML (training the data + serving)

Binary acoustic detector: `activity` (boring/feeding) vs `clean` → `p_activity`.
Host-side inference for v1 (§6). On-device int8 TFLite is a documented stretch.

## Serve (the demo path — light, no TensorFlow needed)

```bash
cd ml
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn serve.app:app --port 8001
# GET  /health  -> {model_version, calibrated, model_loaded}
# POST /score   {mel:[...1280]} -> {p_activity, model_version, calibrated}
```

With no trained model present, `/score` runs the **heuristic baseline**
(`heuristic-baseline-v0`, `calibrated=false`). The backend (`services/fusion.js`)
calls it per reading and falls back to its own heuristic if the service is down
— ingestion never blocks (§9.11).

## Train (reproducible pipeline — needs corpora; never fabricates metrics)

```bash
pip install -r requirements-train.txt
# 1) download corpora into ml/data/ (see prepare/DATASETS.md), then standardize:
python -m prepare.standardize --in data/raw/aspid/infested --label activity --source aspid
python -m prepare.standardize --in data/raw/aspid/clean    --label clean    --source aspid
# 2) train + evaluate + export (grouped split, augment, real metrics):
python -m train.train --manifest data/manifest.csv --esc50 data/esc50/audio
# 3) (stretch) int8 TFLite for esp-tflite-micro:
python -m export.export_tflite --saved export/saved_model --manifest data/manifest.csv
```

`train.py` writes real metrics to `eval_report/metrics.json` (ROC-AUC, PR-AUC,
confusion, per-SNR) and a `saved_model/`. `serve` auto-loads `export/saved_model`
if present (set `PG_MODEL_PATH` to override). See `model_card.md` — until a model
is trained, **there are no metrics and the UI shows "heuristic"**.

## Feature contract (MUST match firmware)

`ml/features/params.py` is the single source of truth, mirrored in
`firmware/.../include/config.h` and implemented identically in
`firmware/.../sensors/acoustic.cpp`. 40×32 HTK-mel log patch, `sr=16000,
n_fft=1024, hop=512, fmin=200, fmax=8000`, per-clip mean-var normalized,
band-major flatten.
