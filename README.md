# Palm Guard 🌴

**Early acoustic detection + targeted micro-dosing for Red Palm Weevil (RPW), on a self-powered per-tree node.**

A solar-powered **ESP32-S3** node clamps to a date-palm trunk, listens for the
acoustic/vibration signature of RPW (_Rhynchophorus ferrugineus_) larvae feeding
inside the trunk, fuses that with environmental sensors, and — on a confirmed
high-risk detection — dispenses a **metered, human-confirmed micro-dose** of
treatment fluid through a peristaltic pump. Events stream to a backend; a live
dashboard shows node health, risk, spectrogram, alerts, model confidence, and
dose history.

Built for the **World Robot Caspian Cup (WRCC) 2026**, Baku.

> ### The honesty mandate (read first)
> The science is real but hard, and our data is imperfect — so the whole system
> is **truthful about its own limits**.
> - **Airborne mic ≠ guaranteed larvae detection.** INMP441 is an *airborne*
>   MEMS mic; larvae feed *inside* the trunk. Reliable mainly in
>   **quiet/close/night** conditions. Not a farm-wide, all-weather detector.
> - **The model is proxy-validated.** No large open dataset of airborne real-RPW
>   exists; v1 trains on proxy boring/feeding sounds. Metrics are reported **on
>   the proxy set** and labelled as such. **There is no trained model yet** — the
>   scorer runs a clearly-labelled *heuristic baseline*, and the UI shows
>   "heuristic", never an accuracy number.
> - **Confirm before you poison a tree.** Dosing is **human-armed and
>   human-confirmed**, with hard caps enforced on **both** the server and the
>   device. Never fully-autonomous spraying.

## Architecture

```
ESP32-S3 node ──POST reading (+log-mel, act)──▶ Backend (Node/Express + SQLite + Socket.io)
     ▲                                              │  ├─ ML service (FastAPI) → p_activity
     └──── downlink {armed, cmd:{dose,nonce}} ──────┘  ├─ fusion (SA=100·p_activity) + 7 alert rules
                                                       └─ dose state machine (server-authoritative)
                                                              │ REST + WebSocket
                                                              ▼
                                          Dashboard (React/Vite): map · spectrogram · risk ·
                                          alerts · ARM/DISARM · confirm-dose · dose history ·
                                          model confidence + proxy badge
```

Inference runs **host-side** for v1 (reliable). On-device int8 TFLite-Micro is a
documented stretch goal. See `docs/BUILD_SPEC.md`, `docs/HARDWARE.md`, `ml/README.md`.

## Repo layout

| Path | What |
|---|---|
| `firmware/palmguard-esp32s3/` | ESP32-S3 PlatformIO: sensors, **actuation/dose FSM**, net, log-mel |
| `backend/` | Node/Express + `node:sqlite` + Socket.io: ingest, fusion, alerts, **dose engine** |
| `ml/` | log-mel features (match firmware), FastAPI scorer, training pipeline, model card |
| `frontend/` | React/Vite/Tailwind dashboard (+ dosing, confirm modal, confidence badge) |
| `tools/` | `mock_device.py` (simulates the dose downlink), `serial_bridge.py`, `seed_palms.py` |
| `docs/` | build spec, hardware fixes, architecture, API |

## Run it (no hardware needed)

```bash
# 1) ML scorer (heuristic baseline; light deps)
cd ml && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && uvicorn serve.app:app --port 8001

# 2) backend (Node 22+ for built-in node:sqlite)
cd backend && cp .env.example .env && npm install && npm run dev      # :4000

# 3) dashboard
cd frontend && npm install && npm run dev                              # :5173 (proxies /api)

# 4) feed data: auto demo-mode runs if no device reports. Or drive a mock node:
python tools/seed_palms.py --server http://localhost:4000
python tools/mock_device.py --device-id PG-001 --server http://localhost:4000
```

**Demo the dose loop:** open the dashboard → **Dosing** page → **Arm** a device →
run the mock node with `--force-event` → a **dose-pending** modal appears →
**Confirm** → the node receives the downlink, "doses", and it lands in dose
history as `done`. Caps (cooldown, max/day) are enforced server- and device-side.

Firmware (real node, needs PlatformIO):
```bash
cd firmware/palmguard-esp32s3
pio run -e palmguard -t upload && pio device monitor     # serial-bridge node
pio run -e palmguard_wifi -t upload                      # HTTP node (receives dose downlink)
pio run -e detect -t upload                              # I2C/1-Wire pin scanner
```

## Status

See `BUILD_LOG.md`. Phases 0–1 done and verified end-to-end (host + mock); Phase 2
ML service live with a heuristic baseline (no trained model yet — by design,
honestly labelled). Firmware is written to spec but **not yet flashed/bench-tested**.

Owner: Abdelrahman (vcoders / IEEE UoP).
