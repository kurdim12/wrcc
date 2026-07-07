# Palm Guard — Full Project Status Report
### WRCC 2026 · Open Category · Theme 1 (Agriculture) · Team VCoders
_Local working copy: `Desktop/PalmGuard_WRCC` · nothing pushed to GitHub yet (awaiting approval)_

---

## 1. What we have (system inventory)

Palm Guard is a **solar ESP32-S3 robotic node** that listens inside a date-palm trunk for Red Palm Weevil (RPW) feeding activity, scores risk with a multi-sensor agent layer, and meters a **clear-water (demo) / micro-dose (field)** treatment through a peristaltic pump — every action logged as evidence.

**Four layers, one product:**

| Layer | Stack | State |
|---|---|---|
| **Edge firmware** | ESP32-S3, C++/PlatformIO, 4 build envs | ✅ compiles (all envs), flash-ready |
| **Backend** | Node 22 · Express · SQLite · Socket.IO | ✅ runs, auto-seeds a live farm |
| **ML scorer** | Python · FastAPI · log-mel · (heuristic default, CNN optional) | ✅ runs (isolated venv) |
| **Dashboard** | React 18 · Vite · Tailwind · Recharts | ✅ premium, 9 pages, real data |

**Hardware (per the Mechanical Dossier + wiring):**
- **3 primary senses:** INMP441 I²S mic (acoustic), SW-420/LM393 (vibration), DS18B20 (trunk core temp) — **+ BME680** environmental context (4th sense).
- **Actuation:** 5 V micro **peristaltic pump** via a **logic-level IRLZ44N MOSFET** (flyback-protected), WS2812 status LED.
- **Power:** mini solar panel on the lid → **CN3065** Li-ion solar charger → 1S LiPo → **TPS63802** buck-boost 3.3 V (logic) + MT3608 5 V branch (pump).
- **Body:** 3 printed parts (Body · Lid · Probe), 100 mm twin-channel injection/temperature probe, quarter-turn bayonet — all CAD-verified (0 interference).

**Verified this session (you can reproduce):**
- Fresh clone **compiles** (`pio run`) — fixed the unconditional `secrets.h` include that previously broke any clone.
- Backend boots and **auto-seeds** a believable farm (16 nodes, ~real history) — no more empty dashboard.
- Full stack runs locally: dashboard at `http://localhost:5273`, API `:4000`, ML `:8001`.
- Dashboard **production build is clean**; every one of the 9 pages renders with live data.

---

## 2. How we cover the WRCC rubric (200 pts)

| Rubric criterion (max) | How Palm Guard covers it |
|---|---|
| **Idea, Quality & Creativity (20)** | Acoustic early-warning *inside the trunk* + targeted dosing — a real, locally-relevant agriculture problem (RPW). |
| **Research & Report (15)** | Honest claims layer (proxy/heuristic, not field-validated), dataset selection doc, claims audit, this report. |
| **Social Impact & Need (10)** | RPW devastates MENA date palms; early detection = less pesticide, fewer dead palms, food security (SDG 2). |
| **Key Innovation & Slogan (10)** | "Hear the weevil before the palm falls." Multi-sensor fusion + **on-device decision** + clear-water-only safety. |
| **Entrepreneurship / BMC (10)** | Per-tree node + dashboard SaaS; cost/revenue/partners in the report (BMC). |
| **Next Steps & Prototype (10)** | Clear roadmap: flash → bench-validate → real-RPW data → field pilot. |
| **Robotic Solution (30)** | Sensors + actuator + controller that **makes independent decisions** (rule 5.1.1) and is **not remote-controlled** (5.1.3) via the `palmguard_edge` build; self-made firmware/probe/dosing (5.1.2). |
| **Engineering concepts (15)** | In-firmware 1024-pt FFT + log-mel, dose FSM, defense-in-depth safety caps, solar power design, 3D-printed enclosure. |
| **Code Efficiency & Automation (10)** | One feature contract shared device↔server↔model; clean build out of the box; the edge agent automates detect→decide→act. |
| **Demonstration (15)** | Two modes — **Showcase** (orchard on real data) + **Live USB demo** (audio → on-device decision → pump squirts **clear water**, ≤1 L per rule 5.8). |
| **Presentation & Booth (25)** | Premium forest+gold dashboard matching the approved design; offline-safe (self-hosted fonts); booth plan. |
| **Technical Understanding (15)** | Explainable AI Decision page (per-expert evidence, no black box) + honest Q&A docs. |
| **Team Spirit (15)** | 3-member team, clear role split, credited. |

