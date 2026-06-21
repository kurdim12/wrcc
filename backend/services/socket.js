// Socket.IO singleton + typed broadcast helpers. server.js calls init(io) once.
import db, { now } from '../db.js';
import { ROSTER, buildBands16 } from './demoFarm.js';

let _io = null;
const SPEC_PREFILL = 480;   // frames sent on subscribe so the demo spectrogram starts full

export const init = (io) => {
  _io = io;

  io.on('connection', (socket) => {
    socket.emit('hello', { ts: now() });

    // Dashboard subscribes to a device's high-frequency band stream for ~60s.
    // Backend records the subscription; the next ESP32 POST sees it and
    // responds with stream_bands:true, telling the device to switch to 2s cycles.
    socket.on('subscribe:spectrogram', (deviceId) => {
      if (typeof deviceId !== 'string') return;
      const until = now() + 60;
      db.prepare(`
        INSERT INTO stream_subscriptions (device_id, stream_until) VALUES (?, ?)
        ON CONFLICT(device_id) DO UPDATE SET stream_until = excluded.stream_until
      `).run(deviceId, until);
      socket.join(`device:${deviceId}`);
      socket.emit('subscribed:spectrogram', { device_id: deviceId, until });

      // Demo prefill: emit one burst of synthetic frames spread across "history"
      // so the spectrogram canvas starts populated (then the live stream appends).
      // Demo-only and clearly synthetic; never claims a validated signature.
      const dev = ROSTER.find((d) => d.id === deviceId);
      if (dev && !dev.offline) {
        const frames = [];
        for (let i = 0; i < SPEC_PREFILL; i++) frames.push(buildBands16(dev.intensity, (i - SPEC_PREFILL) * 0.18));
        socket.emit('live:bands:burst', { device_id: deviceId, frames });
      }
    });

    socket.on('unsubscribe:spectrogram', (deviceId) => {
      if (typeof deviceId !== 'string') return;
      db.prepare('DELETE FROM stream_subscriptions WHERE device_id = ?').run(deviceId);
      socket.leave(`device:${deviceId}`);
    });
  });
};

const emit = (event, payload) => {
  if (_io) _io.emit(event, payload);
};

export const emitReading = (reading) => emit('live:reading', reading);
export const emitAlert   = (alert)   => emit('live:alert', alert);
export const emitBands   = (frame)   => emit('live:bands', frame);   // high-rate spectrogram frame
export const emitDeviceStatus = (device) => emit('device:status', device);
export const emitSystemMode  = (status) => emit('system:mode', status);
// Intelligence layer (multi-sensor expert architecture)
export const emitRiskFusion = (fusion) => emit('risk:fusion', fusion);   // fused risk + recommendation + explanation
export const emitAgents     = (agents) => emit('agents:update', agents); // per-expert breakdown + safety

// Dose lifecycle (§10.4 / §11.2)
export const emitDosePending = (dose) => emit('dose:pending', dose);  // raises confirm modal
export const emitDose        = (dose) => emit('dose:update', dose);   // any status change
export const emitDeviceArm   = (info) => emit('device:arm', info);    // armed/disarmed

// Returns true if a dashboard is currently asking this device to stream.
export const isStreaming = (deviceId) => {
  const row = db.prepare(
    'SELECT stream_until FROM stream_subscriptions WHERE device_id = ?'
  ).get(deviceId);
  if (!row) return false;
  if (row.stream_until < now()) {
    db.prepare('DELETE FROM stream_subscriptions WHERE device_id = ?').run(deviceId);
    return false;
  }
  return true;
};

// All device IDs a dashboard is currently streaming (one query, for the demo
// spectrogram driver). Expired rows are simply ignored.
export const streamingDevices = () =>
  db.prepare('SELECT device_id FROM stream_subscriptions WHERE stream_until >= ?')
    .all(now()).map((r) => r.device_id);
