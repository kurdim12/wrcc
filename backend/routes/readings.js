// /api/v1/readings  -  ESP32 ingestion + history queries
// The actual ingestion logic lives in services/ingest.js so the demo-mode
// generator can reuse it.
import { Router } from 'express';
import { z } from 'zod';
import { all, now } from '../db.js';
import { ingest } from '../services/ingest.js';

const router = Router();

// ─── Payload schema (matches ESP32 firmware + tools/mock_device.py) ──────
const ReadingSchema = z.object({
  v: z.number().int().optional(),
  dev: z.string().min(1).max(64),
  ts: z.number().int().optional(),
  seq: z.number().int().optional(),

  ac: z.object({
    bands: z.array(z.number()).length(6).optional(),
    peaks: z.array(z.tuple([z.number(), z.number()])).max(8).optional(),
    cent: z.number().optional(),
    flat: z.number().min(0).max(1).optional(),
    rms: z.number().optional(),
    zcr: z.number().optional(),
    clk: z.number().optional(),
    bands16: z.array(z.number()).length(16).optional(),
    wv: z.array(z.number()).max(64).optional(),     // 32-sample mini-waveform (0..100)
    // Log-mel patch for the ML scorer: 40×32 = 1280 floats, band-major (§8.3).
    mel: z.array(z.number()).max(4096).optional(),
  }).optional(),

  vb: z.object({
    vib_rms: z.number().optional().default(0),
    vib_pk:  z.number().optional().default(0),
    vib_dom_hz: z.number().optional().default(0),
  }).passthrough().optional(),

  th: z.object({
    core_c: z.number().optional(),
    amb_c:  z.number().optional(),
  }).optional(),

  env: z.object({
    amb_c: z.number().optional(),
    hum:   z.number().optional(),
    pres:  z.number().optional(),
    gas_kohm: z.number().optional(),
  }).optional(),

  // Actuation truth reported by the device (§8.4 / §8.6). last_nonce echoes the
  // last executed dose nonce so the server can close the dose lifecycle.
  act: z.object({
    armed:       z.boolean().optional(),
    doses_today: z.number().optional(),
    last_dose_s: z.number().optional(),
    last_nonce:  z.number().optional(),
  }).passthrough().optional(),

  sys: z.object({
    bat_pct: z.number().optional(),
    bat_mv: z.number().optional(),
    rssi: z.number().optional(),
    fw: z.string().optional(),
    up_s: z.number().optional(),
  }).optional(),
});


// POST /api/v1/readings - main ESP32 ingestion endpoint.
// Response carries the downlink: { stream_bands, cmd:{dose,pump_ms,nonce} }.
router.post('/', async (req, res) => {
  const parse = ReadingSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'invalid_payload', issues: parse.error.issues });
  }
  try {
    const result = await ingest(parse.data, req.ip, false);
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[readings] ingest failed:', e);
    res.status(500).json({ error: 'ingest_failed' });
  }
});


// GET /api/v1/readings/latest  - latest reading per device
router.get('/latest', (_req, res) => {
  const rows = all(`
    SELECT r.*
    FROM readings r
    JOIN (
      SELECT device_id, MAX(ts) AS max_ts FROM readings GROUP BY device_id
    ) m ON m.device_id = r.device_id AND m.max_ts = r.ts
    ORDER BY r.ts DESC
  `);
  res.json({ readings: rows });
});


// GET /api/v1/readings?device_id=&since=&limit=
router.get('/', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 5000);
  const since = parseInt(req.query.since, 10) || (now() - 86400);
  const deviceId = req.query.device_id;
  const rows = deviceId
    ? all(
        'SELECT * FROM readings WHERE device_id = ? AND ts >= ? ORDER BY ts DESC LIMIT ?',
        deviceId, since, limit
      )
    : all('SELECT * FROM readings WHERE ts >= ? ORDER BY ts DESC LIMIT ?', since, limit);
  res.json({ readings: rows, count: rows.length });
});

export default router;
