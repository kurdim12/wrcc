# Palm Guard — Dataset Selection & Real-Model Training Plan

**Purpose:** choose the dataset(s) to train an *actual* RPW acoustic-detection
model (replacing `heuristic-baseline-v0`), and document the choice honestly
enough to survive a domain-expert judge. The methodology *is* part of what we
show. See also `ml/prepare/DATASETS.md` (link list) and `ml/model_card.md`
(current status: no trained model yet).

---

## TL;DR — the decision

| Role | Dataset | Why |
|---|---|---|
| **Primary (signal)** | **ASPID / SPIDB** (Kaggle) | Stored-product beetles **boring/feeding in a substrate** — the closest functional analog to RPW larvae chewing inside a trunk. Ships with **clean controls + natural & artificial noise** → a real noise-robustness story. |
| **Backbone (modality)** | **InsectSound1000** (Kaggle / JKI) | Airborne-**microphone** insect audio at **16 kHz** — our exact sensor modality and sample rate. Large (≈169k labelled clips) → good for pretraining. |
| **Augment (ambient)** | **ESC-50** (GitHub) | Wind / rain / outdoor noise to simulate the daytime-farm problem. |
| **Validate (the capstone)** | **Your own INMP441 clips** | The only data on the *actual* sensor in *actual* conditions. This is what makes the metrics credible. |
| **Cite as field-validation target** | KAUST / Mankin RPW corpora | Real RPW, contact-probe, **on request** — name them as the next step, optionally email the authors. |

**Net result:** a real trained classifier with honest, reproducible metrics + a
methodology a judge respects — not a single dataset grab, and not a fake
"97% RPW" claim.

---

## Why there is no "perfect" RPW dataset (the honest constraint)

- RPW larvae feed **inside** the trunk. The sound is **structure-borne**
  vibration, strongest in the ~0.5–4 kHz band (one sensor study centers it near
  ~2.25 kHz), and reliably audible mainly in **quiet/close** conditions.
- Because it's structure-borne, **every real RPW acoustic system uses a contact
  sensor** — a piezoelectric probe or accelerometer inserted into the trunk
  (Hetzroni/Soroker in Israel; Mankin & Sutanto at King Saud/USDA; KAUST's
  fiber-optic DAS). None of these are released as open raw audio; the largest
  public-ish one (KAUST: 531 infested / 575 clean, 20 s clips, probe drilled
  35 cm into the trunk) is **on request**.
- **Our sensor is an INMP441 airborne mic.** So the literature's RPW data is,
  for us, both the **wrong modality** (contact, not airborne) *and*
  **unavailable**.

**Conclusion:** train on the best **open proxies**, disclose the two gaps
(modality + species), and validate on our own hardware. This is the defensible,
honest path — and it's exactly what the strongest published work does (they all
train on proxies/limited data and state the limits).

---

## The candidates (full comparison)

| Dataset | What it is | Modality | Signal / species | Size | Rate | Noise? | Open? | Fit |
|---|---|---|---|---|---|---|---|---|
| **ASPID / SPIDB** | Acoustic Stored Product Insect DB | **Contact piezo** (+ mic for noise ref) | Boring/feeding: cowpea beetle, confused flour beetle, mealworm/darkling | ~37 h | audio-band | **Yes** (natural + artificial) | **Kaggle** | ★★★★ primary |
| **InsectSound1000** | JKI greenhouse insect sounds | **Airborne mic** (4-ch, anechoic) | 12 insects (bumblebee→aphid midge); not borers | 169k clips / 1000 h | **16 kHz** | No (anechoic) | **Kaggle + JKI** | ★★★★ backbone/pretrain |
| **ESC-50** | Environmental sound | n/a (ambient) | wind, rain, birds, insects, etc. | 2k clips | 44.1 kHz | — | **GitHub** | ★★★ augmentation |
| **TreeVibes** | Wood-borer monitoring | Contact probe | Longicorn borer + *S. oryzae* in grain | moderate | audio-band | some | paper-linked | ★★ optional borer proxy |
| **KAUST RPW DL set** | Real RPW, Al-Ahssa palms | Contact probe (waveguide) | **Real RPW**, 531/575 | ~1,100 clips | 20 s | wind variants | **on request** | ★★★ validation target only |
| Woodboring AE (Zenodo) | Acoustic-emission in wood | AE piezo, **2 MHz** | wood borers, ultrasonic | — | 2 MHz | — | Zenodo | ✗ wrong band (not 16 kHz audio) |
| Generic "insect sound" Kaggle sets | misc | mixed | mixed | small | varies | — | Kaggle | ✗ low quality / unlabeled for our task |

