// Ingestion pipeline shared by:
//   - HTTP route POST /api/v1/readings  (real ESP32-S3 + Python mock)
//   - services/demoMode.js               (auto-fallback when no device connected)
//
// Same path for both, so risk score, alerts, dose engine, and live broadcasts
// behave identically regardless of source.
//
// Flow per reading:
//   upsert device → fusion.scoreActivity (ML p_activity, heuristic fallback)
//   → risk.compute (SA = 100·p_activity) → store → alerts → dose engine
//   → build downlink {stream_bands, cmd}. Ingestion NEVER blocks on the ML
//   service (fusion has a short timeout + fallback, §3/§9.11).

import db, { now, get, run } from '../db.js';
import * as risk   from './riskScore.js';
import * as fusion from './fusion.js';
import * as alerts from './alertEngine.js';
import * as doseEngine from './doseEngine.js';
import * as socket from './socket.js';

const insertReading = db.prepare(`
  INSERT INTO readings (
    device_id, ts, device_ts, seq,
    sa, sv, st, svoc, risk_score, classification,
    core_c, amb_c, hum, pres, gas_kohm,
    vib_rms, vib_pk, vib_dom_hz,
    ac_clk, ac_cent, ac_flat, ac_rms, ac_zcr,
    bands_json, peaks_json,
    p_activity, model_version,
    battery_pct, rssi
  ) VALUES (
    :device_id, :ts, :device_ts, :seq,
    :sa, :sv, :st, :svoc, :risk_score, :classification,
    :core_c, :amb_c, :hum, :pres, :gas_kohm,
    :vib_rms, :vib_pk, :vib_dom_hz,
    :ac_clk, :ac_cent, :ac_flat, :ac_rms, :ac_zcr,
    :bands_json, :peaks_json,
    :p_activity, :model_version,
    :battery_pct, :rssi
  )
`);


// Map env.amb_c into th block (riskScore wants thermal.amb_c for ST baseline cold-start).
const normalize = (p) => {
  if (p.th?.amb_c == null && p.env?.amb_c != null) {
    p.th = { ...(p.th ?? {}), amb_c: p.env.amb_c };
  }
  if (!p.vb) p.vb = {};
  return p;
};


const upsertDevice = (deviceId, sys, ip, isDemo = false) => {
  const t = now();
  const existing = get('SELECT id FROM devices WHERE id = ?', deviceId);
  if (!existing) {
    run(
      `INSERT INTO devices (id, fw_version, last_seen, battery_pct, battery_mv, rssi, ip_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'online')`,
      deviceId, sys?.fw ?? null, t,
      sys?.bat_pct ?? null, sys?.bat_mv ?? null, sys?.rssi ?? null, ip ?? null
    );
    socket.emitDeviceStatus({ id: deviceId, status: 'online', new: true, demo: isDemo });
  } else {
    run(
      `UPDATE devices
         SET last_seen=?, battery_pct=COALESCE(?, battery_pct),
             battery_mv=COALESCE(?, battery_mv), rssi=COALESCE(?, rssi),
             fw_version=COALESCE(?, fw_version), ip_address=COALESCE(?, ip_address),
             status='online'
       WHERE id=?`,
      t, sys?.bat_pct ?? null, sys?.bat_mv ?? null, sys?.rssi ?? null,
      sys?.fw ?? null, ip ?? null, deviceId
    );
  }
};


/**
 * Process a Palm Guard JSON payload from any source. ASYNC because the ML
 * scorer is an HTTP call (with timeout + fallback — never blocks ingestion).
 *  payload: parsed + zod-validated reading body
 *  ip:      string for the devices.ip_address column (request IP, or 'demo')
 *  isDemo:  true when called from services/demoMode
 *
 * Returns { id, risk_score, classification, stream_bands, cmd, server_ts }.
 */
export const ingest = async (payload, ip = null, isDemo = false) => {
  const p = normalize(payload);

  upsertDevice(p.dev, p.sys, ip, isDemo);

  // 1) Acoustic activity from the ML model (or heuristic fallback).
  const fused = await fusion.scoreActivity(p);

  // 2) Multi-sensor fusion with SA = 100·p_activity.
  const scored = risk.compute(p.dev, p, { pActivity: fused.p_activity });
  const t = now();

  const row = {
    device_id: p.dev,
    ts: t,
    device_ts: p.ts ?? null,
    seq: p.seq ?? null,
    sa: scored.sa, sv: scored.sv, st: scored.st, svoc: scored.svoc,
    risk_score: scored.risk_score, classification: scored.classification,
    core_c: p.th?.core_c ?? null,
    amb_c:  p.th?.amb_c ?? p.env?.amb_c ?? null,
    hum: p.env?.hum ?? null,
    pres: p.env?.pres ?? null,
    gas_kohm: p.env?.gas_kohm ?? null,
    vib_rms: p.vb?.vib_rms ?? null,
    vib_pk: p.vb?.vib_pk ?? null,
    vib_dom_hz: p.vb?.vib_dom_hz ?? null,
    ac_clk: p.ac?.clk ?? null,
    ac_cent: p.ac?.cent ?? null,
    ac_flat: p.ac?.flat ?? null,
    ac_rms: p.ac?.rms ?? null,
    ac_zcr: p.ac?.zcr ?? null,
    bands_json: p.ac?.bands ? JSON.stringify(p.ac.bands) : null,
    peaks_json: p.ac?.peaks ? JSON.stringify(p.ac.peaks) : null,
    p_activity: fused.p_activity,
    model_version: fused.model_version,
    battery_pct: p.sys?.bat_pct ?? null,
    rssi: p.sys?.rssi ?? null,
  };

  const info = insertReading.run(row);
  const stored = get('SELECT * FROM readings WHERE id = ?', info.lastInsertRowid);

  // Alert engine (7 rules) — same for demo so the full pipeline stays exercised.
  const baselineRow = get('SELECT * FROM baselines WHERE device_id = ?', p.dev);
  alerts.evaluate(stored, baselineRow);

  // Dose engine: process the device's DOSE_DONE ack first, then Rule 0.
  doseEngine.handleDeviceAck(p.dev, p.act);
  doseEngine.evaluate(p.dev, stored.risk_score);    // gated internally by device.armed
  const cmd = doseEngine.getDownlinkCommand(p.dev); // null unless a confirmed dose is pending
  // Server arm state -> device mirrors it locally (a physical switch can still
  // hard-disarm on the node, §8.4). Lets the dashboard control the node's arm.
  const armed = !!(get('SELECT armed FROM devices WHERE id = ?', p.dev)?.armed);

  socket.emitReading({
    ...stored,
    bands16: p.ac?.bands16 ?? null,
    wv:      p.ac?.wv ?? null,
    act:     p.act ?? null,
    weights: scored.weights,
    model_source: fused.source,        // 'model' | 'fallback' | 'heuristic'
    calibrated:   fused.calibrated,
    is_demo: isDemo || p.dev?.startsWith?.('PG-DEMO') || false,
  });

  return {
    id: stored.id,
    risk_score: stored.risk_score,
    classification: stored.classification,
    p_activity: stored.p_activity,
    model_version: stored.model_version,
    armed,
    stream_bands: socket.isStreaming(p.dev),
    cmd: cmd || undefined,
    server_ts: t,
  };
};
