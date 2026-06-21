// DS18B20 1-Wire trunk-core probe (non-blocking).
//
// To keep the main cycle <250 ms we never wait for the 190 ms 12-bit
// conversion. Instead:
//   Cycle N:   start a conversion (~5 ms of bus activity)
//   Cycle M:   once 200 ms have elapsed, read the scratchpad and start a new one
// Between reads `thermal_sample` returns the last cached value so the JSON
// payload always carries a temperature.
#include "thermal.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <OneWire.h>

namespace {
OneWire one_wire(PG_ONEWIRE_PIN);
bool inited = false;
uint8_t addr[8];

constexpr uint8_t CMD_SKIP_ROM      = 0xCC;
constexpr uint8_t CMD_START_CONV    = 0x44;
constexpr uint8_t CMD_READ_SCRATCH  = 0xBE;
constexpr uint8_t CMD_WRITE_SCRATCH = 0x4E;

// 10-bit resolution: ~0.25°C step, ~190 ms conversion
constexpr uint8_t  RESOLUTION_10 = 0x3F;
constexpr uint32_t CONV_MS       = 200;     // safety margin over 190 ms

bool     conversion_in_flight = false;
uint32_t conv_start_ms        = 0;
float    last_temp            = 0.0f;
bool     last_ok              = false;
}


bool thermal_init() {
  if (inited) return true;
  one_wire.reset_search();
  if (!one_wire.search(addr)) {
    Serial.println(F("[thermal] no DS18B20 on the 1-Wire bus"));
    return false;
  }
  if (OneWire::crc8(addr, 7) != addr[7] || addr[0] != 0x28) {
    Serial.println(F("[thermal] bad ROM / not DS18B20"));
    return false;
  }

  // Configure 10-bit resolution
  one_wire.reset();
  one_wire.select(addr);
  one_wire.write(CMD_WRITE_SCRATCH);
  one_wire.write(0);
  one_wire.write(0);
  one_wire.write(RESOLUTION_10);

  inited = true;
  Serial.println(F("[thermal] DS18B20 ready (async, non-blocking)"));
  return true;
}


bool thermal_sample(ThermalFeatures &out) {
  out = {};
  if (!inited && !thermal_init()) {
    out.ok = false;
    return false;
  }

  uint32_t now = millis();

  if (!conversion_in_flight) {
    // Kick off a conversion (only ~5 ms of bus activity, returns immediately)
    if (one_wire.reset()) {
      one_wire.write(CMD_SKIP_ROM);
      one_wire.write(CMD_START_CONV);
      conv_start_ms = now;
      conversion_in_flight = true;
    }
  } else if ((now - conv_start_ms) >= CONV_MS) {
    // Conversion finished, read scratchpad (~5 ms)
    if (one_wire.reset()) {
      one_wire.select(addr);
      one_wire.write(CMD_READ_SCRATCH);
      uint8_t data[9];
      for (int i = 0; i < 9; ++i) data[i] = one_wire.read();
      if (OneWire::crc8(data, 8) == data[8]) {
        int16_t raw = (data[1] << 8) | data[0];
        float c = (float)raw / 16.0f;
        if (c >= -55 && c <= 125) {
          last_temp = c;
          last_ok = true;
        }
      }
    }
    conversion_in_flight = false;
  }

  out.core_c = last_ok ? last_temp : 0.0f;
  out.ok     = last_ok;
  return last_ok;
}
