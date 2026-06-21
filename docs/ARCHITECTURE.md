# Palm Guard - Architecture

## High-level data flow

```
                                        +------ 30s normal / 2s stream --+
                                        |                                |
   ESP32-S3 + INMP441 / MPU6050 / ----HTTP POST--->  Express :4000       |
   DS18B20 / BME680                 /api/v1/readings    |                |
                                                        v                |
                                                   zod-validated        |
                                                   payload              |
                                                        |                |
                                                        v                |
                                                  riskScore.compute()    |
                                                        |                |
                                                        v                |
                                                  better-sqlite3 ---> readings table
                                                        |                |
                                                        +-> alertEngine.evaluate()
                                                        |
                                                        v
                                                  Socket.IO broadcast
                                                  (live:reading,
                                                   live:alert)
                                                        |
                                                        v
                                                  React dashboard :5173
                                                  (KPI cards, map, charts,
                                                   alert center, live spectrogram)
```

## Components

| Layer | Technology | File / folder |
|---|---|---|
| Sensor node | ESP32-S3 + Arduino + ESP-DSP | `firmware/palmguard-esp32s3/` |
| Backend HTTP / WS | Node.js + Express + Socket.IO | `backend/server.js` |
| Storage | `node:sqlite` (built-in, no native deps) | `backend/data/palmguard.db` |
| Risk-score engine | Pure JS, formulas from `full_report.txt` §4.3.1 | `backend/services/riskScore.js` |
| Alert engine | 7-rule evaluator with dedup index | `backend/services/alertEngine.js` |
| Frontend | Vite + React 18 + Tailwind + recharts + Socket.IO client | `frontend/` |
| Mock device | Python 3.11 + `urllib` | `tools/mock_device.py` |
| Hardware bring-up | PlatformIO + Arduino framework | `firmware/palmguard-esp32s3/` |

## Multi-sensor risk score

```
RiskScore = wA·SA  +  wV·SV  +  wT·ST  +  wVOC·SVOC

  SA   = 35·click_norm + 30·band_ratio + 20·peakiness + 15·centroid_match  (INMP441)
  SV   = 60·tanh(rms_g/0.15) + 40·spectral_match(dom_hz, 5-25 Hz)         (MPU6050)
  ST   = max(0, core_c - baseline - 0.5) · 25                              (DS18B20)
  SVOC = 80·max(0, IAQ_dev - IAQ_farm) + 20·humidity_correction            (BME680)

  Defaults:  wA=0.40   wV=0.25   wT=0.20   wVOC=0.15
  Adaptive:  wind > 0.5g  -> down-weight A,V; up-weight T,VOC
             amb<10 || amb>40°C -> down-weight T
             chemical event in last 72h -> down-weight VOC
  Classification:  0-30 = low, 31-60 = medium, 61-100 = high
```

## Alert rules

| # | Type | Trigger | Severity |
|---|---|---|---|
| 1 | `HIGH_RISK`        | `risk_score ≥ 61`                         | critical |
| 2 | `MEDIUM_SUSTAINED` | risk in [31,60] for 3 consecutive readings | warning |
| 3 | `ANOMALY_SPIKE`    | `Δrisk > 25` between two readings          | warning |
| 4 | `LOW_BATTERY`      | `battery_pct < 15` (max 1×/24h)            | low |
| 5 | `OFFLINE`          | `last_seen > 5 min` (auto-resolves)        | warning |
| 6 | `THERMAL_STRESS`   | `core_c - amb_c > 4°C` for 2 readings      | warning |
| 7 | `VOC_SURGE`        | gas resistance drops > 40% in < 1 h        | warning |

Dedup is enforced by a partial unique index `alerts(device_id, type) WHERE status='active'`.

## Cycle timing

| Mode | Cadence | Use case |
|---|---|---|
| Normal | **30 s** | Default Listen-and-Sleep operation; matches the technical-report power budget. |
| Stream | **2 s** | Activated when a dashboard subscribes to the Live Spectrogram page. ESP32 includes 16-band spectrum (`bands16`). Auto-expires after 60 s. |

## Database retention

| Window | Action |
|---|---|
| < 7 days   | full row in `readings`                              |
| 7-30 days  | aggregated to `readings_hourly` (still keeps `bands_json` / `peaks_json`) |
| 30-90 days | `bands_json` and `peaks_json` dropped (~10× shrink)  |
| > 90 days  | hard-deleted from `readings`                        |

Run by `services/retention.js` via `node-cron` at 02:30 daily.

## Why this stack

- **node:sqlite** instead of better-sqlite3: Node 24 has no prebuilt better-sqlite3 binary for ABI 137, and the user shouldn't need Visual Studio Build Tools to run a dashboard. The built-in module is API-compatible enough.
- **Vite + React** instead of CRA: faster dev cycle, smaller bundle, better Tailwind integration, and the existing `code.txt` mockup is already React.
- **PlatformIO** instead of Arduino IDE: multi-file C++ projects, cleaner library management, headless builds.
- **ESP-DSP** instead of arduinoFFT: 16× faster FFT on ESP32-S3 thanks to LX7 SIMD.
- **HTTP POST** (not MQTT/WS from the device): simpler firmware, easier debugging, and 30 s cadence doesn't need a persistent connection.

The whole stack runs on a single machine over `localhost`. The only network requirement is the ESP32 being on the same WiFi as the PC.
