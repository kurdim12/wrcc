// /api/v1/system - meta endpoints (live vs demo, version, demo events).
import { Router } from 'express';
import { z } from 'zod';
import * as demoMode from '../services/demoMode.js';

const router = Router();

router.get('/mode', (_req, res) => {
  res.json(demoMode.status());
});

const EventSchema = z.object({
  device_id: z.string().min(1).max(64),
  cycles: z.number().int().min(1).max(60).optional(),
});

// POST /api/v1/system/demo-event { device_id, cycles? }
// Drives a scripted infestation spike on a demo device for `cycles` visits, so
// the detect → fuse → alert → (armed+confirm) → dose story runs on command even
// if on-stage capture is noisy. Demo-only (roster devices); keeps the banner.
router.post('/demo-event', (req, res) => {
  const parse = EventSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  const ok = demoMode.triggerEvent(parse.data.device_id, parse.data.cycles ?? 8);
  if (!ok) return res.status(404).json({ error: 'not_a_demo_device' });
  res.json({ ok: true, device_id: parse.data.device_id, cycles: parse.data.cycles ?? 8 });
});

export default router;
