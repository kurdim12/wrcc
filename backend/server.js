// Palm Guard backend - Express + Socket.IO entry point.
import express from 'express';
import http from 'node:http';
import { Server as IOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';

import db, { dbPath, now, get } from './db.js';
import * as socket from './services/socket.js';
import * as alerts from './services/alertEngine.js';
import * as retention from './services/retention.js';
import * as demoMode from './services/demoMode.js';
import * as doseEngine from './services/doseEngine.js';
import { seedIfEmpty } from './scripts/seedFarm.js';

import readingsRouter from './routes/readings.js';
import devicesRouter  from './routes/devices.js';
import palmsRouter    from './routes/palms.js';
import alertsRouter   from './routes/alerts.js';
import statsRouter    from './routes/stats.js';
import reportsRouter  from './routes/reports.js';
import systemRouter   from './routes/system.js';
import dosesRouter    from './routes/doses.js';
import intelligenceRouter from './routes/intelligence.js';

const PORT = parseInt(process.env.PORT, 10) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.set('trust proxy', true);

// Middleware
app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '128kb' }));   // ESP32 payloads are <1kb; 128kb is plenty
app.use(express.urlencoded({ extended: true }));

// Health
app.get('/api/v1/health', (_req, res) => {
  const dbCount = get('SELECT COUNT(*) AS n FROM readings').n;
  res.json({
    ok: true,
    service: 'palm-guard-backend',
    db_path: dbPath,
    readings_count: dbCount,
    server_ts: now(),
    uptime_s: Math.round(process.uptime()),
  });
});

// Routes
app.use('/api/v1/readings', readingsRouter);
app.use('/api/v1/devices',  devicesRouter);
app.use('/api/v1/palms',    palmsRouter);
app.use('/api/v1/alerts',   alertsRouter);
app.use('/api/v1/stats',    statsRouter);
app.use('/api/v1/reports',  reportsRouter);
app.use('/api/v1/system',   systemRouter);
app.use('/api/v1/doses',    dosesRouter);
app.use('/api/v1/intelligence', intelligenceRouter);

// 404 catch-all for /api
app.use('/api', (_req, res) => res.status(404).json({ error: 'not_found' }));

// Static fallback - if frontend was built (frontend/dist), serve it.
// In dev the user runs Vite separately on :5173 with proxy, so this is only for prod.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// HTTP + Socket.IO
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: true, credentials: true },
  serveClient: false,
});
socket.init(io);

// Periodic background tasks
cron.schedule('* * * * *', () => alerts.checkOfflineDevices());
cron.schedule('30 2 * * *', () => retention.runMaintenance());   // 02:30 daily
// Expire stale doses (device never acked a 'sent' dose; un-confirmed 'pending').
setInterval(() => { try { doseEngine.expireStale(); } catch (e) { console.error('[dose] expire:', e.message); } }, 15000);

// Populate a credible demo farm on first boot when the DB is empty
// (PG_SEED_ON_EMPTY=1 is set in the Dockerfile for production). No-op once the
// farm exists, so it never clobbers persisted data on later restarts.
if (process.env.PG_SEED_ON_EMPTY === '1') {
  try { seedIfEmpty(); } catch (e) { console.error('[seed] skipped:', e.message); }
}

// Auto-fallback: when no real ESP32 reports for 60s, an internal generator
// drives demo data through the same ingestion pipeline. Stops on first real POST.
demoMode.start();

// Graceful shutdown. The container runs `node server.js` directly (see
// Dockerfile) so these signals arrive here. io.close() disconnects live
// dashboards and closes the underlying HTTP server (otherwise open WebSocket
// connections would stall the close); a short timer force-exits as a fallback.
let shuttingDown = false;
const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[palm-guard] ${signal} received, shutting down...`);
  io.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => { try { db.close(); } catch {} process.exit(0); }, 3000).unref();
};
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, HOST, () => {
  console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  Palm Guard backend                                       │
  │    listening on  http://${HOST}:${PORT}                       │
  │    health check  http://localhost:${PORT}/api/v1/health     │
  │    db file       ${dbPath}
  └──────────────────────────────────────────────────────────┘
  `.replace(/^\s+/gm, ''));
});
