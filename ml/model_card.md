# Model Card — Palm Guard acoustic activity detector

> **Honesty summary.** Every number in this card is a **PROXY metric**, measured
> on a **grouped (recording-level) held-out split** of an open proxy corpus
> (**ESC-50**). It is **NOT "RPW accuracy,"** it is **not field-validated**, and
> the trained v1 model here does **not even discriminate the product's
> activity-vs-clean task** — it discriminates ESC-50's **flying-insect** class
> from other environmental sound (a deliberately **WEAK** proxy; see below). No
> airborne real-RPW audio is used in training or evaluation. Real-RPW INMP441
> field validation is the next step, not something these numbers establish.

**Product task (the target):** binary, acoustic-primary — `activity`
(boring/feeding present) vs `clean` (no insect activity) from a ~1 s window →
`p_activity ∈ [0,1]`. Species ID is explicitly **out of scope** for v1 (we have
no labelled RPW audio to support it honestly).

**What the v1 model actually learned (be precise):** `cnn-esc50-stream-v1` is
trained on the only insect-relevant signal available *without a large download* —
ESC-50's single **`insects`** class (FLYING insects / wingbeats, 40 clips total)
as the positive, vs all other ESC-50 environmental sounds as the negative. So its
output is really `p(flying-insect-wingbeat)`, used as a **stand-in** for acoustic
activity. Flying-insect wingbeats are acoustically **nothing like** RPW larvae
chewing *inside* a trunk, and there are only ~40 positives — hence "WEAK proxy."
The serving stack reads this as `p_activity`, but the meaning is the weaker
insect-vs-non-insect signal documented here.

---

## ✅ Current status: trained WEAK proxy (`cnn-esc50-stream-v1`)

A real CNN has been trained and evaluated on a grouped held-out ESC-50 fold via
the reproducible no-download pipeline (`ml/prepare/stream_esc50.py` →
`ml/train/train_stream.py`). Real metrics are in `eval_report/metrics.json` and
filled below.

> ⚠️ The trained artifact (`export/model.keras`, `saved_model/`, the int8 TFLite)
> and `eval_report/metrics.json` are **gitignored and NOT shipped** — a fresh
> clone still serves the transparent `heuristic-baseline-v0`. These numbers are
> **reproducible** (public ESC-50 + committed scripts), not bundled. Run the two
> scripts to regenerate them.

> ⚠️ **WEAK, demo-grade, non-commercial.** Trained on ESC-50, which is
> **CC BY-NC** (non-commercial — fine for WRCC demo/research, flag for product).
> The audio is never republished and the model is **never** presented as
> commercial or field validation. Only **~8 positive clips** land in the test
> fold, so every figure below is **high variance** — treat them as directional,
> not precise.

## Intended use / limits (read before quoting any number)

- **Airborne mic ≠ guaranteed larvae detection.** INMP441 is an airborne MEMS
  mic; RPW larvae feed *inside* the trunk (structure-borne sound). Reliable
  mainly in **quiet / close / night** conditions. Not a farm-wide, all-weather
  detector.
- **Weak proxy only.** No large open dataset of airborne real-RPW exists. This v1
  trains on a *functional, weak* proxy (flying-insect presence vs other sound).
  Any metric produced is a **proxy metric** and must be labelled as such
  everywhere — never "RPW accuracy."
- **Operating point favors precision** — a false positive triggers a pesticide
  micro-dose on a healthy palm. Dosing is human-armed + human-confirmed
  regardless (§3); the model is one gate, not the trigger.

## Data (proxy corpus — ESC-50, grouped by fold)

| split | source | clips | insect:non-insect (pos:neg) |
|-------|--------|------:|----------------------------:|
| train (folds 1,2,3) | ESC-50 (proxy) | 96 | 24:72 |
| val   (fold 4)      | ESC-50 (proxy) | 36 | 8:28  |
| test  (fold 5)      | ESC-50 (proxy) | 28 | 8:20  |

Split is **grouped by ESC-50's official `fold`** (1–5): ESC-50 folds keep one
source recording within a single fold, so no clip from one recording leaks across
splits (§9.4). Negatives are downsampled to 3× the positives **overall** (120
sampled negatives for 40 positives, seeded) to keep the base rate sane; the
per-fold negative counts then fall out of ESC-50's fold assignment, so an
individual split is not exactly 3× its own positives. Positives are the full
ESC-50 `insects` class (40 clips, 8/fold).

