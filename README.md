<div align="center">

<img src="frontend/public/logo.png" width="260" alt="Palm Guard Logo" />

# Palm Guard

### Early RPW acoustic risk detection + human-confirmed micro-dosing

#### A self-powered robotic node for date-palm protection

<br />

[![Platform](https://img.shields.io/badge/platform-ESP32--S3-003F2E?style=for-the-badge)]()
[![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20SQLite-C2A14D?style=for-the-badge)]()
[![Frontend](https://img.shields.io/badge/dashboard-React%20%2B%20Vite-003F2E?style=for-the-badge)]()
[![ML](https://img.shields.io/badge/ML-Heuristic%20Baseline-C2A14D?style=for-the-badge)]()
[![WRCC](https://img.shields.io/badge/WRCC-2026%20Baku-003F2E?style=for-the-badge)]()

<br />

**Palm Guard listens, scores risk, asks for human confirmation, and delivers a safe metered response — one palm at a time.**

</div>

---

## Overview

**Palm Guard** is a solar-powered, per-tree robotic monitoring node designed for early risk detection of **Red Palm Weevil** (*Rhynchophorus ferrugineus*) in date palms.

The device clamps to a palm trunk, listens for acoustic and vibration activity linked to internal feeding behavior, fuses that signal with environmental context, and sends live events to a backend dashboard.

When a high-risk event is detected, the system does **not** dose automatically.
Instead, it creates a **human-confirmed dosing workflow** with hard safety limits on both the server and device.

Built for the **World Robot Caspian Cup — WRCC 2026, Baku**.

---

## The Core Loop

<div align="center">

```text
Listen → Analyze → Score Risk → Alert → Human Confirm → Micro-dose → Log Evidence
```

</div>

Palm Guard is not just a sensor and not just a dashboard.
It is a complete robotic loop:

| Stage       | What Happens                                                   |
| ----------- | -------------------------------------------------------------- |
| **Sense**   | ESP32-S3 node captures acoustic/vibration/environment readings |
| **Analyze** | Backend + ML service score suspicious activity                 |
| **Decide**  | Fusion engine creates risk score and alert state               |
| **Confirm** | Human operator reviews the alert before any treatment          |
| **Act**     | Peristaltic pump delivers a metered demo dose                  |
| **Prove**   | Every alert, decision, command, and dose result is logged      |

---

## Why This Matters

Red Palm Weevil is difficult to detect early because larvae feed **inside** the palm trunk before obvious external symptoms appear.

By the time visual damage appears, treatment may be late.

Palm Guard aims to support:

* earlier detection attempts
* per-tree monitoring instead of blind field-wide treatment
* safer targeted response
* transparent evidence logs
* competition-ready robotic actuation
* a future path toward field-validated smart agriculture

---

## System Architecture

```text
┌──────────────────────────────┐
│      ESP32-S3 Palm Node       │
│──────────────────────────────│
│ • Acoustic sensing            │
│ • Vibration/environment input │
│ • Log-mel feature extraction  │
│ • Pump control FSM            │
│ • Dose safety caps            │
│ • Wi-Fi / Serial bridge       │
└───────────────┬──────────────┘
                │
                │ POST readings + features
                ▼
┌──────────────────────────────┐
│        Backend Server         │
│   Node.js + Express + SQLite  │
│──────────────────────────────│
│ • Device ingest               │
│ • Fusion scoring              │
│ • Alert rules                 │
│ • Dose state machine          │
│ • Socket.io live events       │
│ • Server-authoritative safety │
└───────────────┬──────────────┘
                │
        REST + WebSocket
                ▼
┌──────────────────────────────┐
│        Live Dashboard         │
│     React + Vite + Tailwind   │
│──────────────────────────────│
│ • Palm map                    │
│ • Risk score                  │
│ • Spectrogram                 │
│ • Alerts                      │
│ • ARM / DISARM                │
│ • Dose confirmation modal     │
│ • Dose history                │
│ • Model confidence badge      │
└───────────────┬──────────────┘
                │
                ▼
┌──────────────────────────────┐
│          ML Service           │
│            FastAPI            │
│──────────────────────────────│
│ • Heuristic baseline scorer   │
│ • Future trained model API    │
│ • Proxy-validation notes      │
│ • Model card                  │
└──────────────────────────────┘
```

---

## Honest Robotics Mandate

Palm Guard is designed to be impressive **without pretending the science is finished**.

### What is real today

* End-to-end backend pipeline
* Live React dashboard
* Mock device simulation
* Dose pending → confirm → downlink → done workflow
* Server-side dosing caps
* Device-side dosing caps
* Heuristic acoustic activity scoring
* Clear demo/proxy labelling
* Dose history and event logging

### What is not claimed yet

* No guaranteed real-world larvae detection in all farm conditions
* No large real airborne RPW dataset yet
* No trained RPW model yet
* No fully autonomous pesticide spraying
* No field deployment claim yet

The system is honest by design.
It shows what works now and clearly labels what still needs validation.

---

## Detection Reality

The current prototype uses an **INMP441 airborne MEMS microphone**.

That is important because RPW larvae feed inside the trunk, while an airborne microphone listens through air.

So v1 is most realistic in:

* quiet test conditions
* close-range placement
* night or low-noise environments
* controlled demonstrations
* early research trials

Future field versions should improve detection using:

* contact microphones
* piezo vibration sensors
* stronger trunk coupling
* better mechanical isolation
* real RPW-labelled field datasets
* supervised acoustic model training

---

## Dosing Safety

Palm Guard does **not** dose without human approval.

```text
High-risk event
      ↓
Dose-pending alert
      ↓
Operator reviews dashboard
      ↓
Operator confirms
      ↓
Server sends protected command
      ↓
Device checks cooldown + daily limit
      ↓
Pump runs metered demo dose
      ↓
Result is logged
```

Safety controls:

| Safety Layer    | Purpose                            |
| --------------- | ---------------------------------- |
| Human ARM       | Device must be intentionally armed |
| Human CONFIRM   | Operator approves each dose        |
| Server cooldown | Prevents repeated dosing           |
| Server max/day  | Limits total daily dose events     |
| Device cooldown | Independent embedded protection    |
| Device max/day  | Hardware-side daily cap            |
| Nonce command   | Prevents repeated command replay   |
| Dose history    | Creates traceable evidence         |

For WRCC and booth demos, the system should use **clear water or safe demo liquid only**.

---

## Dashboard Features

| Page               | Features                                           |
| ------------------ | -------------------------------------------------- |
| **Overview**       | Farm status, live risk, node health, active alerts |
| **Palms**          | Per-tree monitoring and device state               |
| **Alerts**         | High-risk events, confidence, timestamps           |
| **Dosing**         | Arm/disarm, pending confirmations, dose history    |
| **Mesh / Network** | Device connectivity and node status                |
| **Spectrogram**    | Acoustic activity visualization                    |
| **Reports**        | Logged detections, events, and system evidence     |

---

## Repository Structure

```text
Palm-Guard/
├── firmware/
│   └── palmguard-esp32s3/
│       ├── ESP32-S3 firmware
│       ├── sensor capture
│       ├── log-mel features
│       ├── Wi-Fi / serial bridge
│       └── pump dose FSM
│
├── backend/
│   ├── Node.js / Express API
│   ├── SQLite database
│   ├── Socket.io live stream
│   ├── fusion scoring
│   ├── alert rules
│   └── dose engine
│
├── frontend/
│   ├── React dashboard
│   ├── Vite
│   ├── Tailwind
│   ├── live spectrogram
│   ├── alerts
│   └── dosing workflow
│
├── ml/
│   ├── FastAPI scorer
│   ├── log-mel feature pipeline
│   ├── heuristic baseline
│   ├── training pipeline
│   └── model card
│
├── tools/
│   ├── mock_device.py
│   ├── seed_palms.py
│   └── serial_bridge.py
│
└── docs/
    ├── BUILD_SPEC.md
    ├── HARDWARE.md
    ├── ARCHITECTURE.md
    └── API.md
```

---

## Run Without Hardware

Palm Guard can run fully using the mock device.

### 1. Start the ML scorer

```bash
cd ml

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
uvicorn serve.app:app --port 8001
```

The current scorer is a **heuristic baseline**, not a trained RPW model.

---

### 2. Start the backend

Requires **Node.js 22+**.

```bash
cd backend

cp .env.example .env
npm install
npm run dev
```

Backend:

```text
http://localhost:4000
```

---

### 3. Start the dashboard

```bash
cd frontend

npm install
npm run dev
```

Dashboard:

```text
http://localhost:5173
```

---

### 4. Seed demo palms

```bash
python tools/seed_palms.py --server http://localhost:4000
```

---

### 5. Run a mock device

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000
```

---

## Demo the Dose Loop

1. Open the dashboard
2. Go to **Dosing**
3. Select device `PG-001`
4. Click **Arm**
5. Trigger a forced event:

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000 \
  --force-event
```

6. A **dose-pending** modal appears
7. Click **Confirm**
8. The node receives the downlink command
9. The mock pump action completes
10. Dose history shows the result as `done`

This demonstrates the full robotic chain:

```text
Sense → Score → Alert → Confirm → Act → Record
```

---

## Firmware

The firmware is built with PlatformIO.

### Main firmware

```bash
cd firmware/palmguard-esp32s3

pio run -e palmguard -t upload
pio device monitor
```

### Wi-Fi firmware

```bash
pio run -e palmguard_wifi -t upload
```

### I2C / 1-Wire scanner

```bash
pio run -e detect -t upload
```

---

## Current Build Status

| Component             | Status                      |
| --------------------- | --------------------------- |
| Backend API           | Working                     |
| SQLite storage        | Working                     |
| Socket.io live events | Working                     |
| Dashboard             | Working                     |
| Mock device           | Working                     |
| Dosing workflow       | Working in host + mock flow |
| ML scorer             | Heuristic baseline live     |
| Trained RPW model     | Not yet                     |
| Firmware code         | Written to spec             |
| Hardware flashing     | Pending                     |
| Bench test            | Pending                     |
| Field validation      | Pending                     |

---

## Technical Highlights

* ESP32-S3 per-tree robotic node
* solar-powered deployment concept
* acoustic activity monitoring
* log-mel feature extraction
* FastAPI ML scoring service
* real-time backend events
* React live dashboard
* spectrogram visualization
* server-authoritative dose control
* device-side dose safety caps
* human-confirmed actuation
* complete mock demo without hardware
* clear proxy-data and model-status labelling

---

## Roadmap

### Phase 1 — Competition Prototype

* complete dashboard
* complete backend
* complete mock device
* demonstrate live alerts
* demonstrate human-confirmed dosing
* show dose history and safety caps

### Phase 2 — Hardware Bench Test

* flash ESP32-S3 firmware
* verify microphone capture
* test pump control
* test power behavior
* validate firmware dose caps
* test enclosure mounting

### Phase 3 — Detection Improvement

* collect real trunk recordings
* test contact sensors
* compare airborne vs contact sensing
* build labelled RPW / non-RPW dataset
* train supervised acoustic model
* publish honest validation metrics

### Phase 4 — Field Pilot

* deploy on multiple palms
* monitor solar reliability
* evaluate farm noise
* work with agricultural experts
* validate treatment protocol
* improve model from real-world data

---

## Competition Positioning

Palm Guard fits the WRCC robotics theme because it combines:

* embedded sensing
* signal processing
* autonomous risk scoring
* live communication
* robotic actuation
* safety interlocks
* operator confirmation
* evidence logging

It is a complete precision-agriculture robotic system, not only an IoT monitor.

---

## Suggested GitHub Description

```text
Solar ESP32-S3 palm node for early RPW acoustic risk scoring and human-confirmed micro-dosing.
```

---

## Suggested Tagline

```text
Listen early. Treat precisely. Prove every action.
```

---

## Owner

**Abdelrahman Kurdi**
vcoders / IEEE UoP
University of Petra

---

<div align="center">

### Palm Guard

#### Precision protection for every palm.

</div>
