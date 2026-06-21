// BME680 environmental sensor.
// When PG_BME680_PRESENT == 0 we compile stubs that report "no sensor".
// Once the BME680 is wired, set PG_BME680_PRESENT=1 in include/config.h and
// re-add the Adafruit_BME680 + Adafruit_Sensor lib_deps in platformio.ini.

#include "env.h"
#include "../../include/config.h"

#include <Arduino.h>

#if PG_BME680_PRESENT

#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME680.h>

namespace {
Adafruit_BME680 bme;
bool inited = false;
int  warmup_remaining = 240;
}

bool env_init() {
  if (inited) return true;
  Wire.begin(PG_I2C_SDA, PG_I2C_SCL, 400000);
  if (!bme.begin(PG_BME680_I2C_ADDR)) {
    if (!bme.begin(PG_BME680_I2C_ADDR == 0x77 ? 0x76 : 0x77)) return false;
  }
  bme.setTemperatureOversampling(BME680_OS_8X);
  bme.setHumidityOversampling(BME680_OS_2X);
  bme.setPressureOversampling(BME680_OS_4X);
  bme.setIIRFilterSize(BME680_FILTER_SIZE_3);
  bme.setGasHeater(PG_BME680_HOT_C, PG_BME680_HEAT_MS);
  inited = true;
  return true;
}

bool env_sample(EnvFeatures &out) {
  out = {};
  if (!inited && !env_init()) return false;
  if (!bme.performReading()) return false;
  out.amb_c    = bme.temperature;
  out.hum      = bme.humidity;
  out.pres     = bme.pressure / 100.0f;
  out.gas_kohm = bme.gas_resistance / 1000.0f;
  if (warmup_remaining > 0) { warmup_remaining--; out.warmup = true; }
  return true;
}

#else  // BME680 not present - compile stubs

bool env_init() { return false; }
bool env_sample(EnvFeatures &out) { out = {}; return false; }

#endif
