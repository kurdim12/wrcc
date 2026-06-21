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

## Session 2 — Phase 3 hardening + Tier 2 de-risking

### Task 1 — Offline / flaky-network degradation ✅ (verified)
- **Firmware:** `wifi_mgr` now enables SDK auto-reconnect and exposes a
  non-blocking `wifi_tick()` (throttled `WiFi.reconnect()` kick, never blocks)
  called each loop in the HTTP path — re-syncs after a venue WiFi drop. Serial
  path is one-way and never blocks. (Code review; not flashed.)
- **Backend:** verified **Rule 5** offline marking + auto-recover on a throwaway
  DB: device gap → `status=offline` + active OFFLINE alert; reappearance →
  alert auto-`resolved`. Ingestion already tolerant of gaps.
- **Frontend:** Socket.IO auto-reconnect made explicit (infinite attempts,
  capped backoff); `useConnectivity` (socket events + /health poll),
  `ConnectionBanner` (amber "reconnecting" / red "backend unreachable", hides on
  recovery — no reload), and an `ErrorBoundary` around the page area so a
  transient bad data shape never white-screens. ML-down is already handled
  server-side (heuristic fallback → "heuristic" badge). `vite build` clean.
- DoD met: kill ML (fallback), kill/restart backend (banner + auto-recover),
  drop socket (reconnecting state + auto-resume) — all without a reload.

### Task 2 — Seeded believable farm + scripted demo event ✅ (verified)
- `services/demoFarm.js`: shared 16-node roster (12 healthy / 2 elevated / 1
  high / 1 offline) + per-intensity payload builder + level-scaled mel patch —
  used by BOTH the seeder and the live driver so they stay consistent.
- `scripts/seedFarm.js` (`npm run seed:farm`): direct-DB seed of palms +
  devices + baselines (warmup done) + **~48 h backdated readings** (the high
  node ramps — an emerging-infestation story) + a HIGH_RISK + OFFLINE alert +
  2 past doses. Idempotent. Verified: 16 palms, 1552 readings, 3-day trend.
- `demoMode.js` rewritten to drive the roster live (round-robin, one node per
  600 ms, skips the offline node so Rule 5 stays demoable) with a **per-device
  dose simulator** that closes the dose loop on stage (adopts arm, executes the
  downlink under local failsafes, echoes the nonce).
- `POST /api/v1/system/demo-event {device_id,cycles}` drives a scripted
  infestation spike. Verified: a healthy node climbs to risk ~75 (high) on
  command, and with arm+auto_confirm the dose goes pending→sent→**done** fully
  through the demo driver. Demo banner stays (all nodes are PG-DEMO).
- DoD met: fresh boot shows a credible live farm; the scripted event runs the
  whole detect→fuse→alert→(armed+confirm)→dose→history pipeline on command.

### Task 3 — Polish (honesty + states + legibility) ✅
- **Honesty sweep:** removed the fabricated **"70-80% Accuracy"** landing stat
  (and the unbuilt 500m-mesh / optimistic-battery / "24/7" stats) → replaced
  with true, defensible ones (sensor fusion, proxy model status, human-confirmed
  dosing, solar). Softened "Guaranteed Yield / detects larvae 3–6 months early /
  simple and effective" to defensible early-warning copy.
- **Spectrogram honesty:** the page hardcoded a "2-5 kHz RPW signature band" and
  a Trigger still citing the **removed ~4.5 kHz centroid**. Reframed the overlay
  to the ~0.5-4 kHz **feeding band (literature guide; model owns the call)**,
  relabeled "RPW signature detected" → "High acoustic activity (model)", fixed
  all band labels, and added a **heuristic/proxy badge** next to the
  SA = 100·P(activity) readout. Fixed the "2-5 kHz" string in LiveAnalysis.
- Confidence/proxy badge now appears wherever a model score shows (palm drawer +
  spectrogram). Empty/loading states retained ("collecting…", "No doses yet").
