import { useEffect, useRef, useState } from 'react';
import { Volume2, ChevronDown, AlertTriangle, AudioLines } from 'lucide-react';
import { useDevices } from '../hooks/useDevices.js';
import { onEvent, subscribeSpectrogram, unsubscribeSpectrogram } from '../socket.js';
import { api } from '../api.js';
import { ModelCaveatBadge } from './ModelCaveatBadge.jsx';

// SpectrogramConsole — the "Tree Stethoscope" instrument. Self-contained:
// device picker, scrolling spectrogram (time × frequency × energy), feeding-band
// guide (literature only — model owns the call), VU meter, 16-band bars,
// P(activity). Honest labels throughout; no "RPW signature detected".
const HISTORY_KEEP = 120, SPEC_W = 800, SPEC_H = 256, NUM_BANDS = 16, BAND_HZ = 500;
const FEED_LO = 1, FEED_HI = 8;   // ~0.5–4 kHz literature guide

const dbToFraction = (db) => (db == null ? 0 : Math.max(0, Math.min(1, (db + 80) / 80)));
const dbToRGBA = (db) => {
  const t = Math.max(0, Math.min(1, (db + 80) / 80));
  const stops = [[12,10,30],[20,60,80],[16,120,90],[194,161,77],[201,74,58]]; // ink→teal→forest→gold→crit
  const idx = t * (stops.length - 1), lo = Math.floor(idx), hi = Math.min(stops.length - 1, lo + 1), f = idx - lo;
  return [0,1,2].map((k) => Math.round(stops[lo][k] * (1 - f) + stops[hi][k] * f)).concat(255);
};

const VuMeter = ({ rmsDb }) => {
  const pct = dbToFraction(rmsDb);
  const color = pct > 0.7 ? '#C94A3A' : pct > 0.4 ? '#C2A14D' : '#19A66A';
  const C = 2 * Math.PI * 80;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" strokeWidth="10" fill="none" className="stroke-muted/20" />
          <circle cx="100" cy="100" r="80" stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={C * (1 - pct)} style={{ transition: 'stroke-dashoffset 80ms linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Volume2 size={20} style={{ color }} />
          <div className="telemetry-num text-xl font-bold" style={{ color }}>{rmsDb != null ? Math.round(rmsDb) : '–'}</div>
          <div className="hud-label">dBFS</div>
        </div>
      </div>
      <div className="hud-label mt-1">loudness</div>
    </div>
  );
};

const SpectrumBars = ({ bands, alert }) => {
  if (!bands || bands.length < NUM_BANDS) return <div className="h-16 flex items-center justify-center hud-label">collecting…</div>;
  return (
    <div className="h-16 flex items-end gap-0.5">
      {bands.slice(0, NUM_BANDS).map((db, i) => {
        const h = Math.max(2, dbToFraction(db) * 100);
        const feed = i >= FEED_LO && i < FEED_HI;
        const bg = feed ? (alert ? '#C94A3A' : '#C2A14D') : (h > 60 ? '#19A66A' : '#0A5C44');
        return (
          <div key={i} className="flex-1 relative">
            <div className="rounded-t-sm transition-all" style={{ height: `${h}%`, background: bg }} />
            <div className="absolute -bottom-4 left-0 right-0 text-center text-[8px] telemetry-num text-muted">{((i + 0.5) * BAND_HZ / 1000).toFixed(1)}</div>
          </div>
        );
      })}
    </div>
  );
};

const Spectrogram = ({ queueRef, alert }) => {
  const canvasRef = useRef(null), animRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); c.width = SPEC_W; c.height = SPEC_H;
    ctx.fillStyle = '#08110E'; ctx.fillRect(0, 0, SPEC_W, SPEC_H);
    const tick = () => {
      const q = queueRef.current;
      while (q.length) {
        const bands = q.shift();
        if (!Array.isArray(bands) || bands.length < NUM_BANDS) continue;
        ctx.drawImage(c, 1, 0, SPEC_W - 1, SPEC_H, 0, 0, SPEC_W - 1, SPEC_H);
        const col = ctx.createImageData(1, SPEC_H);
        for (let y = 0; y < SPEC_H; y++) {
          const bi = Math.floor((1 - y / SPEC_H) * NUM_BANDS);
          const [r, g, b, a] = dbToRGBA(bands[Math.min(NUM_BANDS - 1, Math.max(0, bi))] ?? -90);
          const o = y * 4; col.data[o] = r; col.data[o + 1] = g; col.data[o + 2] = b; col.data[o + 3] = a;
        }
        ctx.putImageData(col, SPEC_W - 1, 0);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [queueRef]);

  const feedTop = (1 - FEED_HI / NUM_BANDS) * 100, feedBot = (1 - FEED_LO / NUM_BANDS) * 100;
  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full h-[256px] rounded-lg spectrogram-canvas border border-muted/20" />
      <div className={`absolute pointer-events-none border-y-2 transition-all ${alert ? 'border-crit bg-crit/15' : 'border-gold/40'}`}
           style={{ left: 0, right: 0, top: `${feedTop}%`, height: `${feedBot - feedTop}%` }} />
      <div className="absolute right-2 top-1 telemetry-num text-[10px] text-bone/70 bg-ink-900/60 px-1.5 rounded">8 kHz</div>
      <div className="absolute right-2 bottom-1 telemetry-num text-[10px] text-bone/70 bg-ink-900/60 px-1.5 rounded">0 Hz</div>
      <div className="absolute right-2 telemetry-num text-[10px] font-bold text-gold bg-ink-900/60 px-1.5 rounded" style={{ top: `${feedTop}%` }}>4 kHz</div>
      <div className="absolute right-2 telemetry-num text-[10px] font-bold text-gold bg-ink-900/60 px-1.5 rounded" style={{ top: `${feedBot}%`, transform: 'translateY(-100%)' }}>0.5 kHz · feeding band</div>
      <div className="absolute left-2 bottom-1 hud-label text-bone/70">newest →</div>
      {alert && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-crit text-bone text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2">
          <AlertTriangle size={14} /> High acoustic activity (model)
        </div>
      )}
    </div>
  );
};

