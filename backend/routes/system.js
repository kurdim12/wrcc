// /api/v1/system - meta endpoints (live vs demo, version, etc.)
import { Router } from 'express';
import * as demoMode from '../services/demoMode.js';

const router = Router();

router.get('/mode', (_req, res) => {
  res.json(demoMode.status());
});

export default router;
