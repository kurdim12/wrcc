// Palm Guard ESP32-S3 sensor node entry point.
//
// In serial-only mode (PG_EMIT_SERIAL=1, PG_EMIT_HTTP=0):
//   - No WiFi needed; each cycle prints one tagged JSON line ("#PG#{...}")
//   - tools/serial_bridge.py forwards those to the backend over HTTP.
//   - NOTE: the dose downlink is only delivered on the HTTP path (the serial
//     path is one-way), so a serial-only bench node never doses.
//
// In HTTP mode (env:palmguard_wifi): poster_send() POSTs the envelope and reads
// back {stream_bands, cmd}. A dose runs only on a valid cmd that also passes all
// local failsafes in dose_fsm (§8.4).
#include <Arduino.h>
#include <ArduinoJson.h>
#include "../include/config.h"

#include "sensors/acoustic.h"
#include "sensors/vibration.h"
#include "sensors/thermal.h"
#include "sensors/env.h"

#include "actuation/pump.h"
#include "actuation/led.h"
#include "actuation/dose_fsm.h"

#if PG_EMIT_HTTP
  #include "net/wifi_mgr.h"
  #include "net/poster.h"
#endif

namespace {
uint32_t seq = 0;
bool stream_mode = false;
bool ok_a = false, ok_v = false, ok_t = false, ok_e = false;
// Mel patch buffer (40×32 floats), reused each cycle. ~5 KB.
float mel_patch[PG_MEL_PATCH_LEN];
bool  mel_valid = false;
}


int read_battery_pct() {
#ifdef PG_BAT_ADC_PIN
  int raw = analogRead(PG_BAT_ADC_PIN);
  float v_node = (float)raw / 4095.0f * 3.3f;
  float v_bat  = v_node * 2.0f;
  int pct = (int)((v_bat - 3.3f) / (4.2f - 3.3f) * 100.0f);
  if (pct < 0) pct = 0; if (pct > 100) pct = 100;
  return pct;
#else
  return 100;
#endif
}


// Build the JSON envelope and print it to Serial with the bridge marker prefix.
void emitSerialJson(const AcousticFeatures &ac, const VibrationFeatures &vib,
                    const ThermalFeatures &th, const EnvFeatures &env,
                    const DoseStatus &dose, int batt) {
  JsonDocument doc;
  doc["v"]   = 1;
  doc["dev"] = PG_DEVICE_ID;
  doc["ts"]  = (uint32_t)(millis() / 1000);
  doc["seq"] = seq;

  if (ok_a) {
    JsonObject a = doc["ac"].to<JsonObject>();
    JsonArray bands = a["bands"].to<JsonArray>();
    for (int i = 0; i < 6; ++i) bands.add(roundf(ac.bands[i] * 10) / 10);
    if (ac.peak_count > 0) {
      JsonArray peaks = a["peaks"].to<JsonArray>();
      for (int i = 0; i < ac.peak_count; ++i) {
        JsonArray p = peaks.add<JsonArray>();
        p.add((int)ac.peaks[i][0]);
        p.add((int)roundf(ac.peaks[i][1]));
      }
    }
    a["cent"] = (int)ac.centroid_hz;
    a["flat"] = roundf(ac.flatness * 100) / 100;
    a["rms"]  = roundf(ac.rms_dbfs * 10) / 10;
    a["zcr"]  = roundf(ac.zcr * 100) / 100;
    a["clk"]  = roundf(ac.click_rate * 10) / 10;
    JsonArray wv = a["wv"].to<JsonArray>();
    for (int i = 0; i < PG_MINI_WAVE_LEN; ++i) wv.add((int)ac.mini_wave[i]);
    if (ac.stream_bands16) {
      JsonArray b16 = a["bands16"].to<JsonArray>();
      for (int i = 0; i < 16; ++i) b16.add(roundf(ac.bands16[i] * 10) / 10);
    }
#if PG_MEL_SEND
    if (mel_valid) {
      JsonArray m = a["mel"].to<JsonArray>();
      for (int i = 0; i < PG_MEL_PATCH_LEN; ++i) m.add(roundf(mel_patch[i] * 100) / 100);
    }
#endif
  }

  if (ok_v) {
    JsonObject v = doc["vb"].to<JsonObject>();
    v["vib_rms"]    = roundf(vib.vib_rms * 1000) / 1000;
    v["vib_pk"]     = roundf(vib.vib_pk  * 1000) / 1000;
    v["vib_dom_hz"] = roundf(vib.vib_dom_hz * 10) / 10;
  }

  if (ok_t && th.ok) {
    JsonObject t = doc["th"].to<JsonObject>();
    t["core_c"] = roundf(th.core_c * 10) / 10;
    if (ok_e) t["amb_c"] = roundf(env.amb_c * 10) / 10;
  }

  if (ok_e) {
    JsonObject e = doc["env"].to<JsonObject>();
    e["amb_c"]    = roundf(env.amb_c * 10) / 10;
    e["hum"]      = roundf(env.hum   * 10) / 10;
    e["pres"]     = roundf(env.pres  * 10) / 10;
    e["gas_kohm"] = roundf(env.gas_kohm * 10) / 10;
  }

  // Actuation truth so the dashboard mirrors real device state (§8.4)
  JsonObject act = doc["act"].to<JsonObject>();
  act["armed"]       = dose.armed;
  act["doses_today"] = dose.doses_today;
  act["last_dose_s"] = dose.last_dose_s;
  act["last_nonce"]  = dose.last_nonce;

  JsonObject sys = doc["sys"].to<JsonObject>();
  sys["bat_pct"] = batt;
  sys["fw"]      = PG_FW_VERSION;
  sys["up_s"]    = (uint32_t)(millis() / 1000);

  Serial.print(PG_SERIAL_TAG);
  serializeJson(doc, Serial);
  Serial.println();
}


