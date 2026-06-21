// Intelligence layer orchestrator.
// Runs the multi-sensor expert architecture on a single scored reading and
// produces one explainable decision object. Called from ingest.js AFTER the
// existing risk scoring (it derives from `scored` — it never recomputes risk
// or touches dosing), so the proven pipeline + 19 safety tests are unaffected.
//
// Caches the latest result per device so a GET /api/v1/intelligence can serve it
// without re-running baseline-mutating risk math.

import { acousticExpert }    from './experts/acousticExpert.js';
import { vibrationExpert }   from './experts/vibrationExpert.js';
import { environmentExpert } from './experts/environmentExpert.js';
import { sensorHealthExpert } from './experts/sensorHealthExpert.js';
import { explanationExpert } from './experts/explanationExpert.js';
import { riskFusionEngine }  from './engines/riskFusionEngine.js';
import { doseSafetyEngine }  from './engines/doseSafetyEngine.js';

// Honesty fields — mirror the ML serve schema. Single place to state what this is.
export const MODEL_HONESTY = {
  model_family: 'acoustic_activity_proxy',
  validation_status: 'proxy_validated_not_field_validated',
  claim_guardrail: 'risk_indicator_not_confirmed_rpw_detection',
};

const cache = new Map();   // device_id -> latest intelligence result

/**
 * @param reading  stored reading row (sa, sv, st, svoc, risk_score, ac_*, core_c, ...)
 * @param scored   output of riskScore.compute (sa, sv, st, svoc, risk_score, weights)
 * @param raw      the raw payload (ac, vb, th, env blocks) for feature context
 * @param device   device row (last_seen, status) for sensor-health staleness
 * @param isDemo   whether this is demo/clear-water mode
 * @param nowTs    seconds (injectable for tests)
 */
export const analyze = ({ reading, scored, raw = {}, device = null, isDemo = false, nowTs } = {}) => {
  const acoustic    = acousticExpert({ sa: scored.sa, ac: raw.ac });
  const vibration   = vibrationExpert({ sv: scored.sv, vb: raw.vb });
  const environment = environmentExpert({ st: scored.st, svoc: scored.svoc, th: raw.th, env: raw.env });
  const sensorHealth = sensorHealthExpert(reading, device, nowTs);

  const fusion = riskFusionEngine({ riskScore: scored.risk_score, acoustic, vibration, environment, sensorHealth });
  const safety = doseSafetyEngine(reading.device_id, isDemo);
  const explanation = explanationExpert(fusion, safety);

  const result = {
    device_id: reading.device_id,
    ts: reading.ts,
    fusion,
    experts: { acoustic, vibration, environment, sensorHealth },
    safety,
    explanation,
    model: MODEL_HONESTY,
    generated_at: nowTs ?? Math.floor(Date.now() / 1000),
  };
  cache.set(reading.device_id, result);
  return result;
};

export const latest = (deviceId) => cache.get(deviceId) ?? null;
export const latestAll = () => Array.from(cache.values());

export default { analyze, latest, latestAll, MODEL_HONESTY };
