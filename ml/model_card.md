# Model Card — Palm Guard acoustic activity detector

> **Honesty summary.** Once populated, every number in this card is a **proxy
> metric** — measured on a **grouped** (recording-level) held-out split of open
> proxy corpora (ASPID activity/clean + ESC-50 noise augmentation) — **not "RPW
> accuracy."** No airborne real-RPW audio is used in training or evaluation.
> Real-RPW INMP441 field validation is the next step, not something these numbers
> establish. *Status: not yet populated — serving currently runs the heuristic
> baseline.*

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

## Data (proxy corpora — fill from the run)

| split | source(s) | recordings | clips | activity:clean |
|-------|-----------|-----------:|------:|---------------:|
| train | ASPID (proxy) | `__` | `__` | `__:__` |
| val   | ASPID (proxy) | `__` | `__` | `__:__` |
| test  | ASPID (proxy) | `__` | `__` | `__:__` |

Splits grouped by `recording_id` (no clip from one recording in two splits).
ESC-50 is mixed in as **noise augmentation only** (CC BY-NC — non-commercial).

**`clean` class composition depends on `--negative-policy`:**
- `clean` (default): quiet-palm controls **plus** non-insect distractors
  (e.g. "Talking", "Sweep") folded in as hard negatives — chosen to buy field
  precision against daytime-farm noise.
- `drop`: `clean` = quiet controls only; distractors excluded.

Document which policy this run used (in Run provenance below) — it changes what
`clean` means.

### Data sources & licenses

| Corpus | Role | License | Note |
|--------|------|---------|------|
| ASPID / SPIDB | primary proxy (activity vs clean) | MIT | commercial-OK |
| InsectSound1000 | (pretrain — **not used**, no clean class) | **CC BY 4.0** | resolved at OpenAgrar DOI `10.5073/20231024-173119-0` (the Kaggle "Unknown" was a mirror gap). Still not used — no clean/negative class |
| ESC-50 | noise augmentation only | **CC BY-NC** | non-commercial — fine for WRCC, flag for product |

## Features

HTK-mel log-mel patch, **40 × 32**, `sr=16000, n_fft=1024, hop=512, fmin=200,
fmax=8000`, per-clip mean-var normalization. Identical filterbank in
`ml/features/melspec.py` and `firmware/.../acoustic.cpp` (and mirrored in
`config.h`). See `ml/features/params.py`.

## Metrics (proxy — populated by `train.py` on the grouped test set)

> **All numbers below are PROXY metrics**, measured on a held-out **grouped**
> (recording-level) test split of open proxy corpora (ASPID activity/clean +
> ESC-50 noise augmentation). They are **NOT** "RPW accuracy." No airborne
> real-RPW audio was used in training or evaluation. Real-RPW field validation
> on INMP441 hardware is the next step, not something these numbers establish.
>
> Status: ⬜ not yet populated — fill only from `eval_report/metrics.json`.

### Run provenance (fill from the training run)

| Field | Value |
|-------|-------|
| Model version | `__________` (e.g. `cnn-aspid-v1`) |
| Trained on | ASPID (proxy) — activity vs clean |
| Pretrain | **skipped** — InsectSound1000 has no clean/silence class (no fabricated negative) |
| Noise augmentation | ESC-50 `audio/` via `--esc50` (CC BY-NC — augmentation only) |
| `--negative-policy` | `__________` (`clean` = distractors folded in as hard negatives / `drop`) |
| Split | grouped by `recording_id` (no recording in two splits) |
| Threshold (chosen) | `__________` (precision-favoring — see below) |
| Eval source file | `eval_report/metrics.json` |

### Headline (proxy) metrics

| Metric (proxy) | Value |
|----------------|------:|
| ROC-AUC | `____` |
| PR-AUC | `____` |
| Precision @ chosen threshold | `____` |
| Recall @ chosen threshold | `____` |
| F1 @ chosen threshold | `____` |

### Confusion matrix @ chosen threshold (proxy, grouped test)

|              | pred clean | pred activity |
|--------------|-----------:|--------------:|
| **true clean**    | `____` (TN) | `____` (FP) |
| **true activity** | `____` (FN) | `____` (TP) |

### Threshold selection (precision-favoring)

A false positive triggers a pesticide micro-dose on a healthy palm, so the
operating point is chosen to **favor precision** off the proxy PR curve.

- Target precision: `____` (state the precision floor aimed for)
- Resulting recall: `____` (the recall cost paid for that precision)
- Chosen threshold: `____`
- Rationale: false-dose asymmetry — a false positive pesticides a healthy tree;
  a false negative is recoverable on the next listening window. Dosing is also
  human-armed + human-confirmed regardless (§3), so the model is one gate, not
  the trigger.

### Per-noise-condition breakdown (proxy, support-gated)

> Axis is **noise condition** (ASPID's categorical `noise` column), **not a
> measured SNR/dB**. Calling it SNR would overclaim. A row is reported only if
> it clears the support floor in the grouped test split; sparser conditions are
> collapsed into **`other`**. `n_recordings` / `n_clips` shown so support is
> visible and a low-n row is never mistaken for a stable metric.

**Support floor (lock from real post-split counts):** ≥ `__` distinct
recordings AND ≥ `__` test clips. (Starting proposal: ≥6–8 recordings, ≥50
clips — confirm against the `--inspect` distribution and post-split counts.)

| Noise condition | n_recordings | n_clips | ROC-AUC | PR-AUC | Precision | Recall | F1 |
|-----------------|-------------:|--------:|--------:|-------:|----------:|-------:|---:|
| silence         | `__` | `__` | `__` | `__` | `__` | `__` | `__` |
| `__________`    | `__` | `__` | `__` | `__` | `__` | `__` | `__` |
| `__________`    | `__` | `__` | `__` | `__` | `__` | `__` | `__` |
| **other (folded < floor)** | `__` | `__` | `__` | `__` | `__` | `__` | `__` |

_All rows: proxy metrics on the grouped held-out test set. Conditions below the
support floor are folded into `other` rather than reported as standalone rows._

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
