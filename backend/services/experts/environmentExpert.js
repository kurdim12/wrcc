// Environmental Context Expert — CONTEXT ONLY.
// Pure + deterministic. Consumes the thermal (ST) and VOC (SVOC) sub-scores
// plus raw trunk/ambient/gas values. This expert adjusts confidence and adds
// context; it NEVER claims that temperature or gas proves infestation.
//
// Input:  { st: 0-100, svoc: 0-100, th?: { core_c, amb_c }, env?: { gas_kohm, hum } }
// Output: { score, confidence, label, reasons[] }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

const labelFor = (s) =>
  s < 25 ? 'minimal'
  : s < 50 ? 'mild'
  : s < 75 ? 'moderate'
  : 'elevated_context';

export const environmentExpert = ({ st = 0, svoc = 0, th = null, env = null } = {}) => {
  // Context magnitude — a blend of thermal-anomaly and VOC-over-background.
  const score = Math.round(clamp(0.5 * st + 0.5 * svoc, 0, 100));
  const label = labelFor(score);

  // Context is inherently lower-confidence than the primary signals.
  const decisive = Math.abs(score - 50) / 50;
  const confidence = round2(clamp(0.25 + 0.30 * decisive, 0, 1));

  // ALWAYS lead with the honesty caveat.
  const reasons = ['environmental signals are context only — they do not confirm infestation'];
  if (th?.core_c != null && th?.amb_c != null) {
    reasons.push(`trunk-vs-ambient Δ ≈ ${(th.core_c - th.amb_c).toFixed(1)} °C`);
  }
  if (svoc > 0) reasons.push(`VOC slightly above farm background (context)`);
  if (env?.hum != null) reasons.push(`humidity ${Number(env.hum).toFixed(0)} % (gas-resistance correction applied)`);

  return { score, confidence, label, reasons: reasons.slice(0, 4) };
};

export default environmentExpert;
