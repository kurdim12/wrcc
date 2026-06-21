// Sensor Health Expert — protects reliability (NEW capability).
// Pure + deterministic. Flags missing fields, physically-impossible ranges, and
// stale devices, and emits a confidence penalty the fusion engine uses to force
// a resample instead of acting on bad data.
//
// Input:  reading row (sa, ac_rms, bands_json, core_c, amb_c, hum, vib_rms,
//         battery_pct, ...), device row (last_seen, status), nowTs (seconds).
// Output: { healthy, score, faults[], warnings[], confidencePenalty: 0-1 }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const STALE_S = 120;

export const sensorHealthExpert = (reading = {}, device = null, nowTs = Math.floor(Date.now() / 1000)) => {
  const faults = [];
  const warnings = [];

  // Acoustic is the primary signal — missing it is a fault.
  const hasAcoustic = reading.sa != null || reading.ac_rms != null || reading.bands_json != null;
  if (!hasAcoustic) faults.push('acoustic data missing');

  // Physically-impossible ranges (bad wiring / sensor fault).
  if (reading.core_c != null && (reading.core_c < -20 || reading.core_c > 80)) faults.push(`impossible trunk temp ${reading.core_c}°C`);
  if (reading.amb_c != null && (reading.amb_c < -40 || reading.amb_c > 70)) faults.push(`impossible ambient temp ${reading.amb_c}°C`);
  if (reading.hum != null && (reading.hum < 0 || reading.hum > 100)) faults.push(`impossible humidity ${reading.hum}%`);
  if (reading.gas_kohm != null && reading.gas_kohm <= 0) faults.push('non-positive gas resistance');

  // Soft warnings (degrade confidence, don't fault).
  if (reading.vib_rms == null) warnings.push('vibration data missing — cannot corroborate');
  if (reading.battery_pct != null && reading.battery_pct < 15) warnings.push(`low battery ${reading.battery_pct}%`);

  // Staleness from device status / last_seen.
  if (device) {
    const age = device.last_seen != null ? nowTs - device.last_seen : null;
    if (device.status && device.status !== 'online') warnings.push(`device status: ${device.status}`);
    if (age != null && age > STALE_S) faults.push(`stale device (${age}s since last reading)`);
  }

  const score = Math.round(clamp(100 - faults.length * 35 - warnings.length * 10, 0, 100));
  const healthy = faults.length === 0;
  const confidencePenalty = clamp(0.30 * faults.length + 0.10 * warnings.length, 0, 1);

  return { healthy, score, faults, warnings, confidencePenalty: Math.round(confidencePenalty * 100) / 100 };
};

export default sensorHealthExpert;
