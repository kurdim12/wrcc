// Seed a believable demo farm: palms + devices + baselines + ~48h of backdated
// readings + a couple of alerts + past doses, so a FRESH boot shows a credible,
// non-empty live farm (history, trends, classifications) before the live demo
// driver (services/demoMode.js) has even run. Idempotent: re-running replaces
// the seeded rows for the roster.
//
// Usage:
//   npm run seed:farm                  (from backend/ — always (re)seeds)
//   import { seedIfEmpty } from './scripts/seedFarm.js'   (boot: seed only if empty)
//
// Honesty: p_activity here is the same heuristic-scale value the live pipeline
// produces; nothing is presented as a trained-model metric.
import db, { run, get, now } from '../db.js';
import { pathToFileURL } from 'node:url';
import { ROSTER, FARM_ID } from '../services/demoFarm.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const gauss = (m, s) => m + (Math.random() + Math.random() + Math.random() - 1.5) * 1.5 * s;
const classify = (r) => (r < 31 ? 'low' : r < 61 ? 'medium' : 'high');

const HALF_HOUR = 1800;
const HISTORY_POINTS = 96;          // 48 h of half-hourly points

const ids = ROSTER.map((d) => `'${d.id}'`).join(',');
const palmIds = ROSTER.map((d) => `'${d.palm}'`).join(',');

