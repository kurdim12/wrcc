// Dose state machine — server-authoritative, with DEVICE-SIDE failsafes that
// are the last line of defense even if the backend misbehaves (§3, §8.4).
//
//   IDLE → ARMED → DOSE_REQUESTED → DOSING → COOLDOWN
//
// The device NEVER self-initiates a dose. It executes one only when it receives
// a downlink command {dose, pump_ms, nonce} (from the HTTP poster response) AND
// every local guard passes:
//   - armed flag is locally set, AND
//   - pump_ms ≤ PG_DOSE_MAX_MS, AND
//   - now - last_dose_ts ≥ PG_DOSE_COOLDOWN_S, AND
//   - doses_today < PG_DOSE_MAX_PER_DAY, AND
//   - nonce not seen before (anti-replay).
#pragma once

#include <stdint.h>

enum DoseState { DS_IDLE, DS_ARMED, DS_REQUESTED, DS_DOSING, DS_COOLDOWN };

// Reasons a command was rejected (logged + reflected to the operator indirectly
// via the act block staying unchanged).
enum DoseResult {
  DOSE_NONE,        // no command this cycle
  DOSE_EXECUTED,    // pump ran
  DOSE_REJ_DISARMED,
  DOSE_REJ_PUMP_MS,
  DOSE_REJ_COOLDOWN,
  DOSE_REJ_DAILY_CAP,
  DOSE_REJ_REPLAY,
};

struct DoseStatus {
  bool      armed;
  uint8_t   doses_today;
  uint32_t  last_dose_s;   // device-uptime seconds of last successful dose (0 = never)
  uint32_t  last_nonce;    // last executed nonce (0 = none) — echoed as act.last_nonce
  DoseState state;
};

void  dose_init();

// Arm/disarm from the dashboard downlink or a physical switch. Disarming is a
// HARD KILL: it forces IDLE and cuts any in-flight pump.
void  dose_set_armed(bool armed);
bool  dose_is_armed();

// Process the per-cycle downlink. `now_s` is monotonic device seconds.
// When has_cmd is true a dose command was present (pump_ms, nonce).
DoseResult dose_handle_cmd(bool has_cmd, uint32_t pump_ms, uint32_t nonce, uint32_t now_s);

// Snapshot for the act block in the telemetry envelope.
void  dose_fill_status(DoseStatus &out);
