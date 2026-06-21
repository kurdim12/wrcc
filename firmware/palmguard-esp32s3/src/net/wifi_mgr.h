#pragma once

bool wifi_connect();          // blocking, with timeout. true = connected
bool wifi_is_connected();
int  wifi_rssi();
const char *wifi_ip();
