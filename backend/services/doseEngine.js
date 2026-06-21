// Dose state machine — SERVER-AUTHORITATIVE (§10.4).
//
//   risk_fused ≥ HIGH for K readings  AND  device.armed
//        → dose row status='pending'  (+ dashboard modal)
//   human Confirm (or auto_confirm)   → status='sent' + nonce
//   device next poll                  → /readings response carries cmd{dose,pump_ms,nonce}
//                                        ONLY if server caps (cooldown, daily) also pass
//   device reports DOSE_DONE (act.last_nonce == nonce) → status='done'
//
// Two independent guards by design: server caps here + device failsafes in
// firmware/dose_fsm. BOTH must pass before the pump runs. We NEVER auto-dose
// without arm + (confirm | explicit auto_confirm policy).

import crypto from 'node:crypto';
import { get, all, run, now } from '../db.js';
import * as socket from './socket.js';

// Thresholds (mirror spec §10.4 / firmware config.h)
const HIGH_RISK      = 61;
const SUSTAIN_K      = 3;      // consecutive high readings before a pending dose
const MAX_PUMP_MS    = 3000;   // hard ceiling, mirrors PG_DOSE_MAX_MS
const SENT_TIMEOUT_S = 120;    // a 'sent' dose the device never acks -> failed
const PENDING_TTL_S  = 3600;   // an un-confirmed 'pending' dose expires after 1h
// SPEC-DEFAULT: small peristaltic pump flow estimate for volume_ml display.
const PUMP_FLOW_ML_PER_S = 1.5;

// In-memory streak of consecutive high readings per device (resets on restart;
// that is acceptable — a fresh streak just has to rebuild).
const highStreak = new Map();

const volumeMl = (pumpMs) => +((pumpMs / 1000) * PUMP_FLOW_ML_PER_S).toFixed(2);

const policy = (deviceId) => {
  const d = get('SELECT armed, max_doses_day, cooldown_s, pump_ms, auto_confirm, last_dose_ts FROM devices WHERE id = ?', deviceId);
  return {
    armed:         !!(d?.armed),
    maxDosesDay:   d?.max_doses_day ?? 4,
    cooldownS:     d?.cooldown_s ?? 1800,
    pumpMs:        Math.min(d?.pump_ms ?? 2000, MAX_PUMP_MS),
    autoConfirm:   !!(d?.auto_confirm),
    lastDoseTs:    d?.last_dose_ts ?? null,
  };
};

// Doses successfully delivered in the rolling last 24 h (matches device counter).
const dosesToday = (deviceId) =>
  get(`SELECT COUNT(*) AS n FROM doses WHERE device_id = ? AND status = 'done' AND done_ts >= ?`,
      deviceId, now() - 86400).n;

const openDose = (deviceId) =>
  get(`SELECT * FROM doses WHERE device_id = ? AND status IN ('pending','sent') ORDER BY id DESC LIMIT 1`, deviceId);

/**
 * Server-side caps. Mirror the device failsafes; BOTH must pass.
 * Returns { ok, reason }.
 */
export const serverCapsPass = (deviceId, pumpMs) => {
  const p = policy(deviceId);
  if (!p.armed) return { ok: false, reason: 'disarmed' };
  if (!(pumpMs > 0 && pumpMs <= MAX_PUMP_MS)) return { ok: false, reason: 'pump_ms_out_of_range' };
  if (p.lastDoseTs && (now() - p.lastDoseTs) < p.cooldownS) return { ok: false, reason: 'cooldown' };
  if (dosesToday(deviceId) >= p.maxDosesDay) return { ok: false, reason: 'daily_cap' };
  return { ok: true, reason: null };
};

// Read-only caps snapshot for the UI / doseSafetyEngine. Pure reporting — it
// never creates, confirms, or sends a dose, so it's safe to call on a GET.
export const capsSnapshot = (deviceId) => {
  const p = policy(deviceId);
  const cdRemaining = p.lastDoseTs ? Math.max(0, p.cooldownS - (now() - p.lastDoseTs)) : 0;
  return {
    armed: p.armed,
    maxDosesDay: p.maxDosesDay,
    cooldownS: p.cooldownS,
    cooldownRemainingS: cdRemaining,
    pumpMs: p.pumpMs,
    pumpMsCeiling: MAX_PUMP_MS,
    autoConfirm: p.autoConfirm,
    dosesToday: dosesToday(deviceId),
    capsPass: serverCapsPass(deviceId, p.pumpMs),
  };
};

const emit = (dose) => { if (dose) socket.emitDose(dose); };
const fetchDose = (id) => get('SELECT * FROM doses WHERE id = ?', id);

// ─── Arm / disarm ──────────────────────────────────────────────────────────
export const setArmed = (deviceId, armed) => {
  run('UPDATE devices SET armed = ? WHERE id = ?', armed ? 1 : 0, deviceId);
  // Disarm cancels any open (pending/sent) dose — HARD KILL on the server side.
  if (!armed) {
    const o = openDose(deviceId);
    if (o) { run(`UPDATE doses SET status='cancelled' WHERE id = ?`, o.id); emit(fetchDose(o.id)); }
    highStreak.set(deviceId, 0);
  }
  socket.emitDeviceArm({ device_id: deviceId, armed: !!armed });
  return !!armed;
};

