// Live Analysis - the dashboard centerpiece.
//
// Shows for one selected device:
//   - Big animated risk-score gauge with classification (low/medium/high)
//   - Plain-language status explaining what's happening right now
//   - Sub-score breakdown (SA / SV / ST / SVOC) with adaptive weights
//   - 60-second sparkline of risk score
//
// Updates instantly via Socket.IO `live:reading` events.
import { useEffect, useState } from 'react';
import { Activity, Zap, TrendingUp, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import Card from './ui/Card.jsx';
import LiveBadge from './LiveBadge.jsx';
import { useCountUp } from '../hooks/useCountUp.js';
import { onEvent } from '../socket.js';
import { api } from '../api.js';

const classify = (s) => s == null ? 'unknown' : s < 31 ? 'low' : s < 61 ? 'medium' : 'high';

// Each classification has a self-contained colour set so we never need
// dynamic class strings (which Tailwind cannot purge correctly).
const PALETTE = {
  low: {
    ring:       '#43C76E',
    barColor:   '#43C76E',
    boxBg:      'bg-[#43C76E]/10',
    boxBorder:  'border-[#43C76E]/30',
    boxText:    'text-[#43C76E]',
    chipBg:     'bg-[#43C76E]/15',
    chipText:   'text-[#43C76E]',
    bigText:    'text-[#43C76E]',
    label:      'HEALTHY',
  },
  medium: {
    ring:       '#F0883E',
    barColor:   '#F0883E',
    boxBg:      'bg-[#F0883E]/10',
    boxBorder:  'border-[#F0883E]/30',
    boxText:    'text-[#F0883E]',
    chipBg:     'bg-[#F0883E]/15',
    chipText:   'text-[#F0883E]',
    bigText:    'text-[#F0883E]',
    label:      'AT RISK',
  },
  high: {
    ring:       '#EE5A48',
    barColor:   '#EE5A48',
    boxBg:      'bg-[#EE5A48]/10',
    boxBorder:  'border-[#EE5A48]/30',
    boxText:    'text-[#EE5A48]',
    chipBg:     'bg-[#EE5A48]/15',
    chipText:   'text-[#EE5A48]',
    bigText:    'text-[#EE5A48]',
    label:      'CRITICAL',
  },
  unknown: {
    ring:       '#98A69D',
    barColor:   '#98A69D',
    boxBg:      'bg-[#98A69D]/10',
    boxBorder:  'border-[#98A69D]/25',
    boxText:    'text-[#98A69D]',
    chipBg:     'bg-[#98A69D]/15',
    chipText:   'text-[#98A69D]',
    bigText:    'text-[#98A69D]',
    label:      'WAITING',
  },
};

const explain = (r, mode) => {
  if (!r) {
    if (mode === 'demo') return 'Demo data is starting up — readings should appear within a few seconds.';
    if (mode === 'live') return 'Connected to a real device, but no readings have arrived yet.';
    return 'Waiting for the first reading from this device.';
  }
  const cls = r.classification ?? classify(r.risk_score);
  const parts = [];

  const sa = r.sa ?? 0;
  if (sa > 60) parts.push(`acoustic ${sa.toFixed(0)} (sustained feeding-band activity, model)`);
  else if (sa > 30) parts.push(`acoustic ${sa.toFixed(0)} (intermittent activity)`);

  const sv = r.sv ?? 0;
  if (sv > 50) parts.push(`vibration ${sv.toFixed(0)} (internal-band frequency)`);
  else if (sv > 20) parts.push(`vibration ${sv.toFixed(0)} (low amplitude)`);

  if (r.core_c != null && r.amb_c != null) {
    const dt = r.core_c - r.amb_c;
    if (dt > 4)      parts.push(`trunk +${dt.toFixed(1)}°C above ambient (metabolic stress)`);
    else if (dt > 2) parts.push(`trunk +${dt.toFixed(1)}°C (mild)`);
  }

  const svoc = r.svoc ?? 0;
  if (svoc > 50) parts.push('VOC surge in BME680 gas resistance');
  else if (svoc > 20) parts.push('mild VOC elevation');

  if (parts.length === 0) {
    if (cls === 'low')   return 'All four sensors within normal range. No infestation indicators detected.';
    if (cls === 'high')  return 'Strong multi-sensor evidence of internal larval activity — immediate inspection advised.';
    return 'Some readings elevated — inspection recommended within 24-48 h.';
  }

  const verb = cls === 'high' ? 'Multi-sensor evidence:' : cls === 'medium' ? 'Elevated indicators:' : 'Mild indicators:';
  return `${verb} ${parts.join(', ')}.`;
};


// ─── Risk gauge (circular) ──────────────────────────────────────────────
const RiskGauge = ({ value, classification, hasData }) => {
  const display = useCountUp(value ?? 0, { duration: 250, decimals: 1 });
  const palette = PALETTE[classification] || PALETTE.unknown;
  const pct = Math.max(0, Math.min(100, value ?? 0));
  const C = 2 * Math.PI * 70;
  const offset = C * (1 - pct / 100);

  return (
    <div className="relative flex items-center justify-center w-full aspect-square max-w-[260px] mx-auto">
      {hasData && (
        <div className="absolute inset-4 rounded-full opacity-40 blur-2xl pointer-events-none"
             style={{ background: `radial-gradient(circle, ${palette.ring}44 0%, transparent 70%)` }} />
      )}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="70" stroke="currentColor" strokeWidth="12"
                fill="transparent" className="text-ink-700" />
        <circle cx="100" cy="100" r="70" stroke={palette.ring} strokeWidth="12"
                fill="transparent" strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={hasData ? offset : C}
                style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16, 1, 0.3, 1), stroke 700ms' }} />
      </svg>
      <div className="text-center relative z-10">
        {hasData ? (
          <>
            <div className={`cm-display text-6xl md:text-7xl font-black tabular-nums ${palette.bigText} drop-shadow-sm transition-colors`}>
              {Math.round(display)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] font-bold text-muted mt-1">/ 100</div>
            <div className={`mt-3 inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${palette.chipBg} ${palette.chipText}`}>
              {palette.label}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-muted">
            <Loader2 size={36} className="animate-spin mb-2" />
            <div className="text-xs uppercase tracking-widest font-bold">Waiting</div>
          </div>
        )}
      </div>
    </div>
  );
};


