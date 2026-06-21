// /api/v1/palms - palm-tree registry. Seeded by tools/seed_palms.py.
import { Router } from 'express';
import { z } from 'zod';
import { all, get, run } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  // Each palm includes its latest reading-derived status from the device attached to it.
  const rows = all(`
    SELECT p.*, d.id AS device_id, d.status AS device_status, d.last_seen,
           (SELECT classification FROM readings r WHERE r.device_id = d.id ORDER BY r.ts DESC LIMIT 1) AS classification,
           (SELECT risk_score    FROM readings r WHERE r.device_id = d.id ORDER BY r.ts DESC LIMIT 1) AS risk_score
    FROM palms p
    LEFT JOIN devices d ON d.palm_id = p.id
    ORDER BY p.id
  `);
  res.json({ palms: rows });
});

router.get('/:id', (req, res) => {
  const row = get(`
    SELECT p.*, d.id AS device_id, d.status AS device_status
    FROM palms p LEFT JOIN devices d ON d.palm_id = p.id
    WHERE p.id = ?
  `, req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ palm: row });
});

const PalmSchema = z.object({
  id: z.string().min(1).max(64),
  lat: z.number(),
  lng: z.number(),
  variety: z.string().nullish(),
  planted_date: z.string().nullish(),
  farm_id: z.string().nullish(),
  row_idx: z.number().int().nullish(),
  col_idx: z.number().int().nullish(),
  notes: z.string().nullish(),
});

router.post('/', (req, res) => {
  const parse = PalmSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  const p = parse.data;
  run(`
    INSERT INTO palms (id, lat, lng, variety, planted_date, farm_id, row_idx, col_idx, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      lat = excluded.lat, lng = excluded.lng,
      variety = excluded.variety, planted_date = excluded.planted_date,
      farm_id = excluded.farm_id, row_idx = excluded.row_idx,
      col_idx = excluded.col_idx, notes = excluded.notes
  `, p.id, p.lat, p.lng, p.variety ?? null, p.planted_date ?? null,
     p.farm_id ?? null, p.row_idx ?? null, p.col_idx ?? null, p.notes ?? null);
  res.json({ palm: get('SELECT * FROM palms WHERE id = ?', p.id) });
});

router.patch('/:id', (req, res) => {
  const id = req.params.id;
  const { lat, lng, variety, planted_date, farm_id, notes } = req.body || {};
  run(`
    UPDATE palms SET
      lat = COALESCE(?, lat), lng = COALESCE(?, lng),
      variety = COALESCE(?, variety), planted_date = COALESCE(?, planted_date),
      farm_id = COALESCE(?, farm_id), notes = COALESCE(?, notes)
    WHERE id = ?
  `, lat ?? null, lng ?? null, variety ?? null, planted_date ?? null,
     farm_id ?? null, notes ?? null, id);
  res.json({ palm: get('SELECT * FROM palms WHERE id = ?', id) });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM palms WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// Bulk insert - used by tools/seed_palms.py
router.post('/bulk', (req, res) => {
  const items = Array.isArray(req.body?.palms) ? req.body.palms : [];
  if (items.length === 0) return res.status(400).json({ error: 'empty_payload' });
  const stmt = `
    INSERT INTO palms (id, lat, lng, variety, planted_date, farm_id, row_idx, col_idx, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      lat=excluded.lat, lng=excluded.lng, variety=excluded.variety,
      farm_id=excluded.farm_id, row_idx=excluded.row_idx, col_idx=excluded.col_idx
  `;
  let ok = 0;
  for (const p of items) {
    if (!p?.id || p.lat == null || p.lng == null) continue;
    run(stmt, p.id, p.lat, p.lng, p.variety ?? null, p.planted_date ?? null,
        p.farm_id ?? null, p.row_idx ?? null, p.col_idx ?? null, p.notes ?? null);
    ok++;
  }
  res.json({ ok: true, inserted: ok });
});

export default router;
