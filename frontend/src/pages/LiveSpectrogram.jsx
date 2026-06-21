// Live audio spectrogram + full sensor diagnostics for one selected device.
//
// The big canvas is a real frequency-domain spectrogram (time on X, frequency
// on Y, color = energy). The ~0.5-4 kHz feeding band (literature guide, App. B)
// is outlined in red as a VISUAL AID — the model, not this band, makes the call.
// When SA (=100·P(activity)) sustains >= 60 the overlay flashes a warning.
//
// The firmware computes a 1024-point FFT every 250 ms and ships 16 band
// energies (`bands16`, 500 Hz wide each, covering 0 - 8 kHz).
import { useEffect, useRef, useState } from 'react';
import { Activity, ChevronDown, Mic, Waves, Thermometer, Wind, Volume2, Zap, AudioLines, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';

import Card from '../components/ui/Card.jsx';
import { Badge, severityType } from '../components/ui/Badge.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { onEvent, subscribeSpectrogram, unsubscribeSpectrogram } from '../socket.js';
import { api } from '../api.js';
import { useCountUp } from '../hooks/useCountUp.js';

const HISTORY_KEEP = 120;
const SPEC_WIDTH   = 800;
const SPEC_HEIGHT  = 256;
const NUM_BANDS    = 16;
const BAND_HZ      = 500;
// Feeding band per literature (~0.5-4 kHz, Appendix B), shown as a GUIDE only —
// the trained model owns the actual spectral decision, not this fixed band.
const RPW_BAND_LO  = 1;          // 0.5 kHz
const RPW_BAND_HI  = 8;          // 4 kHz

const dbToFraction = (db) => {
  if (db == null) return 0;
  return Math.max(0, Math.min(1, (db + 80) / 80));
};

// Viridis-ish color map (input -90..-10 dBFS).
const dbToRGBA = (db) => {
  const t = Math.max(0, Math.min(1, (db + 80) / 80));
  const stops = [
    [ 12,  10,  30, 255],
    [ 50,  30, 100, 255],
    [120,  60, 150, 255],
    [200, 110, 100, 255],
    [255, 200,  50, 255],
  ];
  const idx = t * (stops.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.min(stops.length - 1, lo + 1);
  const f = idx - lo;
  return [
    Math.round(stops[lo][0] * (1 - f) + stops[hi][0] * f),
    Math.round(stops[lo][1] * (1 - f) + stops[hi][1] * f),
    Math.round(stops[lo][2] * (1 - f) + stops[hi][2] * f),
    255,
  ];
};


const VuMeter = ({ rmsDb }) => {
  const fill = dbToFraction(rmsDb);
  const animatedFill = useCountUp(Math.round(fill * 100), { duration: 80 });
  const pct = animatedFill / 100;
  const ringColor = pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : '#10b981';
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-40">
        <div className="absolute inset-0 rounded-full pointer-events-none transition-opacity"
             style={{ background: `radial-gradient(circle, ${ringColor}55 0%, transparent 70%)`,
                      opacity: pct, transform: `scale(${1 + pct * 0.3})` }} />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="10"
                  fill="transparent" className="text-gray-200 dark:text-gray-800" />
          <circle cx="100" cy="100" r="80" stroke={ringColor} strokeWidth="10"
                  fill="transparent" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 80}
                  strokeDashoffset={2 * Math.PI * 80 * (1 - pct)}
                  style={{ transition: 'stroke-dashoffset 60ms linear, stroke 200ms' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <Volume2 size={26} style={{ color: ringColor }} />
          <div className="text-2xl font-black tabular-nums mt-1" style={{ color: ringColor }}>
            {rmsDb != null ? Math.round(rmsDb) : '–'}
          </div>
          <div className="text-[10px] uppercase tracking-widest text-gray-400">dBFS</div>
        </div>
      </div>
      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 uppercase tracking-widest">loudness</div>
    </div>
  );
};


const Spectrogram = ({ specQueueRef, alertActive }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    c.width = SPEC_WIDTH;
    c.height = SPEC_HEIGHT;
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, SPEC_WIDTH, SPEC_HEIGHT);

    const tick = () => {
      const queue = specQueueRef.current;
      while (queue.length > 0) {
        const bands = queue.shift();
        if (!Array.isArray(bands) || bands.length < NUM_BANDS) continue;

        ctx.drawImage(c, 1, 0, SPEC_WIDTH - 1, SPEC_HEIGHT, 0, 0, SPEC_WIDTH - 1, SPEC_HEIGHT);
        const colImg = ctx.createImageData(1, SPEC_HEIGHT);
        for (let y = 0; y < SPEC_HEIGHT; y++) {
          const bandIdx = Math.floor((1 - y / SPEC_HEIGHT) * NUM_BANDS);
          const db = bands[Math.min(NUM_BANDS - 1, Math.max(0, bandIdx))] ?? -90;
          const [r, g, b, a] = dbToRGBA(db);
          const o = y * 4;
          colImg.data[o]     = r;
          colImg.data[o + 1] = g;
          colImg.data[o + 2] = b;
          colImg.data[o + 3] = a;
        }
        ctx.putImageData(colImg, SPEC_WIDTH - 1, 0);
      }
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [specQueueRef]);

  const rpwTopPct    = 1 - (RPW_BAND_HI / NUM_BANDS);
  const rpwBottomPct = 1 - (RPW_BAND_LO / NUM_BANDS);

  return (
    <div className="relative">
      <canvas ref={canvasRef} className="w-full h-[256px] rounded-2xl spectrogram-canvas border border-gray-200 dark:border-gray-800" />

      <div className={`absolute pointer-events-none border-y-2 transition-all ${
        alertActive ? 'border-red-500 bg-red-500/15 animate-pulse' : 'border-red-500/40'
      }`} style={{ left: 0, right: 0, top: `${rpwTopPct * 100}%`, height: `${(rpwBottomPct - rpwTopPct) * 100}%` }} />

      <div className="absolute right-2 top-1 text-[10px] font-mono text-white/70 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">8 kHz</div>
      <div className="absolute right-2 bottom-1 text-[10px] font-mono text-white/70 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">0 Hz</div>
      <div className="absolute right-2 text-[10px] font-mono font-bold text-red-300 bg-red-500/40 backdrop-blur px-1.5 py-0.5 rounded"
           style={{ top: `${rpwTopPct * 100 - 0.5}%` }}>4 kHz</div>
      <div className="absolute right-2 text-[10px] font-mono font-bold text-red-300 bg-red-500/40 backdrop-blur px-1.5 py-0.5 rounded"
           style={{ top: `${rpwBottomPct * 100}%`, transform: 'translateY(-100%)' }}>0.5 kHz · feeding band</div>
      <div className="absolute left-2 top-1 text-[10px] font-mono text-white/70 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">freq ↑</div>
      <div className="absolute left-2 bottom-1 text-[10px] font-mono text-white/70 bg-black/60 backdrop-blur px-1.5 py-0.5 rounded">newest →</div>

      {alertActive && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full flex items-center gap-2 shadow-2xl shadow-red-500/50 animate-pulse">
          <AlertTriangle size={14} /> High acoustic activity (model)
        </div>
      )}
    </div>
  );
};


