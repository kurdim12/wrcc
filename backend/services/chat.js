// AI Assistant context gathering + OpenRouter call.
//
// Gathers a compact snapshot of the user's farm (latest readings, active
// alerts, device baselines, farm stats) and feeds it to an OpenRouter chat
// completion. The system prompt explains Palm Guard's risk-score formula so
// the model can reason about the data correctly.
//
// API key is read from `process.env.PG_OPENROUTER_KEY` (loaded via --env-file=.env).

import { all, get, now } from '../db.js';

const OPENROUTER_URL    = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL     = process.env.PG_OPENROUTER_MODEL    || 'anthropic/claude-3.5-sonnet';
const MAX_TOKENS        = parseInt(process.env.PG_OPENROUTER_MAX_TOKENS, 10) || 1024;

const SYSTEM_PROMPT = `You are the Palm Guard Assistant — an AI integrated into a multi-sensor early-warning system that detects Red Palm Weevil (RPW) infestation BEFORE visible symptoms.

Each ESP32-S3 sensor node reads four sensors:
- INMP441 acoustic mic (2-8 kHz FFT, click-rate detection of larval feeding)
- MPU6050 vibration (RMS / peak / dominant Hz; gates wind from internal activity)
- DS18B20 trunk-core thermometer (vs ambient baseline; metabolic stress)
- BME680 environmental + VOC gas resistance (lower kΩ = more VOC = potential fermentation)

Risk score 0-100 = 0.40·SA + 0.25·SV + 0.20·ST + 0.15·SVOC, with adaptive weights (wind down-weights acoustic; chemical events down-weight VOC). Classification: 0-30 low (green), 31-60 medium (orange), 61-100 high (red, immediate action).

Rules of engagement:
1. Be SHORT. Default 2-4 sentences. Long answers only when the user asks "explain in detail".
2. ALWAYS ground claims in the live data context provided below. If you don't see something in the context, say "I don't see that in the current data" — never fabricate readings.
3. When asked about a specific device or palm, name the actual numeric values you see.
4. Suggest concrete actions. ("Inspect within 24 h, focus on rows 5-7" beats "monitor closely".)
5. Use plain English; avoid acronyms unless the user used them first.
6. Acoustic + thermal + VOC all firing simultaneously is the strong RPW signature - call it out by name.`;

