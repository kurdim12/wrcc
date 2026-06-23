-- Palm Guard - SQLite schema
-- Idempotent: safe to run on every server start.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS palms (
  id            TEXT PRIMARY KEY,
  lat           REAL NOT NULL,
  lng           REAL NOT NULL,
  variety       TEXT,
  planted_date  TEXT,
  farm_id       TEXT,
  row_idx       INTEGER,
  col_idx       INTEGER,
  notes         TEXT,
  created_at    INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS devices (
  id            TEXT PRIMARY KEY,         -- e.g. PG-001
  palm_id       TEXT REFERENCES palms(id) ON DELETE SET NULL,
  fw_version    TEXT,
  last_seen     INTEGER,                  -- unix seconds
  battery_pct   INTEGER,
  battery_mv    INTEGER,
  rssi          INTEGER,
  ip_address    TEXT,
  status        TEXT DEFAULT 'unknown',   -- online | offline | unknown
  voc_warmup    INTEGER DEFAULT 240,      -- readings remaining before BME680 VOC trusted

  -- Dosing policy + state (§10.5). Server caps MIRROR the device failsafes;
  -- BOTH guards must pass before the pump runs.
  armed          INTEGER DEFAULT 0,       -- human-in-the-loop arm flag
  max_doses_day  INTEGER DEFAULT 4,
  cooldown_s     INTEGER DEFAULT 1800,
  pump_ms        INTEGER DEFAULT 2000,
  auto_confirm   INTEGER DEFAULT 0,       -- demo-only: auto-confirm (still gated by arm+caps)
  last_dose_ts   INTEGER,

  created_at    INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS readings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     TEXT NOT NULL,
  ts            INTEGER NOT NULL,         -- unix seconds (server-stamped)
  device_ts     INTEGER,                  -- unix seconds (device-reported, if any)
  seq           INTEGER,                  -- monotonic counter from device

  -- multi-sensor fusion scores (filled by services/riskScore.js)
  sa            REAL, sv REAL, st REAL, svoc REAL,
  risk_score    REAL,
  classification TEXT,                    -- low | medium | high

  -- thermal
  core_c        REAL,
  amb_c         REAL,

  -- environment (BME680)
  hum           REAL,
  pres          REAL,
  gas_kohm      REAL,

  -- vibration (SW-420 analog module; uncalibrated envelope, corroboration only)
  vib_rms       REAL,
  vib_pk        REAL,
  vib_dom_hz    REAL,

  -- acoustic features (INMP441 + FFT)
  ac_clk        REAL,                     -- click_rate (transients/sec in 2-8 kHz)
  ac_cent       REAL,                     -- spectral centroid (Hz)
  ac_flat       REAL,                     -- spectral flatness (0..1)
  ac_rms        REAL,                     -- broadband RMS (dBFS)
  ac_zcr        REAL,                     -- zero-crossing rate (0..1)
  bands_json    TEXT,                     -- JSON: 6 dB band energies
  peaks_json    TEXT,                     -- JSON: top-5 peaks [[freq,mag],...]

  -- ML acoustic score (§10.5): p_activity in [0,1] from the FastAPI model,
  -- and which model produced it ('heuristic-baseline-v0' | 'cnn-...' | 'fallback').
  p_activity    REAL,
  model_version TEXT,

  -- system
  battery_pct   INTEGER,
  rssi          INTEGER,

  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_readings_device_ts ON readings(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_readings_ts        ON readings(ts DESC);
CREATE INDEX IF NOT EXISTS idx_readings_risk      ON readings(risk_score DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id       TEXT NOT NULL,
  ts              INTEGER NOT NULL,
  severity        TEXT NOT NULL,          -- critical | warning | low
  type            TEXT NOT NULL,          -- HIGH_RISK | MEDIUM_SUSTAINED | ANOMALY_SPIKE | LOW_BATTERY | OFFLINE | THERMAL_STRESS | VOC_SURGE
  message         TEXT,
  trigger_value   REAL,
  status          TEXT DEFAULT 'active',  -- active | acknowledged | resolved
  acknowledged_by TEXT,
  acknowledged_ts INTEGER,
  resolved_ts     INTEGER,

  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(status, ts DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_device ON alerts(device_id, ts DESC);
-- partial unique index to enforce dedup per (device, type) for active alerts
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_dedup
  ON alerts(device_id, type) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS baselines (
  device_id              TEXT PRIMARY KEY,
  temp_baseline_c        REAL,            -- EWMA core-temp baseline
  temp_samples           INTEGER DEFAULT 0,
  gas_kohm_max           REAL,            -- 7-day rolling max -> R0
  gas_kohm_max_ts        INTEGER,
  voc_warmup_remaining   INTEGER DEFAULT 240,
  consecutive_medium     INTEGER DEFAULT 0,
  prev_risk_score        REAL,
  prev_gas_kohm          REAL,
  prev_gas_kohm_ts       INTEGER,
  last_thermal_stress_ok INTEGER DEFAULT 0, -- consecutive readings with delta>4
  last_low_battery_alert INTEGER DEFAULT 0, -- ts of last LOW_BATTERY emission
  last_updated           INTEGER,

  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chemical_events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT,
  ts        INTEGER,
  type      TEXT,                          -- 'fertilizer' | 'pesticide' | 'manual'
  notes     TEXT
);

CREATE TABLE IF NOT EXISTS readings_hourly (
  device_id        TEXT,
  hour             INTEGER,                -- unix seconds rounded down to the hour
  avg_risk         REAL, max_risk REAL,
  avg_core_c       REAL, avg_amb_c REAL,
  avg_hum          REAL, avg_gas_kohm REAL,
  avg_vib_rms      REAL,
  reading_count    INTEGER,
  PRIMARY KEY (device_id, hour)
);

-- Stream-mode flags: dashboards subscribe to a device for a short window.
-- The next ESP32 POST sees stream_until > now and returns {stream_bands:true}.
CREATE TABLE IF NOT EXISTS stream_subscriptions (
  device_id    TEXT PRIMARY KEY,
  stream_until INTEGER NOT NULL,           -- unix seconds
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);

-- Dose lifecycle (§10.5). Server-authoritative; the device adds its own
-- failsafes. One row per dose attempt.
CREATE TABLE IF NOT EXISTS doses (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id     TEXT NOT NULL,
  ts            INTEGER NOT NULL,          -- created (pending) unix seconds
  trigger_risk  REAL,                      -- risk_fused that triggered it
  pump_ms       INTEGER,
  volume_ml_est REAL,                      -- estimate from pump_ms × flow rate
  source        TEXT,                      -- 'auto' | 'manual'
  status        TEXT,                      -- pending | sent | done | failed | cancelled
  nonce         TEXT,                      -- anti-replay token sent to device
  confirmed_by  TEXT,
  sent_ts       INTEGER,
  done_ts       INTEGER,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_doses_device ON doses(device_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_doses_status ON doses(status, ts DESC);
