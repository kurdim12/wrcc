// /api/v1/doses — dose history + confirm/cancel (the human-in-the-loop gate).
// Arming + per-device dose policy live on /api/v1/devices (see devices.js).
import { Router } from 'express';
import { z } from 'zod';
import * as doseEngine from '../services/doseEngine.js';

const router = Router();

// GET /api/v1/doses?device_id=&limit=  — dose history
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
  const deviceId = req.query.device_id || null;
  res.json({ doses: doseEngine.list(deviceId, limit) });
});

const ConfirmSchema = z.object({ confirmed_by: z.string().max(64).optional() });

// POST /api/v1/doses/:id/confirm  — operator confirms a pending dose
router.post('/:id/confirm', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const parse = ConfirmSchema.safeParse(req.body || {});
  const by = parse.success ? (parse.data.confirmed_by || 'operator') : 'operator';
  const result = doseEngine.confirm(id, by);
  if (!result.ok) return res.status(409).json({ error: 'confirm_failed', reason: result.reason });
  res.json({ ok: true, dose: result.dose });
});

// POST /api/v1/doses/:id/cancel  — operator cancels a pending/sent dose
router.post('/:id/cancel', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const by = (req.body && req.body.cancelled_by) || 'operator';
  const result = doseEngine.cancel(id, by);
  if (!result.ok) return res.status(409).json({ error: 'cancel_failed', reason: result.reason });
  res.json({ ok: true, dose: result.dose });
});

export default router;
