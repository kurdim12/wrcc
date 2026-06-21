#pragma once

struct EnvFeatures {
    float amb_c;        // ambient temperature
    float hum;          // % RH
    float pres;         // hPa
    float gas_kohm;     // BME680 gas resistance
    bool  warmup;       // true while gas reading is unreliable (first ~20 min)
};

bool env_init();
bool env_sample(EnvFeatures &out);
