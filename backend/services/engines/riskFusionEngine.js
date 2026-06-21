// Risk Fusion Engine — combines the expert outputs into one decision.
// Pure + deterministic. To keep ONE source of truth, the fusion `risk` MIRRORS
// the server-authoritative `risk_score` already produced by riskScore.js (which
// weights acoustic highest, vibration as corroboration, thermal/VOC as moderate
// context). The fusion engine adds the level, confidence, recommendation,
// reasons and expert breakdown the UI/explanation need.
//
// Input:  { riskScore: 0-100, acoustic, vibration, environment, sensorHealth }
// Output: { risk, confidence, level, recommendation, reasons[], expertBreakdown }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

const levelFor = (r) =>
  r < 31 ? 'low'
  : r < 45 ? 'watch'
  : r < 61 ? 'elevated'
  : r < 80 ? 'high'
  : 'critical';

// Confidence blends expert confidences (acoustic dominant) then is penalised by
// sensor-health problems.
const CONF_W = { acoustic: 0.50, vibration: 0.25, environment: 0.15, health: 0.10 };

export const riskFusionEngine = ({ riskScore = 0, acoustic, vibration, environment, sensorHealth } = {}) => {
  const risk = Math.round(clamp(riskScore, 0, 100));
  const level = levelFor(risk);

  const blended =
    CONF_W.acoustic * (acoustic?.confidence ?? 0) +
    CONF_W.vibration * (vibration?.confidence ?? 0) +
    CONF_W.environment * (environment?.confidence ?? 0) +
    CONF_W.health * (sensorHealth?.healthy ? 1 : 0.3);
  const confidence = round2(clamp(blended * (1 - (sensorHealth?.confidencePenalty ?? 0)), 0, 1));

  // Recommendation. Bad sensor health or very low confidence => resample (never
  // act on unreliable data). Otherwise escalate by risk. The dose recommendation
  // is advisory only — the dose path still requires arm + human confirmation +
  // server & device caps.
  let recommendation;
  if (!sensorHealth?.healthy || confidence < 0.35) recommendation = 'resample';
  else if (risk < 31) recommendation = 'observe';
  else if (risk < 61) recommendation = 'inspect';
  else recommendation = 'prepare_human_confirmed_dose';

  const reasons = [];
  reasons.push(`risk ${risk}/100 → ${level}`);
  reasons.push(`acoustic ${acoustic?.score ?? 0}/100 (primary), vibration ${vibration?.score ?? 0}/100 (${(vibration?.score ?? 0) >= 50 ? 'confirms' : 'weak'})`);
  reasons.push(`environment ${environment?.score ?? 0}/100 (context only)`);
  if (!sensorHealth?.healthy) reasons.push(`sensor health degraded: ${(sensorHealth?.faults || []).join(', ') || 'faults present'} → resample`);
  else reasons.push(`sensor health OK (confidence ${confidence})`);
  if (recommendation === 'prepare_human_confirmed_dose') reasons.push('human confirmation + caps required before any clear-water demo dose');

  return {
    risk,
    confidence,
    level,
    recommendation,
    reasons: reasons.slice(0, 6),
    expertBreakdown: {
      acoustic:    pick(acoustic),
      vibration:   pick(vibration),
      environment: pick(environment),
      sensorHealth: sensorHealth ? { healthy: sensorHealth.healthy, score: sensorHealth.score, faults: sensorHealth.faults, warnings: sensorHealth.warnings } : null,
    },
  };
};

const pick = (e) => (e ? { score: e.score, label: e.label, confidence: e.confidence } : null);

export default riskFusionEngine;
