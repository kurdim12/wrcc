# Model Card — Palm Guard acoustic activity detector

> **Honesty summary.** Every number in this card is a **PROXY metric**, measured
> by **grouped cross-validation** (recording-level, no leakage) on the open
> **ASPID** stored-product-insect corpus (MIT). It is **NOT "RPW accuracy,"** it
> is **not field-validated**, and the recordings are all the **`silence`**
> condition. The positive class is real **insect-larvae feeding/chewing**
> (Tenebrio/Tribolium/Callosobruchus) vs **No-Insects** controls — a *functional*
> proxy for RPW boring/feeding, but not RPW itself. No airborne real-RPW audio is
> used. Real-RPW INMP441 field validation is the next step, not something these
> numbers establish.

**Task:** binary, acoustic-primary — `activity` (boring/feeding present) vs
`clean` (no insect activity) from a ~1 s window → `p_activity ∈ [0,1]`. Species
ID is explicitly **out of scope** for v1 (we have no labelled RPW audio).

**What the v1 model learned (be precise):** `cnn-aspid-v1` discriminates
**stored-product insect larvae chewing/feeding** (ASPID `Tenebrio molitor`,
`Tribolium confusum`, `Callosobruchus maculatus` larvae) from **No-Insects**
controls, on close-mic recordings in the **`silence`** condition. Larvae
chewing/feeding is acoustically much closer to RPW larvae boring inside a trunk
than flying-insect wingbeats are — so this is a *stronger* proxy than an
insect-vs-environment classifier — but it is still a proxy: different species,
clean lab condition, airborne mic.

---

## ✅ Current status: trained proxy (`cnn-aspid-v1`), grouped-CV evaluated

A real CNN was trained and evaluated via the reproducible pipeline
(`ml/prepare/aspid_intervals.py` → `ml/train/train_cv.py`). Metrics are in
`eval_report/metrics.json` and filled below.

> ⚠️ The trained artifacts (`export/model.keras`, `saved_model/`, int8 TFLite)
> and `eval_report/metrics.json` are **gitignored and NOT shipped** — a fresh
> clone still serves the transparent `heuristic-baseline-v0`. These numbers are
> **reproducible** (ASPID is MIT; scripts are committed), not bundled.

> ⚠️ **Why cross-validation, not a single split.** Only the cleanly time-alignable
> ASPID subset is used (see Data), giving **27 leak-safe groups** (logged
> intervals). A single grouped train/test split leaves only ~5 test recordings,
> and its ROC-AUC swung **0.26–0.85** purely with the training seed — noise, not
> signal. Grouped **5-fold CV** evaluates every recording out-of-fold once and
> pools the predictions, with per-fold variance reported so the small-group
> uncertainty stays visible.

## Intended use / limits (read before quoting any number)

- **Airborne mic ≠ guaranteed larvae detection.** INMP441 is airborne; RPW larvae
  feed *inside* the trunk (structure-borne). Reliable mainly **quiet / close /
  night**. Not a farm-wide, all-weather detector.
- **Proxy only.** v1 trains on ASPID stored-product insect larvae (a functional
  proxy for boring/feeding), not real airborne RPW. Every metric is a **proxy
  metric** and must be labelled as such — never "RPW accuracy."
- **`silence` condition only.** The cleanly-alignable ASPID subset is all the
  `silence` noise condition; robustness to farm noise is **not** measured here
  (ESC-50 noise augmentation via `train.py --esc50` is the path to that, and is
  not applied in this estimate).
- **Operating point favors precision** — a false positive triggers a pesticide
  micro-dose on a healthy palm. Dosing is human-armed + human-confirmed
  regardless (§3); the model is one gate, not the trigger.

## Data (proxy corpus — ASPID, grouped by logged interval)

| split | source | recordings | clips | activity:clean |
|-------|--------|-----------:|------:|---------------:|
| all (grouped 5-fold CV) | ASPID (proxy) | 27 | 11066 | 6216:4850 |
| — activity | larvae feeding | 20 | 6216 | — |
| — clean | No-Insects controls | 7 | 4850 | — |

`recording_id` = the **logged experiment interval** (one condition); all clips
from one interval stay within a single CV fold, so no clip leaks across folds
(§9.4). Each fold tests 3–7 recordings; pooled over 5 folds, **all 27** are
evaluated out-of-fold. (Recording/clip counts above come from the
`manifest_to_db --report` corpus index; the performance metrics come from
`eval_report/metrics.json`.)

