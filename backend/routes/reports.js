// /api/v1/reports - simple CSV exports
import { Router } from 'express';
import { all, now } from '../db.js';

const router = Router();

router.get('/list', (_req, res) => {
  res.json({
    reports: [
      { id: 'weekly',      name: 'Weekly Health Summary',     type: 'CSV', endpoint: '/api/v1/reports/weekly.csv' },
      { id: 'critical',    name: 'Critical Incidents Log',    type: 'CSV', endpoint: '/api/v1/reports/critical.csv' },
      { id: 'battery',     name: 'Battery Efficiency Report', type: 'CSV', endpoint: '/api/v1/reports/battery.csv' },
    ],
  });
});

const csvEscape = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const sendCsv = (res, filename, header, rows) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const lines = [header.join(','), ...rows.map(r => header.map(h => csvEscape(r[h])).join(','))];
  res.send(lines.join('\n'));
};

router.get('/weekly.csv', (_req, res) => {
  const rows = all(`
    SELECT device_id,
           datetime(ts, 'unixepoch') AS time,
           ROUND(risk_score, 1) AS risk_score,
           classification,
           ROUND(core_c, 2) AS core_c,
           ROUND(amb_c, 2) AS amb_c,
           ROUND(hum, 1) AS hum,
           ROUND(gas_kohm, 1) AS gas_kohm,
           ROUND(vib_rms, 3) AS vib_rms,
           ROUND(ac_clk, 1) AS ac_click_rate
    FROM readings WHERE ts >= ? ORDER BY ts DESC
  `, now() - 7 * 86400);
  sendCsv(res, 'palmguard-weekly.csv',
    ['device_id','time','risk_score','classification','core_c','amb_c','hum','gas_kohm','vib_rms','ac_click_rate'],
    rows);
});

router.get('/critical.csv', (_req, res) => {
  const rows = all(`
    SELECT a.id, a.device_id,
           datetime(a.ts, 'unixepoch') AS time,
           a.severity, a.type, a.message,
           ROUND(a.trigger_value, 2) AS trigger_value, a.status
    FROM alerts a
    WHERE a.severity IN ('critical','warning')
    ORDER BY a.ts DESC
  `);
  sendCsv(res, 'palmguard-critical.csv',
    ['id','device_id','time','severity','type','message','trigger_value','status'],
    rows);
});

router.get('/battery.csv', (_req, res) => {
  const rows = all(`
    SELECT id AS device_id, battery_pct, battery_mv, rssi,
           datetime(last_seen, 'unixepoch') AS last_seen, status
    FROM devices ORDER BY battery_pct ASC NULLS LAST
  `);
  sendCsv(res, 'palmguard-battery.csv',
    ['device_id','battery_pct','battery_mv','rssi','last_seen','status'],
    rows);
});

export default router;