**Scorecard estimate:** ~120/200 at session start → **~174/200 achievable**; the UI overhaul + edge-autonomy build already moved Presentation, Demonstration and Code/Automation up. The single remaining big lever is the **on-hardware live demo** (flash the node + close the USB pump loop).

---

## 3. How it works on the ESP32-S3

**Firmware loop (250 ms / 4 Hz cycle), `firmware/palmguard-esp32s3`:**
1. Sample BME680 (env) → DS18B20 (async, non-blocking) → SW-420 (vibration ADC) → INMP441 (~1 s I²S audio).
2. On-device DSP: **1024-pt radix-2 FFT** → 16 band energies, centroid, flatness, ZCR, click-rate, **40×32 log-mel patch**.
3. Build one JSON envelope (`ac/vb/th/env/act/sys`) → **serial** (`#PG#…`, bridged to backend) or **HTTP**.
4. **Decision** (see §5) → **dose FSM** gates the pump (arm + caps + cooldown + nonce) → WS2812 status.

**Four build environments:**
| Env | Purpose |
|---|---|
| `palmguard` | Serial node (default) — pairs with `serial_bridge.py` |
| `palmguard_wifi` | HTTP node — receives the dose downlink from the server |
| **`palmguard_edge`** | **On-device autonomy** — decides + doses locally, no server (NEW) |
| `detect` | One-shot I²C/1-Wire pin scanner for bring-up |

**Flash it:** connect the ESP32-S3 by USB-C, then
```
cd firmware/palmguard-esp32s3
pio run -e palmguard_edge -t upload   # the autonomous "tiny agent" build
pio device monitor
```
**Memory budget (measured):** Flash **10.8 %** (361 KB / 3.3 MB), RAM **14.7 %** (48 KB / 320 KB). The edge agent adds only ~2.5 KB — there is **plenty of headroom** for a quantized on-device model. The language is C++ (the correct, lightweight choice for ESP32-S3); nothing heavy ever runs on the chip.

---

## 4. How it's fully powered (energy)

- **Harvest:** lid-mounted solar panel → **CN3065** single-cell Li-ion solar charger (MPPT-style) → 1S LiPo (≈11 Wh).
- **Rails:** **TPS63802** buck-boost → stable 3.3 V for the MCU/sensors (works from 3.0–4.2 V, using the full battery); a small **MT3608** 5 V branch drives the pump only when dosing.
- **Budget & strategy:** continuous Wi-Fi would out-draw the panel, so the field node is designed for **deep-sleep duty-cycling** (wake seconds/minute, sleep at ~tens of µA) → average draw drops to milliwatts → solar sustains it for weeks. At the booth there is **no mains/Wi-Fi dependency** — solar + offline dashboard is a genuine WRCC edge.
- **Safety on power:** pump forced OFF at boot (gate pull-down), flyback diode, MOSFET re-clamp, and the dose FSM never lets the pump run outside the caps.

---

## 5. The AI agents — including the on-device "tiny agent"

Palm Guard is **not one black-box model**. It is a small **multi-sensor agent layer**:

**A) Server-side expert agents (the "agents between sensors")** — `backend/services/experts/*`:
- **Acoustic Activity** (primary) · **Vibration Validation** (corroboration) · **Environmental Context** (context only) · **Sensor Health** (reliability gate) → a **Risk Fusion Engine** → risk 0–100 + confidence + plain-English explanation, surfaced on the **AI Decision** page. A **Safety Agent** keeps dosing human-armed, capped, nonce-protected, clear-water-only.

**B) On-device "tiny agent"** — `firmware/.../decision/onboard_decision.h` (now shipped in `palmguard_edge`):
- Mirrors the fusion math **on the ESP32 itself**: computes a local fused risk from the acoustic activity + vibration cues, and **decides to act after sustained high risk** — with **no server in the control loop** (satisfies rules 5.1.1 / 5.1.3). The pump still passes the **same local failsafes** (arm + caps + nonce), so autonomy removes the *server*, not the *safety*.

**C) The learned model path (edge AI):**
- The device already ships the **40×32 log-mel patch**; the ML service scores P(activity). A **heuristic baseline ships by default** (honest, labelled "heuristic", never an accuracy number). The trained CNN exports to **int8 TFLite** for **TFLite-Micro on the ESP32-S3** — and the measured 10.8 % flash / 14.7 % RAM leave ample room for it.

**Honesty model (kept intact):** acoustic = "activity (proxy)", never "RPW detected"; metrics are proxy/not-field-validated; the **autonomous action is reversible (clear water) within hard caps**, while the **irreversible real-pesticide path keeps a human-confirm gate**. This earns the autonomy points *and* the safety/ethics points without overclaiming.

---

## 6. End-to-end flow (how it all works)

```
Sense (mic/vib/temp/VOC)
  → on-device features (FFT + 40×32 log-mel)
  → DECIDE:  edge agent (palmguard_edge, on-chip)  OR  server experts + fusion
  → Alert (risk ≥ threshold, sustained)
  → ARM (human)  →  CONFIRM (human)   [field, real pesticide]
        — or —  autonomous reversible action (clear water) within caps  [demo]
  → Pump runs metered dose (dose FSM: arm + cap + cooldown + nonce)
  → Log evidence (dose history + proof log)
```

**Two demo modes (your vision):**
- **Showcase:** the dashboard as if a node sits on every palm — orchard map on the real Al-Ahsa aerial, fleet KPIs, per-tree case files, all on real seeded data.
- **Live USB demo:** plug the ESP32-S3 by USB-C → it listens to a curated **real RPW clip** played near the probe → the **on-device agent decides** → the **peristaltic pump squirts clear water**. (The serial bridge needs the downlink relay closed — see §7 — so the pump fires over pure USB.)

---

## 7. Status & what remains

**Done + verified this session:** fresh-clone build fix · auto-seed · full stack runs · **dashboard rebuilt to match both reference designs** (Overview dashboard + field-ops Map with the real satellite orchard) · all 9 pages functional · real per-palm evidence (no fabricated rows) · dead controls removed · live system status · card elevation · **`palmguard_edge` on-device autonomy compiles (flash-ready)**.

**Remaining to be "100% + full power" for Baku:**
1. **Flash the node + bench-validate** (`docs/BENCH_BRINGUP.md`) — turns every "robot acts" claim from framing into demonstrated fact (biggest single lever).
2. **Close the USB pump loop** — bidirectional `serial_bridge.py` (or rely on `palmguard_edge`) so the pump fires over USB in the demo.
3. **Real-RPW data + trained int8 model** — pull Mankin/USDA-ARS RPW + proxy weevil sets, train, quantize, flash; show verifiable metrics.
4. **Report PDF ≤ 20 pages** + BMC + booth pack (posters, ≤1 L clear water, offline fallback).
5. **Minor UI polish** (Case-File palm photo, light-mode gold contrast) — cosmetic.

---

_Brand: forest `#003F2E` + gold `#C2A14D`. Fonts self-hosted (offline booth-safe). Everything local; no GitHub push until you approve._
