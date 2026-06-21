#include "led.h"
#include "../../include/config.h"
#include <Arduino.h>
#include <Adafruit_NeoPixel.h>

namespace {
Adafruit_NeoPixel strip(PG_LED_COUNT, PG_LED_DATA_PIN, NEO_GRB + NEO_KHZ800);
bool inited = false;

// Colors are pre-scaled to PG_LED_MAX_BRIGHT to stay inside the power budget.
uint32_t scaled(uint8_t r, uint8_t g, uint8_t b) {
  const float k = (float)PG_LED_MAX_BRIGHT / 255.0f;
  return strip.Color((uint8_t)(r * k), (uint8_t)(g * k), (uint8_t)(b * k));
}
}

void led_init() {
  strip.begin();
  strip.setBrightness(PG_LED_MAX_BRIGHT);
  strip.clear();
  strip.show();
  inited = true;
  Serial.printf("[led] WS2812 on GPIO%d, %d LED(s), bright<=%d (status only)\n",
                PG_LED_DATA_PIN, PG_LED_COUNT, PG_LED_MAX_BRIGHT);
}

void led_set(LedStatus s) {
  if (!inited) return;
  uint32_t c;
  switch (s) {
    case LED_BOOT:    c = scaled(60, 60, 60);  break;  // dim white
    case LED_IDLE:    c = scaled(0, 120, 0);   break;  // dim green
    case LED_ARMED:   c = scaled(0, 60, 200);  break;  // blue
    case LED_RISK:    c = scaled(220, 120, 0); break;  // amber
    case LED_DOSING:  c = scaled(220, 0, 160); break;  // magenta
    case LED_OFFLINE:
    default:          c = 0;                   break;  // off
  }
  for (int i = 0; i < PG_LED_COUNT; ++i) strip.setPixelColor(i, c);
  strip.show();
}
