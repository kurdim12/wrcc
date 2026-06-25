<div align="center">

  <img src="frontend/public/logo.png" width="220" alt="Palm Guard logo" />

  # Palm Guard

  ### *"Hear the weevil before the palm falls."*

  **Solar-powered ESP32-S3 robotic node for acoustic Red Palm Weevil early-warning
  and human-confirmed targeted trunk micro-dosing.**

  Acoustic + vibration + temperature fusion · on-device edge AI · offline-first · Jordan-first, Gulf-ready

  <br />

  [![WRCC 2026](https://img.shields.io/badge/WRCC-2026%20Baku-003F2E?style=for-the-badge)]()
  [![Edge](https://img.shields.io/badge/Edge-ESP32--S3%20%C2%B7%20PlatformIO-003F2E?style=for-the-badge)]()
  [![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20SQLite-C2A14D?style=for-the-badge)]()
  [![Dashboard](https://img.shields.io/badge/Dashboard-React%20%2B%20Vite-003F2E?style=for-the-badge)]()
  [![ML](https://img.shields.io/badge/ML-TensorFlow%20%E2%86%92%20TFLite%20%C2%B7%20proxy--validated-C2A14D?style=for-the-badge)]()
  [![License](https://img.shields.io/badge/License-MIT-003F2E?style=for-the-badge)]()

  <br />

  **Listen early. Treat precisely. Prove every action.**

</div>

---

<p align="center">
  <img src="device-render.jpeg" width="100%" alt="Palm Guard node mounted on a date palm — three views" />
</p>

## What it is

**Palm Guard** is a low-cost, solar-powered robotic node that clamps onto a date-palm trunk and runs a complete **sense → decide → act → report** loop on its own — no internet required.

The Red Palm Weevil (RPW) kills date palms *from the inside*: the female lays eggs in the trunk, the larvae tunnel outward unseen, and by the time external symptoms show, the tree is usually beyond saving. Palm Guard closes that gap. It **listens** for the larvae feeding inside the trunk, **corroborates** with vibration and trunk temperature, **scores** a 0–100 risk on-device, and — for a confirmed high-risk tree — opens a **human-confirmed, safety-gated micro-dosing workflow** instead of blindly injecting chemical.

Every reading and every action is logged as a traceable evidence packet and streamed to a live dashboard.

Built for the **World Robot Caspian Cup — WRCC 2026, Baku** · Open Category · **Theme 1 — Agriculture**.

---

## Device & dashboard

| Field robot | CASEMAP dashboard |
|---|---|
| <img src="device-render.jpeg" width="100%" alt="Palm Guard device" /> | <img src="dashboard-preview.jpeg" width="100%" alt="Palm Guard CASEMAP dashboard" /> |

The dashboard shows a per-palm **case file** with a 0–100 risk ruler, a traceable **evidence packet** (acoustic, vibration and temperature signals with confidence), and a **safety gate** that holds any treatment for operator confirmation. **Demo mode runs clear water only**, per WRCC rule 5.8.

---

## How it works

```
   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌──────────────┐   ┌──────────┐
   │  SENSE   │ → │  EXTRACT  │ → │  SCORE   │ → │    AGREE     │ → │   ACT    │
   │ 3 sensors│   │ mel / FFT │   │ risk     │   │ threshold +  │   │ dose +   │
   │ on trunk │   │ features  │   │ 0–100    │   │ multi-sensor │   │ report   │
   └──────────┘   └───────────┘   └──────────┘   └──────────────┘   └──────────┘
                                                         │
                                              chemical dose? → SAFETY GATE
                                              (operator confirms · clear water in demo)
```

1. **Sense** — three sensors read the trunk continuously.
2. **Extract** — the ESP32-S3 runs an on-device FFT and builds mel-spectrogram / spectral features.
3. **Score** — an edge model fuses the signals into a single **0–100 risk score**.
4. **Agree** — treatment is considered only when the score crosses threshold **and** multiple sensors corroborate — which sharply cuts the false positives that sink single-microphone detectors.
5. **Act** — the node reports the event over the network. For a real chemical dose it **does not act alone**: a server- and device-enforced **safety gate** requires operator confirmation, with a hard volume limit. The WRCC booth runs the full loop live with **clear water only**.

---

## The 3-sensor stack

| Sensor | Part | Role | What it detects |
|---|---|---|---|
| 🎤 Acoustic | **INMP441** (I²S MEMS mic) | **Primary** | Low-amplitude larval feeding/boring sounds; energy in the low band with peaks near 2.4 kHz |
| 〰️ Vibration | **SW-420** (LM393 analog envelope on ADC) | Corroboration | Mechanical vibration as larvae bore through the wood — filters wind & random acoustic spikes |
| 🌡️ Temperature | **DS18B20** (1-Wire, waterproof) | Context | Internal trunk-temperature rise from larval metabolic activity |

Acoustic is the early-warning layer; vibration and temperature raise confidence through fusion. The node is solar-powered (LiPo + CN3065 charger + TPS63802 regulator), communicates over Bluetooth LE mesh / WiFi, and actuates a 5 V peristaltic pump via an IRF540 MOSFET, with a WS2812 status LED.

---

## Honesty & safety

This project is built to be **defensible in front of judges**, not over-hyped:

- **Proxy-validated, not field-proven.** The acoustic model is trained and validated on **proxy datasets** (ASPID insect acoustics, ESC-50 environmental sound) because real RPW field recordings are scarce — `cnn-aspid-v1`, **proxy ROC-AUC ≈ 0.90**, reproducible from the training scripts. Validation on live RPW-infested palms is the next step.
- **A transparent baseline by default.** With no trained-model artifacts in a fresh clone, the scoring service runs a clearly-labelled `heuristic-baseline-v0` (`calibrated=false`) — it **never returns a fabricated probability or metric**, and the dashboard renders it with a "heuristic" badge.
- **Human-confirmed treatment.** Detection and decisioning are autonomous; **chemical dosing is operator-confirmed** through a safety gate enforced by *both* the backend and the embedded device, with a hard volume limit.
- **Clear water in the booth.** The competition demo actuates with **clear water only**, per WRCC rule 5.8.
- **Built from off-the-shelf parts on purpose.** ESP32-S3, standard sensors and solar parts are affordable, available and repairable for a farmer — the originality is in the *integration*: firmware, fusion, enclosure, power chain, edge-AI logic, alert workflow and safety-gated actuation.

---

## Architecture

```
  ESP32-S3 node (firmware/)                         Cloud / on-prem
 ┌───────────────────────────┐                 ┌──────────────────────────────┐
 │ INMP441 · SW-420 · DS18B20│   HTTPS JSON     │ backend/  Node + Express     │
 │ on-device FFT + features  │ ───(/readings)──▶│ node:sqlite · Socket.IO      │
 │ risk score · dose FSM     │                 │ services/fusion.js ──┐        │
 │ pump (safety-gated) · LED │ ◀──(dose ACK)─── │                      ▼        │
 └───────────────────────────┘                 │  ml/  FastAPI /score          │
                                                │  (heuristic baseline ·        │
   frontend/  React + Vite + Tailwind  ◀──WS──  │   proxy CNN when trained)     │
   CASEMAP dashboard · live evidence            └──────────────────────────────┘
```

See [`system-architecture.png`](system-architecture.png) and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full diagram.

---

## Repository structure

```
wrcc/
├── firmware/palmguard-esp32s3/   ESP32-S3 firmware (PlatformIO / C++)
│   ├── src/
│   │   ├── main.cpp · detect.cpp
│   │   ├── sensors/              acoustic · vibration · temperature
│   │   ├── actuation/            pump · LED · dose_fsm (safety-gated)
│   │   └── net/                  WiFi manager · JSON poster
│   ├── include/config.h          pin map — single source of truth
│   └── platformio.ini
├── ml/                           acoustic model: prepare → train → eval → serve → export
│   ├── serve/app.py              FastAPI /score (heuristic baseline by default)
│   ├── train/                    TensorFlow training (CV + streaming)
│   ├── features/melspec.py       mel-spectrogram features
│   ├── prepare/                  proxy-corpus prep (ASPID, ESC-50) + DATASETS.md
│   ├── export/export_tflite.py   on-device int8 TFLite export
│   ├── model_card.md · requirements.txt · requirements-train.txt
├── backend/                      Node.js — Express + Socket.IO + node:sqlite
│   ├── server.js · routes/ · services/ · scripts/
├── frontend/                     React + Vite + Tailwind — CASEMAP dashboard
│   ├── src/ (components · pages · hooks · socket.js · api.js)
├── tools/                        record_inmp441 · serial_bridge · mock_device · seed
├── tests/                        pytest — device FSM · server caps
├── docs/                         20+ design docs (HARDWARE, ARCHITECTURE, DEMO_RUNBOOK …)
├── Dockerfile · render.yaml · railway.json   single-service deploy
└── Palm-Guard-Report-FINAL.pdf   the WRCC competition report
```

---

## Tech stack

| Layer | Stack |
|---|---|
| **Firmware** | ESP32-S3 · PlatformIO · C++ · on-device FFT · safety-gated dose FSM |
| **ML** | Python · TensorFlow → int8 TFLite · FastAPI scoring service · mel-spectrogram features |
| **Backend** | Node.js 22 · Express · Socket.IO · `node:sqlite` · zod · helmet |
| **Dashboard** | React 18 · Vite · Tailwind CSS · Recharts · socket.io-client · lucide-react |
| **Deploy** | Docker · Railway / Render (single service serving the built frontend) |

---

## Quick start

**Prerequisites:** Node.js **22+** (the backend uses the built-in `node:sqlite`), Python **3.10+** (for the ML service and tools), and [PlatformIO](https://platformio.org/) (for the firmware).

```bash
# 1) clone
git clone https://github.com/kurdim12/wrcc.git
cd wrcc

# 2) install backend + frontend
npm run install:all

# 3) run the dashboard + API together (http://localhost:5173 → http://localhost:3000)
npm run dev
```

Optional services:

```bash
# ML scoring service (FastAPI, heuristic baseline — no TensorFlow needed)
cd ml && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn serve.app:app --port 8001        # or:  npm run ml   (from repo root)

# feed the dashboard without hardware
npm run mock                              # simulated device readings
npm run seed                              # seed demo palms

# bridge a real ESP32-S3 over USB serial → backend
npm run bridge
```

Flash the firmware:

```bash
cd firmware/palmguard-esp32s3
# set your WiFi + backend URL in include/config.h (the single source of truth)
pio run -t upload && pio device monitor
```

> Pin map, wiring and bring-up are in [`firmware/palmguard-esp32s3/README.md`](firmware/palmguard-esp32s3/README.md) and [`docs/HARDWARE.md`](docs/HARDWARE.md).

---

## Components

- **Firmware** ([`firmware/palmguard-esp32s3/`](firmware/palmguard-esp32s3)) — reads the three sensors, runs an on-device FFT for the acoustic features, scores risk, drives the safety-gated dose FSM and the status LED, and POSTs a compact JSON payload to the backend on a fixed cycle.
- **ML** ([`ml/`](ml)) — a binary acoustic detector (`activity` vs `clean` → `p_activity`). Reproducible training on proxy corpora, a model card, and a light **FastAPI `/score`** service that defaults to a transparent heuristic baseline. See [`ml/README.md`](ml/README.md) and [`ml/prepare/DATASETS.md`](ml/prepare/DATASETS.md).
- **Backend** ([`backend/`](backend)) — Express + Socket.IO ingests device readings, calls the ML service per reading (`services/fusion.js`, with a local heuristic fallback so ingestion never blocks), persists to `node:sqlite`, and streams live evidence to the dashboard. Health check at `/api/v1/health`.
- **Dashboard** ([`frontend/`](frontend)) — the **CASEMAP** UI: per-palm case files, a risk ruler, an evidence stack, a live spectrogram, alerts, dose history, and the safety-gate / treatment-lock workflow.

---

## Deployment

Palm Guard deploys as **one** web service — the Express + Socket.IO backend serves the built React frontend on a single URL, with live data over WebSocket and a SQLite file on a **persistent disk/volume** so data survives restarts.

- **Railway** (recommended) — deploy from GitHub using the `Dockerfile`; add a volume at `/data` and set `PG_DB_PATH=/data/palmguard.db`. Do **not** set `PORT` (the platform injects it).
- **Render** — the `render.yaml` Blueprint provisions a native Node 22 service + a 1 GB disk at `/var/data`.

Full, step-by-step instructions are in [`DEPLOY.md`](DEPLOY.md).

---

## Documentation

The [`docs/`](docs) folder contains the full engineering record, including:
[`ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`HARDWARE.md`](docs/HARDWARE.md) · [`ESP32_SETUP.md`](docs/ESP32_SETUP.md) · [`INTELLIGENCE_LAYER.md`](docs/INTELLIGENCE_LAYER.md) · [`DATASET_SELECTION.md`](docs/DATASET_SELECTION.md) · [`MECHANICAL_DOSSIER.md`](docs/MECHANICAL_DOSSIER.md) · [`DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md) · [`BOOTH_PLAN.md`](docs/BOOTH_PLAN.md) · [`JUDGE_QA.md`](docs/JUDGE_QA.md) · [`CLAIMS_AUDIT.md`](docs/CLAIMS_AUDIT.md) · [`API.md`](docs/API.md) · [`SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md).

The full competition report is [`Palm-Guard-Report-FINAL.pdf`](Palm-Guard-Report-FINAL.pdf).

---

## Team — Vcoders

University of Petra · College of Information Technology · Amman, Jordan

| Member | Role | GitHub |
|---|---|---|
| **Abdalrahman Ali Ahmad AL-Kurdi** | Embedded & AI / CTO | [@kurdim12](https://github.com/kurdim12) |
| **Abdalrahman Alaa Jihad AL-Haymouni** | Operations / COO | [@aboodhaymouni](https://github.com/aboodhaymouni) |
| **Zaid Mahmoud Rajab Abu Al-Shaar** | Business / CBO | [@ZaidAbuAlshaar](https://github.com/ZaidAbuAlshaar) |

Coach: Dr. Abedal-Kareem Al-Banna (guidance & logistics).

---

## License

Released under the [MIT License](LICENSE).

<div align="center">
<br />
<sub>Palm Guard · Vcoders · WRCC 2026 — Baku, Azerbaijan</sub>
</div>