**Download links**
- ASPID / SPIDB — https://www.kaggle.com/datasets/dkadyrov/stored-product-insect-database-spidb-aspids
- InsectSound1000 — https://www.kaggle.com/datasets/hesi0ne/insectsound1000 · source repo (JKI/OpenAgrar): https://doi.org/10.5073/20231024-173119-0 · paper: https://doi.org/10.1038/s41597-024-03301-4 · processing scripts: https://github.com/Jelt0/InsectSound1000Tools
- ESC-50 — https://github.com/karoldvl/ESC-50
- KAUST RPW paper (request data) — https://arxiv.org/abs/2308.15829
- Mankin/King Saud RPW acoustic work (request data) — https://doi.org/10.3390/insects14040339

> **Licenses:** verify each before any *commercial* use. InsectSound1000 is a
> Scientific Data release (typically CC BY — confirm on the JKI repo). ESC-50 is
> **CC BY-NC** (non-commercial — fine for the competition, flag for a product).
> ASPID — check the Kaggle page. For the competition (research/educational), all
> are usable.

---

## The pick, and the reasoning (why not just "the first one")

The two axes that matter — **signal type** (does it sound like RPW larvae
boring?) and **modality** (airborne mic like ours?) — are split across two
datasets. No single set wins both, so we use both with a clear job each:

1. **ASPID is primary** because, for *RPW specifically*, an insect **boring and
   feeding inside a substrate** is the closest available analog to larvae
   chewing inside a trunk — far closer than a bumblebee buzzing. And ASPID
   already contains **noise variants + clean controls**, giving a genuine
   "robust under farm noise" result instead of an anechoic toy number. Its
   weakness (contact-piezo, not airborne) is real and we disclose it.
2. **InsectSound1000 is the backbone** because it's the *only* large open corpus
   recorded with an **airborne microphone at 16 kHz** — our exact sensor and
   rate. Pretraining the feature extractor on it lets us honestly say the model
   has learned from airborne-mic audio at our sensor's rate before it ever sees
   ASPID.
3. **ESC-50** supplies outdoor ambient for augmentation (ASPID's noise + ESC-50
   = strong noise coverage).
4. **Your own INMP441 recordings** close the loop: a small set captured on the
   real device turns "proxy metrics" into "validated on our hardware".

