// INMP441 I2S microphone -> FFT features for the SA risk-score input.
// The first capture after I2S start is invalid (~50 ms warm-up) and is
// discarded inside acoustic_init.
#pragma once

#include <stdint.h>
#include <stddef.h>
#include "../../include/config.h"   // PG_MEL_BANDS / PG_MEL_FRAMES / PG_FFT_N ...

// 32 sub-window RMS samples per 100 ms window = 320 columns/sec on the
// frontend, which feels like a real-time scrolling oscilloscope.
#define PG_MINI_WAVE_LEN 32

// Flattened log-mel patch length (band-major: idx = band*PG_MEL_FRAMES + frame).
#define PG_MEL_PATCH_LEN (PG_MEL_BANDS * PG_MEL_FRAMES)

struct AcousticFeatures {
    float bands[6];        // dB power in 0-500, 500-1k, 1-2k, 2-4k, 4-6k, 6-8k Hz
    float bands16[16];     // log-spaced 2-8 kHz spectrum, populated only in stream mode
    float peaks[5][2];     // top-5 peaks: {freq_hz, mag_dB}
    int   peak_count;
    float centroid_hz;
    float flatness;        // 0..1, lower = peakier
    float rms_dbfs;        // broadband RMS in dBFS
    float zcr;
    float click_rate;      // transients/sec in 2-8 kHz band envelope
    bool  stream_bands16;  // true when bands16 should be sent
    // High-resolution amplitude envelope: 32 RMS values across the 100 ms window.
    // Each value is a u8 in 0..100 mapping roughly -60..0 dBFS for the sub-window.
    uint8_t mini_wave[PG_MINI_WAVE_LEN];
};

// Init I2S, allocate FFT tables. Call once in setup().
bool acoustic_init();

// Capture one 1024-sample frame (~64 ms), run FFT, fill `out`. Returns false on
// hardware failure. `stream_bands16` selects whether to also fill bands16.
bool acoustic_sample(AcousticFeatures &out, bool stream_bands16);

// Capture a contiguous PG_MEL_FRAMES-frame window (~1 s at hop=512) and fill:
//   - patch: flattened 40×32 log-mel, band-major, per-clip mean-var normalized
//            (MUST match ml/features/melspec.py exactly).
//   - out:   the legacy scalar/band/peak features derived from the same audio,
//            so a single capture feeds both the dashboard and the ML scorer.
// `patch` must point to PG_MEL_PATCH_LEN floats. Returns false on hardware fail.
bool acoustic_capture_mel(AcousticFeatures &out, bool stream_bands16, float *patch);
