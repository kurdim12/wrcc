<div align="center">

<img src="frontend/public/logo.png" width="210" alt="Palm Guard logo" />

# Palm Guard

### *Hear the weevil before the palm falls.*

**A solar-powered ESP32-S3 robotic node for early Red Palm Weevil warning, edge-AI risk scoring, and human-confirmed targeted trunk micro-dosing.**

<br />

[![WRCC 2026](https://img.shields.io/badge/WRCC-2026%20Baku-003F2E?style=for-the-badge)]()
[![Theme](https://img.shields.io/badge/Theme-Agriculture-C2A14D?style=for-the-badge)]()
[![Edge AI](https://img.shields.io/badge/Edge%20AI-ESP32--S3-003F2E?style=for-the-badge)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js%2022%20%2B%20SQLite-C2A14D?style=for-the-badge)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-React%20%2B%20Vite-003F2E?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-003F2E?style=for-the-badge)]()

<br />

**Listen early. Score locally. Treat precisely. Prove every action.**

</div>

---

<p align="center">
  <img src="device-render.jpeg" width="100%" alt="Palm Guard robotic node mounted on a date palm" />
</p>

---

## 01 · Project snapshot

| Category            | Palm Guard                                                                           |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Competition**     | World Robot Caspian Cup — WRCC 2026, Baku                                            |
| **Category**        | Open Category · Theme 1 — Agriculture                                                |
| **Problem**         | Red Palm Weevil infestation is hidden inside the trunk until serious damage appears  |
| **Solution**        | A solar-powered robotic node that senses, scores, alerts, and safety-gates treatment |
| **Core loop**       | Sense → Extract → Score → Agree → Act → Report                                       |
| **Main controller** | ESP32-S3                                                                             |
| **Sensors**         | INMP441 acoustic mic · SW-420 vibration · DS18B20 trunk temperature                  |
| **AI layer**        | On-device FFT/features + proxy-validated acoustic model path                         |
| **Dashboard**       | CASEMAP live case file: risk, evidence, alerts, dose history, safety gate            |
| **Demo safety**     | Clear water only · human-confirmed actuation · hard volume limits                    |

---

## 02 · The problem

The Red Palm Weevil does not attack loudly from the outside.

It hides inside the trunk.

By the time a farmer sees visible symptoms, the palm may already be severely damaged. Traditional inspection is slow, manual, and often too late.

Palm Guard is built around one idea:

> **Do not wait for the palm to look sick. Listen before the damage becomes visible.**

---

## 03 · What Palm Guard does

**Palm Guard** is a low-cost, solar-powered robotic node that clamps onto a date-palm trunk and runs a complete local decision loop.

It:

1. **Listens** for acoustic activity from inside the trunk.
2. **Corroborates** the signal using vibration and temperature.
3. **Scores** each palm with a 0–100 risk value.
4. **Reports** every reading to a live dashboard.
5. **Safety-gates** any treatment behind operator confirmation.
6. **Logs** every action as traceable evidence.

Palm Guard is not only a sensor.

It is a robotic field node that can sense, decide, communicate, and actuate through a controlled safety workflow.

---

## 04 · Device and dashboard

| Field robotic node                                                                           | CASEMAP dashboard                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| <img src="device-render.jpeg" width="100%" alt="Palm Guard device mounted on a palm tree" /> | <img src="dashboard-preview.jpeg" width="100%" alt="Palm Guard CASEMAP dashboard" /> |

The dashboard turns every palm into a live case file.

It shows the current risk score, sensor evidence, acoustic activity, vibration confirmation, temperature context, alerts, dose history, and treatment lock status.

---

## 05 · How the system works

```text
┌──────────┐     ┌────────────┐     ┌──────────┐     ┌─────────────┐     ┌──────────┐
│  SENSE   │ ──▶ │  EXTRACT   │ ──▶ │  SCORE   │ ──▶ │    AGREE    │ ──▶ │   ACT    │
│ sensors  │     │ FFT / mel  │     │ 0–100    │     │ fusion gate │     │ report   │
└──────────┘     └────────────┘     └──────────┘     └─────────────┘     └──────────┘
                                                              │
                                                              ▼
                                                    Human-confirmed
                                                     safety gate
```

### The loop

| Stage       | What happens                                                             |
| ----------- | ------------------------------------------------------------------------ |
| **Sense**   | The node reads acoustic, vibration, and trunk-temperature signals        |
| **Extract** | The ESP32-S3 runs FFT and builds acoustic features                       |
| **Score**   | A risk score from 0–100 is calculated                                    |
| **Agree**   | Treatment is considered only when the score and supporting sensors agree |
| **Act**     | The node reports the event and waits for safety-gated confirmation       |
| **Prove**   | Every reading, alert, and actuation is logged                            |

---

## 06 · Three-sensor fusion

| Sensor              | Part                             | Role           | Why it matters                                                |
| ------------------- | -------------------------------- | -------------- | ------------------------------------------------------------- |
| 🎤 **Acoustic**     | INMP441 I²S MEMS mic             | Primary signal | Detects low-amplitude feeding and boring sound patterns       |
| 〰️ **Vibration**    | SW-420 LM393 analog envelope     | Corroboration  | Helps filter random acoustic spikes, wind, and handling noise |
| 🌡️ **Temperature** | DS18B20 waterproof 1-Wire sensor | Context        | Adds trunk-condition context for confidence scoring           |

Acoustic is the early-warning layer.

Vibration and temperature do not replace it. They make the decision more defensible by reducing false positives from single-sensor detection.

---

## 07 · Safety-first actuation

Palm Guard separates detection from treatment.

Detection is autonomous.

Treatment is safety-gated.

For real treatment, the node does **not** blindly inject. A chemical dose requires:

* operator confirmation,
* backend approval,
* embedded-device approval,
* a hard dose-volume cap,
* logged dose history,
* and a clear event trail.

For the WRCC booth demo, the pump runs with **clear water only**, following WRCC rule 5.8.

---

## 08 · Honesty and validation

Palm Guard is designed to be defendable in front of judges.

| Claim                   | How we handle it                                                     |
| ----------------------- | -------------------------------------------------------------------- |
| **Model performance**   | Proxy-validated, not field-proven                                    |
| **Dataset limitation**  | Real RPW field recordings are scarce                                 |
| **Default scoring**     | Fresh clones use a labelled `heuristic-baseline-v0`                  |
| **No fake probability** | The dashboard clearly marks heuristic mode as `calibrated=false`     |
| **Treatment**           | Human-confirmed, safety-gated, and volume-limited                    |
| **Demo chemical use**   | Clear water only                                                     |
| **Off-the-shelf parts** | Used intentionally for cost, repairability, and farmer accessibility |

The acoustic model path uses proxy datasets such as ASPID insect acoustics and ESC-50 environmental sound. The current model card reports `cnn-aspid-v1` with proxy ROC-AUC around `0.90`.

Field validation on real RPW-infested palms is the next step.

---

## 09 · Architecture

```text
ESP32-S3 robotic node                              Backend / dashboard
┌──────────────────────────────┐                 ┌──────────────────────────────┐
│ INMP441 acoustic sensor      │                 │ Node.js + Express            │
│ SW-420 vibration sensor      │                 │ Socket.IO live stream        │
│ DS18B20 trunk temperature    │                 │ SQLite event storage         │
│                              │                 │                              │
│ On-device FFT + features     │   HTTPS JSON    │ Fusion service               │
│ Risk scoring                 │ ─────────────▶  │ ML scoring fallback          │
│ Safety-gated dose FSM        │ ◀─────────────  │ Dose approval workflow       │
│ Pump + WS2812 status LED     │   dose ACK      │                              │
└──────────────────────────────┘                 └──────────────┬───────────────┘
                                                                 │
                                                                 ▼
                                                       React CASEMAP dashboard
```

Full details are available in:

* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
* [`docs/HARDWARE.md`](docs/HARDWARE.md)
* [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md)
* [`docs/JUDGE_QA.md`](docs/JUDGE_QA.md)
* [`docs/CLAIMS_AUDIT.md`](docs/CLAIMS_AUDIT.md)

---

## 10 · Repository structure

```text
wrcc/
├── firmware/palmguard-esp32s3/
│   ├── src/
│   │   ├── main.cpp
│   │   ├── detect.cpp
│   │   ├── sensors/
│   │   ├── actuation/
│   │   └── net/
│   ├── include/config.h
│   └── platformio.ini
│
├── ml/
│   ├── serve/app.py
│   ├── train/
│   ├── features/melspec.py
│   ├── prepare/
│   ├── export/export_tflite.py
│   ├── model_card.md
│   └── requirements.txt
│
├── backend/
│   ├── server.js
│   ├── routes/
│   ├── services/
│   └── scripts/
│
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       ├── socket.js
│       └── api.js
│
├── tools/
├── tests/
├── docs/
├── Dockerfile
├── render.yaml
├── railway.json
└── Palm-Guard-Report-FINAL.pdf
```

---

## 11 · Tech stack

| Layer          | Stack                                                           |
| -------------- | --------------------------------------------------------------- |
| **Embedded**   | ESP32-S3 · PlatformIO · C++ · FFT · safety-gated FSM            |
| **Sensors**    | INMP441 · SW-420 · DS18B20                                      |
| **Actuation**  | 5 V peristaltic pump · IRF540 MOSFET · hard dose cap            |
| **ML**         | Python · TensorFlow · TFLite export · FastAPI `/score`          |
| **Backend**    | Node.js 22 · Express · Socket.IO · `node:sqlite` · zod · helmet |
| **Dashboard**  | React 18 · Vite · Tailwind CSS · Recharts · lucide-react        |
| **Deployment** | Docker · Railway · Render · persistent SQLite volume            |

---

## 12 · Quick start

### Prerequisites

* Node.js 22+
* Python 3.10+
* PlatformIO
* ESP32-S3 board for firmware flashing

### Run backend and dashboard

```bash
git clone https://github.com/kurdim12/wrcc.git
cd wrcc

npm run install:all
npm run dev
```

Dashboard:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:3000
```

---

## 13 · Optional services

### Run the ML scoring service

```bash
cd ml
python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
uvicorn serve.app:app --port 8001
```

Or from the repository root:

```bash
npm run ml
```

### Feed the dashboard without hardware

```bash
npm run mock
npm run seed
```

### Bridge a real ESP32-S3 over USB serial

```bash
npm run bridge
```

---

## 14 · Firmware flashing

```bash
cd firmware/palmguard-esp32s3

pio run -t upload
pio device monitor
```

Before flashing, update WiFi and backend settings in:

```text
firmware/palmguard-esp32s3/include/config.h
```

This file is the single source of truth for the firmware pin map and network configuration.

---

## 15 · Deployment

Palm Guard deploys as one web service.

The Express backend serves the built React dashboard, streams live data over Socket.IO, and stores data in SQLite on a persistent disk.

### Railway

Use the included `Dockerfile`.

Recommended environment:

```text
PG_DB_PATH=/data/palmguard.db
```

Add a persistent volume mounted at:

```text
/data
```

Do not set `PORT`; Railway injects it automatically.

### Render

Use the included `render.yaml`.

The blueprint provisions:

* Node.js 22 service,
* built React frontend,
* backend API,
* Socket.IO stream,
* 1 GB persistent disk.

Full deployment steps are in [`DEPLOY.md`](DEPLOY.md).

---

## 16 · Key documents

| Document                                                       | Purpose                                |
| -------------------------------------------------------------- | -------------------------------------- |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                 | Full system architecture               |
| [`docs/HARDWARE.md`](docs/HARDWARE.md)                         | Wiring, components, power, and sensors |
| [`docs/ESP32_SETUP.md`](docs/ESP32_SETUP.md)                   | ESP32-S3 setup guide                   |
| [`docs/INTELLIGENCE_LAYER.md`](docs/INTELLIGENCE_LAYER.md)     | Fusion and scoring logic               |
| [`docs/DATASET_SELECTION.md`](docs/DATASET_SELECTION.md)       | Dataset choices and limitations        |
| [`docs/MECHANICAL_DOSSIER.md`](docs/MECHANICAL_DOSSIER.md)     | Enclosure and mechanical design        |
| [`docs/DEMO_RUNBOOK.md`](docs/DEMO_RUNBOOK.md)                 | Live booth demonstration plan          |
| [`docs/BOOTH_PLAN.md`](docs/BOOTH_PLAN.md)                     | Booth setup and presentation flow      |
| [`docs/JUDGE_QA.md`](docs/JUDGE_QA.md)                         | Expected judge questions               |
| [`docs/CLAIMS_AUDIT.md`](docs/CLAIMS_AUDIT.md)                 | Claim-by-claim honesty audit           |
| [`docs/API.md`](docs/API.md)                                   | Backend API reference                  |
| [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md) | Competition submission checklist       |

Competition report:

[`Palm-Guard-Report-FINAL.pdf`](Palm-Guard-Report-FINAL.pdf)

---

## 17 · Team

<div align="center">

### Vcoders

University of Petra · College of Information Technology · Amman, Jordan

</div>

| Member                                 | Role                | GitHub                                               |
| -------------------------------------- | ------------------- | ---------------------------------------------------- |
| **Abdalrahman Ali Ahmad AL-Kurdi**     | Embedded & AI / CTO | [@kurdim12](https://github.com/kurdim12)             |
| **Abdalrahman Alaa Jihad AL-Haymouni** | Operations / COO    | [@aboodhaymouni](https://github.com/aboodhaymouni)   |
| **Zaid Mahmoud Rajab Abu Al-Shaar**    | Business / CBO      | [@ZaidAbuAlshaar](https://github.com/ZaidAbuAlshaar) |

**Coach:** Dr. Abedal-Kareem Al-Banna
Guidance and logistics

---

## 18 · License

Released under the [MIT License](LICENSE).

---

<div align="center">

<br />

### Palm Guard

**Listen early. Treat precisely. Prove every action.**

<sub>Vcoders · University of Petra · WRCC 2026 — Baku, Azerbaijan</sub>

</div>
