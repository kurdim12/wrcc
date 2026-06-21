// Shared demo-farm definition used by BOTH the seeder (backdated history) and
// the live demo driver (services/demoMode.js), so a fresh boot shows a credible,
// consistent farm and the live stream matches the seeded profiles.
//
// Device IDs keep the PG-DEMO prefix so is_demo detection + the demo banner work
// and a real node still flips the system to "live".

export const FARM_ID = 'al-qassim-block-a';
export const CENTER = { lat: 31.917632, lng: 35.589378 };

const VARIETIES = ['Medjool', 'Barhi', 'Deglet Nour', 'Khalas'];

// 16-node block: 12 healthy, 2 elevated, 1 high-risk, 1 intermittently-offline.
// `intensity` is the steady-state infestation level in [0,1] the live driver
// targets; `offline` nodes stop reporting so the OFFLINE path is demoable.
const PROFILES = [
  'high', 'elevated', 'elevated',
  'healthy', 'healthy', 'healthy', 'healthy', 'healthy', 'healthy',
  'healthy', 'healthy', 'healthy', 'healthy', 'healthy',
  'offline', 'healthy',
];

const INTENSITY = { healthy: 0.06, elevated: 0.5, high: 0.85, offline: 0.06 };

export const ROSTER = PROFILES.map((profile, i) => {
  const row = Math.floor(i / 4);
  const col = i % 4;
  return {
    id: `PG-DEMO-1${String(i + 1).padStart(2, '0')}`,   // PG-DEMO-101 ..-116
    palm: `P-1${String(i + 1).padStart(2, '0')}`,
    variety: VARIETIES[i % VARIETIES.length],
    lat: CENTER.lat + (row - 2) * 0.00015,
    lng: CENTER.lng + (col - 1.5) * 0.00015,
    row, col,
    profile,
    intensity: INTENSITY[profile],
    offline: profile === 'offline',
  };
});

const gauss = (m, s) => m + (Math.random() + Math.random() + Math.random() - 1.5) * 1.5 * s;
const rng = (lo, hi) => lo + Math.random() * (hi - lo);
const lerp = (a, b, t) => a + (b - a) * t;

// 40×32 band-major log-mel patch, per-clip mean-var normalized (matches firmware
// + tools/mock_device.py). Feeding-band rows [4,30) lift with `level` in [0,1].
export const MEL_BANDS = 40, MEL_FRAMES = 32, FEED_LO = 4, FEED_HI = 30;
export const buildMelPatch = (level) => {
  const raw = new Array(MEL_BANDS * MEL_FRAMES);
  for (let b = 0; b < MEL_BANDS; b++) {
    for (let f = 0; f < MEL_FRAMES; f++) {
      let v = gauss(-52, 2);
      if (level > 0.15 && b >= FEED_LO && b < FEED_HI) {
        v += level * (9 + 4 * Math.sin(f * 0.9 + b));
        if (Math.random() < 0.18 * level) v += rng(4, 9);
      }
      raw[b * MEL_FRAMES + f] = v;
    }
  }
  const L = raw.length;
  let mean = 0; for (let i = 0; i < L; i++) mean += raw[i]; mean /= L;
  let varr = 0; for (let i = 0; i < L; i++) varr += (raw[i] - mean) ** 2; varr = Math.max(varr / L, 1e-6);
  const inv = 1 / Math.sqrt(varr);
  for (let i = 0; i < L; i++) raw[i] = +((raw[i] - mean) * inv).toFixed(2);
  return raw;
};

// 16-band (×500 Hz, 0–8 kHz) instantaneous dB spectrum for the Tree Stethoscope.
// Bands 1..7 (~0.5–4 kHz) are the RPW feeding "literature guide" and lift with
// `level`; the values drift in time so the spectrogram scrolls with texture and
// fire occasional feeding "clicks". This is synthetic DEMO data (the UI is
// labelled DEMO) — it never claims a validated RPW signature.
export const buildBands16 = (level, tOffset = 0) => {
  const I = Math.max(0, Math.min(1, level));
  const t = Date.now() / 1000 + tOffset;   // tOffset spreads a prefill burst over "history"
  const out = new Array(16);
  for (let i = 0; i < 16; i++) {
    // Noise floor: a touch warmer at low frequencies, with slow broadband drift.
    let db = -74 + (i < 2 ? 5 : 0) + 3 * Math.sin(t * 1.3 + i * 0.7) + gauss(0, 2);
    if (i >= 1 && i < 8) {                          // feeding band 0.5–4 kHz
      const center = 1 - Math.abs(i - 4) / 4;       // peak ~2 kHz (band 4)
      const mod = 0.7 + 0.3 * Math.sin(t * 2.3 + i * 1.1);
      db += (6 + 56 * I) * center * mod;
    }
    out[i] = +db.toFixed(1);
  }
  // Sporadic feeding "clicks": a brief energy burst across the feeding band.
  if (I > 0.2 && Math.random() < 0.3 * I) {
    for (let i = 2; i < 7; i++) out[i] = Math.min(-6, out[i] + rng(6, 16));
  }
  return out;
};

// Build a full reading payload for a device at a given infestation intensity.
// `amb` lets the caller share one diurnal ambient across the farm.
export const buildPayload = (device, intensity, { amb = 28, cycle = 0, withMel = true } = {}) => {
  const I = Math.max(0, Math.min(1, intensity));
  const bands = [
    lerp(-58, -70, I), lerp(-55, -64, I), lerp(-54, -58, I),
    lerp(-53, -28, I), lerp(-55, -25, I), lerp(-59, -50, I),
  ].map((b) => gauss(b, 2));

  const ac = {
    bands,
    bands16: buildBands16(I),                      // 16×500 Hz spectrum → spectrogram
    cent: lerp(1500, 2800, I) + gauss(0, 200),   // model owns the real spectral call
    flat: Math.max(0.08, lerp(0.78, 0.15, I) + gauss(0, 0.03)),
    rms:  lerp(-52, -26, I) + gauss(0, 2),
    zcr:  lerp(0.09, 0.28, I),
    clk:  Math.max(0, lerp(0.5, 15, I) + gauss(0, 1)),
  };
  if (withMel) ac.mel = buildMelPatch(I);
  if (I > 0.4) {
    ac.peaks = [[rng(900, 3800), rng(-24, -14)], [rng(1800, 4200), rng(-28, -18)]];
  }

  const coreOffset = lerp(1.8, 5.5, I) + gauss(0, 0.2);

  return {
    v: 1,
    dev: device.id,
    ts: Math.floor(Date.now() / 1000),
    seq: cycle,
    ac,
    vb: {
      vib_rms: Math.max(0.003, lerp(0.02, 0.2, I) + gauss(0, 0.01)),
      vib_pk:  lerp(0.05, 0.5, I),
      vib_dom_hz: I > 0.4 ? rng(8, 22) : rng(0.3, 4),
    },
    th: { core_c: amb + coreOffset, amb_c: amb },
    env: {
      amb_c: amb,
      hum:   Math.max(20, Math.min(80, gauss(48, 6))),
      pres:  gauss(1011, 2),
      gas_kohm: Math.max(12, lerp(160, 22, I) + gauss(0, 6)),
    },
    act: { armed: false, doses_today: 0, last_dose_s: 0, last_nonce: 0 },
    sys: { bat_pct: 78 + Math.floor(rng(0, 20)), rssi: Math.floor(rng(-78, -55)), fw: 'demo-2.0.0', up_s: 3600 + cycle },
  };
};
