# Datasets (Appendix A) — the data for "training the data"

> **Honest summary:** there is **no large open, airborne-mic, real-RPW** dataset.
> Train on proxies (insects boring/feeding, recorded acoustically), augment with
> ambient noise, validate honestly, and **record your own INMP441 data** (§9.10).
> **Verify each licence before any commercial use** — most are fine for
> research/competition; some are non-commercial.

Place downloads under `ml/data/` (gitignored). Then run `prepare/standardize.py`
to produce 16 kHz mono clips + `data/manifest.csv`.

## Primary proxy — boring/feeding sounds (train "activity vs clean")

- **ASPID — Acoustic Stored Product Insect Dataset** (~37 h; rice/granary
  weevil + lesser grain borer + **clean controls**, silent and with noise).
  Internal-feeder boring = closest functional proxy for RPW larvae.
  Kaggle: <https://www.kaggle.com/search?q=ASPID+stored+product+insect> ·
  context: <https://pmc.ncbi.nlm.nih.gov/articles/PMC12987122/>
- **TreeVibes** (wood-borer vibration via probe; incl. *S. oryzae* in wheat).
  CC BY paper + dataset: <https://www.mdpi.com/2624-6511/4/1/17>
- **Generic insect-sound set** (smaller, secondary):
  <https://www.kaggle.com/datasets/heuristicsoft/dataset-for-insect-sound>

## Airborne-mic insect audio @16 kHz (great for pretraining)

- **InsectSound1000** (>1000 h, anechoic 4-ch, **16 kHz / 32-bit**, designed
  for DL pretraining): <https://pmc.ncbi.nlm.nih.gov/articles/PMC11082239/>
- **InsectSet459** (open bioacoustic benchmark): <https://arxiv.org/abs/2503.15074>

## Closest real RPW corpus (vibro-acoustic, probe-based; likely on request)

- **Early Detection of RPW via DL Classification of Acoustic Signals** — 531
  infested / 575 not, 20 s clips, probe in trunk. Request from authors:
  <https://arxiv.org/abs/2308.15829>
- **Fiber-optic DAS RPW** (12-day larvae): <https://www.nature.com/articles/s41598-020-60171-7>
  · <https://doi.org/10.3390/s21051592>

## Ambient / negative audio for augmentation (the daytime-farm noise problem)

- **ESC-50** (50 environmental classes): <https://github.com/karoldvl/ESC-50>
  _(CC BY-NC 3.0 — non-commercial; fine for the competition, flag for product.)_
  Pass its `audio/` dir to `train.py --esc50` for SNR-varied noise mixing.

## Acoustic-emission (ultrasonic, MHz — reference only, NOT the 16 kHz model)

- Woodboring-insect AE on Zenodo (2 MHz sensors): <https://zenodo.org/records/16315621>

---

### Scientific facts to keep claims accurate (Appendix B)

- RPW larvae feed **inside** the trunk; first detectable signal is the
  boring/feeding noise of young larvae (~12 days with sensitive sensors).
- Feeding energy sits **low** (~2.25 kHz reported; clicks roughly 0.5–4 kHz),
  **not** ~4.5 kHz — so the old hardcoded 4.5 kHz centroid was dropped; the
  model owns the spectral decision.
- Larval sound is reliably audible mainly in **quiet/close/night** conditions
  (grain/wood attenuates with distance) — hence noise-augmented training.
- 16 kHz (Nyquist 8 kHz) comfortably covers the feeding band; the limit is SNR
  and coupling, not bandwidth.
