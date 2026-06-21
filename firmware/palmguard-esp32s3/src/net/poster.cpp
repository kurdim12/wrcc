// Build the Palm Guard JSON envelope and POST it to the backend.
// Payload schema matches what backend/routes/readings.js validates with zod.
#include "poster.h"
#include "wifi_mgr.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>


PostResult poster_send(uint32_t seq,
                       const AcousticFeatures &ac,
                       const VibrationFeatures &vib,
                       const ThermalFeatures &th,
                       const EnvFeatures &env,
                       const DoseStatus &dose,
                       const float *mel,
                       int battery_pct)
{
    PostResult r = { false, false, 0, false, false, 0, 0 };
    if (!wifi_is_connected()) return r;

    JsonDocument doc;
    doc["v"]   = 1;
    doc["dev"] = PG_DEVICE_ID;
    doc["ts"]  = (uint32_t)(millis() / 1000);   // device-side seconds since boot
    doc["seq"] = seq;

    // Acoustic
    JsonObject a = doc["ac"].to<JsonObject>();
    {
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
        if (ac.stream_bands16) {
            JsonArray b16 = a["bands16"].to<JsonArray>();
            for (int i = 0; i < 16; ++i) b16.add(roundf(ac.bands16[i] * 10) / 10);
        }
        // Log-mel patch for the ML scorer (40×32, band-major, mean-var
        // normalized). Sent rounded to 2 dp to keep the payload small.
        if (mel) {
            JsonArray m = a["mel"].to<JsonArray>();
            for (int i = 0; i < PG_MEL_BANDS * PG_MEL_FRAMES; ++i)
                m.add(roundf(mel[i] * 100) / 100);
        }
    }

    // Vibration
    JsonObject v = doc["vb"].to<JsonObject>();
    v["vib_rms"]    = roundf(vib.vib_rms * 1000) / 1000;
    v["vib_pk"]     = roundf(vib.vib_pk * 1000) / 1000;
    v["vib_dom_hz"] = roundf(vib.vib_dom_hz * 10) / 10;

    // Thermal
    if (th.ok) {
        JsonObject t = doc["th"].to<JsonObject>();
        t["core_c"] = roundf(th.core_c * 10) / 10;
        t["amb_c"]  = roundf(env.amb_c * 10) / 10;
    }

    // Environment
    JsonObject e = doc["env"].to<JsonObject>();
    e["amb_c"]    = roundf(env.amb_c * 10) / 10;
    e["hum"]      = roundf(env.hum * 10) / 10;
    e["pres"]     = roundf(env.pres * 10) / 10;
    e["gas_kohm"] = roundf(env.gas_kohm * 10) / 10;

    // Actuation truth (so the dashboard reflects real device state, §8.4)
    JsonObject act = doc["act"].to<JsonObject>();
    act["armed"]       = dose.armed;
    act["doses_today"] = dose.doses_today;
    act["last_dose_s"] = dose.last_dose_s;
    act["last_nonce"]  = dose.last_nonce;

    // System
    JsonObject sys = doc["sys"].to<JsonObject>();
    sys["bat_pct"] = battery_pct;
    sys["rssi"]    = wifi_rssi();
    sys["fw"]      = PG_FW_VERSION;
    sys["up_s"]    = (uint32_t)(millis() / 1000);

    // Serialize + POST
    String body;
    serializeJson(doc, body);

    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(PG_HTTP_TIMEOUT_MS);
    http.setTimeout(PG_HTTP_TIMEOUT_MS);
    http.setReuse(true);

    String url = String("http://") + PG_SERVER_HOST + ":" + PG_SERVER_PORT + "/api/v1/readings";

    if (!http.begin(client, url)) {
        Serial.println(F("[poster] http.begin failed"));
        return r;
    }
    http.addHeader("Content-Type", "application/json");

    int code = http.POST(body);
    r.http_code = code;
    if (code == 200) {
        String resp = http.getString();
        // Parse the response for stream_bands + the dose downlink command.
        JsonDocument rdoc;
        DeserializationError err = deserializeJson(rdoc, resp);
        if (!err) {
            r.stream_bands = rdoc["stream_bands"] | false;
            r.armed        = rdoc["armed"] | false;
            JsonObjectConst cmd = rdoc["cmd"];
            if (!cmd.isNull() && (cmd["dose"] | false)) {
                r.has_cmd     = true;
                r.cmd_pump_ms = cmd["pump_ms"] | 0;
                r.cmd_nonce   = cmd["nonce"]   | 0;
            }
        }
        r.ok = true;
        Serial.printf("[poster] OK seq=%u size=%d stream=%s cmd=%s\n",
                      seq, body.length(), r.stream_bands ? "yes" : "no",
                      r.has_cmd ? "DOSE" : "none");
    } else {
        Serial.printf("[poster] HTTP %d\n", code);
    }
    http.end();
    return r;
}
