#pragma once

bool wifi_connect();          // blocking, with timeout. true = connected
bool wifi_is_connected();
// Non-blocking reconnect tick. Call every loop; if disconnected and a throttle
// window has elapsed it kicks a NON-blocking WiFi.reconnect() and returns.
// Re-syncs after a venue WiFi drop without ever stalling the main loop (§3).
void wifi_tick();
int  wifi_rssi();
const char *wifi_ip();