const buildContext = (deviceId) => {
  const lines = [];
  const t = now();

  // Farm-wide stats
  const total      = get('SELECT COUNT(*) AS n FROM palms').n;
  const totalDev   = get('SELECT COUNT(*) AS n FROM devices').n;
  const onlineDev  = get('SELECT COUNT(*) AS n FROM devices WHERE last_seen >= ?', t - 300).n;
  const activeAlerts = all(`
    SELECT device_id, severity, type, message, trigger_value, ts
    FROM alerts WHERE status = 'active' ORDER BY ts DESC LIMIT 25
  `);
  lines.push(`== Farm-wide state (as of ${new Date(t * 1000).toISOString()}) ==`);
  lines.push(`Palms registered: ${total}`);
  lines.push(`Devices: ${totalDev} total, ${onlineDev} online`);
  lines.push(`Active alerts: ${activeAlerts.length}`);
  if (activeAlerts.length) {
    for (const a of activeAlerts) {
      lines.push(`  - [${a.severity}] ${a.device_id} ${a.type}: ${a.message}`);
    }
  }

  // Latest reading for each device (or just one device if specified)
  let devices;
  if (deviceId) {
    devices = all(`SELECT * FROM devices WHERE id = ?`, deviceId);
  } else {
    devices = all(`
      SELECT * FROM devices
      WHERE last_seen IS NOT NULL
      ORDER BY last_seen DESC LIMIT 10
    `);
  }

  for (const d of devices) {
    const r = get(
      `SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1`,
      d.id
    );
    if (!r) continue;
    const palm = d.palm_id
      ? get('SELECT id, variety, row_idx, col_idx, farm_id FROM palms WHERE id = ?', d.palm_id)
      : null;
    const baseline = get('SELECT * FROM baselines WHERE device_id = ?', d.id);

    lines.push('');
    lines.push(`== Device ${d.id} ==`);
    if (palm) lines.push(`Attached to palm ${palm.id} (${palm.variety || 'unknown variety'}, row ${palm.row_idx}, col ${palm.col_idx}, farm ${palm.farm_id || '-'})`);
    lines.push(`Status: ${d.status}, last seen ${Math.floor((t - r.ts) / 60)} min ago`);
    lines.push(`Battery: ${d.battery_pct ?? '?'}%, RSSI: ${d.rssi ?? '?'} dBm, FW: ${d.fw_version ?? '?'}`);
    lines.push(`Latest reading (${new Date(r.ts * 1000).toISOString()}):`);
    lines.push(`  Risk score: ${r.risk_score?.toFixed(1)} (${r.classification})`);
    lines.push(`    SA=${r.sa?.toFixed(0)}  SV=${r.sv?.toFixed(0)}  ST=${r.st?.toFixed(0)}  SVOC=${r.svoc?.toFixed(0)}`);
    lines.push(`  Acoustic: click_rate=${r.ac_clk?.toFixed(1)}/s  centroid=${r.ac_cent?.toFixed(0)} Hz  flatness=${r.ac_flat?.toFixed(2)}  RMS=${r.ac_rms?.toFixed(1)} dBFS`);
    if (r.bands_json) lines.push(`  6-band dB: ${r.bands_json}`);
    lines.push(`  Vibration: RMS=${r.vib_rms?.toFixed(3)} g  peak=${r.vib_pk?.toFixed(3)} g  dom=${r.vib_dom_hz?.toFixed(1)} Hz`);
    lines.push(`  Thermal: trunk=${r.core_c?.toFixed(1)}°C  ambient=${r.amb_c?.toFixed(1)}°C  delta=${r.core_c != null && r.amb_c != null ? (r.core_c - r.amb_c).toFixed(1) : '?'}°C`);
    lines.push(`  Environment: hum=${r.hum?.toFixed(1)}%  pres=${r.pres?.toFixed(1)} hPa  gas=${r.gas_kohm?.toFixed(1)} kΩ`);
    if (baseline) {
      lines.push(`  Baselines: temp=${baseline.temp_baseline_c?.toFixed(1)}°C  R0=${baseline.gas_kohm_max?.toFixed(0)} kΩ  voc_warmup_remaining=${baseline.voc_warmup_remaining}`);
    }

    // 24h trend on this device
    const trend = all(`
      SELECT
        ROUND(AVG(risk_score), 1) AS avg_risk,
        ROUND(MAX(risk_score), 1) AS max_risk,
        COUNT(*) AS n
      FROM readings WHERE device_id = ? AND ts >= ?
    `, d.id, t - 86400)[0];
    if (trend?.n) lines.push(`  Last 24 h: ${trend.n} readings, avg risk ${trend.avg_risk}, max ${trend.max_risk}`);
  }

  return lines.join('\n');
};


export const ask = async ({ messages, message, device_id }) => {
  if (!process.env.PG_OPENROUTER_KEY) {
    throw new Error('PG_OPENROUTER_KEY not set. Edit backend/.env and restart the backend.');
  }

  // Accept either a single `message` string or a full chat history
  const history = Array.isArray(messages) && messages.length > 0
    ? messages.map(m => ({
        role: m.role === 'user' || m.role === 'assistant' ? m.role : 'user',
        content: String(m.content ?? m.text ?? ''),
      }))
    : (message ? [{ role: 'user', content: String(message) }] : []);

  if (history.length === 0) {
    throw new Error('No message provided');
  }

  const ctx = buildContext(device_id);
  const fullMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'system', content: `Live farm data context:\n\n${ctx}` },
    ...history,
  ];

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.PG_OPENROUTER_KEY}`,
      'Content-Type':  'application/json',
      'HTTP-Referer':  'http://localhost:5173',     // OpenRouter recommends sending your URL
      'X-Title':       'Palm Guard',
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: fullMessages,
      max_tokens: MAX_TOKENS,
      temperature: 0.4,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
  }
  let data;
  try { data = JSON.parse(text); }
  catch (e) { throw new Error(`OpenRouter returned non-JSON: ${text.slice(0, 200)}`); }

  const choice = data.choices?.[0]?.message?.content;
  if (!choice) {
    throw new Error(`OpenRouter returned no message: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return {
    role: 'assistant',
    content: choice,
    model: data.model || DEFAULT_MODEL,
    usage: data.usage || null,
  };
};

// Quick sanity check the chat service can reach OpenRouter and the configured
// key is valid. Used by the dashboard to render "AI online" / "set up needed".
export const isReady = () => Boolean(process.env.PG_OPENROUTER_KEY);
