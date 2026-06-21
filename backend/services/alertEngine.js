// 7-rule alert engine (per the approved plan):
//   1. risk >= 61                                  -> HIGH_RISK         (critical)
//   2. risk in [31,60] for 3 consecutive readings  -> MEDIUM_SUSTAINED  (warning)
//   3. risk delta > 25 between two readings        -> ANOMALY_SPIKE     (warning)
//   4. battery < 15% (max 1/24h)                   -> LOW_BATTERY       (low)
//   5. last_seen > 5 min                           -> OFFLINE           (warning, auto-resolves)
//   6. core - amb > 4°C for 2 readings             -> THERMAL_STRESS    (warning)
//   7. gas_kohm drop > 40% in <1h                  -> VOC_SURGE         (warning)
//
// Dedup:  unique (device_id, type) where status='active' enforced by partial index.
// Resolution: alerts are auto-resolved when the underlying condition clears.

import db, { now } from '../db.js';
import * as socket from './socket.js';

const SEVERITY = {
  HIGH_RISK:        'critical',
  MEDIUM_SUSTAINED: 'warning',
  ANOMALY_SPIKE:    'warning',
  THERMAL_STRESS:   'warning',
  VOC_SURGE:        'warning',
  OFFLINE:          'warning',
  LOW_BATTERY:      'low',
};

const HUMAN_MESSAGE = {
  HIGH_RISK:        ({v}) => `Risk score ${Math.round(v)} - strong multi-sensor evidence of internal activity`,
  MEDIUM_SUSTAINED: ({v}) => `Risk score sustained at ${Math.round(v)} for 3+ readings - inspection recommended`,
  ANOMALY_SPIKE:    ({v}) => `Sudden risk-score jump of +${Math.round(v)} points`,
  THERMAL_STRESS:   ({v}) => `Trunk-ambient delta ${v.toFixed(1)}°C for 2+ readings - metabolic stress`,
  VOC_SURGE:        ({v}) => `BME680 gas resistance dropped ${Math.round(v)}% in under 1h`,
  LOW_BATTERY:      ({v}) => `Battery at ${Math.round(v)}% - schedule maintenance`,
  OFFLINE:          ({v}) => `Device unreachable for ${Math.round(v/60)} min`,
};

const upsertAlert = (deviceId, type, value) => {
  const t = now();
  const message = HUMAN_MESSAGE[type]({ v: value });
  const severity = SEVERITY[type] || 'warning';

  // Try insert, on conflict update value/timestamp (partial index handles dedup)
  const existing = db.prepare(
    `SELECT id FROM alerts WHERE device_id = ? AND type = ? AND status = 'active'`
  ).get(deviceId, type);

  let row;
  if (existing) {
    db.prepare(`
      UPDATE alerts SET trigger_value = ?, message = ?, ts = ? WHERE id = ?
    `).run(value, message, t, existing.id);
    row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(existing.id);
  } else {
    const info = db.prepare(`
      INSERT INTO alerts (device_id, ts, severity, type, message, trigger_value, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `).run(deviceId, t, severity, type, message, value);
    row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(info.lastInsertRowid);
  }
  socket.emitAlert(row);
  return row;
};

const resolveAlert = (deviceId, type) => {
  const r = db.prepare(`
    UPDATE alerts SET status = 'resolved', resolved_ts = ?
    WHERE device_id = ? AND type = ? AND status = 'active'
  `).run(now(), deviceId, type);
  if (r.changes > 0) {
    const last = db.prepare(`
      SELECT * FROM alerts WHERE device_id = ? AND type = ? ORDER BY id DESC LIMIT 1
    `).get(deviceId, type);
    if (last) socket.emitAlert(last);
  }
};

/**
 * Run all 7 rules after a new reading is stored.
 *   reading: the just-stored row (with risk_score already filled)
 *   prev:    baseline row before this reading (for delta tracking)
 */
