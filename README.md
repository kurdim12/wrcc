# Palm Guard 🌴

### Early RPW detection + human-confirmed micro-dosing for date palms

**Palm Guard** is a solar-powered, per-tree smart node for early Red Palm Weevil detection.
It clamps to a date-palm trunk, listens for acoustic/vibration activity linked to **Red Palm Weevil larvae** (*Rhynchophorus ferrugineus*), combines that signal with environmental context, and supports a **human-confirmed micro-dose** response through a peristaltic pump.

Built for the **World Robot Caspian Cup — WRCC 2026, Baku**.

<p align="center">
  <strong>Listen → Score Risk → Alert → Human Confirm → Micro-dose → Log Evidence</strong>
</p>

---

## Why Palm Guard?

Red Palm Weevil is hard to detect early because larvae feed **inside** the trunk before visible symptoms appear. By the time the tree shows clear external damage, treatment may already be late.

Palm Guard aims to make every palm tree a monitored unit:

* **Detect earlier** using acoustic/vibration activity
* **Reduce blind spraying** with targeted, event-based treatment
* **Keep humans in control** before any dosing action
* **Create proof** through logs, alerts, dose history, and sensor records
* **Work per tree** using a solar-powered ESP32-S3 node

---

## System Overview

```text
ESP32-S3 Palm Node
  ├─ INMP441 acoustic sensing
  ├─ vibration / environmental sensor inputs
  ├─ log-mel feature extraction
  ├─ pump + dosing safety FSM
  └─ Wi-Fi / serial bridge communication

        │ POST readings + log-mel features
        ▼

Backend — Node.js / Express / SQLite / Socket.io
  ├─ device ingest
  ├─ fusion scoring
  ├─ alert rules
  ├─ server-authoritative dose engine
  ├─ device downlink
  └─ live WebSocket events

        │ REST + WebSocket
        ▼

Dashboard — React / Vite / Tailwind
  ├─ live palm map
  ├─ spectrogram view
  ├─ risk score
  ├─ alerts
  ├─ ARM / DISARM
  ├─ dose confirmation modal
  ├─ dose history
  └─ model confidence + proxy-data badge

        │ optional
        ▼

ML Service — FastAPI
  ├─ heuristic baseline scorer
  ├─ future trained model endpoint
  └─ model card / proxy validation notes
```

---

## Core Principle: Honest Robotics

Palm Guard is designed to be useful **without pretending the science is solved**.

### What the system does today

* Runs an end-to-end demo pipeline from node data to backend to dashboard
* Scores acoustic activity using a clearly labelled **heuristic baseline**
* Shows model confidence without claiming real-world RPW accuracy
* Supports a full human-confirmed dosing workflow
* Enforces dose limits on both the backend and device side
* Logs detections, confirmations, and dosing events

### What the system does **not** claim yet

* It does **not** claim guaranteed larvae detection in all farm conditions
* It does **not** claim a fully trained RPW model yet
* It does **not** claim autonomous chemical treatment
* It does **not** hide that v1 uses proxy acoustic data

This honesty is intentional. Palm Guard is built as a robotics prototype with a clear path from demo system → field validation → safer agricultural deployment.

---

## Detection Reality

The current prototype uses an **INMP441 airborne MEMS microphone**.

That matters because RPW larvae feed inside the trunk, while the INMP441 listens through air. This means detection is most realistic in:

* quiet environments
* close-range placement
* controlled test conditions
* night or low-noise farm conditions

For robust field use, Palm Guard’s future hardware direction includes stronger contact-based sensing such as:

* piezo contact microphones
* vibration sensing
* improved trunk coupling
* better mechanical isolation
* field-collected RPW datasets

---

## Dosing Safety

Palm Guard does **not** dose automatically without human approval.

The dose loop is:

```text
High-risk event detected
        ↓
Backend creates dose-pending event
        ↓
Operator reviews alert + confidence + history
        ↓
Operator confirms dose
        ↓
Server sends signed dose command
        ↓
Device verifies caps + nonce
        ↓
Peristaltic pump runs a metered dose
        ↓
Dose result is logged
```

Safety controls:

* human-arm required
* human-confirmation required
* server-side cooldown
* server-side max doses per day
* device-side cooldown
* device-side max doses per day
* nonce-based command protection
* full dose history logging

For competition and booth demonstrations, the dosing fluid should be **clear water or a safe demo liquid**, not real pesticide.

---

## Repository Structure