// (Re)seed the demo farm. Wrapped in a single transaction so it's fast even on
// a network-mounted volume (one commit instead of ~1500).
export function runSeed() {
  console.log('[seedFarm] clearing prior seeded rows…');
  db.exec('BEGIN');
  try {
    db.exec(`DELETE FROM readings WHERE device_id IN (${ids})`);
    db.exec(`DELETE FROM alerts   WHERE device_id IN (${ids})`);
    db.exec(`DELETE FROM doses    WHERE device_id IN (${ids})`);
    db.exec(`DELETE FROM baselines WHERE device_id IN (${ids})`);
    db.exec(`DELETE FROM devices  WHERE id IN (${ids})`);
    db.exec(`DELETE FROM palms    WHERE id IN (${palmIds})`);

    const insReading = db.prepare(`
      INSERT INTO readings (device_id, ts, device_ts, seq, sa, sv, st, svoc, risk_score, classification,
        core_c, amb_c, hum, pres, gas_kohm, vib_rms, vib_pk, vib_dom_hz,
        ac_clk, ac_cent, ac_flat, ac_rms, ac_zcr, bands_json, peaks_json,
        p_activity, model_version, battery_pct, rssi)
      VALUES (:device_id,:ts,:device_ts,:seq,:sa,:sv,:st,:svoc,:risk_score,:classification,
        :core_c,:amb_c,:hum,:pres,:gas_kohm,:vib_rms,:vib_pk,:vib_dom_hz,
        :ac_clk,:ac_cent,:ac_flat,:ac_rms,:ac_zcr,:bands_json,:peaks_json,
        :p_activity,:model_version,:battery_pct,:rssi)
    `);

    const t = now();
    let nReadings = 0;

    for (const d of ROSTER) {
      // Palm + device + baseline
      run(`INSERT INTO palms (id, lat, lng, variety, farm_id, row_idx, col_idx) VALUES (?,?,?,?,?,?,?)`,
          d.palm, d.lat, d.lng, d.variety, FARM_ID, d.row, d.col);
      const lastSeen = d.offline ? t - 1200 : t;           // offline node: 20 min stale
      run(`INSERT INTO devices (id, palm_id, fw_version, last_seen, battery_pct, rssi, status,
            armed, max_doses_day, cooldown_s, pump_ms, auto_confirm)
           VALUES (?,?,?,?,?,?,?,0,4,1800,2000,0)`,
          d.id, d.palm, 'demo-2.0.0', lastSeen, 80 + Math.floor(Math.random() * 18),
          -60 - Math.floor(Math.random() * 15), d.offline ? 'offline' : 'online');
      run(`INSERT INTO baselines (device_id, temp_baseline_c, temp_samples, gas_kohm_max, gas_kohm_max_ts,
            voc_warmup_remaining, last_updated) VALUES (?,?,?,?,?,0,?)`,
          d.id, 30 + gauss(0, 0.5), 500, clamp(150 + gauss(0, 10), 120, 180), t - 3600, t);

      // Backdated history. The high-risk node tells a story: clean → ramping up.
      for (let k = HISTORY_POINTS; k >= 0; k--) {
        const ts = t - k * HALF_HOUR;
        let intensity = d.intensity;
        if (d.profile === 'high') {
          const frac = (HISTORY_POINTS - k) / HISTORY_POINTS;   // 0..1 over the window
          intensity = clamp(0.1 + frac * 0.8, 0, 0.9);          // emerging infestation
        }
        intensity = clamp(intensity + gauss(0, 0.04), 0, 1);
        const pAct = clamp(intensity * 0.9 + 0.1 + gauss(0, 0.03), 0.02, 0.99);
        const risk = clamp(6 + intensity * 80 + gauss(0, 4), 0, 100);
        const amb = 27 + 4 * Math.sin(ts / 6000) + gauss(0, 0.3);
        insReading.run({
          device_id: d.id, ts, device_ts: ts, seq: HISTORY_POINTS - k,
          sa: clamp(pAct * 100, 0, 100), sv: clamp(intensity * 80, 0, 100),
          st: clamp(intensity * 70, 0, 100), svoc: clamp(intensity * 55, 0, 100),
          risk_score: risk, classification: classify(risk),
          core_c: amb + 1.8 + intensity * 4, amb_c: amb,
          hum: clamp(48 + gauss(0, 5), 25, 75), pres: 1011 + gauss(0, 2),
          gas_kohm: clamp(160 - intensity * 135 + gauss(0, 6), 12, 180),
          vib_rms: clamp(0.02 + intensity * 0.18, 0, 0.6), vib_pk: 0.05 + intensity * 0.5,
          vib_dom_hz: intensity > 0.4 ? 8 + Math.random() * 14 : Math.random() * 4,
          ac_clk: clamp(0.5 + intensity * 15, 0, 20), ac_cent: 1500 + intensity * 1300,
          ac_flat: clamp(0.78 - intensity * 0.6, 0.08, 0.9), ac_rms: -52 + intensity * 26,
          ac_zcr: 0.09 + intensity * 0.2, bands_json: null, peaks_json: null,
          p_activity: pAct, model_version: 'heuristic-baseline-v0',
          battery_pct: 82, rssi: -62,
        });
        nReadings++;
      }
    }

    // A live HIGH_RISK alert on the high node + an OFFLINE alert on the offline node.
    const high = ROSTER.find((d) => d.profile === 'high');
    const off = ROSTER.find((d) => d.offline);
    if (high) run(`INSERT INTO alerts (device_id, ts, severity, type, message, trigger_value, status)
       VALUES (?,?, 'critical','HIGH_RISK','Risk score 78 - strong multi-sensor evidence of internal activity', 78, 'active')`,
       high.id, t - 600);
    if (off) run(`INSERT INTO alerts (device_id, ts, severity, type, message, trigger_value, status)
       VALUES (?,?, 'warning','OFFLINE','Device unreachable for 20 min', 1200, 'active')`,
       off.id, t - 300);

    // A couple of past (done) doses on the high node so dose history isn't empty.
    if (high) {
      for (const ago of [26 * 3600, 50 * 3600]) {
        run(`INSERT INTO doses (device_id, ts, trigger_risk, pump_ms, volume_ml_est, source, status,
              nonce, confirmed_by, sent_ts, done_ts)
             VALUES (?,?,?,2000,3.0,'auto','done',?, 'operator', ?, ?)`,
            high.id, t - ago - 60, 72 + Math.random() * 8, String(100000 + Math.floor(Math.random() * 900000)),
            t - ago - 30, t - ago);
      }
      run(`UPDATE devices SET last_dose_ts = ? WHERE id = ?`, t - 26 * 3600, high.id);
    }

    db.exec('COMMIT');
    console.log(`[seedFarm] seeded ${ROSTER.length} palms/devices, ${nReadings} readings, alerts + past doses.`);
    console.log('[seedFarm] high-risk node:', high?.id, '| offline node:', off?.id);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// Seed only when the farm has no palms yet (fresh DB). Safe no-op otherwise, so
// it never clobbers existing data. Called at server boot in production.
export function seedIfEmpty() {
  const n = get('SELECT COUNT(*) AS n FROM palms').n;
  if (n > 0) return false;
  console.log('[seedFarm] empty farm detected — seeding demo data…');
  runSeed();
  return true;
}

// CLI entrypoint: `npm run seed:farm` always (re)seeds, then exits.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeed();
  process.exit(0);
}
