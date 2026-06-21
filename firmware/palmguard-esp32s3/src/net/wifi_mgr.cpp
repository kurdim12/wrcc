#include "wifi_mgr.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <WiFi.h>


bool wifi_connect() {
    if (WiFi.status() == WL_CONNECTED) return true;
    Serial.printf("[wifi] connecting to '%s'\n", PG_WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true);
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


bool wifi_is_connected() { return WiFi.status() == WL_CONNECTED; }
int  wifi_rssi()         { return WiFi.RSSI(); }
const char *wifi_ip() {
    static String s; s = WiFi.localIP().toString(); return s.c_str();
}
