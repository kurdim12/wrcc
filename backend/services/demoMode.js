// Auto-fallback demo mode.
//
// Watches the `readings` table once every 10 s. If no real (non-PG-DEMO)
// device has reported in the last 60 s, spawns an internal mock ESP32
// generator that posts realistic sensor payloads through the same ingestion
// pipeline (services/ingest.js) - so the dashboard always shows live data
// and the entire risk-score + alert pipeline stays exercised.
//
// As soon as a real device reports, the demo generator pauses (its rows are
// preserved so the chart history doesn't disappear).

import { get, now, run } from '../db.js';
import { ingest } from './ingest.js';
import * as socket from './socket.js';

const DEMO_DEVICES = ['PG-DEMO-001', 'PG-DEMO-002'];
const REAL_TIMEOUT_S = 60;          // how long without a real reading before demo kicks in
const DEMO_TICK_MS  = 2000;         // demo packet every 2s (faster than real for snappier UI)
const MONITOR_INTERVAL_MS = 5000;   // check every 5s

let tick_timers = {};
let monitor_timer = null;
let mode = 'unknown';
let cycle_counters = {};

// ─── Sensor models (port of tools/mock_device.py) ──────────────────────
const T_START = Date.now() / 1000;
const gauss   = (m, s) => m + (Math.random() + Math.random() + Math.random() - 1.5) * 1.5 * s;
const rng     = (lo, hi) => lo + Math.random() * (hi - lo);

const ambient_c = () => {
  const phase = ((Date.now() / 1000 - T_START) / 600) * 2 * Math.PI;   // fast 10-min cycle for visible variation
  return 27 + 5 * Math.sin(phase) + gauss(0, 0.3);
};

// Synthesize a 40×32 log-mel patch (band-major, mean-var normalized) consistent
// with the ML scorer's feeding-band rows [4,30) (~0.5-4 kHz). Infested clips lift
// + add click structure in those rows; clean clips are near-flat. After per-clip
// normalization only structure survives (gain is irrelevant), matching the
// firmware. See ml/serve/app.py heuristic for the matching row definition.
const MEL_BANDS = 40, MEL_FRAMES = 32, FEED_LO = 4, FEED_HI = 30;
const buildMelPatch = (infested) => {
  const raw = new Array(MEL_BANDS * MEL_FRAMES);
  for (let b = 0; b < MEL_BANDS; b++) {
    for (let f = 0; f < MEL_FRAMES; f++) {
      let v = gauss(-52, 2);                       // ambient floor (log-mel dB)
      if (infested && b >= FEED_LO && b < FEED_HI) {
        v += 9 + 4 * Math.sin(f * 0.9 + b);        // sustained feeding-band lift
        if (Math.random() < 0.18) v += rng(4, 9);  // transient "clicks"
      }
      raw[b * MEL_FRAMES + f] = v;
    }
  }
  // Per-clip mean-var normalization (identical operation to the firmware).
  const L = raw.length;
  let mean = 0; for (let i = 0; i < L; i++) mean += raw[i]; mean /= L;
  let varr = 0; for (let i = 0; i < L; i++) varr += (raw[i] - mean) ** 2; varr = Math.max(varr / L, 1e-6);
  const inv = 1 / Math.sqrt(varr);
  for (let i = 0; i < L; i++) raw[i] = +((raw[i] - mean) * inv).toFixed(2);
  return raw;
};

