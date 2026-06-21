// /api/v1/stats - aggregate KPIs for the Overview page
import { Router } from 'express';
import { get, all, now } from '../db.js';

const router = Router();

router.get('/farm', (_req, res) => {
  const t = now();
  const totalPalms = get('SELECT COUNT(*) AS n FROM palms').n;
  const totalDevices = get('SELECT COUNT(*) AS n FROM devices').n;
  const onlineDevices = get(
    'SELECT COUNT(*) AS n FROM devices WHERE last_seen >= ?',
    t - 300
  ).n;
  const activeAlerts = get(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active'`).n;
  const criticalAlerts = get(
    `SELECT COUNT(*) AS n FROM alerts WHERE status = 'active' AND severity = 'critical'`
  ).n;

  // Palm classification counts (latest reading per device)
  const palmStatus = all(`
    WITH latest AS (
      SELECT r.device_id,
             r.classification,
             r.risk_score,
             ROW_NUMBER() OVER (PARTITION BY r.device_id ORDER BY r.ts DESC) AS rn
      FROM readings r
    )
    SELECT classification, COUNT(*) AS n, AVG(risk_score) AS avg_risk
    FROM latest WHERE rn = 1
    GROUP BY classification
  `);

  // Average risk across all devices' latest readings
  const avgRiskRow = get(`
    SELECT AVG(risk_score) AS avg_risk
    FROM (
      SELECT risk_score, ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY ts DESC) AS rn
      FROM readings
    )
    WHERE rn = 1
  `);

  const byStatus = { low: 0, medium: 0, high: 0 };
  for (const row of palmStatus) {
    if (row.classification && byStatus[row.classification] != null) {
      byStatus[row.classification] = row.n;
    }
  }

  // Average battery and last-sync
  const battery = get(`SELECT AVG(battery_pct) AS avg, MIN(battery_pct) AS min FROM devices WHERE battery_pct IS NOT NULL`);
  const lastSync = get('SELECT MAX(last_seen) AS ts FROM devices');

  res.json({
    totalPalms,
    totalDevices,
    onlineDevices,
    onlinePct: totalDevices ? +(onlineDevices / totalDevices * 100).toFixed(1) : 0,
    activeAlerts,
    criticalAlerts,
    atRisk: byStatus.medium + byStatus.high,
    critical: byStatus.high,
    avgRiskScore: avgRiskRow?.avg_risk != null ? +avgRiskRow.avg_risk.toFixed(1) : 0,
    avgHealthPct: avgRiskRow?.avg_risk != null ? +(100 - avgRiskRow.avg_risk).toFixed(1) : 100,
    avgBatteryPct: battery?.avg != null ? Math.round(battery.avg) : null,
    minBatteryPct: battery?.min ?? null,
    lastSyncTs: lastSync?.ts ?? null,
  });
});

// Returns risk-score time-series suitable for the "AI Risk Trends (30 Days)" chart
router.get('/risk-trends', (req, res) => {
  const days = Math.min(parseInt(req.query.days, 10) || 30, 90);
  const since = now() - days * 86400;
  const rows = all(`
    SELECT
      strftime('%Y-%m-%d', ts, 'unixepoch') AS day,
      AVG(risk_score) AS avg_risk,
      MAX(risk_score) AS max_risk,
      COUNT(*) AS n
    FROM readings WHERE ts >= ?
    GROUP BY day ORDER BY day ASC
  `, since);
  res.json({ days, points: rows });
});

router.get('/temperature-distribution', (_req, res) => {
  // Bucket trunk-core minus ambient delta
  const since = now() - 86400;
  const rows = all(`
    WITH d AS (SELECT (core_c - amb_c) AS delta FROM readings WHERE ts >= ? AND core_c IS NOT NULL AND amb_c IS NOT NULL)
    SELECT
      SUM(CASE WHEN delta < -1 THEN 1 ELSE 0 END) AS very_low,
      SUM(CASE WHEN delta >= -1 AND delta < 1 THEN 1 ELSE 0 END) AS low,
      SUM(CASE WHEN delta >= 1 AND delta < 3 THEN 1 ELSE 0 END) AS normal,
      SUM(CASE WHEN delta >= 3 AND delta < 5 THEN 1 ELSE 0 END) AS high,
      SUM(CASE WHEN delta >= 5 THEN 1 ELSE 0 END) AS very_high
    FROM d
  `, since);
  res.json({ buckets: rows[0] || {} });
});

export default router;
