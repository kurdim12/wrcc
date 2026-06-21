#pragma once

struct VibrationFeatures {
    float vib_rms;       // g, RMS over 1 s window across 3 axes
    float vib_pk;        // g, peak magnitude
    float vib_dom_hz;    // dominant frequency (Hz)
};

bool vibration_init();
bool vibration_sample(VibrationFeatures &out);
