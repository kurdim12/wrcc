#pragma once

#include "../sensors/acoustic.h"
#include "../sensors/vibration.h"
#include "../sensors/thermal.h"
#include "../sensors/env.h"
#include "../actuation/dose_fsm.h"

struct PostResult {
    bool  ok;
    bool  stream_bands;     // backend tells us a dashboard wants the spectrogram stream
    int   http_code;

    // Server-controlled arm state — the device mirrors it locally (a physical
    // switch can still hard-disarm on the node, §8.4).
    bool      armed;

    // Dose downlink command parsed from the backend response (§8.4 / §10.4).
    // The device applies its own failsafes before acting on this.
    bool      has_cmd;
    uint32_t  cmd_pump_ms;
    uint32_t  cmd_nonce;
};

// Build the Palm Guard JSON envelope for one cycle (including the `act` block
// and, when mel != nullptr, the ac.mel log-mel patch) and POST it to
// /api/v1/readings. Parses the response for {stream_bands, cmd}.
PostResult poster_send(uint32_t seq,
                       const AcousticFeatures &ac,
                       const VibrationFeatures &vib,
                       const ThermalFeatures &th,
                       const EnvFeatures &env,
                       const DoseStatus &dose,
                       const float *mel,        // len PG_MEL_BANDS*PG_MEL_FRAMES, or nullptr
                       int battery_pct);
