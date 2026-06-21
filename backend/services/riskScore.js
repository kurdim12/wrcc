// Multi-sensor fusion risk-score engine.
// Fuses four physical channels into a 0-100 risk score:
//   - INMP441   -> SA  (acoustic)   — now driven by the ML model (services/fusion.js)
//   - SW-420    -> SV  (vibration)  — corroboration only (crude analog module)
//   - DS18B20   -> ST  (thermal)
//   - BME680    -> SVOC (chemical / VOC)

import * as baseline from './baseline.js';

const clip = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const tanh = Math.tanh;

// ─── Acoustic heuristic (FALLBACK ONLY) ────────────────────────────────────
// Used only when the ML service is unreachable or no mel frame is present.
// Returns p_activity in [0,1].
//
// Appendix B / C #4: there is NO hardcoded "RPW ≈ 4.5 kHz centroid" term here.
// Literature puts larval feeding energy lower (~0.5-4 kHz) and, more to the
// point, the trained model owns the spectral decision. This heuristic only
// reflects coarse, defensible cues: transient/click density, mid-band lift over
// the off-bands, and spectral peakiness.
export const acousticHeuristic = (ac) => {
  if (!ac) return 0;
  const { bands = [-80, -80, -80, -80, -80, -80], clk = 0, flat = 1 } = ac;

  const clickNorm = Math.min(clk / 10, 1);                  // 10 clicks/sec saturates
  const midEnergy = (bands[3] + bands[4]) / 2;              // 2-4 kHz, 4-6 kHz
  const offEnergy = (bands[0] + bands[1] + bands[5]) / 3;   // < 1 kHz + > 6 kHz
  const bandRatio = sigmoid((midEnergy - offEnergy) / 6);   // ~0..1, soft transition
  const peakiness = clip(1 - flat, 0, 1);                   // peaky spectra score higher

  return clip(0.45 * clickNorm + 0.35 * bandRatio + 0.20 * peakiness, 0, 1);
};

// ─── SV: vibration validation score (0-100) ───────────────────────────────
// Sustained internal vibration in 5-25 Hz scores high; transient external events ignored.
// SPEC-NOTE: SW-420 is a crude LM393 analog module — treat SV as CORROBORATION,
// not validation. A future MPU6050 upgrade would give real g-RMS + dominant Hz.
const computeSV = (vib) => {
  if (!vib) return 0;
  const { vib_rms = 0, vib_dom_hz = 0 } = vib;

  const rmsTerm = 60 * tanh(vib_rms / 0.15);                 // 0.15g = ~mid-scale
  const freqMatch = (vib_dom_hz >= 5 && vib_dom_hz <= 25) ? 40 : 0;

  return clip(rmsTerm + freqMatch, 0, 100);
};

// ─── ST: thermal anomaly score (0-100) ────────────────────────────────────
// Deviation of trunk core temp above a per-device EWMA baseline.
// Returns 0 if baseline isn't established yet (cold-start handled in baseline.js).
const computeST = (th, b) => {
  if (!th || th.core_c == null || !b?.temp_baseline_c) return 0;
  const delta = th.core_c - b.temp_baseline_c - 0.5;          // -0.5°C noise floor
  return clip(Math.max(0, delta) * 25, 0, 100);
};

// ─── SVOC: chemical signature score (0-100) ───────────────────────────────
// Uses BME680 gas resistance with Differential Baseline Correction (DBC):
//   IAQ_proxy = log10( R0_device / R_current )   -- R0 = 7-day rolling max
//   IAQ_farm  = mean of R0 across devices in same farm
//   SVOC scales with how much device exceeds farm-level VOC background.
const computeSVOC = (env, b, deviceId) => {
  if (!env || env.gas_kohm == null) return 0;
  // Skip during BME680 warm-up (first ~20 min of operation).
  if ((b?.voc_warmup_remaining ?? 0) > 0) return 0;
  if (!b?.gas_kohm_max) return 0;                            // no R0 yet

  const iaqDev = Math.log10(b.gas_kohm_max / Math.max(env.gas_kohm, 0.1));
  const farmMean = baseline.farmGasMean(deviceId);
  const farmIaq = farmMean ? Math.log10(farmMean / Math.max(env.gas_kohm, 0.1)) : 0;

  const dbcDelta = Math.max(0, iaqDev - farmIaq);            // pure device-level VOC
  // Humidity correction: gas_resistance falls in high humidity even without VOC
  const humCorr = env.hum != null ? clip((env.hum - 60) / 100, -0.2, 0.2) : 0;

  return clip(80 * dbcDelta + 20 * (1 - Math.abs(humCorr)), 0, 100);
};

// ─── Adaptive weights ─────────────────────────────────────────────────────
const adaptiveWeights = (vib, env, deviceId) => {
  const w = { a: 0.40, v: 0.25, t: 0.20, voc: 0.15 };

  // High wind: down-weight acoustic + vibration, up-weight thermal + VOC
  if (vib?.vib_rms > 0.5) {
    w.a *= 0.7; w.v *= 0.7; w.t *= 1.3; w.voc *= 1.3;
  }
  // Extreme ambient temps make EWMA baseline unreliable
  if (env?.amb_c != null && (env.amb_c > 40 || env.amb_c < 10)) {
    w.t *= 0.7;
  }
  // Recent farm chemical activity contaminates BME680 - damp VOC for 72h
  if (baseline.recentChemicalEventHours(deviceId) < 72) {
    w.voc *= 0.6;
  }

  const s = w.a + w.v + w.t + w.voc;
  return { a: w.a / s, v: w.v / s, t: w.t / s, voc: w.voc / s };
};

const classify = (risk) =>
  risk < 31 ? 'low' : risk < 61 ? 'medium' : 'high';

/**
 * Compute the full multi-sensor risk score for a single reading.
 *   reading: parsed POST /api/v1/readings body (validated by zod)
 *   opts.pActivity: P(activity) in [0,1] from the ML model (services/fusion.js).
 *                   When provided, SA = 100 * pActivity (§10.2). When omitted,
 *                   SA falls back to 100 * acousticHeuristic(ac).
 * Returns: { sa, sv, st, svoc, weights, risk_score, classification, baseline }
 */
export const compute = (deviceId, reading, opts = {}) => {
  // Update baselines first (uses this reading) then read them back.
  const b = baseline.update(deviceId, reading);

  const sa = opts.pActivity != null
    ? clip(100 * opts.pActivity, 0, 100)
    : 100 * acousticHeuristic(reading.ac);
  const sv = computeSV(reading.vb);
  const st = computeST(reading.th, b);
  const svoc = computeSVOC(reading.env, b, deviceId);

  const w = adaptiveWeights(reading.vb, reading.env, deviceId);
  const risk = clip(w.a * sa + w.v * sv + w.t * st + w.voc * svoc, 0, 100);

  return {
    sa, sv, st, svoc,
    weights: w,
    risk_score: risk,
    classification: classify(risk),
    baseline: b,
  };
};

// Exported for unit testing.
export const _internals = { acousticHeuristic, computeSV, computeST, computeSVOC, adaptiveWeights, classify };