const SpectrumBars = ({ bands, alertActive }) => {
  if (!bands || !Array.isArray(bands) || bands.length < NUM_BANDS) {
    return <div className="h-16 flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-400">collecting...</div>;
  }
  return (
    <div className="h-16 flex items-end gap-0.5">
      {bands.slice(0, NUM_BANDS).map((db, i) => {
        const h = Math.max(2, dbToFraction(db) * 100);
        const inRpw = i >= RPW_BAND_LO && i < RPW_BAND_HI;
        const bg = inRpw
          ? (alertActive ? '#ef4444' : '#f97316')
          : (h > 60 ? '#fbbf24' : h > 30 ? '#10b981' : '#475569');
        return (
          <div key={i} className="flex-1 relative">
            <div className="rounded-t-sm transition-all" style={{
              height: `${h}%`, background: bg,
              boxShadow: inRpw && alertActive ? `0 0 8px ${bg}` : 'none',
            }} />
            <div className="absolute -bottom-4 left-0 right-0 text-center text-[8px] font-mono text-gray-400">
              {((i + 0.5) * BAND_HZ / 1000).toFixed(1)}
            </div>
          </div>
        );
      })}
    </div>
  );
};


const SensorChart = ({ icon: Icon, title, source, color, valueKey, unit, decimals = 1, history }) => {
  const data = history.map((r, i) => ({
    t: i,
    v: Number.isFinite(r[valueKey]) ? r[valueKey] : null,
  }));
  const last = history[history.length - 1];
  const lastVal = last?.[valueKey];
  const display = useCountUp(lastVal ?? 0, { duration: 200, decimals });
  const hasData = lastVal != null && Number.isFinite(lastVal);

  return (
    <Card className="p-4 border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg" style={{ background: color + '22' }}>
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">{title}</div>
            <div className="text-[9px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider">{source}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-black tabular-nums" style={{ color: hasData ? color : '#9ca3af' }}>
            {hasData ? display.toFixed(decimals) : '–'}
            <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{unit}</span>
          </div>
        </div>
      </div>
      <div className="h-24 text-gray-500 dark:text-gray-400">
        {data.length < 2 ? (
          <div className="h-full flex items-center justify-center text-[10px] uppercase tracking-widest text-gray-400 dark:text-gray-500">collecting...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} vertical={false} />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} stroke="currentColor" strokeOpacity={0.2} width={36} />
              <Tooltip
                contentStyle={{ background: 'rgba(15, 20, 34, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11, color: '#e5e7eb', padding: '4px 8px' }}
                labelStyle={{ display: 'none' }}
                itemStyle={{ color: '#e5e7eb', padding: 0 }}
                formatter={(v) => [v?.toFixed?.(decimals) + ' ' + unit, title.toLowerCase()]}
              />
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
};


export const LiveSpectrogram = () => {
  const { devices } = useDevices();
  const [deviceId, setDeviceId] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const specQueueRef = useRef([]);
  const [rpwAlert, setRpwAlert] = useState(false);
  const saStreakRef = useRef(0);

  useEffect(() => {
    if (!deviceId && devices.length) {
      const real = devices.find(d => !d.id.startsWith('PG-DEMO'));
      setDeviceId((real || devices[0]).id);
    }
  }, [devices, deviceId]);

  useEffect(() => {
    if (!deviceId) return;
    setLatest(null);
    setHistory([]);
    specQueueRef.current = [];
    saStreakRef.current = 0;
    setRpwAlert(false);

    api.readings({ device_id: deviceId, limit: HISTORY_KEEP, since: Math.floor(Date.now()/1000) - 600 })
      .then(rows => {
        const ord = rows.slice().reverse();
        setHistory(ord);
        setLatest(ord[ord.length - 1] ?? null);
      })
      .catch(() => {});

    subscribeSpectrogram(deviceId);
    setStreaming(true);
    const renew = setInterval(() => subscribeSpectrogram(deviceId), 50_000);

    const off = onEvent('live:reading', (r) => {
      if (r.device_id !== deviceId) return;
      setLatest(r);
      setHistory(prev => {
        const next = [...prev, r];
        return next.length > HISTORY_KEEP ? next.slice(-HISTORY_KEEP) : next;
      });

      let bands = r.bands16;
      if (!bands && r.bands_json) {
        try { bands = JSON.parse(r.bands_json); } catch {}
      }
      if (bands && Array.isArray(bands)) {
        specQueueRef.current.push(bands);
      }

      const sa = r.sa ?? 0;
      if (sa >= 60) saStreakRef.current = Math.min(saStreakRef.current + 1, 6);
      else          saStreakRef.current = Math.max(saStreakRef.current - 1, 0);
      setRpwAlert(saStreakRef.current >= 3);
    });

    return () => {
      clearInterval(renew);
      off();
      unsubscribeSpectrogram(deviceId);
      setStreaming(false);
    };
  }, [deviceId]);

  const rmsDb = latest?.ac_rms;

  return (
    <div className="space-y-5">
      <Card className="p-5 md:p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <AudioLines className="text-emerald-500" /> Live Audio Spectrogram
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              INMP441 · 1024-pt FFT · 16 bands × 500 Hz · 4 Hz refresh · ~0.5-4 kHz feeding band (literature guide; model owns the call)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="appearance-none px-4 py-2.5 pr-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-700 dark:text-gray-200 cursor-pointer hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {devices.length === 0 && <option value="">no devices</option>}
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id}{d.id.startsWith('PG-DEMO') ? ' (demo)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
            </div>
            <Badge type={streaming ? 'success' : 'neutral'} text={streaming ? 'streaming' : 'idle'} />
          </div>
        </div>
      </Card>

      <Card className="p-5 md:p-6 border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col lg:flex-row gap-6 items-stretch">
          <div className="flex flex-col items-center gap-4 lg:w-48 shrink-0">
            <VuMeter rmsDb={rmsDb} />
            <div className="text-center">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Acoustic activity</div>
              <div className={`text-3xl font-black ${
                (latest?.sa ?? 0) >= 61 ? 'text-red-500' :
                (latest?.sa ?? 0) >= 31 ? 'text-orange-500' : 'text-emerald-500'
              }`}>
                {latest?.p_activity != null ? `P=${Number(latest.p_activity).toFixed(2)}`
                  : latest?.sa != null ? `P=${(latest.sa / 100).toFixed(2)}` : '–'}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-gray-400">SA = 100·P(activity)</div>
              {(() => {
                const ver = String(latest?.model_version || '');
                const isToy = /toy/i.test(ver);
                const heuristic = !ver || ver.startsWith('heuristic')
                  || ver === 'fallback' || latest?.model_source === 'fallback' || latest?.model_source === 'heuristic';
                const label = isToy ? 'TOY — not real' : heuristic ? 'heuristic' : 'proxy-validated';
                const color = isToy ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                  : heuristic ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';
                return (
                  <div className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${color}`}
                    title="Airborne mic; proxy-validated. A probability, not a certified accuracy.">
                    {label}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 min-w-0">
            <Spectrogram specQueueRef={specQueueRef} alertActive={rpwAlert} />
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Current spectrum (instant)</div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400">x = kHz · highlighted = feeding band (~0.5-4 kHz)</div>
              </div>
              <SpectrumBars bands={latest?.bands16} alertActive={rpwAlert} />
            </div>
          </div>
        </div>

        {latest && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-5">
            <Stat label="Risk score"     value={latest.risk_score?.toFixed(1) ?? '–'} accent={severityType(latest.classification)} />
            <Stat label="Click rate /s"  value={latest.ac_clk?.toFixed(1) ?? '–'} hint="2-8 kHz mid-band activity" />
            <Stat label="ZCR"            value={latest.ac_zcr?.toFixed(2) ?? '–'} hint="zero-crossings per sample" />
            <Stat label="RMS dBFS"       value={latest.ac_rms?.toFixed(1) ?? '–'} hint="broadband loudness" />
            <Stat label="Centroid"       value={latest.ac_cent != null ? Math.round(latest.ac_cent) + ' Hz' : '–'} hint="mean spectral frequency" />
          </div>
        )}
      </Card>

      <Card className="p-5 border border-gray-100 dark:border-gray-800">
        <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Zap size={16} className="text-amber-500" /> What makes the mic respond
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs text-gray-600 dark:text-gray-300">
          <Trigger title="Frequency range"
                   detail="Mic samples at 16 kHz, captures 0 - 8 kHz (Nyquist limit). Anything above 8 kHz is filtered out." />
          <Trigger title="Spectrogram colors"
                   detail="Dark purple = quiet (≤ -70 dBFS), green/yellow = moderate, bright yellow = loud (≥ -20 dBFS). Each row spans 500 Hz." />
          <Trigger title="VU meter"
                   detail="Pulses with broadband loudness (RMS dBFS). Voice, knock, breath, anything above ~-70 dBFS lights it up." />
          <Trigger title="Feeding band (~0.5-4 kHz)"
                   detail="The red-outlined band is a literature GUIDE (Appendix B) for where larval boring/feeding energy tends to sit. It does NOT itself decide — the model does. Sustained high activity flashes the overlay." />
          <Trigger title="Sustained click pattern"
                   detail="Boring/feeding shows up as repeated transients (clicks) plus mid-band energy. Reliable mainly in quiet/close/night conditions — an airborne mic, not a guaranteed in-trunk detector." />
          <Trigger title="Acoustic score SA = 100·P(activity)"
                   detail="P(activity) comes from the ML scorer on a 40×32 log-mel patch — currently a proxy/heuristic baseline (see badge), NOT a certified accuracy. The hardcoded ~4.5 kHz centroid assumption was removed; the model owns the spectral decision." />
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            All sensors · last 120 readings (~30 s)
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">streams in real-time</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SensorChart icon={Mic}        title="Acoustic SA score"     source="INMP441 + FFT"
                       color="#d946ef" valueKey="sa"      unit=""    decimals={0} history={history} />
          <SensorChart icon={Waves}      title="Vibration RMS"          source="LM393 · ADC"
                       color="#06b6d4" valueKey="vib_rms" unit="g"   decimals={3} history={history} />
          <SensorChart icon={Thermometer} title="Trunk core temperature" source="DS18B20 · 1-Wire"
                       color="#f97316" valueKey="core_c"  unit="°C"  decimals={1} history={history} />
          <SensorChart icon={Wind}       title="Acoustic RMS (loudness)" source="INMP441 · dBFS"
                       color="#10b981" valueKey="ac_rms"  unit="dB"  decimals={1} history={history} />
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value, accent, hint }) => (
  <div className={`p-3 rounded-xl border ${
    accent === 'critical' ? 'bg-red-50 border-red-100 dark:bg-red-950/40 dark:border-red-900/60' :
    accent === 'warning'  ? 'bg-orange-50 border-orange-100 dark:bg-orange-950/40 dark:border-orange-900/60' :
                            'bg-gray-50 border-gray-100 dark:bg-gray-800/50 dark:border-gray-800'
  }`}>
    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">{label}</div>
    <div className="text-lg font-bold font-mono text-gray-900 dark:text-white">{value}</div>
    {hint && <div className="text-[9px] text-gray-500 dark:text-gray-500 mt-1 leading-tight">{hint}</div>}
  </div>
);

const Trigger = ({ title, detail }) => (
  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
    <div className="text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200 mb-1">{title}</div>
    <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">{detail}</div>
  </div>
);

export default LiveSpectrogram;
