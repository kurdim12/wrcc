// On-device decision (autonomy path) — header-only, pure logic, NO hardware deps.
//
// Mirrors the backend acoustic heuristic (services/riskScore.js: acousticHeuristic)
// + a light vibration corroboration so the NODE can detect → decide → request a
// dose entirely on its own, with the server reduced to monitoring/audit. The
// actual pump still runs only through dose_fsm's local failsafes (arm + caps +
// nonce), so this never weakens safety — it removes the *server* from the
// control path.
//
// ⚠️ UNTESTED ON HARDWARE in this repo state — bench-validate per
// docs/BENCH_BRINGUP.md. Compiled out by default (PG_ONBOARD_AUTONOMY=0).
//
// Integration (add at the known call site in src/main.cpp, after features are
// computed for the cycle, inside `#if PG_ONBOARD_AUTONOMY`):
//
//     static int pg_streak = 0;
//     int risk = pg_onboard_risk(ac, vib_rms, vib_dom_hz);   // 0..100, local
//     if (pg_onboard_decide(risk, pg_streak, dose_is_armed())) {
//         uint32_t nonce = pg_onboard_nonce(now_s);
//         dose_handle_cmd(true, PG_DOSE_PUMP_MS_DEF, nonce, now_s);  // node acts; FSM still gates
//     }
//
#pragma once
#include <math.h>
#include <stdint.h>
#include "../sensors/acoustic.h"
#include "../../include/config.h"

#ifndef PG_ONBOARD_HIGH_RISK
#define PG_ONBOARD_HIGH_RISK 61      // mirrors server doseEngine HIGH_RISK
#endif
#ifndef PG_ONBOARD_SUSTAIN_K
#define PG_ONBOARD_SUSTAIN_K 3       // sustained high readings before the node decides
#endif

// Hardware RNG when on-target; deterministic fallback for host unit tests.
#if defined(ARDUINO) || defined(ESP_PLATFORM)
  #include <esp_system.h>
  static inline uint32_t pg_rng() { return esp_random(); }
#else
  static inline uint32_t pg_rng() { return 0x9E3779B9u; }
#endif

static inline float pg_clipf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
static inline float pg_sigmoidf(float x) { return 1.0f / (1.0f + expf(-x)); }

// Acoustic activity in [0,1] from the same coarse cues as the server heuristic:
// transient/click density, mid-band lift over off-bands, spectral peakiness.
// No hardcoded "RPW = X kHz" term — this is an activity indicator, not a classifier.
static inline float pg_onboard_activity(const AcousticFeatures &ac) {
    const float clickNorm = pg_clipf(ac.click_rate / 10.0f, 0.0f, 1.0f);
    const float midEnergy = (ac.bands[3] + ac.bands[4]) * 0.5f;            // 2-4k, 4-6k
    const float offEnergy = (ac.bands[0] + ac.bands[1] + ac.bands[5]) / 3.0f;
    const float bandRatio = pg_sigmoidf((midEnergy - offEnergy) / 6.0f);
    const float peakiness = pg_clipf(1.0f - ac.flatness, 0.0f, 1.0f);
    return pg_clipf(0.45f * clickNorm + 0.35f * bandRatio + 0.20f * peakiness, 0.0f, 1.0f);
}

// Local fused risk 0..100: acoustic primary (SA) + light vibration corroboration.
// Thermal/VOC context stays server-side; this is the on-device, real-time signal.
static inline int pg_onboard_risk(const AcousticFeatures &ac, float vib_rms, float vib_dom_hz) {
    const float sa = 100.0f * pg_onboard_activity(ac);
    const float rmsTerm = 60.0f * tanhf(vib_rms / 0.15f);
    const float freqMatch = (vib_dom_hz >= 5.0f && vib_dom_hz <= 25.0f) ? 40.0f : 0.0f;
    const float sv = pg_clipf(rmsTerm + freqMatch, 0.0f, 100.0f);
    return (int)(pg_clipf(0.75f * sa + 0.25f * sv, 0.0f, 100.0f) + 0.5f);
}

// The autonomous decision: sustained high local risk + armed → request a dose.
// `streak` is caller-owned state (reset to 0 after a request so cooldown governs
// repeats). Returns true at most once per sustained event.
static inline bool pg_onboard_decide(int risk, int &streak, bool armed) {
    streak = (risk >= PG_ONBOARD_HIGH_RISK) ? (streak + 1) : 0;
    if (armed && streak >= PG_ONBOARD_SUSTAIN_K) { streak = 0; return true; }
    return false;
}

// Locally-generated single-use nonce (anti-replay) when the node self-initiates.
static inline uint32_t pg_onboard_nonce(uint32_t now_s) {
    uint32_t n = now_s * 2654435761u + pg_rng();
    return n ? n : 1u;   // never 0 (0 means "no dose")
}
