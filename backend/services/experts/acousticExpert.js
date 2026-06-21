// Acoustic Activity Expert — the PRIMARY signal.
// Pure + deterministic. Consumes the already-computed acoustic activity score
// (SA = 100·p_activity from services/fusion.js + riskScore.js) plus the raw
// acoustic feature block. It NEVER claims "RPW detected" — at most it reports
// "feeding-like acoustic activity" (proxy) when the score is high.
//
// Input:  { sa: 0-100, ac?: { clk, flat, cent, bands, ... } }
// Output: { score, confidence, label, reasons[] }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

const labelFor = (s) =>
  s < 25 ? 'quiet'
  : s < 50 ? 'background_activity'
  : s < 75 ? 'suspicious_activity'
  : 'high_acoustic_activity';

export const acousticExpert = ({ sa = 0, ac = null } = {}) => {
  const score = Math.round(clamp(sa, 0, 100));
  const label = labelFor(score);

  // Confidence: decisiveness (distance from the 50/50 line) + whether real
  // acoustic features were present to back the score up.
  const hasFeatures = !!(ac && (ac.clk != null || Array.isArray(ac.bands)));
  const decisive = Math.abs(score - 50) / 50;            // 0..1
  const confidence = round2(clamp(0.35 + 0.45 * decisive + (hasFeatures ? 0.2 : 0), 0, 1));

  const reasons = [`acoustic activity score ${score}/100 (model p_activity × 100)`];
  if (ac?.clk != null) reasons.push(`click/transient rate ≈ ${Number(ac.clk).toFixed(1)}/s`);
  if (score >= 75) reasons.push('feeding-like acoustic activity pattern (proxy — not confirmed RPW)');
  else if (score >= 50) reasons.push('mid-band acoustic lift above background');
  else reasons.push('no strong acoustic activity over background');
  if (!hasFeatures) reasons.push('no raw acoustic features attached — score-only');

  return { score, confidence, label, reasons: reasons.slice(0, 4) };
};

export default acousticExpert;
