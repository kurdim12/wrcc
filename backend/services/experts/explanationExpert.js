// Explanation Agent — turns the fusion decision into one honest, judge-friendly
// sentence. Pure + deterministic; no overclaiming, no "RPW detected".
//
// Input:  fusion (from riskFusionEngine), safety (from doseSafetyEngine)
// Output: string

const VIB = (s) => (s >= 50 ? 'partially confirms it' : 'does not corroborate it');

export const explanationExpert = (fusion = {}, safety = {}) => {
  const b = fusion.expertBreakdown || {};
  const a = b.acoustic?.score ?? 0;
  const v = b.vibration?.score ?? 0;
  const health = b.sensorHealth?.healthy;

  if (!health) {
    const faults = (b.sensorHealth?.faults || []).join(', ') || 'a sensor fault';
    return `Decision withheld: sensor health is degraded (${faults}), so the system recommends a resample rather than acting on unreliable data. No treatment is prepared.`;
  }

  const head = `Risk is ${fusion.level} (${fusion.risk}/100, confidence ${fusion.confidence}).`;
  const body = `Acoustic activity is the primary signal at ${a}/100; vibration at ${v}/100 ${VIB(v)}; environmental readings are used only as context. `;
  let tail;
  if (fusion.recommendation === 'prepare_human_confirmed_dose') {
    tail = safety?.allowed
      ? `A capped${safety.demoClearWaterOnly ? ' clear-water (demo)' : ''} dose can be prepared, but it stays armed and requires explicit human confirmation; server and device caps and an anti-replay nonce still apply.`
      : `A dose would be blocked by safety caps (${safety?.blockedReason || 'caps'}); human confirmation is required regardless. Nothing is dosed automatically.`;
  } else if (fusion.recommendation === 'inspect') {
    tail = 'The recommendation is to inspect the palm; no dose is prepared.';
  } else if (fusion.recommendation === 'resample') {
    tail = 'The recommendation is to resample; no dose is prepared.';
  } else {
    tail = 'The recommendation is to keep observing; no dose is prepared.';
  }
  return `${head} ${body}${tail}`;
};

export default explanationExpert;