**Source / provenance.** ASPID / SPIDB raw research export (`aspids_log.csv` +
device-timestamped session WAVs). The log is a sparse interval annotation with no
filename column, so `aspid_intervals.py` aligns each WAV to its logged interval by
timestamp (a recorder-clock glitch affected only 2 of 1091 sessions and drops out
naturally). One mic channel (**Ch0**) is used to avoid 8× near-duplicate channels;
each WAV is trimmed to its logged window; non-insect distractor targets
(`Noise NN dB`, `White Noise`, `Ronald Reagan Speech`, `Talking`, `Sweep`) are
folded into `clean` as hard negatives. **62% of WAVs fall outside any logged
interval and are dropped unlabeled** (never guessed). Features: firmware-matched
40×32 HTK log-mel.

### Data sources & licenses

| Corpus | Role | License | Note |
|--------|------|---------|------|
| ASPID / SPIDB | **primary proxy** (activity vs clean) | **MIT** | commercial-OK; used here |
| ESC-50 | noise augmentation (available, not used in this estimate) | CC BY-NC | non-commercial — augmentation only, never a class, never republished |
| InsectSound1000 | pretrain — **not used** | CC BY 4.0 | no clean/negative class |

## Features

HTK-mel log-mel patch, **40 × 32**, `sr=16000, n_fft=1024, hop=512, fmin=200,
fmax=8000`, per-clip mean-var normalization. Identical filterbank in
`ml/features/melspec.py` and `firmware/.../acoustic.cpp` (mirrored in `config.h`).
See `ml/features/params.py`.

## Metrics (proxy — from `eval_report/metrics.json`)

> **All numbers below are PROXY metrics**, pooled out-of-fold over a grouped
> 5-fold CV of ASPID activity/clean (`silence` condition). **NOT** "RPW accuracy,"
> **NOT** field-validated.

### Run provenance

| Field | Value |
|-------|-------|
| Model version | `cnn-aspid-v1` |
| Trained on | ASPID (proxy) — larvae feeding vs No-Insects, `silence` condition |
| Evaluation | grouped 5-fold CV; pooled out-of-fold over all 27 recordings (11066 clips) |
| Noise augmentation | none in this estimate (ESC-50 available via `train.py --esc50`) |
| Threshold (chosen) | **0.223** — precision-favoring, selected on pooled OOF |
| Eval source file | `eval_report/metrics.json` |

### Headline (proxy) metrics

| Metric (proxy) | Value |
|----------------|------:|
| ROC-AUC (pooled OOF) | **0.905** |
| PR-AUC (pooled OOF) | **0.926** |
| Per-fold ROC-AUC | 0.944 / 0.819 / 0.948 / 0.840 / 0.822 → **0.875 ± 0.059** |
| Precision @ threshold 0.223 | **0.800** |
| Recall @ threshold 0.223 | **0.899** |
| F1 @ threshold 0.223 | **0.846** |

### Confusion matrix @ threshold 0.223 (proxy, pooled OOF, n=11066)

|              | pred clean | pred activity |
|--------------|-----------:|--------------:|
| **true clean**    | 3454 (TN) | 1396 (FP) |
| **true activity** | 630 (FN)  | 5586 (TP) |

### Threshold selection (precision-favoring)

A false positive triggers a pesticide micro-dose on a healthy palm, so the
operating point favors precision off the proxy PR curve.

- Target precision: **0.80** (the precision floor aimed for)
- Resulting recall: **0.899** (the recall cost paid for that precision)
- Chosen threshold: **0.223**
- Selection set: the **pooled out-of-fold predictions** (each recording was
  held out when scored). This is mildly optimistic — the threshold is tuned on
  the same pooled set it is reported on — so treat the threshold-free **ROC-AUC
  0.905 / PR-AUC 0.926** as the robust headline and the operating point as
  indicative.
- Rationale: false-dose asymmetry — a false positive pesticides a healthy tree; a
  false negative is recoverable on the next listening window. Dosing is also
  human-armed + human-confirmed regardless (§3).

### Per-noise-condition breakdown (proxy, support-gated)

The cleanly time-alignable ASPID subset is **entirely the `silence` condition**
(the log's Noise/Factory/Crowd/Helicopter intervals did not time-align to any
recording, so they are absent). The single supported row:

| Noise condition | n_recordings | n_clips | ROC-AUC | PR-AUC | Precision | Recall | F1 |
|-----------------|-------------:|--------:|--------:|-------:|----------:|-------:|---:|
| silence         | 27 | 11066 | 0.905 | 0.926 | 0.800 | 0.899 | 0.846 |

_Noise-condition robustness is therefore **not** measured here. ESC-50 noise
augmentation (`train.py --esc50`) is the route to it; field noise robustness needs
your own INMP441 clips._

## Highest-value next step (§9.10)

This is a strong *proxy* but still a proxy (stored-product insects, clean lab
condition, airborne mic). To make the number credible for RPW: record **your own
INMP441 clips** (palm log + mic, controlled activity if available, plenty of clean
farm ambient) and (a) fine-tune and (b) **validate** on them. Metrics on *your*
mic in *your* conditions are far more credible to a judge than any proxy AUC.
