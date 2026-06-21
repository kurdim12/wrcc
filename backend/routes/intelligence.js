// /api/v1/intelligence — read-only view of the multi-sensor expert architecture.
// Served from the per-device cache populated during ingestion, so a GET never
// re-runs the baseline-mutating risk math. Lets the dashboard hydrate the
// Intelligence Layer before the first socket tick arrives.
import { Router } from 'express';
import * as intelligence from '../services/intelligence.js';

const router = Router();

// GET /api/v1/intelligence            -> latest decision for every device
router.get('/', (_req, res) => {
  res.json({ intelligence: intelligence.latestAll(), model: intelligence.MODEL_HONESTY });
});

// GET /api/v1/intelligence/:deviceId  -> latest decision for one device
router.get('/:deviceId', (req, res) => {
  const r = intelligence.latest(req.params.deviceId);
  if (!r) return res.status(404).json({ error: 'no_intelligence_yet', device_id: req.params.deviceId });
  res.json(r);
});

export default router;
