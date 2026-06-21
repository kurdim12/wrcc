// Acoustic activity score (§10.2 / §9.11).
//
// Replaces the old hand-crafted acoustic sub-score (SA) with the ML model:
//   SA = 100 * p_activity
// where p_activity comes from the FastAPI scorer (ml/serve). The model owns the
// spectral decision now — the old hardcoded "RPW ≈ 4.5 kHz centroid" assumption
// is gone (Appendix B/C #4).
//
// Hard rule (§3): ingestion must NEVER block on the ML service. We call it with
// a short timeout and, on ANY failure (down, slow, no mel frame), fall back to
// a transparent heuristic and tag the reading so the dashboard shows "heuristic"
// instead of a confidence number.

import { acousticHeuristic } from './riskScore.js';

const ML_URL     = process.env.PG_ML_URL || 'http://localhost:8001';
const TIMEOUT_MS = parseInt(process.env.PG_ML_TIMEOUT_MS, 10) || 600;

const clip01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Score P(activity) for one reading.
 *   reading: the parsed payload (expects reading.ac, optionally reading.ac.mel)
 * Returns { p_activity, model_version, calibrated, source }.
 *   source: 'model' | 'fallback' | 'heuristic'
 */
export const scoreActivity = async (reading) => {
  const mel = reading?.ac?.mel;

  // No mel patch -> can't run the CNN; use the transparent heuristic directly.
  if (!Array.isArray(mel) || mel.length === 0) {
    return {
      p_activity: acousticHeuristic(reading?.ac),
      model_version: 'heuristic-nomel',
      calibrated: false,
      source: 'heuristic',
    };
  }

  try {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const res = await fetch(`${ML_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mel }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`ml ${res.status}`);
    const data = await res.json();
    if (typeof data.p_activity !== 'number') throw new Error('bad ml response');
    return {
      p_activity: clip01(data.p_activity),
      model_version: data.model_version || 'unknown',
      calibrated: !!data.calibrated,
      source: 'model',
    };
  } catch (_e) {
    // Degrade gracefully — never block or crash ingestion (§3, §9.11).
    return {
      p_activity: acousticHeuristic(reading?.ac),
      model_version: 'fallback',
      calibrated: false,
      source: 'fallback',
    };
  }
};