export const SpectrogramConsole = ({ deviceId: controlled, onDeviceChange }) => {
  const { devices } = useDevices();
  const [internal, setInternal] = useState('');
  const deviceId = controlled ?? internal;
  const [latest, setLatest] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const queueRef = useRef([]);
  const [alert, setAlert] = useState(false);
  const streakRef = useRef(0);

  useEffect(() => {
    if (!controlled && !internal && devices.length) {
      const real = devices.find((d) => !d.id.startsWith('PG-DEMO'));
      setInternal((real || devices[0]).id);
    }
  }, [devices, controlled, internal]);

  useEffect(() => {
    if (!deviceId) return;
    setLatest(null); queueRef.current = []; streakRef.current = 0; setAlert(false);
    api.readings({ device_id: deviceId, limit: HISTORY_KEEP, since: Math.floor(Date.now() / 1000) - 600 })
      .then((rows) => setLatest(rows[0] ?? null)).catch(() => {});
    subscribeSpectrogram(deviceId); setStreaming(true);
    const renew = setInterval(() => subscribeSpectrogram(deviceId), 50000);
    const off = onEvent('live:reading', (r) => {
      if (r.device_id !== deviceId) return;
      setLatest(r);
      let bands = r.bands16; if (!bands && r.bands_json) { try { bands = JSON.parse(r.bands_json); } catch {} }
      if (Array.isArray(bands)) queueRef.current.push(bands);
      const sa = r.sa ?? 0;
      streakRef.current = sa >= 60 ? Math.min(streakRef.current + 1, 6) : Math.max(streakRef.current - 1, 0);
      setAlert(streakRef.current >= 3);
    });
    return () => { clearInterval(renew); off(); unsubscribeSpectrogram(deviceId); setStreaming(false); };
  }, [deviceId]);

  const pAct = latest?.p_activity;

  return (
    <div className="instrument p-4 md:p-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 text-charcoal dark:text-bone">
          <AudioLines size={18} className="text-forest-400" />
          <span className="font-bold">Tree Stethoscope</span>
          <span className="hud-label ml-2">INMP441 · 1024-pt FFT · 16×500 Hz</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={deviceId} onChange={(e) => (controlled ? onDeviceChange?.(e.target.value) : setInternal(e.target.value))}
                    className="focus-ring appearance-none instrument-inset px-3 py-2 pr-9 text-sm font-bold text-charcoal dark:text-bone cursor-pointer">
              {devices.length === 0 && <option value="">no devices</option>}
              {devices.map((d) => <option key={d.id} value={d.id}>{d.id}{d.id.startsWith('PG-DEMO') ? ' (demo)' : ''}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
          </div>
          <span className={`hud-label flex items-center gap-1 ${streaming ? 'text-forest-400' : 'text-muted'}`}>
            <span className={`w-2 h-2 rounded-full ${streaming ? 'bg-forest-400 animate-heartbeat' : 'bg-muted'}`} />
            {streaming ? 'streaming' : 'idle'}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-5 items-start">
        <Spectrogram queueRef={queueRef} alert={alert} />
        <div className="flex lg:flex-col gap-4 items-center">
          <VuMeter rmsDb={latest?.ac_rms} />
          <div className="text-center">
            <div className="hud-label">acoustic activity</div>
            <div className="telemetry-num text-2xl font-bold" style={{ color: (latest?.sa ?? 0) >= 61 ? '#C94A3A' : (latest?.sa ?? 0) >= 31 ? '#C2A14D' : '#19A66A' }}>
              {pAct != null ? `P=${Number(pAct).toFixed(2)}` : '–'}
            </div>
            <div className="hud-label mb-1">SA = 100·P(activity)</div>
            <ModelCaveatBadge modelVersion={latest?.model_version} modelSource={latest?.model_source} calibrated={latest?.calibrated} size="xs" />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="hud-label mb-1">16-band spectrum · highlighted = feeding band (~0.5–4 kHz)</div>
        <SpectrumBars bands={latest?.bands16} alert={alert} />
      </div>

      <p className="mt-5 text-[11px] text-muted leading-relaxed">
        The microphone responds to acoustic/vibration activity near the device. The highlighted band is a
        <strong className="text-gold"> literature guide (~0.5–4 kHz)</strong> — the model owns the call, not a fixed
        frequency. The score is an <strong>activity estimate</strong> (proxy/heuristic); real RPW validation is a
        documented next step. We never claim "RPW signature detected".
      </p>
    </div>
  );
};

export default SpectrogramConsole;
