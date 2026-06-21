// Nightly maintenance:
//   1. Aggregate readings older than 7 days into readings_hourly (one row per
//      device per hour). Drops the raw rows once aggregated.
//   2. Drop bands_json / peaks_json from readings older than 30 days (~10x
//      size reduction without losing the scalar features).
//   3. Hard-delete readings older than 90 days.
//
// Run from server.js via node-cron at 02:30 every day.

import db from '../db.js';

const SEVEN_DAYS  = 7 * 86400;
const THIRTY_DAYS = 30 * 86400;
const NINETY_DAYS = 90 * 86400;

// Note: node:sqlite doesn't expose `db.transaction()` like better-sqlite3
// does, so we wrap manually with BEGIN/COMMIT/ROLLBACK.
const aggregate = (cutoff) => {
  const rows = db.prepare(`
    SELECT device_id,
           CAST(ts / 3600 * 3600 AS INTEGER) AS hour,
           AVG(risk_score) AS avg_risk,
           MAX(risk_score) AS max_risk,
           AVG(core_c)     AS avg_core_c,
           AVG(amb_c)      AS avg_amb_c,
           AVG(hum)        AS avg_hum,
           AVG(gas_kohm)   AS avg_gas_kohm,
           AVG(vib_rms)    AS avg_vib_rms,
           COUNT(*)        AS reading_count
    FROM readings
    WHERE ts < ? AND ts >= ?
    GROUP BY device_id, hour
  `).all(cutoff, cutoff - SEVEN_DAYS);

  const upsert = db.prepare(`
    INSERT INTO readings_hourly
      (device_id, hour, avg_risk, max_risk, avg_core_c, avg_amb_c, avg_hum, avg_gas_kohm, avg_vib_rms, reading_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id, hour) DO UPDATE SET
      avg_risk = excluded.avg_risk, max_risk = excluded.max_risk,
      avg_core_c = excluded.avg_core_c, avg_amb_c = excluded.avg_amb_c,
      avg_hum = excluded.avg_hum, avg_gas_kohm = excluded.avg_gas_kohm,
      avg_vib_rms = excluded.avg_vib_rms,
      reading_count = excluded.reading_count
  `);

  db.exec('BEGIN');
  try {
    for (const r of rows) {
      upsert.run(r.device_id, r.hour, r.avg_risk, r.max_risk,
                 r.avg_core_c, r.avg_amb_c, r.avg_hum, r.avg_gas_kohm,
                 r.avg_vib_rms, r.reading_count);
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  return rows.length;
};


export const runMaintenance = () => {
  const now = Math.floor(Date.now() / 1000);
  const t0 = Date.now();
  const aggregated = aggregate(now - SEVEN_DAYS);
  const trimmed = db.prepare(`
    UPDATE readings SET bands_json = NULL, peaks_json = NULL
    WHERE ts < ? AND (bands_json IS NOT NULL OR peaks_json IS NOT NULL)
  `).run(now - THIRTY_DAYS).changes;
  const deleted = db.prepare(`DELETE FROM readings WHERE ts < ?`).run(now - NINETY_DAYS).changes;
  console.log(`[retention] hourly_rows=${aggregated} bands_dropped=${trimmed} purged=${deleted} (${Date.now() - t0}ms)`);
};
