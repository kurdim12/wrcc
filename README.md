<div align="center">

<img src="frontend/public/logo.png" width="230" alt="Palm Guard Logo" />

# Palm Guard

### *"Hear the weevil before the palm falls."*

### Early RPW acoustic risk detection + human-confirmed micro-dosing

#### A self-powered robotic field node for precision date-palm protection

#### WRCC 2026 · Open Category · **Theme 1 — Agriculture**

<br />

[![WRCC](https://img.shields.io/badge/WRCC-2026%20Baku-003F2E?style=for-the-badge)]()
[![Platform](https://img.shields.io/badge/Edge-ESP32--S3-003F2E?style=for-the-badge)]()
[![Backend](https://img.shields.io/badge/Backend-Node.js%20%2B%20SQLite-C2A14D?style=for-the-badge)]()
[![Dashboard](https://img.shields.io/badge/Dashboard-React%20%2B%20Vite-003F2E?style=for-the-badge)]()
[![ML](https://img.shields.io/badge/ML-Heuristic%20%2B%20Proxy%20CNN%20\(0.90%20AUC%2C%20proxy\)-C2A14D?style=for-the-badge)]()
[![License](https://img.shields.io/badge/License-MIT-003F2E?style=for-the-badge)]()

<br />

## **Listen early. Treat precisely. Prove every action.**

</div>

---

<p align="center">
  <img src="device-render.jpeg" width="100%" alt="Palm Guard device mounted on a date-palm trunk" />
</p>

---

## The Product

**Palm Guard** is a solar-powered robotic monitoring node designed to help detect early **Red Palm Weevil** risk in date palms and support a safer, targeted response workflow.

The node mounts directly onto a palm trunk, captures acoustic, vibration, and environmental evidence, sends structured readings to a backend, and displays live risk evidence on a professional dashboard.

When the system identifies a high-risk event, it does **not** blindly dose. Instead, it opens a **human-confirmed micro-dosing workflow** with hard safety limits enforced by both the server and the embedded device.

Built for the **World Robot Caspian Cup — WRCC 2026, Baku**.

---

## Executive Snapshot

<table>
  <tr>
    <td><strong>Problem</strong></td>
    <td>Red Palm Weevil damage is often hidden inside the trunk until visible symptoms appear late.</td>
  </tr>
  <tr>
    <td><strong>Solution</strong></td>
    <td>A per-tree robotic node that listens, scores risk, alerts operators, and supports confirmed micro-dosing.</td>
  </tr>
  <tr>
    <td><strong>Core Hardware</strong></td>
    <td>ESP32-S3, acoustic sensing, vibration/environment inputs, solar power, and a peristaltic pump actuator.</td>
  </tr>
  <tr>
    <td><strong>Software Stack</strong></td>
    <td>Node.js, Express, SQLite, Socket.io, FastAPI, React, Vite, and Tailwind.</td>
  </tr>
  <tr>
    <td><strong>Safety Model</strong></td>
    <td>Human-arm + human-confirm + server caps + device caps + nonce protection + full dose logging.</td>
  </tr>
  <tr>
    <td><strong>Current ML Status</strong></td>
    <td>Heuristic baseline ships by default. A proxy CNN (<code>cnn-aspid-v1</code>) is trained and grouped-CV-evaluated on open ASPID proxy data with ROC-AUC ≈ 0.90 and PR-AUC 0.926. Proxy only — <strong>not RPW, not field-validated</strong>. Model artifacts are gitignored, so a fresh clone serves the heuristic baseline.</td>
  </tr>
</table>

---

## Core Robotic Loop

<div align="center">

```text
Sense → Score → Alert → Human Confirm → Micro-dose → Log Evidence
```

</div>

Palm Guard is designed as a complete robotic loop, not just an IoT monitor.

| Stage       | What Palm Guard Does                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| **Sense**   | Captures acoustic, vibration, trunk-temperature, and environmental readings from a per-tree node |
| **Score**   | Converts readings into activity/risk indicators using edge features and backend fusion           |
| **Alert**   | Raises high-risk events with context, confidence, and sensor evidence                            |
| **Confirm** | Requires operator review before any dose command                                                 |
| **Act**     | Runs a metered pump action through a protected command path                                      |
| **Prove**   | Logs detection, command, dose result, and history for accountability                             |

---

# The Field Device

<p align="center">
  <img src="device-mounted.jpeg" width="100%" alt="Palm Guard field device mounted on a date-palm trunk" />
</p>

The **Palm Guard field device** is the physical robotic node mounted directly on the palm trunk.

It is responsible for sensing, local signal processing, status feedback, safety-gated actuation, and sending evidence packets to the backend.

The device is designed to be low-cost, repairable, solar-powered, and realistic for agricultural environments.

---

## Device Responsibilities

| Function                  | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| **Acoustic sensing**      | Captures feeding-like acoustic activity using the INMP441 microphone |
| **Vibration sensing**     | Adds mechanical confirmation through the SW-420 vibration sensor     |
| **Trunk temperature**     | Adds local trunk-temperature context using the DS18B20 sensor        |
| **Environmental context** | Tracks surrounding conditions using the BME680 sensor                |
| **Edge processing**       | Runs FFT / log-mel feature extraction on the ESP32-S3                |
| **Risk reporting**        | Sends structured readings and evidence packets to the backend        |
| **Actuation**             | Controls the pump through a protected dose FSM                       |
| **Safety control**        | Enforces cooldown, daily limits, and command validation on-device    |
| **Status feedback**       | Uses LED states to show device mode, risk state, and treatment lock  |

---

## Device Hardware

| Part                   | Role                                     |
| ---------------------- | ---------------------------------------- |
| **ESP32-S3**           | Main controller and edge-processing unit |
| **INMP441**            | Acoustic activity capture                |
| **SW-420**             | Vibration confirmation                   |
| **DS18B20**            | Trunk-temperature context                |
| **BME680**             | Environmental context                    |
| **Peristaltic pump**   | Metered micro-dosing actuator            |
| **MOSFET driver**      | Pump switching and protection            |
| **Solar + LiPo power** | Outdoor autonomous power concept         |
| **WS2812 LED**         | Visual device status                     |

The originality is not in using rare components.

The originality is in the **integration**: sensing, firmware, signal processing, safety logic, actuation, evidence reporting, dashboard explanation, and judge-ready traceability.

---

## Device Sensor Stack

| Sensor                          | Role                  | What it contributes                                                     | Honesty Boundary                                        |
| ------------------------------- | --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| **INMP441 acoustic mic**        | Primary signal        | Captures acoustic activity that may resemble feeding or boring patterns | Reports acoustic activity, not guaranteed RPW detection |
| **SW-420 vibration sensor**     | Corroboration         | Adds mechanical evidence when the trunk has vibration activity          | Confirmation only                                       |
| **DS18B20 trunk temperature**   | Biological context    | Tracks local trunk-temperature behavior                                 | Context only                                            |
| **BME680 environmental sensor** | Environmental context | Adds humidity, pressure, VOC, and air-condition context                 | Does not prove infestation alone                        |

Palm Guard does not rely on one microphone alone.

The system uses multi-sensor evidence to make the risk score more defensible and to reduce false positives from random sound spikes, wind, or handling noise.

---

## Device Safety Logic

The device has its own protection layer.

Even if the backend sends a command, the ESP32-S3 firmware checks safety conditions before running the pump.

```text
Receive command
      ↓
Validate command nonce
      ↓
Check ARM state
      ↓
Check cooldown
      ↓
Check daily limit
      ↓
Run metered pump action
      ↓
Report result
```

| Device-Side Safety Layer | Purpose                                               |
| ------------------------ | ----------------------------------------------------- |
| **ARM state**            | Prevents accidental treatment mode                    |
| **Nonce validation**     | Reduces repeated-command replay risk                  |
| **Cooldown**             | Blocks repeated pump actions too close together       |
| **Daily cap**            | Limits total dose events per day                      |
| **Metered pump timing**  | Keeps actuation controlled and measurable             |
| **Result reporting**     | Confirms whether the command completed or was blocked |

For WRCC and booth demonstrations, the pump should use **clear water only**.

---

# The CASEMAP Dashboard

<p align="center">
  <img src="dashboard-preview.jpeg" width="100%" alt="Palm Guard dashboard overview" />
</p>

The **CASEMAP dashboard** is the operator and judging interface for Palm Guard.

It does not simply show a number.

It explains why the system raised a risk event, what evidence supports it, whether the model is calibrated or heuristic, and whether treatment is locked or allowed.

The dashboard turns every monitored palm into a live case file.

---

## Dashboard Responsibilities

| Module                      | Purpose                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Farm overview**           | Shows all monitored palms and device health                                          |
| **Palm case file**          | Displays one palm’s latest readings, risk, and event history                         |
| **Risk ruler**              | Shows the current 0–100 fused risk score                                             |
| **Evidence packet**         | Breaks down acoustic, vibration, temperature, environment, and sensor-health signals |
| **Live spectrogram**        | Visualizes acoustic activity for the demo                                            |
| **Alerts**                  | Highlights high-risk palm events                                                     |
| **ARM / DISARM control**    | Prevents accidental actuation                                                        |
| **Dose confirmation modal** | Requires human approval before a dose command                                        |
| **Dose history**            | Logs all dose attempts, completions, and blocked actions                             |
| **Model status labels**     | Clearly separates heuristic, proxy, and future field-validated models                |

---

## Dashboard Philosophy

The dashboard is built around one judge-facing question:

> **Can we prove why the robot made this decision?**

Palm Guard avoids a black-box “infected / not infected” claim.

Instead, the dashboard shows:

* the fused risk score,
* the sensor evidence behind it,
* acoustic activity patterns,
* vibration confirmation,
* environmental context,
* sensor-health status,
* model mode and calibration label,
* treatment lock status,
* and the full action history.

---

## Device vs Dashboard

| Field Device                 | CASEMAP Dashboard                       |
| ---------------------------- | --------------------------------------- |
| Physical robotic node        | Software command and evidence interface |
| Mounted on the palm trunk    | Used by operator, farmer, or judge      |
| Reads sensors directly       | Explains the sensor evidence            |
| Runs local signal extraction | Displays live risk and confidence       |
| Controls the pump FSM        | Confirms or blocks treatment            |
| Enforces device-side limits  | Enforces server-side limits             |
| Sends readings to backend    | Streams readings, alerts, and history   |
| Works offline-first          | Gives traceability and decision clarity |

The device creates the evidence.

The dashboard explains the evidence.

Together, they form the complete Palm Guard robotic system.

---

# System Architecture

<p align="center">
  <img src="system-architecture.png" width="100%" alt="Palm Guard system architecture" />
</p>

```mermaid
flowchart LR
  A[ESP32-S3 Palm Node<br/>Acoustic + vibration + environment<br/>Log-mel features + pump FSM] -->|POST readings| B[Backend<br/>Node.js + Express + SQLite + Socket.io]
  B --> C[ML Service<br/>FastAPI heuristic scorer<br/>p_activity]
  C --> B
  B -->|REST + WebSocket| D[Dashboard<br/>React + Vite + Tailwind]
  D -->|Arm / Confirm dose| B
  B -->|Protected downlink<br/>armed + dose nonce| A
```

---

## Architecture Breakdown

| Layer          | Responsibility                                                                      |
| -------------- | ----------------------------------------------------------------------------------- |
| **Firmware**   | Sensor reading, FFT/log-mel features, dose FSM, LED state, and backend posting      |
| **ML service** | Heuristic scoring by default, proxy CNN path when trained artifacts are available   |
| **Backend**    | Reading ingestion, fusion, event storage, alerting, safety rules, and dose commands |
| **Dashboard**  | Live monitoring, risk explanation, operator confirmation, and traceable history     |
| **Tools**      | Mock device, seed palms, serial bridge, and demo utilities                          |

---

# Intelligence Layer — Multi-Sensor Expert Architecture

Palm Guard is **not a single black-box detector**.

The backend runs a small **multi-sensor expert architecture**: deterministic expert / signal-model modules with no LLM in the control path.

These modules feed one server-authoritative **fusion engine**.

Acoustic activity is the primary signal.

Vibration validates it.

Environmental sensors add context only.

A sensor-health expert protects reliability.

The fusion engine produces a risk score.

A safety agent keeps dosing human-confirmed, hard-capped, nonce-protected, and clear-water-only in the demo.

The dashboard surfaces all of this on the **Intelligence Layer** page.

```mermaid
flowchart LR
  S[Sensors<br/>mic · vibration · trunk temp · environment] --> A[Acoustic Activity Expert<br/>primary signal]
  S --> V[Vibration Validation Expert<br/>corroboration]
  S --> E[Environmental Context Expert<br/>context only]
  S --> H[Sensor Health Expert<br/>reliability gate]
  A --> F[Risk Fusion Engine<br/>risk 0-100 + confidence]
  V --> F
  E --> F
  H -->|confidence penalty / resample| F
  F --> SA[Safety Dose Agent<br/>server + device caps]
  SA --> HC[Human Confirmation<br/>mandatory]
  HC --> D[Capped Demo Dose<br/>clear water only]
```

| Expert / Engine                  | Role                                            | Honesty Boundary                                   |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| **Acoustic Activity Expert**     | Primary — scores feeding-like acoustic activity | “Acoustic activity” / proxy — never “RPW detected” |
| **Vibration Validation Expert**  | Confirms or weakens acoustic suspicion          | Corroboration only                                 |
| **Environmental Context Expert** | Trunk temperature + VOC context                 | Never claims gas/temp proves infestation           |
| **Sensor Health Expert**         | Flags missing, impossible, or stale data        | Forces resample on bad data                        |
| **Risk Fusion Engine**           | Weighted fuse → risk + level + recommendation   | Mirrors the server-authoritative risk score        |
| **Safety Dose Agent**            | Server caps mirror device caps                  | Human-confirmed, nonce-protected, clear-water demo |
| **Explanation Agent**            | Plain-English, judge-friendly rationale         | No overclaiming                                    |

**Endpoints / events:**

```text
GET /api/v1/intelligence
GET /api/v1/intelligence/:deviceId
Socket.io: risk:fusion
Socket.io: agents:update
```

The existing `live:reading` event can also carry an additive `intelligence` field for backwards compatibility.

Full details, payload examples, and the capability-vs-roadmap table are in:

```text
docs/INTELLIGENCE_LAYER.md
```

---

## One-Paragraph Technical Summary

Palm Guard is a solar ESP32-S3 node that listens inside the palm with an INMP441 microphone, fused with SW-420 analog vibration, DS18B20 trunk temperature, and a BME680 environmental sensor.

The ESP32 runs a 1024-point FFT in firmware to build a 40×32 log-mel fingerprint, posts readings to a Node.js + Socket.io backend, and a React/Vite mission-control dashboard shows the system live.

Palm Guard is not a single black-box AI model: acoustic, vibration, environmental, and sensor-health experts feed a server-authoritative fusion engine.

Any treatment path remains human-confirmed, hard-capped, nonce-protected, and clear-water only in the demo.

---

# Repository Structure

```text
wrcc/
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
│   ├── Socket.io live events
│   ├── fusion scoring
│   ├── alert rules
│   └── server-authoritative dose engine
│
├── frontend/
│   ├── public/
│   │   ├── logo.png
│   │   ├── device-render.png
│   │   ├── dashboard-preview.png
│   │   └── system-architecture.png
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
    ├── INTELLIGENCE_LAYER.md
    └── API.md
```

---

# Honest Robotics Mandate

Palm Guard is built to look premium, but it is also built to stay scientifically honest.

## What Works Today

* backend ingest and live event pipeline
* React/Vite dashboard
* mock device simulation
* dose-pending → confirm → downlink → done workflow
* server-side dosing caps
* device-side dosing caps
* heuristic acoustic activity scoring
* live demo mode without hardware
* clear model-status and proxy-data labelling

## What Is Not Claimed Yet

* no guaranteed real-world larvae detection in all farm conditions
* no large open airborne RPW dataset is claimed
* no trained real-RPW model is claimed yet
* no fully autonomous pesticide treatment
* no field deployment claim yet

The system separates **current verified prototype behavior** from **future field-validation goals**.

---

# Detection Reality

The current prototype uses an **INMP441 airborne MEMS microphone**.

That matters because RPW larvae feed inside the trunk, while an airborne microphone listens through air.

Therefore, v1 is most realistic in controlled or low-noise conditions such as:

* quiet close-range tests
* night or low-noise farm environments
* booth/competition demonstrations
* early research trials

Future versions should improve detection with:

* contact microphones
* piezo vibration sensors
* stronger trunk coupling
* mechanical isolation
* real RPW-labelled field recordings
* supervised acoustic model training

---

# Dosing Safety

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

| Safety Layer        | Purpose                              |
| ------------------- | ------------------------------------ |
| **Human ARM**       | Device must be intentionally armed   |
| **Human CONFIRM**   | Operator approves every dose         |
| **Server cooldown** | Prevents repeated dose commands      |
| **Server max/day**  | Limits total daily dose events       |
| **Device cooldown** | Independent embedded protection      |
| **Device max/day**  | Hardware-side daily cap              |
| **Nonce command**   | Reduces repeated-command replay risk |
| **Dose history**    | Creates traceable evidence           |

For WRCC and booth demos, the system should use **clear water or safe demo liquid only**.

---

# Run Without Hardware

Palm Guard can run fully in software using the mock device.

## 1. Start the ML scorer

```bash
cd ml

python -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
uvicorn serve.app:app --port 8001
```

A fresh clone serves the **heuristic baseline**.

The trained proxy CNN `cnn-aspid-v1` artifacts are gitignored.

Neither mode is a field-validated RPW model. The proxy number, ROC-AUC ≈ 0.90 on open ASPID, is labelled as proxy.

---

## 2. Start the backend

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

## 3. Start the dashboard

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

## 4. Seed demo palms

```bash
python tools/seed_palms.py --server http://localhost:4000
```

---

## 5. Run a mock device

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000
```

---

# Demo the Dose Loop

1. Open the dashboard.
2. Go to **Dosing**.
3. Select device `PG-001`.
4. Click **Arm**.
5. Trigger a forced event:

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000 \
  --force-event
```

6. A **dose-pending** modal appears.
7. Click **Confirm**.
8. The node receives the downlink command.
9. The mock pump action completes.
10. Dose history shows the result as `done`.

This demonstrates the complete robotic chain:

```text
Sense → Score → Alert → Confirm → Act → Record
```

---

# Firmware

The firmware is built with PlatformIO.

## Main firmware

```bash
cd firmware/palmguard-esp32s3

pio run -e palmguard -t upload
pio device monitor
```

## Wi-Fi firmware

```bash
pio run -e palmguard_wifi -t upload
```

## I2C / 1-Wire scanner

```bash
pio run -e detect -t upload
```

---

# Build Status

| Component                 | Status                                             |
| ------------------------- | -------------------------------------------------- |
| Backend API               | Working                                            |
| SQLite storage            | Working                                            |
| Socket.io live events     | Working                                            |
| Dashboard                 | Working                                            |
| Mock device               | Working                                            |
| Dosing workflow           | Working in host + mock flow                        |
| ML scorer                 | Heuristic baseline live by default                 |
| Trained proxy model       | `cnn-aspid-v1` — ROC-AUC ≈ 0.90, proxy, gitignored |
| Field-validated RPW model | Not yet — next step is own INMP441 clips           |
| Firmware code             | Written to spec                                    |
| Hardware flashing         | Pending                                            |
| Bench test                | Pending                                            |
| Field validation          | Pending                                            |

See also:

```text
BUILD_LOG.md
docs/BUILD_SPEC.md
docs/HARDWARE.md
ml/README.md
```

---

# Technical Highlights

* ESP32-S3 per-tree robotic node
* solar-powered deployment concept
* acoustic activity monitoring
* vibration confirmation
* trunk-temperature context
* environmental context
* log-mel feature extraction
* FastAPI scoring service
* real-time backend events
* SQLite event storage
* React live dashboard
* spectrogram visualization
* server-authoritative dose control
* device-side dose safety caps
* human-confirmed actuation
* complete mock demo without hardware
* clear proxy-data and model-status labelling

---

# Roadmap

## Phase 1 — Competition Prototype

* complete backend
* complete dashboard
* complete mock device
* demonstrate live alerts
* demonstrate human-confirmed dosing
* show dose history and safety caps

## Phase 2 — Hardware Bench Test

* flash ESP32-S3 firmware
* verify microphone capture
* test vibration readings
* test trunk-temperature reading
* test pump control
* test power behavior
* validate firmware dose caps
* test enclosure mounting

## Phase 3 — Detection Improvement

* collect real trunk recordings
* test contact sensors
* compare airborne vs contact sensing
* build labelled RPW / non-RPW dataset
* train supervised acoustic model
* publish honest validation metrics

## Phase 4 — Field Pilot

* deploy on multiple palms
* monitor solar reliability
* evaluate farm noise
* work with agricultural experts
* validate treatment protocol
* improve model from real-world data

---

# Competition Positioning

Palm Guard fits the WRCC robotics theme because it combines:

* embedded sensing
* signal processing
* live communication
* robotic actuation
* safety interlocks
* operator confirmation
* evidence logging
* a clear path toward field validation

It is a precision-agriculture robotic system built to demonstrate a serious, safe, and scalable response to one of the most damaging palm pests.

---

# Suggested Repository Description

```text
Solar ESP32-S3 palm node for early RPW acoustic risk scoring and human-confirmed micro-dosing.
```

---

<div align="center">

# Palm Guard

### Precision protection for every palm.

**Built by Team VCoders — Abdalrahman AL-Kurdi ([@kurdim12](https://github.com/kurdim12)) · Abdalrahman AL-Haymouni ([@aboodhaymouni](https://github.com/aboodhaymouni)) · Zaid Abu Al-Shaar ([@ZaidAbuAlshaar](https://github.com/ZaidAbuAlshaar)) — IEEE UoP / University of Petra**

See [`CONTRIBUTORS.md`](CONTRIBUTORS.md).

</div>
