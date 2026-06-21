// Auto-fallback demo mode + scripted demo driver.
//
// When no real (non-PG-DEMO) device has reported recently, an internal driver
// posts realistic payloads for the seeded demo farm (services/demoFarm.js)
// through the same ingestion pipeline (services/ingest.js) — so the dashboard
// shows a credible LIVE farm and the full risk/alert/dose pipeline stays
// exercised. As soon as a real device reports, the driver pauses (rows kept).
//
// A scripted event (triggerEvent) drives one device to high infestation for a
// few cycles on command, so the detect → fuse → alert → (armed+confirm) → dose
// → history story works even if on-stage capture is noisy.

import { get, now, run } from '../db.js';
import { ingest } from './ingest.js';
import * as socket from './socket.js';
import { ROSTER, buildPayload } from './demoFarm.js';

const REAL_TIMEOUT_S = 60;          // how long without a real reading before demo kicks in
const DRIVE_TICK_MS  = 600;         // post one roster device per tick (round-robin)
const MONITOR_INTERVAL_MS = 5000;

let drive_timer = null;
let monitor_timer = null;
let mode = 'unknown';
let rr_index = 0;
const seen = new Set();             // devices we've ingested at least once
const events = new Map();           // deviceId -> scripted high-intensity cycles remaining

// Per-device dose simulation so the demo driver closes the dose loop on stage
// (adopt server arm state, execute the downlink under local failsafes, echo the
// nonce) WITHOUT needing the external mock_device.py. Mirrors firmware dose_fsm.
const DOSE_MAX_MS = 3000, DOSE_COOLDOWN_S = 1800, DOSE_MAX_PER_DAY = 4;
const doseSim = new Map();          // deviceId -> {armed,lastNonce,lastDoseS,dosesToday,dayStart}
const doseState = (id) => {
  if (!doseSim.has(id)) doseSim.set(id, { armed: false, lastNonce: 0, lastDoseS: 0, dosesToday: 0, dayStart: now() });
  return doseSim.get(id);
};
const applyDownlink = (id, result) => {
  const s = doseState(id);
  s.armed = !!result?.armed;                          // device mirrors server arm state
  if (now() - s.dayStart >= 86400) { s.dayStart = now(); s.dosesToday = 0; }
  const cmd = result?.cmd;
  if (!cmd || !cmd.dose) return;
  const nowS = now();
  if (!s.armed) return;
  if (!(cmd.pump_ms > 0 && cmd.pump_ms <= DOSE_MAX_MS)) return;
  if (cmd.nonce && cmd.nonce === s.lastNonce) return;            // anti-replay
  if (s.lastDoseS && (nowS - s.lastDoseS) < DOSE_COOLDOWN_S) return;
  if (s.dosesToday >= DOSE_MAX_PER_DAY) return;
  s.lastNonce = cmd.nonce; s.lastDoseS = nowS; s.dosesToday += 1;  // "dose"; echoed next tick
  console.log(`[demoMode] ${id} executed dose (nonce=${cmd.nonce}); will ack next tick`);
};

const T_START = Date.now() / 1000;
const gauss = (m, s) => m + (Math.random() + Math.random() + Math.random() - 1.5) * 1.5 * s;
const ambient_c = () => {
  const phase = ((Date.now() / 1000 - T_START) / 600) * 2 * Math.PI;  // fast 10-min cycle
  return 27 + 5 * Math.sin(phase) + gauss(0, 0.3);
};

// Trigger a scripted infestation event on a device for `cycles` round-robin
// visits. Returns false if the device isn't in the demo roster.
export const triggerEvent = (deviceId, cycles = 8) => {
  if (!ROSTER.some((d) => d.id === deviceId)) return false;
  events.set(deviceId, Math.max(1, Math.min(60, cycles)));
  console.log(`[demoMode] scripted event on ${deviceId} for ${cycles} cycles`);
  return true;
};

const tickDevice = async (device) => {
  const amb = ambient_c();
  let intensity = device.intensity;
  const ev = events.get(device.id) || 0;
  if (ev > 0) { intensity = 0.92; events.set(device.id, ev - 1); }   // scripted spike

  const isFirst = !seen.has(device.id);
  try {
    const payload = buildPayload(device, intensity, { amb, cycle: rr_index, withMel: true });
    // Reflect this node's simulated actuation state so the server can close the
    // dose lifecycle (act.last_nonce ack).
    const s = doseState(device.id);
    payload.act = { armed: s.armed, doses_today: s.dosesToday, last_dose_s: s.lastDoseS, last_nonce: s.lastNonce };
    const result = await ingest(payload, 'demo', true);
    applyDownlink(device.id, result);     // adopt arm + execute any downlink dose
    seen.add(device.id);
  } catch (e) {
    console.error(`[demoMode] ingest failed for ${device.id}:`, e.message);
    return;
  }
  // Fast-forward the BME680 warmup once so SVOC contributes in the demo.
  if (isFirst) { try { run(`UPDATE baselines SET voc_warmup_remaining = 3 WHERE device_id = ?`, device.id); } catch {} }
};

const driveTick = () => {
  // Round-robin across the roster, skipping offline nodes (they go OFFLINE so
  // Rule 5 is demoable). One device per tick keeps load + socket traffic light.
  const active = ROSTER.filter((d) => !d.offline);
  if (active.length === 0) return;
  const device = active[rr_index % active.length];
  rr_index++;
  void tickDevice(device);
};

const startDriver = () => {
  if (drive_timer) return;
  console.log(`[demoMode] starting demo farm driver (${ROSTER.length} nodes, round-robin)`);
  drive_timer = setInterval(driveTick, DRIVE_TICK_MS);
};

const stopDriver = () => {
  if (!drive_timer) return;
  console.log('[demoMode] stopping driver (real device is reporting)');
  clearInterval(drive_timer);
  drive_timer = null;
};

// Detects mode based on whether any non-demo device reported recently
export const computeMode = () => {
  const t = now();
  const lastReal = get(`
    SELECT MAX(last_seen) AS ts FROM devices
    WHERE id NOT LIKE 'PG-DEMO%' AND last_seen IS NOT NULL
  `);
  const liveCount = get(`
    SELECT COUNT(*) AS n FROM devices
    WHERE id NOT LIKE 'PG-DEMO%' AND last_seen >= ?
  `, t - REAL_TIMEOUT_S).n;

  return {
    mode: liveCount > 0 ? 'live' : 'demo',
    live_devices: liveCount,
    last_real_ts: lastReal?.ts ?? null,
    seconds_since_real: lastReal?.ts ? (t - lastReal.ts) : null,
    demo_active: drive_timer != null,
    demo_devices: ROSTER.map((d) => d.id),
  };
};

export const start = () => {
  const evaluate = () => {
    const status = computeMode();
    const newMode = status.mode;
    if (newMode === 'demo' && !drive_timer) startDriver();
    else if (newMode === 'live' && drive_timer) stopDriver();
    if (newMode !== mode) {
      mode = newMode;
      socket.emitSystemMode({ ...status, mode });
    }
  };
  evaluate();
  monitor_timer = setInterval(evaluate, MONITOR_INTERVAL_MS);
};

export const stop = () => {
  if (monitor_timer) clearInterval(monitor_timer);
  stopDriver();
};

export const status = () => {
  const s = computeMode();
  return { ...s, mode };
};
