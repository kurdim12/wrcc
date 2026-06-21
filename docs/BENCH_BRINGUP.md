# Bench bring-up (firmware not yet flashed)

The firmware is written to spec but **not compiled/flashed in this environment**
(no PlatformIO). This is the start-to-finish checklist to validate it on a real
ESP32-S3-DevKitC-1 + the BOM in `docs/HARDWARE.md`. Apply the §5.2 electrical
fixes first (logic-level MOSFET, dedicated 5 V branch, status-only LED).

## 0. Toolchain
```bash
pip install platformio          # or use the PlatformIO IDE extension
cd firmware/palmguard-esp32s3
cp include/secrets.h.example include/secrets.h   # set WiFi + backend IP
```

## 1. Pin / bus discovery
```bash
pio run -e detect -t upload && pio device monitor   # 115200
```
Confirm the I2C scan finds the BME680 (addr 0x76/0x77) and 1-Wire finds the
DS18B20 (family 0x28). Update `include/config.h` pins if they differ. If BME680
is absent, set `PG_BME680_PRESENT 0` (don't show a dead channel).

## 2. Sensor smoke test (serial node, no WiFi)
```bash
pio run -e palmguard -t upload && pio device monitor
```
Watch the `#PG#{...}` JSON lines. Per channel:
- **acoustic** — `rms` rises when you talk/scrape near the mic; `bands16` shifts.
- **vibration** (SW-420) — `vib_rms`/`vib_pk` rise when you tap the module.
- **thermal** (DS18B20) — `core_c` tracks the probe; warm it with a finger.
- **env** (BME680) — `hum`/`pres`/`gas_kohm` present (gas needs ~20 min warm-up).
Bridge it to the dashboard: `python tools/serial_bridge.py --port <COM> --backend http://<host>:4000`.

## 3. Log-mel window: timing + RAM (the risky bit)
`acoustic_capture_mel()` captures a contiguous ~1 s window (`PG_MEL_FRAMES=32`
frames at `hop=512`) → a 40×32 patch. Verify on hardware:
- **Timing:** the `[t] cycle=…ms` line should be ≈1.0–1.3 s when `PG_MEL_SEND=1`.
  If too slow, reduce `PG_MEL_FRAMES` (and match `ml/features/params.py`) or
  duty-cycle the mel capture (every N cycles).
- **RAM:** confirm no allocation failures / resets. Buffers: window 1024 + agg
  512 + FFT 2×1024 + patch 1280 floats (~30 KB). Print `ESP.getFreeHeap()` if unsure.
- **Match:** the device patch must equal `ml/features/melspec.py` output (same
  HTK mel, hop, normalization). Spot-check by feeding the same WAV through both.

## 4. Actuation DRY test (NO reservoir / tube primed)
Run the pump branch from a **bench 5 V supply**, pump inlet/outlet in air (dry):
```bash
pio run -e palmguard_wifi -t upload && pio device monitor
```
- On boot the gate must read **OFF** (pull-down holds it low); LED shows boot→idle.
- Arm from the dashboard (Dosing page) → LED → armed (blue). Confirm a dose →
  serial shows `[dose] DOSING <pump_ms> ms` and the pump runs for exactly that
  bounded time, then OFF. Verify the LED returns to armed.
- Failsafes: try to dose twice quickly → second is `REJECT: cooldown`. Set
  `pump_ms` > 3000 server-side (rejected) — the device also clamps. Toggle the
  physical disarm (if `PG_DISARM_PIN` wired) mid-dose → pump cuts immediately.
- Only after dry tests pass: prime the tube + reservoir with water (not pesticide)
  and repeat, measuring delivered volume vs `volume_ml_est` to calibrate
  `PUMP_FLOW_ML_PER_S` in `backend/services/doseEngine.js`.

## 5. End-to-end against the real backend
With backend + ML running (`npm run backend`, `uvicorn serve.app:app --port 8001`)
and the node on `palmguard_wifi`:
1. Node appears online; readings carry `ac.mel` → `p_activity` on the dashboard.
2. Drop the venue WiFi → node keeps looping; `wifi_tick()` re-syncs on return
   (no reboot). Backplane marks it offline after 5 min, recovers on return.
3. Arm → induce activity (scrape the log) until risk ≥ 61 sustained → confirm the
   dose modal → pump fires → dose lands in history as `done`.

## 6. Record your own data (§9.10) — highest-value step
```bash
python tools/record_inmp441.py --label clean    --session ambientA --clips 20
python tools/record_inmp441.py --label activity --session logtapB  --clips 20
```
Capture protocol: quiet/close/night where possible; many minutes of real farm
ambient as "clean"; controlled scraping/knocking of a palm log (or real insect
activity if available) as "activity"; vary distance + background noise. Keep one
`--session` per physical setup so the grouped split never leaks. Then
`prepare.standardize` both folders and re-run `train.train` for honest,
**your-mic** metrics (label them clearly; they replace the heuristic baseline).
