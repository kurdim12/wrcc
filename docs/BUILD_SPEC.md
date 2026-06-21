# Palm Guard — Build Spec (authoritative essentials)

This is the normative reference the code must keep honoring. Full mission/phase
detail lives with the team; the sections below are the parts that are
safety-critical, judge-graded, or easy to silently violate.

## §2 The honesty mandate

- **Airborne mic ≠ guaranteed larvae detection.** INMP441 is airborne; larvae
  are structure-borne inside the trunk. Reliable mainly in quiet/close/night.
  Don't imply farm-wide, all-weather detection from one air mic.
- **The model is proxy-validated.** No large open airborne real-RPW dataset
  exists; train on proxy boring/feeding sounds and report metrics **on the proxy
  set**, labelled as such.
- **Confirm before you poison a tree.** Dosing is human-armed + confirmed, with
  hard caps. Never ship fully-autonomous spraying.
- **Show confidence, not certainty.** UI shows a probability + a
  proxy/heuristic badge, never "98% accurate".

## §3 Non-negotiable constraints

**ALWAYS**
- Human in the dosing loop: dose requires `device.armed` **and** a confirmation
  step (or an explicit `auto_confirm` policy that is still gated by arm + caps).
- Enforce dose failsafes on **both** server and device: max doses/day, min
  cooldown, max single-dose duration.
- Display model output as a probability with the proxy/heuristic caveat.
- Use real, reproducible metrics for any number shown anywhere.
- Resample/normalize all audio to 16 kHz mono before training.
- Split train/val/test **by recording/source** (group key = `recording_id`).

**NEVER**
- Auto-dose without arm + confirm.
- Hardcode a detection threshold as "the RPW frequency" (the 4.5 kHz centroid is
  removed; the model owns acoustics).
- Invent accuracy numbers or dataset contents.
- Drive 5 V pump / LED strip off the 3.3 V rail or raw VBAT.
- Block the main firmware loop or backend ingestion on network/ML I/O.

## Feature contract (firmware ⇄ ml MUST match exactly)

Log-mel patch **40×32**, band-major flatten, per-clip mean-var normalized,
`sr=16000, n_fft=1024, hop=512, fmin=200, fmax=8000`, HTK mel
(`2595·log10(1+f/700)`), triangular filters on linear FFT bins (`i·SR/N`).
Single source of truth: `ml/features/params.py`, mirrored in
`firmware/.../include/config.h`, implemented identically in `acoustic.cpp`.

## Dose lifecycle (§10.4)

`risk_fused ≥ 61` sustained for K=3 readings **and** `device.armed`
→ `pending` → operator **Confirm** (or `auto_confirm`) → `sent` + nonce
→ device poll receives `cmd{dose,pump_ms,nonce}` (only if server caps pass)
→ device doses through its own failsafes → echoes `act.last_nonce` → `done`.
Server caps **mirror** device caps; both must pass. Two independent guards.

## §15 Whole-system Definition of Done

Capture → log-mel → ML score → multi-sensor fusion → alert → **armed +
confirmed** dose (caps enforced both sides) → dashboard reflects device truth
(risk, confidence, dose history). Every number on screen traces to a real
evaluation. No autonomous spraying. No dead channel shown as live.

---

## Appendix B — Scientific facts to keep claims accurate

- RPW larvae feed **inside** the trunk; first detectable signal is the
  boring/feeding noise of young larvae (~12 days with sensitive sensors).
  (Nature Sci. Rep. 2020.)
- Feeding energy sits **low** — ~2.25 kHz reported; boring "clicks" roughly
  **0.5–4 kHz**, **not** ~4.5 kHz. The old hardcoded 4.5 kHz centroid was wrong;
  the trained model owns the spectral decision. (Gutiérrez et al.)
- Larval sound is reliably audible mainly in **quiet/low-noise** conditions and
  **close to the transducer** (grain/wood attenuates with distance) — hence the
  airborne-mic honesty caveat and noise-augmented training.
- 16 kHz (Nyquist 8 kHz) comfortably covers the feeding band; the limit is SNR
  and coupling, not bandwidth.

## Appendix C — Old-repo issues, and how this rebuild resolved them

1. **No pump/actuation/dose code** → built `firmware/actuation/*` + backend
   `doseEngine` + dose routes + frontend dosing UI.
2. **No ML model/pipeline** ("AI" was a heuristic) → built `ml/` (features,
   FastAPI scorer, training pipeline, model card). No model trained yet →
   honest heuristic baseline.
3. **BME680 disabled** → `PG_BME680_PRESENT 1` (degrades gracefully if absent).
4. **Hardcoded 4.5 kHz centroid** in risk score → removed; model owns acoustics.
5. **FFT length mismatch** (2048 vs 1024) → unified to 1024 in `config.h`.
6. **Stale "MPU6050" comment** → it's SW-420; vibration is corroboration only.
7. **Hardware** (non-logic-level IRF540, no 5 V rail, 60-LED strip over budget,
   redundant 3rd temp sensor) → documented in `docs/HARDWARE.md`; firmware
   assumes the fixes.

Plus a latent bug fixed: `baseline.js` read flat fields from a nested payload, so
thermal/VOC baselines never updated (ST/SVOC ≈ 0). Now reads the nested payload.