export const evaluate = (reading, prev) => {
  const dev = reading.device_id;

  // Rule 1: HIGH_RISK
  if (reading.risk_score >= 61) {
    upsertAlert(dev, 'HIGH_RISK', reading.risk_score);
  } else {
    // Auto-resolve when risk drops below threshold
    resolveAlert(dev, 'HIGH_RISK');
  }

  // Rule 2: MEDIUM_SUSTAINED (3 consecutive readings in [31,60])
  const inMedium = reading.risk_score >= 31 && reading.risk_score < 61;
  const consecutive = inMedium ? (prev?.consecutive_medium ?? 0) + 1 : 0;
  db.prepare(
    'UPDATE baselines SET consecutive_medium = ? WHERE device_id = ?'
  ).run(consecutive, dev);
  if (consecutive >= 3) {
    upsertAlert(dev, 'MEDIUM_SUSTAINED', reading.risk_score);
  } else if (!inMedium) {
    resolveAlert(dev, 'MEDIUM_SUSTAINED');
  }

  // Rule 3: ANOMALY_SPIKE (Δrisk > 25 in one reading)
  if (prev?.prev_risk_score != null) {
    const delta = reading.risk_score - prev.prev_risk_score;
    if (delta > 25) {
      upsertAlert(dev, 'ANOMALY_SPIKE', delta);
    }
  }
  db.prepare(
    'UPDATE baselines SET prev_risk_score = ? WHERE device_id = ?'
  ).run(reading.risk_score, dev);

  // Rule 4: LOW_BATTERY (max 1×/24h)
  if (reading.battery_pct != null && reading.battery_pct < 15) {
    const lastTs = prev?.last_low_battery_alert ?? 0;
    if (now() - lastTs > 24 * 3600) {
      upsertAlert(dev, 'LOW_BATTERY', reading.battery_pct);
      db.prepare(
        'UPDATE baselines SET last_low_battery_alert = ? WHERE device_id = ?'
      ).run(now(), dev);
    }
  }

  // Rule 6: THERMAL_STRESS (delta > 4°C for 2 readings)
  if (reading.core_c != null && reading.amb_c != null) {
    const delta = reading.core_c - reading.amb_c;
    const ok = delta > 4 ? (prev?.last_thermal_stress_ok ?? 0) + 1 : 0;
    db.prepare(
      'UPDATE baselines SET last_thermal_stress_ok = ? WHERE device_id = ?'
    ).run(ok, dev);
    if (ok >= 2) {
      upsertAlert(dev, 'THERMAL_STRESS', delta);
    } else if (delta <= 4) {
      resolveAlert(dev, 'THERMAL_STRESS');
    }
  }

  // Rule 7: VOC_SURGE (gas_kohm drop > 40% in < 1h)
  if (reading.gas_kohm != null && prev?.prev_gas_kohm != null && prev?.prev_gas_kohm_ts != null) {
    const dt = now() - prev.prev_gas_kohm_ts;
    if (dt < 3600 && prev.prev_gas_kohm > 0) {
      const dropPct = (prev.prev_gas_kohm - reading.gas_kohm) / prev.prev_gas_kohm * 100;
      if (dropPct > 40) {
        upsertAlert(dev, 'VOC_SURGE', dropPct);
      }
    }
  }
  if (reading.gas_kohm != null) {
    db.prepare(
      'UPDATE baselines SET prev_gas_kohm = ?, prev_gas_kohm_ts = ? WHERE device_id = ?'
    ).run(reading.gas_kohm, now(), dev);
  }
};

// Periodic offline-checker. Runs from server.js setInterval.
export const checkOfflineDevices = () => {
  const cutoff = now() - 5 * 60;
  const offline = db.prepare(`
    SELECT id, last_seen FROM devices
    WHERE last_seen IS NOT NULL AND last_seen < ? AND status != 'offline'
  `).all(cutoff);

  for (const d of offline) {
    db.prepare("UPDATE devices SET status = 'offline' WHERE id = ?").run(d.id);
    upsertAlert(d.id, 'OFFLINE', now() - d.last_seen);
    socket.emitDeviceStatus({ id: d.id, status: 'offline' });
  }

  // Auto-resolve OFFLINE alerts when device reappears
  const recovered = db.prepare(`
    SELECT a.id, a.device_id FROM alerts a
    JOIN devices d ON d.id = a.device_id
    WHERE a.type = 'OFFLINE' AND a.status = 'active' AND d.last_seen >= ?
  `).all(cutoff);
  for (const a of recovered) resolveAlert(a.device_id, 'OFFLINE');
};
