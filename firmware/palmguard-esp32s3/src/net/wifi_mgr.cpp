#include "wifi_mgr.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <WiFi.h>


bool wifi_connect() {
    if (WiFi.status() == WL_CONNECTED) return true;
    Serial.printf("[wifi] connecting to '%s'\n", PG_WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true);
    // Let the SDK transparently reconnect after a drop (non-blocking).
    WiFi.setAutoReconnect(true);
    WiFi.persistent(false);
    WiFi.begin(PG_WIFI_SSID, PG_WIFI_PASSWORD);

    uint32_t start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < PG_WIFI_CONNECT_TIMEOUT_MS) {
        delay(250);
        Serial.print('.');
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println(F("[wifi] failed - will retry next cycle"));
        return false;
    }
    Serial.printf("[wifi] connected, IP=%s, RSSI=%d\n",
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    return true;
}


// Non-blocking re-sync after a WiFi drop. The main loop calls this every cycle;
// it NEVER blocks — it just kicks WiFi.reconnect() at most once per throttle
// window and returns immediately. The SDK does the actual reconnect in the
// background (setAutoReconnect), so telemetry resumes on its own.
void wifi_tick() {
    if (strlen(PG_WIFI_SSID) == 0) return;          // serial-only build, no WiFi
    if (WiFi.status() == WL_CONNECTED) return;
    static uint32_t last_kick = 0;
    const uint32_t RECONNECT_THROTTLE_MS = 10000;   // at most every 10 s
    uint32_t nowMs = millis();
    if (last_kick != 0 && (nowMs - last_kick) < RECONNECT_THROTTLE_MS) return;
    last_kick = nowMs;
    Serial.println(F("[wifi] link down - kicking non-blocking reconnect"));
    WiFi.reconnect();                                // returns immediately
}


bool wifi_is_connected() { return WiFi.status() == WL_CONNECTED; }
int  wifi_rssi()         { return WiFi.RSSI(); }
const char *wifi_ip() {
    static String s; s = WiFi.localIP().toString(); return s.c_str();
}
