#include "pump.h"
#include "../../include/config.h"
#include <Arduino.h>

namespace {
const int   GATE_ON  = PG_PUMP_ACTIVE_HIGH ? HIGH : LOW;
const int   GATE_OFF = PG_PUMP_ACTIVE_HIGH ? LOW  : HIGH;
bool inited = false;
}

void pump_off() {
  digitalWrite(PG_PUMP_GATE_PIN, GATE_OFF);
}

void pump_init() {
  pinMode(PG_PUMP_GATE_PIN, OUTPUT);
  pump_off();                     // default OFF before anything else
  inited = true;
  Serial.printf("[pump] gate=GPIO%d active_%s, default OFF (max %d ms/dose)\n",
                PG_PUMP_GATE_PIN, PG_PUMP_ACTIVE_HIGH ? "high" : "low", PG_DOSE_MAX_MS);
}

uint32_t pump_run_ms(uint32_t ms, bool (*abort)()) {
  if (!inited) pump_init();
  // Hard clamp — the firmware never trusts an upstream pump_ms blindly (§8.4).
  if (ms > (uint32_t)PG_DOSE_MAX_MS) ms = PG_DOSE_MAX_MS;
  if (ms == 0) return 0;

  const uint32_t t0 = millis();
  digitalWrite(PG_PUMP_GATE_PIN, GATE_ON);

  // Run in 20 ms slices so a physical disarm aborts within one slice and the
  // task watchdog stays fed.
  while (millis() - t0 < ms) {
    if (abort && abort()) break;
    delay(20);
  }

  pump_off();
  return millis() - t0;
}
