#include "dose_fsm.h"
#include "pump.h"
#include "led.h"
#include "../../include/config.h"
#include <Arduino.h>

namespace {
DoseState state        = DS_IDLE;
bool      armed        = false;
uint8_t   doses_today  = 0;
uint32_t  last_dose_s  = 0;       // 0 = never
uint32_t  last_nonce   = 0;       // anti-replay: most recent executed nonce
uint32_t  day_start_s  = 0;       // rolling-24h window anchor

// Optional physical disarm input. Define PG_DISARM_PIN in config.h/secrets.h to
// wire a hardware kill switch (active-low). Undefined by default — the flag is
// still a full hard-kill via dose_set_armed(false).
bool physical_disarmed() {
#ifdef PG_DISARM_PIN
  return digitalRead(PG_DISARM_PIN) == LOW;   // active-low kill
#else
  return false;
#endif
}

// pump_run_ms abort callback — cut the dose instantly on any disarm.
bool dose_abort() {
  return !armed || physical_disarmed();
}

void roll_day(uint32_t now_s) {
  if (day_start_s == 0) day_start_s = now_s;
  if (now_s - day_start_s >= 86400UL) {        // rolling 24 h
    day_start_s = now_s;
    doses_today = 0;
  }
}
}  // namespace

void dose_init() {
  pump_init();
#ifdef PG_DISARM_PIN
  pinMode(PG_DISARM_PIN, INPUT_PULLUP);
#endif
  state = DS_IDLE;
  armed = false;
  pump_off();
  led_set(LED_IDLE);
  Serial.printf("[dose] init: caps max_ms=%d cooldown=%ds max/day=%d (DISARMED)\n",
                PG_DOSE_MAX_MS, PG_DOSE_COOLDOWN_S, PG_DOSE_MAX_PER_DAY);
}

void dose_set_armed(bool a) {
  if (a == armed) return;
  armed = a;
  if (!armed) {                    // HARD KILL
    pump_off();
    state = DS_IDLE;
    led_set(LED_IDLE);
    Serial.println("[dose] DISARMED (hard kill)");
  } else {
    state = DS_ARMED;
    led_set(LED_ARMED);
    Serial.println("[dose] ARMED");
  }
}

bool dose_is_armed() { return armed && !physical_disarmed(); }

DoseResult dose_handle_cmd(bool has_cmd, uint32_t pump_ms, uint32_t nonce, uint32_t now_s) {
  roll_day(now_s);

  // A physical disarm always wins, regardless of the flag/downlink.
  if (physical_disarmed() && armed) dose_set_armed(false);

  // Drop out of COOLDOWN back to ARMED/IDLE once the window elapses.
  if (state == DS_COOLDOWN && (now_s - last_dose_s) >= (uint32_t)PG_DOSE_COOLDOWN_S) {
    state = armed ? DS_ARMED : DS_IDLE;
    led_set(armed ? LED_ARMED : LED_IDLE);
  }

  if (!has_cmd) return DOSE_NONE;

  // ── Failsafe gauntlet (every guard independent of the server) ──────────
  if (!dose_is_armed()) {
    Serial.println("[dose] REJECT cmd: disarmed");
    return DOSE_REJ_DISARMED;
  }
  if (pump_ms == 0 || pump_ms > (uint32_t)PG_DOSE_MAX_MS) {
    Serial.printf("[dose] REJECT cmd: pump_ms %u out of range (max %d)\n", pump_ms, PG_DOSE_MAX_MS);
    return DOSE_REJ_PUMP_MS;
  }
  if (nonce != 0 && nonce == last_nonce) {
    Serial.printf("[dose] REJECT cmd: replayed nonce %u\n", nonce);
    return DOSE_REJ_REPLAY;
  }
  if (last_dose_s != 0 && (now_s - last_dose_s) < (uint32_t)PG_DOSE_COOLDOWN_S) {
    Serial.printf("[dose] REJECT cmd: cooldown (%us since last)\n", now_s - last_dose_s);
    return DOSE_REJ_COOLDOWN;
  }
  if (doses_today >= (uint8_t)PG_DOSE_MAX_PER_DAY) {
    Serial.printf("[dose] REJECT cmd: daily cap reached (%u)\n", doses_today);
    return DOSE_REJ_DAILY_CAP;
  }

  // ── Execute ────────────────────────────────────────────────────────────
  state = DS_DOSING;
  led_set(LED_DOSING);
  Serial.printf("[dose] DOSING %u ms (nonce=%u)\n", pump_ms, nonce);
  uint32_t actual = pump_run_ms(pump_ms, dose_abort);
  pump_off();

  // Commit dose bookkeeping (this nonce is now spent — anti-replay).
  last_dose_s = now_s;
  last_nonce  = nonce;
  doses_today++;
  state = DS_COOLDOWN;
  led_set(LED_ARMED);
  Serial.printf("[dose] DONE actual=%u ms doses_today=%u\n", actual, doses_today);
  return DOSE_EXECUTED;
}

void dose_fill_status(DoseStatus &out) {
  out.armed       = armed;
  out.doses_today = doses_today;
  out.last_dose_s = last_dose_s;
  out.last_nonce  = last_nonce;
  out.state       = state;
}