void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println();
  Serial.println(F("============================================"));
  Serial.print  (F(" Palm Guard "));
  Serial.print  (PG_DEVICE_ID);
  Serial.print  (F("  fw "));
  Serial.println(PG_FW_VERSION);
  Serial.printf(" Mode: %s%s\n",
                PG_EMIT_SERIAL ? "Serial " : "",
                PG_EMIT_HTTP   ? "+HTTP"   : "");
  Serial.println(F("============================================"));

  // Actuation first so the pump is forced OFF before anything else can run.
  led_init();
  led_set(LED_BOOT);
  dose_init();

  ok_a = acoustic_init();
  ok_v = vibration_init();
  ok_t = thermal_init();
#if PG_BME680_PRESENT
  ok_e = env_init();
#else
  ok_e = false;
#endif

  Serial.printf("[init] acoustic=%d vibration=%d thermal=%d env=%d\n",
                ok_a, ok_v, ok_t, ok_e);

#if PG_EMIT_HTTP
  if (strlen(PG_WIFI_SSID) > 0) wifi_connect();
#endif

  led_set(LED_IDLE);
  Serial.println(F("[ready] starting cycle loop"));
}


void loop() {
  seq++;
  uint32_t t0 = millis();

  AcousticFeatures ac{};
  VibrationFeatures vib{};
  ThermalFeatures th{};
  EnvFeatures env{};

  if (ok_e) env_sample(env);
  if (ok_t) thermal_sample(th);
  if (ok_v) vibration_sample(vib);
  if (ok_a) {
#if PG_MEL_SEND
    // ~1 s contiguous capture -> fast features + 40×32 log-mel patch
    mel_valid = acoustic_capture_mel(ac, stream_mode, mel_patch);
#else
    mel_valid = false;
    acoustic_sample(ac, stream_mode);
#endif
  }

  int batt = read_battery_pct();

  DoseStatus dose{};
  dose_fill_status(dose);

#if PG_EMIT_SERIAL
  emitSerialJson(ac, vib, th, env, dose, batt);
#endif

#if PG_EMIT_HTTP
  if (wifi_is_connected()) {
    auto r = poster_send(seq, ac, vib, th, env, dose,
                         (PG_MEL_SEND && mel_valid) ? mel_patch : nullptr, batt);
    stream_mode = r.stream_bands;
    // Mirror the dashboard-controlled arm state (physical switch can still
    // hard-disarm locally inside dose_fsm).
    dose_set_armed(r.armed);
    // Apply the downlink dose command through the local failsafe gauntlet.
    uint32_t now_s = (uint32_t)(millis() / 1000);
    dose_handle_cmd(r.has_cmd, r.cmd_pump_ms, r.cmd_nonce, now_s);
  }
#endif

  uint32_t cycle_ms = millis() - t0;

  static uint32_t last_log = 0;
  if (millis() - last_log > 2000) {
    last_log = millis();
    Serial.printf("[t] cycle=%lums  armed=%d doses_today=%u\n",
                  cycle_ms, dose.armed, dose.doses_today);
  }

  uint32_t target = stream_mode ? PG_STREAM_CYCLE_INTERVAL_MS : PG_CYCLE_INTERVAL_MS;
  if (cycle_ms < target) delay(target - cycle_ms);
}
