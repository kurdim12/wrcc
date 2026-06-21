# Palm Guard — Hardware (authoritative) & required electrical fixes

This documents the §5 hardware design and the **electrical bugs that must be
fixed on paper before fabricating the PCB**. Firmware already assumes these fixes
(see `firmware/.../include/config.h`).

## Bill of materials (§5.1)

- **MCU:** ESP32-S3 (DevKitC-1 for bench; custom PCB for field)
- **Sensing:** INMP441 (I2S MEMS mic, **airborne**) · SW-420 (LM393 vibration
  module, read on ADC) · DS18B20 (waterproof 1-Wire trunk-core temp) · BME680
  (I2C temp/RH/pressure/VOC) · NTC MF52AT 10k thermistor
- **Power:** LiPo 3.7 V · Solar 5 V (~1 W class) · CN3065 solar LiPo charger ·
  TPS63802 buck-boost → **3.3 V** · 220 µF/16 V cap · KCD1-105 switch
- **Actuation:** 5 V micro peristaltic pump · **logic-level N-MOSFET** · RGB SMD
  LED · 5 V addressable RGB strip (WS2812-class)
- **Mech:** silicone tube 2 mm ID × 4 mm OD · 9×15 cm PCB

## Electrical fixes — required before fabrication (§5.2)

1. **No 5 V rail exists.** TPS63802 outputs 3.3 V; the pump and LED strip are
   5 V. **Add a small 5 V boost for the actuation branch** (or power that branch
   from a bench 5 V supply for the demo). Never run 5 V loads off raw VBAT.
2. **IRF540 is not logic-level.** At a 3.3 V gate it barely conducts and runs
   hot. **Replace with a logic-level MOSFET (IRLZ44N / IRL540N / IRLB8721)** or
   add a gate driver. The firmware pump driver assumes a logic-level part on
   `PG_PUMP_GATE_PIN` (GPIO5) with an external **10 kΩ gate pull-down** so the
   pump stays OFF while the MCU boots/floats.
3. **LED strip is over budget.** 60 addressable LEDs at full white ≈ 3.6 A —
   impossible on a ~1 W solar node. Firmware drives **only `PG_LED_COUNT` LED(s)
   at `PG_LED_MAX_BRIGHT`** for status; it never lights the full strip in field
   mode. Treat the strip as bench-only.
4. **NTC MF52AT** is redundant with DS18B20 + BME680. **Disabled by default**
   (`PG_NTC_PRESENT 0`). Enable + wire to an ADC1 pin only if used as a
   battery-pack thermal cutoff for charging.

## Pin map (§5.3)

| Signal | GPIO | Notes |
|---|---|---|
| INMP441 BCLK / WS / DIN | 9 / 10 / 11 | I2S0 |
| SW-420 A0 (analog) | 4 | ADC1, 11 dB atten |
| DS18B20 data | 0 | 4.7 kΩ pull-up; **GPIO0 is a strapping pin** — keep pull-up off during boot/flash; move to GPIO6/7 on the field PCB |
| BME680 SDA / SCL | 8 / 18 | confirm with `pio run -e detect`; `PG_BME680_PRESENT 1` |
| Battery sense | 1 | divider ×2 |
| **Pump gate (MOSFET)** | **5** | logic-level MOSFET, PWM-capable, default OFF + pull-down |
| **Status LED data** | **48** | WS2812 (onboard on most DevKitC-1); few LEDs only |
| **NTC ADC** | 2 | only if `PG_NTC_PRESENT 1` |

## Power budget & duty cycling (§5.4)

Continuous audio + WiFi + actuation on ~1 W solar will not sustain 24/7 at full
duty. The node must **duty-cycle**: short listen+inference windows, deep-sleep
between, waking more often only when risk is elevated. The pump and bright LEDs
are the big draws and are gated hard. The log-mel capture is a contiguous ~1 s
window (`PG_MEL_FRAMES` frames at hop 512) — size the listen window around it.

**Honest field duty-cycle target:** listen ~1 s every 1–5 min in baseline; wake
faster (e.g. every 15–30 s) when recent risk is elevated. Tune in `BUILD_LOG.md`.

## Actuation + safety hardware (§5.5)

The pump draws treatment fluid from a small reservoir through the silicone tube
to a trunk outlet. A dose = pump-on for a bounded number of milliseconds. Local
hard limits live in firmware (`PG_DOSE_MAX_MS / _COOLDOWN_S / _MAX_PER_DAY`) as
the last line of defense even if the backend misbehaves, and they **mirror** the
server-side caps. An optional physical disarm switch (`PG_DISARM_PIN`, undefined
by default) forces the dose FSM to IDLE and cuts any in-flight pump.