- `vite build` clean.

### Task 4 — Prove the safety logic without flashing ✅ (tests pass)
- `tests/test_device_fsm.py` (7 pass): device-side gauntlet via `DoseSim` (the
  host port of `dose_fsm.cpp`) — disarmed, pump_ms≤MAX, cooldown, daily-cap,
  anti-replay, pump_ms==0 each block.
- `tests/test_server_caps.py` (12 pass): spawns a fresh backend (temp DB+port,
  ML in fallback) and asserts the server doseEngine independently enforces:
  disarmed → no pending; armed+sustained → pending → confirm → sent+nonce →
  downlink within hard cap; device ack → done; cooldown → no new pending;
  no-resend of a completed dose; pump_ms>3000 rejected; confirm-while-disarmed
  rejected. → BOTH guards proven independently (§3).
- **Bug found + fixed by the tests:** cooldown used `last_dose_s != 0` as the
  "never dosed" sentinel, which collides with a real dose at uptime second 0.
  Fixed with an explicit `has_dosed` flag in BOTH `DoseSim` and the firmware
  `dose_fsm.cpp`.
- `tests/run_all.sh` runner + `tests/README.md`.

### Task 5 — Prove the ML path on toy data ✅ (verified)
- `ml/prepare/make_toy_corpus.py`: 10 activity (tone bursts + clicks) + 10 clean
  (noise) synthetic WAVs (stdlib `wave`, clearly fake).
- Ran the REAL pipeline: `standardize` → 80 grouped clips → `train.train`
  (Keras-3 fix: save `.keras` for serving + `model.export()` SavedModel for
  TFLite) → `export_tflite` → **`model_int8.tflite` (36 KB)**.
- `serve` auto-loads it: `/health` → `model_loaded:true`,
  `model_version:"TOY-DATA-not-real-v0"`, `calibrated:false`; `/score` returns
  from the trained model. (Outputs are meaningless toy outputs — by design.)
- **Honesty:** everything labelled TOY — metrics.json note, model_version, and a
  new red **"TOY — not real"** UI badge (ConfidenceBadge + spectrogram). All toy
  artifacts gitignored/regenerable; real corpora + own INMP441 clips drop in
  with the same commands. installed train deps (TF 2.21, librosa, sklearn, pandas).

### Task 6 — Bench-readiness docs + capture helper ✅
- `docs/BENCH_BRINGUP.md`: toolchain, pin discovery, per-sensor smoke test, the
  ~1 s mel-window timing + RAM check, a safe **DRY** pump/LED test (bench 5 V, no
  reservoir) with failsafe checks, end-to-end against the real backend incl. a
  WiFi-drop test, and the §9.10 self-recording protocol.
- `tools/record_inmp441.py`: host-audio or firmware-UDP capture of labelled
  16 kHz clips named for `prepare/standardize.py` grouping. Compiles clean.

### Task 7 — Claims/report alignment ✅
- `docs/CLAIMS_AUDIT.md`: 14-row claim→reality table + an explicit "MUST NOT
  claim yet" list (no accuracy/AUC, no trained-on-RPW, no autonomy, no
  mesh/range/battery/field-tested, no fixed RPW frequency) + the safe claims.

### Known limits / TODO (current)
- **Firmware unbuilt** (no PlatformIO here): follow `docs/BENCH_BRINGUP.md` to
  validate the ~1 s mel capture timing/RAM and the pump/LED/dose paths on the
  board before the field demo.
- **No trained model** (by design/honesty): pipeline proven on TOY data only.
  Record own INMP441 clips (`tools/record_inmp441.py`), run `train.py`, fill
  `model_card.md` with real **proxy** metrics; `serve` then auto-loads it.
- **Phase 4** (judge Q&A rehearsal; on-device TFLite-Micro; BLE/ESP-NOW
  multi-node; bilingual UI) remains — all explicitly out of scope for this PR.
