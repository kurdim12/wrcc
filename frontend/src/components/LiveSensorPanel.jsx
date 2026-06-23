// Per-sensor live readout cards. Each tile shows the most recent value, a
// 60-sample mini-trend, and the source variable. Updates instantly via
// Socket.IO `live:reading`.
import { useEffect, useState } from 'react';
import { Mic, Waves, Thermometer, Wind, ChevronUp, ChevronDown, Minus } from 'lucide-react';
import Card from './ui/Card.jsx';
import { useCountUp } from '../hooks/useCountUp.js';
import { onEvent } from '../socket.js';
import { api } from '../api.js';

// ─── Mini SVG sparkline ────────────────────────────────────────────────
const Spark = ({ values, color = '#10b981', height = 32 }) => {
  if (!values?.length) return <div style={{ height }} />;
  if (values.length === 1) {
    return (
      <svg viewBox={`0 0 200 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
        <circle cx="100" cy={height / 2} r="3" fill={color} />
      </svg>
    );
  }
  const W = 200, H = height;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const xs = values.map((_, i) => (i / Math.max(1, values.length - 1)) * W);
  const ys = values.map(v => H - ((v - lo) / span) * (H - 4) - 2);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const id = `fill-${color.replace('#','')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height }}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"  stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill={`url(#${id})`} />
      <path d={path} stroke={color} strokeWidth="1.6" fill="none" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

// ─── One sensor tile ───────────────────────────────────────────────────
const Tile = ({ icon: Icon, color, sensor, source, primary, primaryUnit, decimals = 1, sub, history, valueKey, hasReading }) => {
  const display = useCountUp(primary ?? 0, { duration: 200, decimals });
  const series = history.map(r => r[valueKey]).filter(v => v != null && Number.isFinite(v));

  let trend = 0;
  if (series.length >= 6) {
    const recent  = series.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlier = series.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    if (Math.abs(recent - earlier) > Math.abs(earlier) * 0.02) {
      trend = Math.sign(recent - earlier);
    }
  }
  const TrendIcon = trend > 0 ? ChevronUp : trend < 0 ? ChevronDown : Minus;
  const trendColor = trend > 0 ? 'text-orange-500'
                  : trend < 0 ? 'text-emerald-500'
                              : 'text-gray-400 dark:text-gray-500';

  return (
    <Card className="p-4 md:p-5 relative overflow-hidden border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-start justify-between mb-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg shrink-0 ${color.bg}`}>
            <Icon size={14} className={color.text} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-200">{sensor}</div>
            <div className="text-[9px] font-mono text-gray-400 dark:text-gray-500 uppercase tracking-wider truncate">{source}</div>
          </div>
        </div>
        <TrendIcon size={18} className={`${trendColor} transition-colors shrink-0`} />
      </div>

      <div className="flex items-baseline gap-1.5 mt-3">
        {primary == null || !hasReading ? (
          <div className="text-3xl md:text-4xl font-black text-gray-300 dark:text-gray-700 tabular-nums">–</div>
        ) : (
          <div className={`text-3xl md:text-4xl font-black tabular-nums ${color.text}`}>
            {display.toFixed(decimals)}
          </div>
        )}
        <div className="text-[10px] md:text-xs font-bold text-gray-400 dark:text-gray-500 uppercase">{primaryUnit}</div>
      </div>

      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-tight font-medium min-h-[2.4em]">
        {hasReading ? sub : <span className="italic text-gray-400 dark:text-gray-600">no reading yet</span>}
      </div>

      <div className="mt-3">
        <Spark values={series} color={color.hex} />
      </div>
    </Card>
  );
};


export const LiveSensorPanel = ({ deviceId }) => {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!deviceId) {
      setLatest(null);
      setHistory([]);
      return;
    }
    let alive = true;
    setLatest(null);
    setHistory([]);

    api.readings({ device_id: deviceId, limit: 60, since: Math.floor(Date.now()/1000) - 600 })
      .then(rows => {
        if (!alive) return;
        const ord = rows.slice().reverse();
        setHistory(ord);
        setLatest(ord[ord.length - 1] ?? null);
      })
      .catch(() => {});

    const off = onEvent('live:reading', (r) => {
      if (r.device_id !== deviceId) return;
      setLatest(r);
      setHistory(prev => {
        const next = [...prev, r];
        return next.length > 60 ? next.slice(-60) : next;
      });
    });

    return () => { alive = false; off(); };
  }, [deviceId]);

  const hasReading = latest != null;

  // Pretty-print sub strings, only when we have a reading
  const subAcoustic = hasReading
    ? `centroid ${latest.ac_cent != null ? Math.round(latest.ac_cent) : '–'} Hz · flat ${latest.ac_flat?.toFixed(2) ?? '–'} · ${latest.ac_rms?.toFixed(0) ?? '–'} dBFS`
    : '';
  const subVibration = hasReading
    ? `peak ${latest.vib_pk?.toFixed(3) ?? '–'} g · dom ${latest.vib_dom_hz?.toFixed(1) ?? '–'} Hz`
    : '';
  const subThermal = hasReading
    ? `ambient ${latest.amb_c?.toFixed(1) ?? '–'}°C · Δ ${latest.core_c != null && latest.amb_c != null ? '+' + (latest.core_c - latest.amb_c).toFixed(1) : '–'}°C`
    : '';
  const subEnv = hasReading
    ? `${latest.hum?.toFixed(1) ?? '–'}% RH · ${latest.pres != null ? Math.round(latest.pres) : '–'} hPa`
    : '';

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      <Tile
        icon={Mic}
        color={{ bg: 'bg-fuchsia-100 dark:bg-fuchsia-500/10', text: 'text-fuchsia-600 dark:text-fuchsia-400', hex: '#d946ef' }}
        sensor="Acoustic"
        source="INMP441 · I2S · FFT"
        primary={latest?.ac_clk}
        primaryUnit="clk/s"
        decimals={1}
        sub={subAcoustic}
        history={history}
        valueKey="ac_clk"
        hasReading={hasReading}
      />
      <Tile
        icon={Waves}
        color={{ bg: 'bg-cyan-100 dark:bg-cyan-500/10', text: 'text-cyan-600 dark:text-cyan-400', hex: '#06b6d4' }}
        sensor="Vibration"
        source="SW-420 · analog"
        primary={latest?.vib_rms}
        primaryUnit="rms (a.u.)"
        decimals={3}
        sub={subVibration}
        history={history}
        valueKey="vib_rms"
        hasReading={hasReading}
      />
      <Tile
        icon={Thermometer}
        color={{ bg: 'bg-orange-100 dark:bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', hex: '#f97316' }}
        sensor="Thermal"
        source="DS18B20 · 1-Wire"
        primary={latest?.core_c}
        primaryUnit="°C"
        decimals={1}
        sub={subThermal}
        history={history}
        valueKey="core_c"
        hasReading={hasReading}
      />
      <Tile
        icon={Wind}
        color={{ bg: 'bg-emerald-100 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', hex: '#10b981' }}
        sensor="Environment"
        source="BME680 · I2C"
        primary={latest?.gas_kohm}
        primaryUnit="kΩ gas"
        decimals={0}
        sub={subEnv}
        history={history}
        valueKey="gas_kohm"
        hasReading={hasReading}
      />
    </div>
  );
};

export default LiveSensorPanel;
