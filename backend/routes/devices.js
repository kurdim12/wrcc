// /api/v1/devices - registry CRUD (devices auto-create on first POST /readings)
// Also exposes arming + per-device dose policy + manual dose request (§10.3).
import { Router } from 'express';
import { z } from 'zod';
import { all, get, run, now } from '../db.js';
import * as doseEngine from '../services/doseEngine.js';

const router = Router();

router.get('/', (_req, res) => {
  const t = now();
  const rows = all(`
    SELECT d.*,
           p.lat, p.lng, p.variety,
           CASE
             WHEN d.last_seen IS NULL              THEN 'unknown'
             WHEN d.last_seen >= ? - 300           THEN 'online'
             WHEN d.last_seen >= ? - 1800          THEN 'idle'
             ELSE 'offline'
           END AS computed_status
    FROM devices d
    LEFT JOIN palms p ON p.id = d.palm_id
    ORDER BY d.last_seen DESC NULLS LAST
  `, t, t);
  res.json({ devices: rows });
});

router.get('/:id', (req, res) => {
  const row = get('SELECT * FROM devices WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  res.json({ device: row });
});

const UpsertSchema = z.object({
  id: z.string().min(1).max(64),
  palm_id: z.string().nullish(),
  fw_version: z.string().nullish(),
});

router.post('/', (req, res) => {
  const parse = UpsertSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  const { id, palm_id, fw_version } = parse.data;
  run(`
    INSERT INTO devices (id, palm_id, fw_version, status)
    VALUES (?, ?, ?, 'unknown')
    ON CONFLICT(id) DO UPDATE SET
      palm_id = COALESCE(excluded.palm_id, devices.palm_id),
      fw_version = COALESCE(excluded.fw_version, devices.fw_version)
  `, id, palm_id ?? null, fw_version ?? null);
  res.json({ device: get('SELECT * FROM devices WHERE id = ?', id) });
});

router.patch('/:id', (req, res) => {
  const id = req.params.id;
  const { palm_id, fw_version } = req.body || {};
  run(
    'UPDATE devices SET palm_id = COALESCE(?, palm_id), fw_version = COALESCE(?, fw_version) WHERE id = ?',
    palm_id ?? null, fw_version ?? null, id
  );
  res.json({ device: get('SELECT * FROM devices WHERE id = ?', id) });
});

router.delete('/:id', (req, res) => {
  run('DELETE FROM devices WHERE id = ?', req.params.id);
  res.json({ ok: true });
});

// ─── Dosing: arm / policy / manual request (§10.3) ──────────────────────────

const ArmSchema = z.object({ armed: z.boolean() });

// POST /api/v1/devices/:id/arm  { armed: true|false }  — human-in-the-loop gate
router.post('/:id/arm', (req, res) => {
  const id = req.params.id;
  if (!get('SELECT id FROM devices WHERE id = ?', id)) return res.status(404).json({ error: 'not_found' });
  const parse = ArmSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  const armed = doseEngine.setArmed(id, parse.data.armed);
  res.json({ ok: true, device: get('SELECT * FROM devices WHERE id = ?', id), armed });
});

const PolicySchema = z.object({
  max_doses_day: z.number().int().min(0).max(50).optional(),
  cooldown_s:    z.number().int().min(0).max(86400).optional(),
  pump_ms:       z.number().int().min(0).max(3000).optional(),   // hard ceiling = PG_DOSE_MAX_MS
  auto_confirm:  z.boolean().optional(),
});

// PATCH /api/v1/devices/:id/policy  — edit per-device dose caps
router.patch('/:id/policy', (req, res) => {
  const id = req.params.id;
  if (!get('SELECT id FROM devices WHERE id = ?', id)) return res.status(404).json({ error: 'not_found' });
  const parse = PolicySchema.safeParse(req.body || {});
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  const p = parse.data;
  run(
    `UPDATE devices SET
       max_doses_day = COALESCE(?, max_doses_day),
       cooldown_s    = COALESCE(?, cooldown_s),
       pump_ms       = COALESCE(?, pump_ms),
       auto_confirm  = COALESCE(?, auto_confirm)
     WHERE id = ?`,
    p.max_doses_day ?? null, p.cooldown_s ?? null, p.pump_ms ?? null,
    p.auto_confirm == null ? null : (p.auto_confirm ? 1 : 0), id
  );
  res.json({ ok: true, device: get('SELECT * FROM devices WHERE id = ?', id) });
});

// POST /api/v1/devices/:id/dose  — operator-initiated manual dose (still needs
// arm + confirm). Creates a pending dose; the confirm modal then gates it.
router.post('/:id/dose', (req, res) => {
  const id = req.params.id;
  if (!get('SELECT id FROM devices WHERE id = ?', id)) return res.status(404).json({ error: 'not_found' });
  const by = (req.body && req.body.requested_by) || 'operator';
  const result = doseEngine.requestManual(id, by);
  if (!result.ok) return res.status(409).json({ error: 'request_failed', reason: result.reason });
  res.json({ ok: true, dose: result.dose });
});

export default router;