**Source / provenance.** ESC-50 (`ashraq/esc50` is a Hugging Face mirror of
`karoldvl/ESC-50`). The committed `stream_esc50.py` streams from the Hub by
default; on this machine HF streaming required the heavy `torchcodec` decoder, so
features were computed from a **local ESC-50 clone** (identical data) via the
script's `--source local` fallback. Features are the firmware-matched 40×32 HTK
log-mel patch over the **first ~1.02 s** of each 5 s clip.

### Data sources & licenses

| Corpus | Role | License | Note |
|--------|------|---------|------|
| ESC-50 | **training corpus** (this weak-proxy path) | **CC BY-NC** | non-commercial — OK for WRCC demo/research; never republished, never commercial/field validation. **Flag before any product use.** |
| ASPID / SPIDB | stronger proxy (activity vs clean) — **not used here** | MIT | the intended primary proxy; needs a ~106 GB download (skipped on this no-download path) |
| InsectSound1000 | pretrain — **not used** | CC BY 4.0 | no clean/negative class |

## Features

HTK-mel log-mel patch, **40 × 32**, `sr=16000, n_fft=1024, hop=512, fmin=200,
fmax=8000`, per-clip mean-var normalization. Identical filterbank in
`ml/features/melspec.py` and `firmware/.../acoustic.cpp` (mirrored in `config.h`).
See `ml/features/params.py`.

## Metrics (proxy — from `eval_report/metrics.json`)

> **All numbers below are PROXY metrics** on a grouped held-out ESC-50 test fold
> (insect vs non-insect). They are **NOT** "RPW accuracy" and **NOT** the
> activity-vs-clean task. **n_test = 28 clips, only 8 positive → high variance.**

### Run provenance

| Field | Value |
|-------|-------|
| Model version | `cnn-esc50-stream-v1` |
| Trained on | ESC-50 (proxy) — flying-insect vs non-insect |
| Pretrain | none (InsectSound1000 has no clean class — no fabricated negative) |
| Source corpus | ESC-50, CC BY-NC (streamed `ashraq/esc50` / local clone fallback) |
| Split | grouped by ESC-50 fold — train {1,2,3} / val {4} / test {5} |
| Threshold (chosen) | **0.529** — precision-favoring, selected on **val** (not test) |
| Eval source file | `eval_report/metrics.json` |

### Headline (proxy) metrics

| Metric (proxy) | Value |
|----------------|------:|
| ROC-AUC | **0.831** |
| PR-AUC | **0.722** |
| Precision @ threshold 0.529 | **0.833** |
| Recall @ threshold 0.529 | **0.625** |
| F1 @ threshold 0.529 | **0.714** |

### Confusion matrix @ threshold 0.529 (proxy, grouped test fold, n=28)

|              | pred non-insect | pred insect |
|--------------|----------------:|------------:|
| **true non-insect** | 19 (TN) | 1 (FP) |
| **true insect**     | 3 (FN)  | 5 (TP) |

### Threshold selection (precision-favoring)

A false positive triggers a pesticide micro-dose on a healthy palm, so the
operating point favors precision off the proxy PR curve.

- Target precision: **0.80** (the precision floor aimed for)
- Selection set: the **validation fold (fold 4)**, *not* the test fold — the
  lowest threshold whose val precision ≥ 0.80 — so the reported test
  precision/recall are not optimistically tuned on the same data they score.
- Chosen threshold: **0.529**
- Resulting test recall: **0.625** (recall cost paid for the precision floor;
  measured test precision at this point is 0.833)
- Rationale: false-dose asymmetry — a false positive pesticides a healthy tree; a
  false negative is recoverable on the next listening window. Dosing is also
  human-armed + human-confirmed regardless (§3).

### Per-noise-condition breakdown

**N/A for this path.** ESC-50 has no per-recording noise-condition axis (that
axis belongs to the ASPID corpus's categorical `noise` column). With only ~8
positive test clips here, any sub-breakdown would be noise, not signal. A
support-gated per-condition table is populated only when the **ASPID** proxy path
is run (`prepare.aspid_prepare` → `train.train`), which carries the noise
condition through to `eval_report/metrics.json`.

## Highest-value next step (§9.10)

This is a **demo-grade weak proxy**. To make the number meaningful: (1) run the
**ASPID** proxy path (MIT, activity-vs-clean, per-noise-condition support) for a
stronger proxy, and (2) record **your own INMP441 clips** (palm log + mic,
controlled activity if available, plenty of clean farm ambient) and fine-tune +
**validate** on them. Metrics on *your* mic in *your* conditions are far more
credible to a judge than any proxy AUC.