const buildPayload = (deviceId, infested, cycle) => {
  const amb = ambient_c();
  const ac = infested ? {
    bands: [gauss(-70,3), gauss(-65,3), gauss(-58,3), gauss(-30,4), gauss(-26,4), gauss(-50,3)],
    peaks: [
      [rng(2900, 3700), rng(-20, -14)],
      [rng(3900, 4800), rng(-22, -16)],
      [rng(4800, 5800), rng(-25, -18)],
      [rng(2200, 2700), rng(-28, -22)],
      [rng(6000, 7000), rng(-30, -24)],
    ],
    cent: rng(4000, 5200),
    flat: rng(0.10, 0.25),
    rms:  rng(-32, -22),
    zcr:  rng(0.20, 0.32),
    clk:  rng(8.0, 18.0),
  } : {
    bands: [gauss(-58,2), gauss(-55,2), gauss(-54,2), gauss(-53,2), gauss(-55,2), gauss(-59,2)],
    peaks: Math.random() < 0.4 ? [[rng(200, 1500), rng(-45, -35)]] : [],
    cent: rng(800, 2500),
    flat: rng(0.55, 0.85),
    rms:  rng(-55, -42),
    zcr:  rng(0.05, 0.15),
    clk:  rng(0.0, 1.5),
  };
  ac.mel = buildMelPatch(infested);

  const vib = infested ? {
    vib_rms: rng(0.10, 0.22),
    vib_pk:  rng(0.30, 0.55),
    vib_dom_hz: rng(8, 22),
  } : {
    vib_rms: rng(0.005, 0.04),
    vib_pk:  rng(0.02, 0.10),
    vib_dom_hz: rng(0.3, 4),
  };

  const offset = infested ? rng(2.5, 4.5) : rng(1.4, 2.4);

  // Demo readings need to bypass the BME680 20-min warmup so SVOC contributes immediately.
  // We cheat by putting the device past warmup the first time we ingest for it.

  return {
    v: 1,
    dev: deviceId,
    ts: Math.floor(Date.now() / 1000),
    seq: cycle,
    ac,
    vb: vib,
    th: { core_c: amb + offset, amb_c: amb },
    env: {
      amb_c: amb,
      hum:   Math.max(20, Math.min(80, gauss(50, 8))),
      pres:  gauss(1011, 2),
      gas_kohm: infested ? rng(15, 35) : rng(110, 180),
    },
    // Background ambient generator stays disarmed (no dosing). The dose loop is
    // demonstrated with tools/mock_device.py, which simulates the downlink.
    act: { armed: false, doses_today: 0, last_dose_s: 0, last_nonce: 0 },
    sys: {
      bat_pct: 95 - Math.floor(cycle / 2000),
      rssi:    Math.floor(rng(-75, -55)),
      fw:      'demo-0.1.0',
      up_s:    Math.floor(Date.now() / 1000 - T_START),
    },
  };
};


const tickDevice = async (deviceId, eventEvery) => {
  cycle_counters[deviceId] ??= 0;
  const isFirst = cycle_counters[deviceId] === 0;
  cycle_counters[deviceId]++;
  const cycle = cycle_counters[deviceId];
  const infested = cycle > 4 && (cycle % eventEvery === 0);

  try {
    await ingest(buildPayload(deviceId, infested, cycle), 'demo', true);
  } catch (e) {
    console.error(`[demoMode] ingest failed for ${deviceId}:`, e.message);
    return;
  }

  // After the first successful ingest the baselines row exists, so we can
  // fast-forward the BME680 20-min warmup so SVOC contributes within a few
  // demo cycles. (Real ESP32 keeps the full warmup, this only affects PG-DEMO*.)
  if (isFirst) {
    try {
      run(`UPDATE baselines SET voc_warmup_remaining = 3 WHERE device_id = ?`, deviceId);
    } catch {}
  }
};


const startDemoTickers = () => {
  if (Object.keys(tick_timers).length > 0) return;
  console.log('[demoMode] starting (no real device reporting)');
  // Two staggered demo devices so the dashboard looks alive
  tick_timers[DEMO_DEVICES[0]] = setInterval(() => tickDevice(DEMO_DEVICES[0], 12), DEMO_TICK_MS);
  setTimeout(() => {
    if (mode === 'demo') {
      tick_timers[DEMO_DEVICES[1]] = setInterval(() => tickDevice(DEMO_DEVICES[1], 18), DEMO_TICK_MS);
    }
  }, DEMO_TICK_MS / 2);
};


const stopDemoTickers = () => {
  if (Object.keys(tick_timers).length === 0) return;
  console.log('[demoMode] stopping (real device is reporting)');
  for (const k of Object.keys(tick_timers)) {
    clearInterval(tick_timers[k]);
    delete tick_timers[k];
  }
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
    demo_active: Object.keys(tick_timers).length > 0,
    demo_devices: DEMO_DEVICES,
  };
};


export const start = () => {
  // Initial check + recurring monitor
  const evaluate = () => {
    const status = computeMode();
    const newMode = status.mode;

    if (newMode === 'demo' && Object.keys(tick_timers).length === 0) {
      startDemoTickers();
    } else if (newMode === 'live' && Object.keys(tick_timers).length > 0) {
      stopDemoTickers();
    }

    if (newMode !== mode) {
      mode = newMode;
      socket.emitSystemMode({ ...status, mode });
    }
  };

  evaluate();   // synchronous first run
  monitor_timer = setInterval(evaluate, MONITOR_INTERVAL_MS);
};


export const stop = () => {
  if (monitor_timer) clearInterval(monitor_timer);
  stopDemoTickers();
};


export const status = () => {
  const s = computeMode();
  return { ...s, mode };
};
