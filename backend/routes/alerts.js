// /api/v1/alerts - list / acknowledge / resolve
import { Router } from 'express';
import { all, get, run, now } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  const status = req.query.status;        // active | acknowledged | resolved | undefined=all
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 1000);
  const since = parseInt(req.query.since, 10) || 0;
  let rows;
  if (status) {
    rows = all(
      `SELECT * FROM alerts WHERE status = ? AND ts >= ? ORDER BY ts DESC LIMIT ?`,
      status, since, limit
    );
  } else {
    rows = all(`SELECT * FROM alerts WHERE ts >= ? ORDER BY ts DESC LIMIT ?`, since, limit);
  }
  res.json({ alerts: rows, count: rows.length });
});

router.get('/counts', (_req, res) => {
  const counts = {
    active:       get(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active'`).n,
    critical:     get(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active' AND severity = 'critical'`).n,
    warning:      get(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active' AND severity = 'warning'`).n,
    low:          get(`SELECT COUNT(*) AS n FROM alerts WHERE status = 'active' AND severity = 'low'`).n,
  };
  res.json(counts);
});

router.patch('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { status, acknowledged_by } = req.body || {};
  if (!['acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' });
  }
  if (status === 'acknowledged') {
    run(
      `UPDATE alerts SET status = 'acknowledged', acknowledged_by = ?, acknowledged_ts = ? WHERE id = ?`,
      acknowledged_by ?? 'user', now(), id
    );
  } else {
    run(`UPDATE alerts SET status = 'resolved', resolved_ts = ? WHERE id = ?`, now(), id);
  }
  res.json({ alert: get('SELECT * FROM alerts WHERE id = ?', id) });
});

export default router;
