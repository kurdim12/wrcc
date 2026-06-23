// Living Orchard Command Map — a calm, instrument-style plot of the orchard.
// Replaces the old noisy satellite/polka-dot view. Palms are laid out on their
// row/col grid as engineered risk glyphs (halo + core), wired to a gateway, with
// a legend and low-battery/offline hints. SVG so it scales crisply to any panel.
import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { useDevices } from '../hooks/useDevices.js';

const VB_W = 320, VB_H = 200;
const PAD_X = 30, PAD_TOP = 26, PAD_BOT = 46;   // bottom room for the gateway

// Semantic status palette (matches the CaseMap legend / status pills).
const TONES = {
  high:    '#C05621',   // high risk → orange
  medium:  '#B7791F',   // watch → gold
  low:     '#2F7D46',   // healthy → green
  offline: '#8C9B91',   // offline / stale → slate-sage
};
const LEGEND = [
  ['low', 'healthy'], ['medium', 'watch'], ['high', 'critical'], ['offline', 'offline / stale'],
];

const toneKey = (p) => {
  if (p.device_status && p.device_status !== 'online') return 'offline';
  return p.classification === 'high' ? 'high' : p.classification === 'medium' ? 'medium' : 'low';
};

export const PalmGridMap = ({ palms = [], onSelectPalm, selectedPalm, height = 'h-[360px]' }) => {
  const { devices } = useDevices();
  const devById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);

  const nodes = useMemo(() => {
    const withIdx = palms.map((p, i) => ({
      ...p,
      _r: p.row_idx ?? Math.floor(i / 4),
      _c: p.col_idx ?? i % 4,
    }));
    const maxR = Math.max(1, ...withIdx.map((p) => p._r));
    const maxC = Math.max(1, ...withIdx.map((p) => p._c));
    return withIdx.map((p) => {
      const dev = devById[p.device_id] || {};
      return {
        ...p,
        tone: toneKey(p),
        battery: dev.battery_pct,
        x: PAD_X + (p._c / maxC) * (VB_W - 2 * PAD_X),
        y: PAD_TOP + (p._r / maxR) * (VB_H - PAD_TOP - PAD_BOT),
      };
    });
  }, [palms, devById]);

  const gw = { x: VB_W / 2, y: VB_H - 18 };
  const counts = nodes.reduce((m, n) => ((m[n.tone] = (m[n.tone] || 0) + 1), m), {});

  return (
    <div className={`instrument relative overflow-hidden ${height}`}>
      {/* status chip */}
      <div className="absolute top-3 left-3 z-10 instrument-inset px-3 py-1.5 flex items-center gap-2">
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="absolute inline-flex h-full w-full rounded-full animate-heartbeat" style={{ background: TONES.low }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: TONES.low }} />
        </span>
        <span className="hud-label text-muted">{nodes.length} palms · 1 gateway{counts.high ? ` · ${counts.high} critical` : ''}</span>
      </div>

      {/* legend */}
      <div className="absolute top-3 right-3 z-10 instrument-inset px-3 py-2 space-y-1.5 min-w-[132px]">
        <div className="hud-label font-display tracking-tight mb-0.5">Orchard risk</div>
        {LEGEND.map(([k, lbl]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TONES[k], boxShadow: `0 0 0 2px ${TONES[k]}26` }} />
            <span className="hud-label">{lbl}</span>
            <span className="telemetry-num text-[10px] text-muted ml-auto">{counts[k] || 0}</span>
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="orchard-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M20 0H0V20" fill="none" stroke="#8C9B91" strokeOpacity="0.10" strokeWidth="0.5" />
          </pattern>
          <radialGradient id="gw-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#2F7D46" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#2F7D46" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* subtle orchard-row grid */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#orchard-grid)" />

        {/* signal threads node → gateway */}
        {nodes.map((n) => (
          <line key={`l-${n.id}`} x1={n.x} y1={n.y} x2={gw.x} y2={gw.y}
                stroke={n.tone === 'offline' ? '#8C9B91' : TONES[n.tone]}
                strokeOpacity={n.tone === 'offline' ? 0.06 : 0.14} strokeWidth="0.6"
                strokeDasharray={n.tone === 'offline' ? '2 3' : undefined} />
        ))}

        {/* gateway / base station */}
        <circle cx={gw.x} cy={gw.y} r="22" fill="url(#gw-glow)" />
        <circle cx={gw.x} cy={gw.y} r="12" fill="none" stroke="#2F7D46" strokeWidth="0.6" strokeOpacity="0.45">
          <animate attributeName="r" values="12;20;12" dur="3.2s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.45;0;0.45" dur="3.2s" repeatCount="indefinite" />
        </circle>
        <rect x={gw.x - 6} y={gw.y - 6} width="12" height="12" rx="2" transform={`rotate(45 ${gw.x} ${gw.y})`}
              fill="#123C2C" stroke="#2F7D46" strokeWidth="1.2" />
        <circle cx={gw.x} cy={gw.y} r="2.4" fill="#19A66A" />
        <text x={gw.x} y={gw.y + 16} textAnchor="middle" fill="#8C9B91"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 6, letterSpacing: '0.16em', fontWeight: 600 }}>GATEWAY</text>

        {/* palm nodes */}
        {nodes.map((n) => {
          const c = TONES[n.tone];
          const sel = selectedPalm?.id === n.id;
          const crit = n.tone === 'high';
          const lowBat = n.battery != null && n.battery < 25 && n.tone !== 'offline';
          return (
            <g key={n.id} role="button" tabIndex={0}
               onClick={() => onSelectPalm?.(n)}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectPalm?.(n); } }}
               className="palm-marker focus:outline-none"
               style={{ cursor: 'pointer', transformBox: 'fill-box', transformOrigin: 'center', transition: 'transform .2s cubic-bezier(.16,1,.3,1)' }}
               onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.18)'; }}
               onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
               onFocus={(e) => { e.currentTarget.style.transform = 'scale(1.18)'; }}
               onBlur={(e) => { e.currentTarget.style.transform = ''; }}>
              {/* generous invisible hit area */}
              <circle cx={n.x} cy={n.y} r="13" fill="transparent" />
              {/* halo */}
              <circle cx={n.x} cy={n.y} r={sel ? 11 : 9} fill={c} fillOpacity={crit ? 0.16 : 0.10}
                      style={{ transition: 'r .2s ease, fill-opacity .2s ease' }} />
              <circle cx={n.x} cy={n.y} r={sel ? 11 : 9} fill="none" stroke={c}
                      strokeOpacity={n.tone === 'offline' ? 0.5 : 0.85} strokeWidth={sel ? 1.6 : 1.1}
                      style={{ transition: 'r .2s ease, stroke-width .2s ease, stroke-opacity .2s ease' }} />
              {crit && (
                <circle cx={n.x} cy={n.y} r="9" fill="none" stroke={c} strokeWidth="1">
                  <animate attributeName="r" values="9;15;9" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* core */}
              <circle cx={n.x} cy={n.y} r={sel ? 4.2 : 3.4} fill={c}
                      stroke="#FFFDF6" strokeOpacity="0.5" strokeWidth="0.6"
                      style={{ transition: 'r .2s ease' }} />
              {/* selection ring */}
              {sel && (
                <circle cx={n.x} cy={n.y} r="15" fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="3 3">
                  <animateTransform attributeName="transform" type="rotate"
                    from={`0 ${n.x} ${n.y}`} to={`360 ${n.x} ${n.y}`} dur="8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* low-battery tick */}
              {lowBat && <circle cx={n.x + 7} cy={n.y - 7} r="1.8" fill="#D89B2B" stroke="#FFFDF6" strokeWidth="0.4" />}
              {/* label */}
              <text x={n.x} y={n.y - (sel ? 15 : 12)} textAnchor="middle"
                    fill={sel ? c : '#8C9B91'} fillOpacity={sel ? 1 : 0.8}
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: sel ? 6.5 : 5.5, fontWeight: sel ? 700 : 500, letterSpacing: '0.04em', transition: 'fill-opacity .2s ease' }}>
                {n.id?.replace('P-', '')}
              </text>
            </g>
          );
        })}
      </svg>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="hud-label flex items-center gap-2"><Radio size={14} /> awaiting orchard telemetry…</div>
        </div>
      )}
    </div>
  );
};

export default PalmGridMap;
