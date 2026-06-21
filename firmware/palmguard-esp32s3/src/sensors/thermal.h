#pragma once

struct ThermalFeatures {
    float core_c;     // trunk core probe (DS18B20)
    bool  ok;
};

bool thermal_init();
bool thermal_sample(ThermalFeatures &out);