// ─── Sub-score row ──────────────────────────────────────────────────────
const SubScoreBar = ({ label, sub, value, weight, barColor, hasData }) => {
  const v = useCountUp(value ?? 0, { duration: 200, decimals: 0 });
  const numericValue = value ?? 0;
  const contribution = (numericValue * (weight ?? 0)).toFixed(1);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs gap-3">
        <span className="flex items-center gap-2 font-bold text-bone min-w-0">
          <span className="cm-mono font-black text-bone">{label}</span>
          <span className="text-muted font-medium truncate">{sub}</span>
        </span>
        <span className="cm-mono text-muted tabular-nums shrink-0">
          {hasData ? Math.round(v) : '–'} <span className="text-muted/60">·</span> w {weight?.toFixed(2) ?? '–'} <span className="text-muted/60">→</span> <strong className="text-bone">{hasData ? contribution : '–'}</strong>
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-ink-700 overflow-hidden">
        <div
          className="h-full rounded-full relative overflow-hidden"
          style={{
            width: `${Math.max(2, hasData ? numericValue : 0)}%`,
            background: barColor,
            transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 animate-shimmer" />
        </div>
      </div>
    </div>
  );
};


// ─── Sparkline ──────────────────────────────────────────────────────────
const RiskSparkline = ({ history, classification }) => {
  if (history.length < 2) return <div className="h-12" />;
  const W = 600, H = 48;
  const xs = history.map((_, i) => (i / (history.length - 1)) * W);
  const ys = history.map(r => H - ((r.risk_score ?? 0) / 100) * H);
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const stroke = PALETTE[classification]?.ring || PALETTE.unknown.ring;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12 mt-2" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${W} ${H} L 0 ${H} Z`} fill="url(#sparkfill)" />
      <path d={path} stroke={stroke} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {ys.length > 0 && (
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r="4" fill={stroke}>
          <animate attributeName="r" values="4;7;4" dur="1.5s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  );
};


export const LiveAnalysis = ({ deviceId, mode = 'unknown' }) => {
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

  const hasData = latest != null;
  const classification = hasData ? (latest.classification ?? classify(latest.risk_score)) : 'unknown';
  const palette = PALETTE[classification];
  const weights = latest?.weights ?? { a: 0.40, v: 0.25, t: 0.20, voc: 0.15 };
  const status = explain(latest, mode);
  const ago = hasData ? Math.max(0, Math.floor((Date.now() / 1000) - latest.ts)) : null;
  const isFresh = ago != null && ago < 5;

  return (
    <Card className="p-5 md:p-7 relative overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="cm-display text-xl md:text-2xl font-bold text-bone">Live Analysis</h2>
            <LiveBadge mode={mode} size="md" />
            {deviceId && (
              <span className="cm-mono text-xs md:text-sm text-muted bg-ink-700 px-2.5 py-1 rounded-lg border border-ink-600">
                {deviceId}
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1.5 flex items-center gap-2">
            <Zap size={12} className={isFresh ? 'text-forest-400 animate-pulse' : 'text-muted'} />
            {ago == null ? 'no readings yet'
              : ago < 1 ? 'just now'
              : ago < 60 ? `updated ${ago}s ago`
              : `updated ${Math.floor(ago / 60)}m ago`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-10">
        {/* Left: gauge + sparkline */}
        <div className="flex flex-col items-center justify-start">
          <RiskGauge value={latest?.risk_score} classification={classification} hasData={hasData} />
          <RiskSparkline history={history} classification={classification} />
          <div className="cm-label text-[10px] uppercase tracking-widest text-muted mt-1">last 60 readings</div>
        </div>

        {/* Right: status + sub-scores */}
        <div className="space-y-5 min-w-0">
          {/* Plain-language status */}
          <div className={`p-4 md:p-5 rounded-2xl border ${palette.boxBg} ${palette.boxBorder}`}>
            <div className="flex items-start gap-3">
              <div className={`shrink-0 mt-0.5 ${palette.boxText}`}>
                {classification === 'high'   ? <AlertTriangle size={22} /> :
                 classification === 'medium' ? <TrendingUp     size={22} /> :
                 classification === 'low'    ? <ShieldCheck    size={22} /> :
                                                <Loader2 size={22} className="animate-spin" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-black uppercase tracking-widest mb-1 ${palette.boxText}`}>Current status</div>
                <div className="text-sm leading-relaxed text-bone font-medium break-words">
                  {status}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-score bars */}
          <div className="space-y-3">
            <div className="cm-label text-[10px] uppercase tracking-widest text-muted font-bold">
              Sub-score contributions (adaptive weights · sum = 1.00)
            </div>
            <SubScoreBar label="SA"   sub="acoustic"  value={latest?.sa}   weight={weights.a}   barColor="#4D9BE6" hasData={hasData} />
            <SubScoreBar label="SV"   sub="vibration" value={latest?.sv}   weight={weights.v}   barColor="#CBA45B" hasData={hasData} />
            <SubScoreBar label="ST"   sub="thermal"   value={latest?.st}   weight={weights.t}   barColor="#F0883E" hasData={hasData} />
            <SubScoreBar label="SVOC" sub="VOC"       value={latest?.svoc} weight={weights.voc} barColor="#43C76E" hasData={hasData} />
          </div>
        </div>
      </div>
    </Card>
  );
};

export default LiveAnalysis;
