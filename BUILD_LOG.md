# BUILD_LOG

One bullet per session: what changed, what's verified working, what's stubbed.
Honesty mandate (§2): nothing here claims a metric that wasn't measured.

## Session 1 — rebuild foundation + actuation loop + ML service (Phases 0–2)

### Phase 0 — Foundation ✅ (DoD met)
- Created the monorepo (§7): ported `backend/`, `frontend/`, `firmware/`,
  `tools/`, `docs/` from the reference repo; added `ml/`.
- **Firmware config fixes:** unified FFT length to **1024** (removed the
  `-DPG_FFT_N=2048` override that disagreed with `config.h`, Appendix C #5);
  enabled **BME680** (`PG_BME680_PRESENT 1`, env_init degrades gracefully if
  absent, §8.2); added actuation pins + dose failsafes + log-mel params.
- **Backend cleanup:** removed the hardcoded **4.5 kHz RPW centroid** from the
  acoustic score (Appendix C #4 — the model owns acoustics now); fixed the stale
  **MPU6050 → SW-420** comment (Appendix C #6, SV is corroboration only).
- **Bugfix (latent in old repo):** `baseline.js update()` read flat fields
  (`reading.core_c`/`gas_kohm`) from a NESTED payload, so the thermal + gas
  baselines never updated and ST/SVOC were ~always 0. Now reads the nested
  payload. _Verified:_ infested readings now reach risk ~77 (was stuck ~57).
- Wrote `docs/HARDWARE.md` (§5.2 electrical fixes + pin map + power budget).
- **Verified:** backend boots on Node 22 `node:sqlite`; auto demo-mode streams;
  `seed_palms.py` seeds 40 palms; dashboard builds (`vite build`, 0 errors).

### Phase 1 — Actuation loop ✅ (DoD met)
- **Firmware (new):** `actuation/pump`, `actuation/led`, `actuation/dose_fsm`
  with the full failsafe gauntlet (armed + pump_ms≤MAX + cooldown + daily cap +
  nonce anti-replay) and a hard-kill disarm. `poster` now sends the `act` block +
  `ac.mel` and parses the `{stream_bands, armed, cmd}` downlink; `main` applies
  arm state + the dose command each HTTP cycle. Added `palmguard_wifi` PlatformIO
  env (HTTP transport carries the downlink). **NOT compiled/flashed** — no
  PlatformIO in this environment; written to spec, needs bench validation.
- **Backend (new):** `doses` table + device dose-policy columns (§10.5; idempotent
  migration in `db.js`); `services/doseEngine.js` (server-authoritative state
  machine, caps mirror the device); `routes/doses.js` + arm/policy/manual-dose on
  `routes/devices.js`; Rule 0 + downlink wired into `ingest.js`; dose socket
  events; stale-dose expiry cron.
- **mock_device.py:** simulates the device dose FSM end-to-end — adopts server
  arm state, applies local failsafes, executes the downlink, echoes
  `act.last_nonce` to close the loop.
- **Verified end-to-end** (backend + mock): arm → 3 sustained high-risk readings
  → `pending` dose → confirm → downlink `cmd{dose,pump_ms,nonce}` → device
  "DOSING" → `act.last_nonce` echo → `done`; subsequent doses blocked by cooldown
  cap. Both server and device-side caps enforced.

### Phase 2 — ML pipeline ⏳ (service live; NO trained model yet)
- `ml/features/{params,melspec}.py`: HTK-mel log-mel patch (40×32, sr=16k,
  n_fft=1024, hop=512, fmin=200, fmax=8000, per-clip mean-var norm) — **identical
  filterbank to firmware `acoustic.cpp`** (verified the math matches; single
  source of truth in `params.py` mirrored in `config.h`).
- `ml/serve/app.py`: FastAPI `/score` + `/health`. **No trained model exists**,
  so it runs a transparent **heuristic baseline** (`heuristic-baseline-v0`,
  `calibrated=false`). _Verified:_ clean patch → P≈0.15, infested → P≈0.90.
- `services/fusion.js`: live readings carry real `p_activity` from the ML
  service; `SA = 100·p_activity`. On ML failure it falls back to a transparent
  heuristic tagged `fallback`; **ingestion never blocks** (timeout + fallback).
  _Verified:_ live readings show `model: heuristic-baseline-v0`.
- Training pipeline (`prepare/standardize.py`, `train/{model,train}.py`,
  `export/export_tflite.py`) written and reproducible, **NOT executed** — no
  corpora downloaded and we must not fabricate metrics. `model_card.md` states
  "no model trained yet" and `eval_report/` is empty until `train.py` runs.

### Frontend ✅ (Phases 1 + 3 UI)
- Added **Dosing page** (arm/disarm per device, caps, manual dose, dose history),
  global **DoseConfirmModal** (human-in-the-loop gate on `dose:pending`),
  **ConfidenceBadge** (P(activity) + "proxy-validated"/"heuristic" badge, never
  "98% accurate"), and arm/dose controls + confidence in `PalmDetailDrawer`.
  _Verified:_ `vite build` succeeds.

### Known limits / TODO
- Firmware unbuilt (no PlatformIO here): bench-validate I2S timing/RAM of the
  ~1 s mel capture and the pump/LED/dose paths before the field demo.
- No trained model: record own INMP441 clips (§9.10), run `train.py`, fill
  `model_card.md` with real **proxy** metrics; then `serve` auto-loads it.
- Phase 3 polish (offline-degradation pass, seeded believable farm) and Phase 4
  (report alignment, judge Q&A rehearsal, on-device TFLite stretch) outstanding.
