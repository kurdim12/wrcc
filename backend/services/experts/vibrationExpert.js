// Vibration Validation Expert — CONFIRMS or WEAKENS acoustic suspicion.
// Pure + deterministic. Consumes the vibration sub-score (SV from riskScore.js)
// + raw IMU block. Structure-borne energy in ~5–25 Hz corroborates internal
// activity; its job is corroboration, not standalone detection.
//
// Input:  { sv: 0-100, vb?: { vib_rms, vib_dom_hz, vib_pk } }
// Output: { score, confidence, label, reasons[] }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

const labelFor = (s) =>
  s < 25 ? 'quiet'
  : s < 50 ? 'weak'
  : s < 75 ? 'moderate'
  : 'strong_corroboration';

export const vibrationExpert = ({ sv = 0, vb = null } = {}) => {
  const score = Math.round(clamp(sv, 0, 100));
  const label = labelFor(score);

  const hasVib = !!(vb && vb.vib_rms != null);
  const decisive = Math.abs(score - 50) / 50;
  const confidence = round2(clamp(0.30 + 0.50 * decisive + (hasVib ? 0.2 : 0), 0, 1));

  const reasons = [];
  if (vb?.vib_rms != null) reasons.push(`vibration RMS ≈ ${Number(vb.vib_rms).toFixed(3)} g`);
  if (vb?.vib_dom_hz != null) {
    const inBand = vb.vib_dom_hz >= 5 && vb.vib_dom_hz <= 25;
    reasons.push(`dominant ${Number(vb.vib_dom_hz).toFixed(1)} Hz${inBand ? ' (structure-borne band)' : ' (out of structure band)'}`);
  }
  reasons.push(score >= 50 ? 'vibration corroborates acoustic suspicion' : 'vibration does not corroborate (acoustic weakened)');
  if (!hasVib) reasons.push('no vibration data — cannot corroborate');

  return { score, confidence, label, reasons: reasons.slice(0, 4) };
};

export default vibrationExpert;