**Rejected:** the woodboring **AE** dataset (2 MHz ultrasonic — outside our
16 kHz mic's range entirely) and generic Kaggle insect-sound dumps
(unlabeled/low quality for an activity-vs-clean task).

---

## Preprocessing — must match the firmware exactly

Everything funnels into the same representation the device produces (single
source of truth = `ml/features/params.py`, mirrored in `config.h`, implemented
identically in firmware `acoustic.cpp`):
- Resample all audio → **16 kHz mono**.
- Log-mel: `n_fft=1024, hop=512, n_mels=40, fmin=200, fmax=8000`, log/dB,
  per-clip mean-var normalization → **40×32 patch** (band-major flatten).
- Segment into fixed ~0.96–1.0 s clips, 50% overlap.
- **Split by `recording_id`** (no clip from one recording in two splits —
  prevents leakage and inflated scores). `ml/prepare/standardize.py` already
  stamps `recording_id = <source>:<file-stem>`.

---

## Training plan (executable with the repo as-is)

1. **Pretrain** the compact CNN on InsectSound1000 as airborne
   **insect-vs-silence** (learns general airborne insect features at 16 kHz).
   → produces `export/model.keras`.
2. **Fine-tune** on ASPID as **activity (boring/feeding) vs clean**, loading the
   pretrained weights with `train.py --init-from export/model.keras`, with
   **noise augmentation** (ASPID's own noise + ESC-50 mixing at varied SNR +
   SpecAugment + mixup — already in `train.py`).
3. **Calibrate** the output (temperature/isotonic) so `p_activity` is a real
   probability. _(Next step: add a `calibration.json`; `serve` reports
   `calibrated:true` when present — see `ml/serve/app.py`.)_
4. **Export** `saved_model/` (FastAPI service) and `model_int8.tflite`
   (on-device stretch) — `export/export_tflite.py`.
5. **Evaluate** on (a) the ASPID grouped holdout and (b) your INMP441 set.
   Report **ROC-AUC, PR-AUC, confusion matrix, precision/recall/F1 at the chosen
   threshold, and a per-SNR breakdown** (all emitted to `eval_report/`). Favor
   **precision** (a false dose is costly).

---

## The honest framing (what we CAN and CANNOT say)

- ✅ **CAN say:** *"A trained CNN detector (not a heuristic), pretrained on
  airborne insect audio at our 16 kHz rate and fine-tuned on boring/feeding-insect
  recordings with realistic noise. It scores X ROC-AUC / Y precision on the proxy
  holdout and Z on our own INMP441 recordings."*
- ❌ **CANNOT say:** *"Detects RPW with X% accuracy."* The model has never seen
  real RPW. Real-RPW field validation (via contact-probe data like KAUST's, or
  our own infested-palm recordings) is the **documented next step**.
- **Pitch / README one-liner:** *"Real RPW acoustic data is structure-borne,
  contact-sensor-based, and not public — so Palm Guard's detector is trained on
  open proxy corpora (boring/feeding insects + airborne insect audio at our
  16 kHz rate), noise-augmented, and validated on our own INMP441; field
  validation on real RPW is the next step."*

This is **stronger** than a dubious 97% claim: it shows command of the domain,
the sensor physics, and the limits — which is what separates a real engineering
project from a demo. (See `docs/CLAIMS_AUDIT.md` for the full must-not-claim list.)

---

## How to actually get the data and train

Network here is locked to GitHub/PyPI/npm — no Kaggle/Zenodo pulls — so two paths:

**A — Train locally (best for the big proxy datasets; `ml/train/train.py` runs):**
```bash
pip install -r ml/requirements-train.txt
pip install kaggle                                   # needs ~/.kaggle/kaggle.json
kaggle datasets download -d dkadyrov/stored-product-insect-database-spidb-aspids
kaggle datasets download -d hesi0ne/insectsound1000
git clone https://github.com/karoldvl/ESC-50         # ambient noise

cd ml
# Stage 1 — pretrain on InsectSound1000 (insect vs silence). Point standardize at
# its per-insect WAV folders (insect=activity) + a silence/clean folder, then:
python -m train.train --manifest data/manifest_is1000.csv --epochs 30 --version cnn-pretrain-v1
# Stage 2 — fine-tune on ASPID (boring/feeding vs control), with ESC-50 noise:
python -m train.train --manifest data/manifest_aspid.csv --esc50 data/ESC-50/audio \
       --init-from export/model.keras --epochs 40 --version cnn-aspid-v1
# Stretch — int8 edge build:
python -m export.export_tflite --saved export/saved_model --manifest data/manifest_aspid.csv
```
**Glue (~1 session):** each corpus has its own folder layout, so map its
subfolders to `activity`/`clean` with `ml/prepare/standardize.py`
(`--in <dir> --label <activity|clean> --source <tag>` — it walks the dir,
resamples to 16 kHz, windows, and appends to the manifest grouped by
`recording_id`). Confirm the exact subfolder names against the unzipped tree
first (don't guess them). InsectSound1000's processing scripts (linked above)
help with its layout.

**B — Validate here on real hardware:** record a small **INMP441 set** (clean
farm ambient + "activity": scraping/boring a palm log works as a stand-in) with
`tools/record_inmp441.py`, upload the WAVs, and I'll run prepare → train (or
fine-tune via `--init-from`) → export and hand back a real model + an honest
metrics report + the `.tflite`. Big proxy corpora are GB-scale and impractical
to upload — those stay on path A.

**Highest-credibility combo:** **A** for the trained-model-with-metrics story,
**B** for the "validated on our actual device" capstone.