| Path                          | Purpose                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `firmware/palmguard-esp32s3/` | ESP32-S3 PlatformIO firmware: sensing, log-mel, networking, actuation, dose FSM            |
| `backend/`                    | Node.js / Express backend with SQLite, Socket.io, fusion scoring, alerts, and dose engine  |
| `ml/`                         | FastAPI scorer, feature pipeline, training scripts, proxy-data notes, and model card       |
| `frontend/`                   | React / Vite / Tailwind dashboard with live risk, alerts, spectrogram, and dosing workflow |
| `tools/`                      | Mock device, seed scripts, and serial bridge tools                                         |
| `docs/`                       | Build spec, hardware notes, architecture, API documentation, and safety design             |

---

## Run Without Hardware

Palm Guard can run fully in software using the mock device.

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

Requires **Node.js 22+** because the backend uses built-in `node:sqlite`.

```bash
cd backend

cp .env.example .env
npm install
npm run dev
```

Backend runs on:

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

Dashboard runs on:

```text
http://localhost:5173
```

---

### 4. Seed demo palms

```bash
python tools/seed_palms.py --server http://localhost:4000
```

---

### 5. Run a mock node

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000
```

If no real device reports, the system can run in demo mode.

---

## Demo the Full Dose Loop

1. Open the dashboard
2. Go to the **Dosing** page
3. Select a device
4. Click **Arm**
5. Trigger a high-risk event:

```bash
python tools/mock_device.py \
  --device-id PG-001 \
  --server http://localhost:4000 \
  --force-event
```

6. A **dose-pending** modal appears
7. Click **Confirm**
8. The mock node receives the dose downlink
9. The dose is logged as `done` in dose history

This demonstrates the full robotic loop:

```text
Sense → Decide → Ask Human → Act → Prove
```

---

## Firmware

The firmware is written for ESP32-S3 using PlatformIO.

### Upload main firmware

```bash
cd firmware/palmguard-esp32s3

pio run -e palmguard -t upload
pio device monitor
```

### Upload Wi-Fi firmware

```bash
pio run -e palmguard_wifi -t upload
```

### Upload sensor pin scanner

```bash
pio run -e detect -t upload
```

---

## Current Status

| Area                     | Status                      |
| ------------------------ | --------------------------- |
| Backend                  | End-to-end working          |
| Dashboard                | End-to-end working          |
| Mock device              | Working                     |
| Dose workflow            | Working in host + mock flow |
| ML service               | Live heuristic baseline     |
| Trained RPW model        | Not available yet           |
| Firmware                 | Written to spec             |
| Real hardware bench test | Not completed yet           |
| Field validation         | Not completed yet           |

See:

```text
BUILD_LOG.md
docs/BUILD_SPEC.md
docs/HARDWARE.md
ml/README.md
```

---

## Technical Highlights

* ESP32-S3 per-tree embedded node
* acoustic feature extraction using log-mel features
* host-side ML scoring for v1 reliability
* clear model-status labelling
* real-time backend with Socket.io
* SQLite event storage
* live dashboard with spectrogram and risk score
* server-authoritative dose state machine
* device-side dosing safety caps
* mock device for no-hardware demonstration
* documented path toward on-device TinyML

---

## Roadmap

### Phase 1 — Prototype System

* backend ingest
* live dashboard
* mock device
* heuristic scoring
* human-confirmed dose loop
* dose history

### Phase 2 — Hardware Validation

* flash firmware to ESP32-S3
* bench-test microphone readings
* test pump control
* verify power behavior
* validate dose caps on device
* improve enclosure and trunk mounting

### Phase 3 — Better Detection

* collect real trunk recordings
* compare airborne mic vs contact sensor
* build labelled RPW / non-RPW dataset
* train supervised acoustic model
* publish model card with real validation results

### Phase 4 — Field Deployment

* multi-tree pilot
* solar reliability testing
* farm noise evaluation
* agronomist-supervised dosing protocol
* long-term event and treatment analysis

---

## Competition Positioning

Palm Guard is not just a dashboard and not just a sensor.

It is a robotic agricultural node with:

* sensing
* signal processing
* decision support
* actuation
* safety interlocks
* human confirmation
* live monitoring
* evidence logging

The goal is to show a realistic path toward precision treatment for palm pests while staying honest about what has and has not been validated yet.

---

## Owner

**Abdelrahman Kurdi**
vcoders / IEEE UoP
University of Petra

---

## One-Line Pitch

**Palm Guard listens inside the risk zone of a date palm, scores RPW activity, asks for human confirmation, and delivers a safe metered response — one tree at a time.**
