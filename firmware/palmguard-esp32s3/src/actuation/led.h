// Status LED (WS2812-class, addressable). STATUS USE ONLY.
//
// Power note (§5.2.3): a 60-LED strip at full white ≈ 3.6 A is impossible on a
// ~1 W solar node. Firmware drives only PG_LED_COUNT LEDs at PG_LED_MAX_BRIGHT
// and never lights the full strip in field mode.
#pragma once

enum LedStatus {
  LED_BOOT,       // dim white  - starting up
  LED_IDLE,       // dim green  - listening, disarmed
  LED_ARMED,      // blue       - armed, waiting for a confirmed dose
  LED_RISK,       // amber      - elevated risk detected
  LED_DOSING,     // magenta    - pump running
  LED_OFFLINE,    // off        - no uplink
};

void led_init();
void led_set(LedStatus s);
