# Palm Guard — Device Connection & Demo Guide
### Step by step: connect your laptop ⇄ USB-C ⇄ ESP32-S3, wire the 3 sensors, flash, and run the live demo.

> Plain-English, in order. Do the sections top to bottom the first time.

---

## 0. The picture (what connects to what)

```
  ┌──────────┐   USB-A/C ──► USB-C        ┌──────────────────────┐        ┌──────────────┐
  │  Laptop  │ ─────────────────────────► │  ESP32-S3-DevKitC-1   │ ─wires─► 3 SENSORS    │
  │ (dashboard│       (the "UART" port)    │  (the brain)          │        │ mic·vib·temp │
  │  + bridge)│ ◄───── serial telemetry ── │                       │ ─wires─► PUMP (water) │
  └──────────┘                             └──────────────────────┘        └──────────────┘
```

- **Laptop → ESP32-S3:** one **USB-C cable** (data cable, not charge-only). Powers + flashes + talks to the board.
- **ESP32-S3 → sensors + pump:** short jumper wires (pin map in §3).
- The dashboard you already opened (`http://localhost:5273`) shows everything live.

---

## 1. Which USB-C port? (this trips everyone up)

The **ESP32-S3-DevKitC-1 has TWO USB-C ports** side by side:

| Port (silk label) | Use it for |
|---|---|
| **`UART`** (the on-board USB-to-UART bridge) | **← USE THIS.** Flashing **and** the serial monitor. Our firmware prints on UART0. Shows up as a **COM port**. |
| `USB` (native USB on GPIO19/20) | Not used by our firmware. Skip it. |

> If you plug into the wrong one, flashing/serial won't appear. Plug the cable into the port labelled **UART**.

---

## 2. One-time laptop setup (≈5 min, already mostly done)

1. **USB-UART driver** — if Windows doesn't show a new COM port when you plug in, install the driver for your board's bridge (CP210x *or* CH343). After install, unplug/replug.
2. **PlatformIO** — already installed on this machine (`pio 6.1.19`). Nothing to do.
3. **Find the COM port:** plug the board into the **UART** port, then run:
   ```
   pio device list
   ```
   Note the `COMx` it shows (e.g. `COM5`).

---

## 3. Wire the 3 sensors + pump (pin map — copy exactly)

All pins below are the firmware's single source of truth (`firmware/palmguard-esp32s3/include/config.h`).
**Power every sensor from `3V3`, never 5V** (ESP32-S3 pins are 3.3 V only).

### 🎤 Sensor 1 — INMP441 (acoustic, the main RPW sense)
| INMP441 pin | → ESP32-S3 |
|---|---|
| VDD | `3V3` |
| GND | `GND` |
| SCK (BCLK) | `GPIO9` |
| WS (LRCLK) | `GPIO10` |
| SD (data) | `GPIO11` |
| **L/R** | **`GND`** ← critical: selects the LEFT channel; if left floating the mic returns silence |

### 📳 Sensor 2 — SW-420 / LM393 (vibration corroboration)
| SW-420 pin | → ESP32-S3 |
|---|---|
| VCC | `3V3` |
| GND | `GND` |
| **AO** (analog out) | `GPIO4` (ADC1) |
| DO | leave unconnected |

### 🌡️ Sensor 3 — DS18B20 (trunk-core temperature)
| DS18B20 pin | → ESP32-S3 |
|---|---|
| VDD | `3V3` |
| GND | `GND` |
| DATA | `GPIO0` **+ a 4.7 kΩ resistor from DATA to 3V3** (pull-up) |

> ⚠️ GPIO0 is a boot "strapping" pin. The 4.7 kΩ pull-up must **not** be forced low while you press flash. It works on the dev board; a production PCB should move this to GPIO6/7 (already noted in `config.h`).

### 🌿 (4th sense, optional) — BME680 environmental context (I²C)
| BME680 | → ESP32-S3 |
|---|---|
| VCC | `3V3` · GND → `GND` |
| SDA | `GPIO8` · SCL → `GPIO18` (addr `0x77`) |

### 💧 Pump (clear-water demo actuator)
```
  GPIO5 ──[220Ω]── Gate(IRLZ44N)        Pump(+) ── +5V branch (MT3608)
                       │                Pump(−) ── Drain(IRLZ44N)
              [10kΩ to GND]   + 1N5819 flyback diode across the pump
                       │
                    Source ── GND   (common ground with the ESP32!)
```
Status LED (WS2812) data → `GPIO48`. Battery sense → `GPIO1`.

> **One common GND for everything** — ESP32, all sensors, MOSFET, pump, battery. This is the #1 cause of "weird" readings if missed.

---

## 4. Flash the firmware (pick ONE build)

From `firmware/palmguard-esp32s3`:

| Goal | Command |
|---|---|
| **Sensors stream to the dashboard over USB** (simplest) | `pio run -e palmguard -t upload` |
| **Autonomous "tiny agent": node decides + doses on its own** | `pio run -e palmguard_edge -t upload` |
| **WiFi node: dashboard arms + confirms + doses** | `pio run -e palmguard_wifi -t upload` |

Then watch it talk:
```
pio device monitor
```
You should see `#PG#{...}` JSON lines every ~250 ms with your 3 sensors' values. ✅ That means the board + sensors are alive. (Memory used: Flash 10.8 %, RAM 14.7 % — tiny.)

---

## 5. Run the live demo (board plugged in by USB)

1. **Start the app** — double-click **`START_PALMGUARD.bat`** (opens backend + ML + dashboard + the browser). Or it's already running at `http://localhost:5273`.
2. **Bridge the board to the dashboard** — in a terminal at the repo root:
   ```
   python tools/serial_bridge.py --port COM5 --server http://localhost:4000
   ```
   (use your COM port from §2). Now your **real device's 3 sensors** appear live on the dashboard (the demo-data generator steps aside as soon as a real device reports).
3. **See the sensors working:** open **Live Spectrogram** (the mic), and the **AI Decision** page (the 3 sensors fused into a risk score with per-sensor evidence).
4. **Trigger detection:** play a real RPW / weevil-feeding clip near the probe mic. Acoustic activity rises → vibration corroborates → the fused **risk climbs** on screen.
5. **Treat (clear water):** on **Dosing**, **Arm** the device, then **Confirm** when the dose-pending modal appears → the **pump runs a metered clear-water dose** and it's logged in the proof log.

---

## 6. How it works with the 3 sensors (the flow, end to end)

```
INMP441 mic ─┐
SW-420 vib  ─┤→ ESP32-S3 reads all 3 every 250 ms
DS18B20 temp─┘    → on-chip FFT + 40×32 log-mel features
                  → DECISION:
                       • palmguard_edge  → the on-device "tiny agent" fuses the
                         sensors and decides locally (NO laptop needed) ──┐
                       • palmguard/_wifi → sensors stream to the dashboard;│
                         the server "expert agents" fuse + score ─────────┤
                  → risk crosses threshold (sustained) → ALERT            │
                  → ARM + CONFIRM (human)  →  pump runs CLEAR WATER  ◄─────┘
                  → every step logged as evidence
```

- **Mic (acoustic)** = the primary RPW sense (feeding sounds inside the trunk).
- **Vibration** = corroboration (does a trunk-borne source back up the sound?).
- **Temperature** = context (trunk-core vs ambient).
- The **fusion** turns the 3 into one 0–100 risk with a confidence and a plain-English reason — shown on the **AI Decision** page (no black box).

---

## 7. The pure-USB pump demo — now closed end-to-end ✅

The serial bridge is now **two-way**, so the full clear-water squirt runs over a **single USB cable**. Three ways to demo:

1. **Human-confirmed over USB** (`palmguard` build): plug in → run the two-way bridge → on the dashboard **Arm** then **Confirm** → the confirm command travels back **down** the USB cable (`#CMD#…`) → the pump runs. Safety gate visible — best for judges.
2. **Fully autonomous, standalone** (`palmguard_edge` build): the node is pre-armed for the clear-water demo, decides **on-device**, and squirts with **no laptop at all** — just power + a speaker playing the RPW clip. Demonstrates rule 5.1.1/5.1.3 autonomy.
3. **WiFi** (`palmguard_wifi` build): the same human-confirm flow over Wi-Fi instead of USB.

All three pass the **identical on-device failsafes** (arm + per-dose cap + cooldown + daily cap + nonce). Clear water only. Nothing changed about safety — autonomy removes the *server* from the loop, not the guards.

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| No COM port appears | Use the **UART** port (§1); install CP210x/CH343 driver; try another USB-C **data** cable. |
| `pio` can't upload | Hold the **BOOT** button, tap **RST**, release BOOT, re-run upload. |
| Serial monitor blank | Right port + `115200` baud (our `monitor_speed`). |
| Mic reads silence | The **L/R pin must go to GND** (§3). |
| Pump never runs | It must be **armed + confirmed**, within cooldown + daily cap (safety by design). Check the **Dosing** page. |
| Readings look wrong/noisy | Make sure **all grounds are common** (sensors + MOSFET + pump + ESP32). |

---

## 9. Safety (always)

Demo uses **clear water only** (≤ 1 L, WRCC rule 5.8). The pump is **OFF at boot**, gated by a **logic-level MOSFET + flyback diode**, and the firmware enforces **arm + per-dose cap + cooldown + daily cap + nonce** — both on the device and on the server. Nothing sprays by accident.

---

_Pin map source: `firmware/palmguard-esp32s3/include/config.h`. ESP32-S3-DevKitC-1 port behaviour per Espressif's official dev-kit guide._
