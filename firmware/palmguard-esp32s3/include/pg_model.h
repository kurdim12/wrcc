// pg_model.h — on-device trained "tiny agent" head (real edge AI).
//
// Derived from ml/eval_report/real_model_edge.json: a logistic model trained on
// REAL weevil/borer feeding recordings (cbalingbing Rice-Acoustic-Sensor corpus,
// 75 recordings, 54,838 windows), leakage-safe GroupKFold-by-recording OOF
// ROC-AUC 0.669. It uses ONLY the 5 features the device already computes, so it
// maps 1:1 onto acoustic.cpp (no band-edge dependency, no quantization mismatch).
//
// This is genuine edge AI: ~40 floats, runs in microseconds on the ESP32-S3.
// HONEST SCOPE: trained on proxy species via a contact/MEMS corpus; airborne-mic
// RPW field validation is the documented next step. Never reported as a
// field-validated RPW accuracy. The dose path stays human/cap gated regardless.
#pragma once
#include <math.h>

#define PG_MODEL_NFEAT   5
#define PG_MODEL_VERSION "real-edge-logreg-v1"   // real weevil corpus, OOF AUC 0.669

// feature order: [rms_dbfs, zcr, centroid_hz, flatness, click_rate]
static const float PG_MODEL_MEAN[PG_MODEL_NFEAT] = { -67.442555f, 0.184992f, 347.520170f, 0.114634f, 0.081095f };
static const float PG_MODEL_STD [PG_MODEL_NFEAT] = {   7.791776f, 0.035671f,  69.407045f, 0.029219f, 0.183340f };
static const float PG_MODEL_COEF[PG_MODEL_NFEAT] = {  -0.076259f, -0.113298f,  0.188900f, -0.193584f, -1.208378f };
static const float PG_MODEL_INTERCEPT = -0.189591f;

// Standardize + logistic -> P(feeding activity) in [0,1].
static inline float pg_model_activity(const float f[PG_MODEL_NFEAT]) {
  float z = PG_MODEL_INTERCEPT;
  for (int i = 0; i < PG_MODEL_NFEAT; ++i)
    z += PG_MODEL_COEF[i] * ((f[i] - PG_MODEL_MEAN[i]) / PG_MODEL_STD[i]);
  return 1.0f / (1.0f + expf(-z));
}