// ─── Create a pending dose ──────────────────────────────────────────────────
const createPending = (deviceId, triggerRisk, source) => {
  const p = policy(deviceId);
  const t = now();
  const info = run(
    `INSERT INTO doses (device_id, ts, trigger_risk, pump_ms, volume_ml_est, source, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    deviceId, t, triggerRisk ?? null, p.pumpMs, volumeMl(p.pumpMs), source
  );
  const dose = fetchDose(info.lastInsertRowid);
  socket.emitDosePending(dose);     // dashboard raises the confirm modal
  // Demo-only: explicit policy can auto-confirm (still gated by arm + caps).
  if (p.autoConfirm) confirm(dose.id, 'auto_confirm');
  return fetchDose(dose.id);
};

/**
 * Rule 0 (§10.4.1): evaluate sustained high risk after each reading.
 *   deviceId, riskFused, alreadyOpen guard prevents stacking doses.
 */
export const evaluate = (deviceId, riskFused) => {
  const streak = riskFused >= HIGH_RISK ? (highStreak.get(deviceId) ?? 0) + 1 : 0;
  highStreak.set(deviceId, streak);

  if (streak < SUSTAIN_K) return null;
  const p = policy(deviceId);
  if (!p.armed) return null;              // never create a dose path on a disarmed node
  if (openDose(deviceId)) return null;    // one open dose at a time
  const caps = serverCapsPass(deviceId, p.pumpMs);
  if (!caps.ok) return null;              // cooldown / daily cap — stay quiet, no pending

  return createPending(deviceId, riskFused, 'auto');
};

// Manual operator-initiated dose request (still requires arm + confirm).
export const requestManual = (deviceId, by = 'operator') => {
  const p = policy(deviceId);
  if (!p.armed) return { ok: false, reason: 'disarmed' };
  if (openDose(deviceId)) return { ok: false, reason: 'dose_already_open' };
  const dose = createPending(deviceId, null, 'manual');
  if (by && dose && dose.status === 'pending') run('UPDATE doses SET confirmed_by = ? WHERE id = ?', by, dose.id);
  return { ok: true, dose: fetchDose(dose.id) };
};

// ─── Confirm / cancel ───────────────────────────────────────────────────────
export const confirm = (doseId, by = 'operator') => {
  const dose = fetchDose(doseId);
  if (!dose) return { ok: false, reason: 'not_found' };
  if (dose.status !== 'pending') return { ok: false, reason: `not_pending (${dose.status})` };

  const caps = serverCapsPass(dose.device_id, dose.pump_ms);
  if (!caps.ok) {
    run(`UPDATE doses SET status='cancelled', confirmed_by=? WHERE id=?`, by, doseId);
    emit(fetchDose(doseId));
    return { ok: false, reason: caps.reason };
  }

  const nonce = String(crypto.randomInt(1, 2 ** 31));   // fits device uint32
  run(`UPDATE doses SET status='sent', nonce=?, confirmed_by=?, sent_ts=? WHERE id=?`,
      nonce, by, now(), doseId);
  const updated = fetchDose(doseId);
  emit(updated);
  return { ok: true, dose: updated };
};

export const cancel = (doseId, by = 'operator') => {
  const dose = fetchDose(doseId);
  if (!dose) return { ok: false, reason: 'not_found' };
  if (!['pending', 'sent'].includes(dose.status)) return { ok: false, reason: `not_open (${dose.status})` };
  run(`UPDATE doses SET status='cancelled', confirmed_by=? WHERE id=?`, by, doseId);
  emit(fetchDose(doseId));
  return { ok: true, dose: fetchDose(doseId) };
};

// ─── Downlink command for the device's next poll (§10.4.3) ──────────────────
// Returns { dose:true, pump_ms, nonce } only if a 'sent' dose exists for this
// device AND the server caps still pass. Otherwise null.
export const getDownlinkCommand = (deviceId) => {
  const sent = get(`SELECT * FROM doses WHERE device_id=? AND status='sent' ORDER BY id DESC LIMIT 1`, deviceId);
  if (!sent) return null;
  const caps = serverCapsPass(deviceId, sent.pump_ms);
  if (!caps.ok) return null;            // second guard at downlink time
  return { dose: true, pump_ms: sent.pump_ms, nonce: parseInt(sent.nonce, 10) };
};

// ─── Device acknowledgement (§10.4.4) ───────────────────────────────────────
// The device echoes act.last_nonce after it doses. Match it to a 'sent' dose
// and close it out, stamping device.last_dose_ts so cooldown starts.
export const handleDeviceAck = (deviceId, act) => {
  if (!act || act.last_nonce == null) return;
  const lastNonce = String(act.last_nonce);
  if (lastNonce === '0') return;
  const sent = get(`SELECT * FROM doses WHERE device_id=? AND status='sent' AND nonce=?`, deviceId, lastNonce);
  if (!sent) return;
  const t = now();
  run(`UPDATE doses SET status='done', done_ts=? WHERE id=?`, t, sent.id);
  run('UPDATE devices SET last_dose_ts = ? WHERE id = ?', t, deviceId);
  highStreak.set(deviceId, 0);
  emit(fetchDose(sent.id));
};

// ─── Periodic expiry (called from server.js cron) ───────────────────────────
export const expireStale = () => {
  const t = now();
  const sentDead = all(`SELECT id, device_id FROM doses WHERE status='sent' AND sent_ts < ?`, t - SENT_TIMEOUT_S);
  for (const d of sentDead) { run(`UPDATE doses SET status='failed' WHERE id=?`, d.id); emit(fetchDose(d.id)); }
  const pendingDead = all(`SELECT id FROM doses WHERE status='pending' AND ts < ?`, t - PENDING_TTL_S);
  for (const d of pendingDead) { run(`UPDATE doses SET status='cancelled' WHERE id=?`, d.id); emit(fetchDose(d.id)); }
};

export const list = (deviceId, limit = 100) =>
  deviceId
    ? all('SELECT * FROM doses WHERE device_id = ? ORDER BY ts DESC LIMIT ?', deviceId, limit)
    : all('SELECT * FROM doses ORDER BY ts DESC LIMIT ?', limit);
