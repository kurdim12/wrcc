// Build-time configuration. Per-installation secrets (WiFi, server IP) live
// in include/secrets.h - copy include/secrets.h.example before flashing.
#pragma once

#include "secrets.h"

// ─── Device identity ───────────────────────────────────────────────────
#ifndef PG_DEVICE_ID
#define PG_DEVICE_ID "PG-001"
#endif
#ifndef PG_FW_VERSION
// 2.0.0 = rebuild with actuation/dose FSM + log-mel ML frame (see docs/BUILD_SPEC.md)
#define PG_FW_VERSION "2.0.0"
#endif
// Feature-contract version — MUST match ml/features/params.py + ml/serve (FEATURE_VERSION)
// and the backend intelligence layer. Bump together if the 40×32 log-mel shape changes.
#ifndef PG_FEATURE_VERSION
#define PG_FEATURE_VERSION "logmel-40x32-v1"
#endif

// ─── Reading payload → backend expert mapping (multi-sensor architecture) ──
// Each JSON reading the node emits maps to the backend experts as follows:
//   ac{bands16,clk,cent,flat,rms,zcr,mel} → Acoustic Activity Expert  (primary)
//   vb{vib_rms,vib_pk,vib_dom_hz}         → Vibration Validation Expert (corroboration)
//   th{core_c,amb_c} + env{gas_kohm,hum}  → Environmental Context Expert (context only)
//   sys{fw,bat_pct,rssi} + freshness      → Sensor Health Expert
//   act{armed,doses_today,last_nonce}     → Dose Safety Engine (nonce ack / anti-replay)
// The device-side dose FSM (sensors/dose_fsm) enforces the SAME caps as the
// server (PG_DOSE_* below): both must pass before the pump runs.

// ─── Cycle timing ──────────────────────────────────────────────────────
// 250 ms cycle = 4 Hz update rate. Each cycle samples ~100 ms of vibration +
// ~64 ms of audio, then issues an async DS18B20 conversion whose result is
// picked up on a later cycle so we never block on the ~190 ms 1-Wire wait.
#define PG_CYCLE_INTERVAL_MS         250
#define PG_STREAM_CYCLE_INTERVAL_MS  250

// ─── Output transport ──────────────────────────────────────────────────
// PG_EMIT_SERIAL=1: print every reading as a single JSON line over UART0.
//   The Python serial-bridge (tools/serial_bridge.py) picks them up and
//   forwards to the local backend via HTTP, so the dashboard updates live.
// PG_EMIT_HTTP=1: also try HTTP POST when WiFi is available. The HTTP path is
//   the only one that receives the dose downlink command (see net/poster).
// Both are #ifndef-guarded so platformio.ini env build_flags can flip them
// (the palmguard_wifi env builds an HTTP node that can receive dose downlinks).
#ifndef PG_EMIT_SERIAL
#define PG_EMIT_SERIAL  1
#endif
#ifndef PG_EMIT_HTTP
#define PG_EMIT_HTTP    0
#endif
#define PG_SERIAL_TAG   "#PG#"          // line prefix recognized by the bridge

// ─── Pin map (USER WIRING) ─────────────────────────────────────────────
// INMP441 acoustic mic
#define PG_I2S_BCLK     9    // INMP441 SCK
#define PG_I2S_LRCK     10   // INMP441 WS
#define PG_I2S_DIN      11   // INMP441 SD

// LM393 / SW-420 vibration module (analog out)
#define PG_VIB_ADC_PIN  4    // A0 of the vibration module (ADC1, 11 dB atten)

// DS18B20 trunk-core probe (1-Wire)
// SPEC-NOTE: GPIO0 is a strapping pin. Carried over from the old build; the
// 4.7k pull-up must not be present during boot/flash or strapping can latch.
// A field PCB should move this to a non-strapping GPIO (e.g. 6/7).
#define PG_ONEWIRE_PIN  0    // DATA pin (4.7 kOhm pull-up to 3V3 required)

// I2C bus (BME680). Confirm wiring with the `detect` env before trusting it.
#define PG_I2C_SDA      8
#define PG_I2C_SCL      18
// SPEC-DEFAULT (§8.2): BME680 enabled. env_init() degrades gracefully — if the
// chip does not ACK, ok_e stays false and NO env block is emitted, so the
// dashboard shows the channel as absent rather than a dead channel as live.
#define PG_BME680_PRESENT 1

#define PG_BAT_ADC_PIN  1    // battery divider ×2

// ─── Actuation pins (NEW — §5.3 / §8.4) ────────────────────────────────
// Pump gate drives a LOGIC-LEVEL MOSFET (IRLZ44N / IRL540N / IRLB8721 — NOT the
// non-logic-level IRF540, see docs/HARDWARE.md §electrical-fixes). Default OFF
// with an external 10k gate pull-down so a floating/booting MCU cannot fire it.
// 5V pump load is fed from a dedicated 5V boost branch, never the 3.3V rail.
// SPEC-DEFAULT: GPIO5 — PWM-capable (LEDC), not a strapping pin, free of the
// I2S/I2C/ADC assignments above.
#define PG_PUMP_GATE_PIN   5
#define PG_PUMP_PWM_CH     0      // LEDC channel for soft-start (optional)
#define PG_PUMP_ACTIVE_HIGH 1

