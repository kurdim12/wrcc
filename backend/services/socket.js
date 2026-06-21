// Socket.IO singleton + typed broadcast helpers. server.js calls init(io) once.
import db, { now } from '../db.js';

let _io = null;

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
export const emitDeviceStatus = (device) => emit('device:status', device);
export const emitSystemMode  = (status) => emit('system:mode', status);

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
