// Vibration sensor: LM393-based analog module (SW-420, KY-002, 801S, ...).
// The breakout exposes:
//   VCC, GND, DO (digital threshold out, unused), A0 (analog out).
// We sample A0 on the ESP32-S3 ADC at 1 kHz for one second, remove the
// quiescent DC offset, then compute RMS, peak, and zero-crossing rate
// (a cheap proxy for dominant frequency).
//
// This replaces the original MPU6050 I2C path - same VibrationFeatures
// struct, so riskScore on the backend continues to read it without changes.

#include "vibration.h"
#include "../../include/config.h"

#include <Arduino.h>
#include <math.h>

namespace {
bool inited = false;
constexpr int   N        = PG_VIB_SAMPLES;             // 1000 samples
constexpr int   PERIOD_US = 1000000 / PG_VIB_SAMPLE_HZ; // 1 ms per sample
constexpr float ADC_REF_V = 3.3f;
constexpr float ADC_RES   = 4095.0f;
}


bool vibration_init() {
  if (inited) return true;
  pinMode(PG_VIB_ADC_PIN, INPUT);
  // ESP32-S3 ADC1 default: 12-bit, ~0-3.3V (with 11dB attenuation).
  analogReadResolution(12);
  analogSetPinAttenuation(PG_VIB_ADC_PIN, ADC_11db);
  inited = true;
  Serial.println(F("[vibration] LM393 ADC ready"));
  return true;
}


bool vibration_sample(VibrationFeatures &out) {
  out = {};
  if (!inited && !vibration_init()) return false;

  static float samples[N];

  // Sample 1 kHz for 1 s.
  uint32_t next = micros();
  for (int i = 0; i < N; ++i) {
    while ((int32_t)(micros() - next) < 0) ;
    next += PERIOD_US;
    int raw = analogRead(PG_VIB_ADC_PIN);
    samples[i] = (float)raw * ADC_REF_V / ADC_RES;     // volts
  }

  // Mean (DC offset of LM393 quiescent state)
  float mean = 0;
  for (int i = 0; i < N; ++i) mean += samples[i];
  mean /= (float)N;

  // RMS / peak / zero-crossing rate around the mean
  float sum_sq = 0;
  float peak = 0;
  int zc = 0;
  bool prev_pos = (samples[0] - mean) > 0;
  for (int i = 0; i < N; ++i) {
    float a = samples[i] - mean;
    sum_sq += a * a;
    if (fabsf(a) > peak) peak = fabsf(a);
    bool pos = a > 0;
    if (i > 0 && pos != prev_pos) zc++;
    prev_pos = pos;
  }

  // Convert volt-RMS to a g-equivalent so the backend's riskScore (which is
  // tuned for accelerometer "g RMS") still produces sensible numbers.
  // The LM393 module saturates around full scale on heavy vibration; we map
  // 0-1.5V deviation roughly to 0-0.5g (calibration is approximate).
  const float V_TO_G = 0.33f;
  out.vib_rms    = sqrtf(sum_sq / N) * V_TO_G;
  out.vib_pk     = peak * V_TO_G;
  out.vib_dom_hz = (float)zc * (float)PG_VIB_SAMPLE_HZ / (2.0f * (float)N);
  return true;
}
