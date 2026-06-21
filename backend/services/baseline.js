// Per-device baselines for the risk-score engine.
//   - core temperature  (EWMA, alpha=0.02 once 14 days of data exist)
//   - BME680 gas resistance R0 (7-day rolling max)
//   - BME680 VOC warm-up countdown (first 240 readings ignored - ~20 min @ 5s, ~2h @ 30s)
//   - bookkeeping for adaptive alert rules

import db, { now } from '../db.js';

const ALPHA = 0.02;                 // EWMA factor for thermal baseline
const VOC_WARMUP_READINGS = 240;    // ~20 min at 5s cadence
const SEVEN_DAYS = 7 * 24 * 3600;
const FOURTEEN_DAYS = 14 * 24 * 3600;

const upsertBaseline = db.prepare(`
  INSERT INTO baselines (device_id, last_updated)
  VALUES (?, ?)
  ON CONFLICT(device_id) DO UPDATE SET last_updated = excluded.last_updated
`);

const getBaseline = db.prepare('SELECT * FROM baselines WHERE device_id = ?');
const updateThermal = db.prepare(`
  UPDATE baselines SET temp_baseline_c = ?, temp_samples = temp_samples + 1, last_updated = ?
  WHERE device_id = ?
`);
const updateGasMax = db.prepare(`
  UPDATE baselines SET gas_kohm_max = ?, gas_kohm_max_ts = ?, last_updated = ?
  WHERE device_id = ?
`);
const decrementWarmup = db.prepare(`
  UPDATE baselines SET voc_warmup_remaining = MAX(0, voc_warmup_remaining - 1), last_updated = ?
  WHERE device_id = ?
`);

const ensure = (deviceId) => {
  upsertBaseline.run(deviceId, now());
  return getBaseline.get(deviceId);
};

/**
 * Update baselines after a new reading arrives.
 * Returns the (post-update) baseline row, used by riskScore.compute().
 */
export const update = (deviceId, reading) => {
  let b = ensure(deviceId);
  const t = now();

  // Bugfix (carried latent from the old repo): `update` is called with the
  // NESTED payload (reading.th.core_c / reading.env.gas_kohm), but previously
  // read FLAT fields (reading.core_c / reading.gas_kohm) — which are undefined
  // on a payload, so the thermal + gas baselines never actually updated and
  // ST/SVOC were effectively always 0. Read both shapes so baselines work
  // whether passed a payload or a stored row.
  const core_c   = reading.th?.core_c ?? reading.core_c ?? null;
  const amb_c    = reading.th?.amb_c ?? reading.env?.amb_c ?? reading.amb_c ?? null;
  const gas_kohm = reading.env?.gas_kohm ?? reading.gas_kohm ?? null;

  // Thermal: EWMA once we have >FOURTEEN_DAYS of data; otherwise warm-up using ambient + offset
  if (core_c != null) {
    let nextBaseline;
    if (b.temp_samples >= FOURTEEN_DAYS / 30) {
      // EWMA in steady state
      const prev = b.temp_baseline_c ?? core_c;
      nextBaseline = ALPHA * core_c + (1 - ALPHA) * prev;
    } else {
      // Cold-start: amb + 1.8 unless we have anything better
      nextBaseline = (amb_c != null ? amb_c + 1.8 : core_c);
    }
    updateThermal.run(nextBaseline, t, deviceId);
  }

  // Gas resistance: track 7-day rolling max as R0
  if (gas_kohm != null) {
    const expired = !b.gas_kohm_max_ts || (t - b.gas_kohm_max_ts) > SEVEN_DAYS;
    if (b.gas_kohm_max == null || expired || gas_kohm > b.gas_kohm_max) {
      updateGasMax.run(gas_kohm, t, deviceId);
    }
  }

  // VOC warm-up: count down from 240
  if (b.voc_warmup_remaining > 0) decrementWarmup.run(t, deviceId);

  return getBaseline.get(deviceId);
};

export const get = (deviceId) => ensure(deviceId);

// Mean R0 across all devices on the same farm — used by SVOC for differential-baseline correction.
// "Farm" defined as devices attached to a palm with the same farm_id.
export const farmGasMean = (deviceId) => {
  const row = db.prepare(`
    SELECT AVG(b.gas_kohm_max) AS mean
    FROM baselines b
    JOIN devices d ON d.id = b.device_id
    WHERE b.gas_kohm_max IS NOT NULL
      AND ( d.palm_id IS NULL OR d.palm_id IN (
            SELECT id FROM palms WHERE farm_id = (
              SELECT p2.farm_id FROM palms p2
              JOIN devices d2 ON d2.palm_id = p2.id
              WHERE d2.id = ?
            )
          ))
  `).get(deviceId);
  return row?.mean ?? null;
};

// Was a chemical event recorded for this device in the last 72h?
export const recentChemicalEventHours = (deviceId) => {
  const row = db.prepare(
    'SELECT MAX(ts) AS ts FROM chemical_events WHERE device_id = ?'
  ).get(deviceId);
  if (!row?.ts) return Infinity;
  return (now() - row.ts) / 3600;
};