// Status LED — WS2812-class addressable, driven over RMT. STATUS USE ONLY:
// a 60-LED strip at full white ≈ 3.6 A is impossible on a ~1 W solar node
// (§5.2.3), so firmware drives only PG_LED_COUNT LEDs at low brightness.
// SPEC-DEFAULT: GPIO48 = onboard addressable LED on most ESP32-S3-DevKitC-1.
#define PG_LED_DATA_PIN    48
#define PG_LED_COUNT       1      // status only; never the full strip in field mode
#define PG_LED_MAX_BRIGHT  40     // 0..255, capped for power budget

// NTC MF52AT 10k — battery-pack thermal cutoff for charging (§5.2.4).
// SPEC-DEFAULT: disabled by default to avoid a redundant 3rd temp channel
// (DS18B20 + BME680 already cover core + ambient). Set PRESENT=1 and wire to
// an ADC1 pin only if you actually use it for charge-temperature protection.
#define PG_NTC_PRESENT     0
#define PG_NTC_ADC_PIN     2      // ADC1 if enabled

// ─── Dose failsafes (LOCAL hard limits — last line of defense, §3/§8.4) ─
// Mirror the server-side caps in backend (devices.max_doses_day / cooldown_s /
// pump_ms). BOTH guards must pass before the pump runs.
#define PG_DOSE_MAX_MS        3000   // max single-dose pump-on duration (ms)
#define PG_DOSE_COOLDOWN_S    1800   // min seconds between doses
#define PG_DOSE_MAX_PER_DAY   4      // rolling-24h cap
#define PG_DOSE_PUMP_MS_DEF   2000   // default dose duration if cmd omits pump_ms

// ─── On-device autonomy (§5.1.1/5.1.3) ─────────────────────────────────
// When 1, the NODE decides locally (detect -> risk -> request dose) with the
// server reduced to monitoring/audit; the dose still passes dose_fsm's local
// failsafes. Default 0 (server-authoritative). Logic in src/decision/
// onboard_decision.h is host-validated; on-hardware integration is a
// documented bench-validation step (docs/BENCH_BRINGUP.md).
#ifndef PG_ONBOARD_AUTONOMY
#define PG_ONBOARD_AUTONOMY   0
#endif

// ─── I2S audio ─────────────────────────────────────────────────────────
#define PG_AUDIO_SR        16000
// 1024 samples = 64 ms @ 16 kHz; matches the in-firmware FFT length so we
// don't need to zero-pad. Bin width = 16000/1024 = 15.625 Hz.
#define PG_AUDIO_SAMPLES   1024
#define PG_AUDIO_WINDOW_MS ((PG_AUDIO_SAMPLES * 1000) / PG_AUDIO_SR)
// FFT length is FIXED at 1024 here (Appendix C item 5: the old platformio.ini
// forced PG_FFT_N=2048 which disagreed with this file). Do NOT override it in
// platformio.ini — config.h is the single source of truth.
#ifndef PG_FFT_N
#define PG_FFT_N        1024
#endif
#define PG_FFT_LOG2N    10                  // log2(1024)

// ─── Log-mel ML frame (§8.3 — MUST equal ml/features/params.py) ─────────
// The device computes a log-mel patch from the same FFT and ships it as ac.mel
// so the host FastAPI model can score P(activity). If ANY of these change,
// change ml/features/params.py too or training and inference will disagree.
#define PG_MEL_BANDS    40        // n_mels
#define PG_MEL_FRAMES   32        // rolling window of frames -> 40×32 patch
#define PG_MEL_HOP      512       // 50% hop of the 1024-sample frame
#define PG_MEL_FMIN     200       // Hz
#define PG_MEL_FMAX     8000      // Hz (Nyquist at 16 kHz)
#define PG_MEL_SEND     1         // 1 = include ac.mel in the envelope

// ─── Vibration (analog ADC) ────────────────────────────────────────────
#define PG_VIB_SAMPLE_HZ 1000
#define PG_VIB_WINDOW_MS 100               // shrunk from 1000 ms for fast cycles
#define PG_VIB_SAMPLES   ((PG_VIB_SAMPLE_HZ * PG_VIB_WINDOW_MS) / 1000)

// ─── BME680 ────────────────────────────────────────────────────────────
#define PG_BME680_I2C_ADDR  0x77
#define PG_BME680_HOT_C     320
#define PG_BME680_HEAT_MS   150

// ─── DS18B20 ───────────────────────────────────────────────────────────
#define PG_DS18B20_RES        10

// ─── Networking (only used when PG_EMIT_HTTP=1) ────────────────────────
#define PG_HTTP_TIMEOUT_MS  5000
#define PG_WIFI_CONNECT_TIMEOUT_MS 8000

// secrets.h placeholders so the firmware still compiles in serial-only mode
#ifndef PG_WIFI_SSID
#define PG_WIFI_SSID     ""
#define PG_WIFI_PASSWORD ""
#define PG_SERVER_HOST   "127.0.0.1"
#define PG_SERVER_PORT   4000
#endif
