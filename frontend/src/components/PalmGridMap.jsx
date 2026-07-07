// Living Orchard Command Map — a calm, instrument-style plot of the orchard.
// Replaces the old noisy satellite/polka-dot view. Palms are laid out on their
// row/col grid as engineered risk glyphs (halo + core), wired to a gateway, with
// a legend and low-battery/offline hints. SVG so it scales crisply to any panel.
import { useMemo } from 'react';
import { Radio } from 'lucide-react';
import { useDevices } from '../hooks/useDevices.js';

const VB_W = 320, VB_H = 200;
const PAD_X = 30, PAD_TOP = 26, PAD_BOT = 46;   // bottom room for the gateway

const TONES = {
  high:    '#EE5A48',
  medium:  '#F0B040',
  low:     '#43C76E',
  offline: '#98A69D',
};
const LEGEND = [
  ['low', 'healthy'], ['medium', 'watch'], ['high', 'critical'], ['offline', 'offline / stale'],
];

const toneKey = (p) => {
  if (p.device_status && p.device_status !== 'online') return 'offline';
  return p.classification === 'high' ? 'high' : p.classification === 'medium' ? 'medium' : 'low';
};

export const PalmGridMap = ({ palms = [], onSelectPalm, selectedPalm, height = 'h-[360px]', showLegend = true }) => {
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
    <div className={`relative overflow-hidden rounded-[12px] ${height}`}
         style={{ background: '#121710' }}>
      {/* status chip */}
      <div className="absolute top-3 left-3 z-10 cm-glass px-3 py-1.5 flex items-center gap-2">
        <Radio size={12} style={{ color: '#43C76E' }} />
        <span className="cm-mono text-[10px] tracking-[0.12em] uppercase cm-ink">
          {nodes.length} palms · 1 gateway{counts.high ? ` · ${counts.high} critical` : ''}
        </span>
      </div>

      {/* legend */}
      {showLegend && (
        <div className="absolute top-3 right-3 z-10 cm-glass px-3 py-2 space-y-1">
          {LEGEND.map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONES[k], boxShadow: `0 0 8px ${TONES[k]}66` }} />
              <span className="text-[10px] tracking-[0.08em] uppercase cm-muted font-semibold">{lbl}</span>
              <span className="cm-mono text-[10px] cm-ink ml-auto font-semibold">{counts[k] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {/* aerial-orchard vignette + glow (above plot, below chips) */}
      <div className="absolute inset-0 z-[5] pointer-events-none cm-map-vignette" />

      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* aerial orchard — soil base + dense tree-crown grid + access paths */}
          <radialGradient id="crown" cx="46%" cy="38%" r="60%">
            <stop offset="0%" stopColor="#3F7044" />
            <stop offset="55%" stopColor="#27502E" />
            <stop offset="100%" stopColor="#18331F" stopOpacity="0.9" />
          </radialGradient>
          <pattern id="grove" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#121710" />
            <circle cx="7" cy="7" r="5.3" fill="url(#crown)" />
          </pattern>
          <pattern id="grove2" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="translate(7,7)">
            <circle cx="7" cy="7" r="2.9" fill="#356039" fillOpacity="0.4" />
          </pattern>
          <pattern id="paths" width="84" height="84" patternUnits="userSpaceOnUse">
            <path d="M0 0H84" stroke="#6E6038" strokeOpacity="0.15" strokeWidth="3.2" />
            <path d="M0 0V84" stroke="#6E6038" strokeOpacity="0.11" strokeWidth="2.6" />
          </pattern>
          <radialGradient id="vig" cx="50%" cy="44%" r="78%">
            <stop offset="56%" stopColor="#04070A" stopOpacity="0" />
            <stop offset="100%" stopColor="#04070A" stopOpacity="0.62" />
          </radialGradient>
          <radialGradient id="gw-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#43C76E" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#43C76E" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* aerial orchard backdrop */}
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="#121710" />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#grove)" />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#grove2)" />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#paths)" />
        <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#vig)" />

        {/* signal threads node → gateway */}
        {nodes.map((n) => (
          <line key={`l-${n.id}`} x1={n.x} y1={n.y} x2={gw.x} y2={gw.y}
                stroke={n.tone === 'offline' ? '#98A69D' : TONES[n.tone]}
                strokeOpacity={n.tone === 'offline' ? 0.06 : 0.14} strokeWidth="0.6"
                strokeDasharray={n.tone === 'offline' ? '2 3' : undefined} />
        ))}

        {/* gateway / base station */}
        <circle cx={gw.x} cy={gw.y} r="22" fill="url(#gw-glow)" />
        <rect x={gw.x - 6} y={gw.y - 6} width="12" height="12" rx="2" transform={`rotate(45 ${gw.x} ${gw.y})`}
              fill="#0E3322" stroke="#43C76E" strokeWidth="1.3" />
        <circle cx={gw.x} cy={gw.y} r="2.4" fill="#4ED68A" />
        <text x={gw.x} y={gw.y + 16} textAnchor="middle" fill="#9FB0A6"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 6, letterSpacing: '0.14em' }}>GATEWAY</text>

        {/* palm nodes */}
        {nodes.map((n) => {
          const c = TONES[n.tone];
          const sel = selectedPalm?.id === n.id;
          const crit = n.tone === 'high';
          const lowBat = n.battery != null && n.battery < 25 && n.tone !== 'offline';
          return (
            <g key={n.id} onClick={() => onSelectPalm?.(n)} style={{ cursor: 'pointer' }}>
              {/* generous invisible hit area */}
              <circle cx={n.x} cy={n.y} r="13" fill="transparent" />
              {/* dark seat — keeps the marker legible over the canopy */}
              <circle cx={n.x} cy={n.y} r={sel ? 9.5 : 7.5} fill="#070B08" fillOpacity="0.5" />
              {/* halo */}
              <circle cx={n.x} cy={n.y} r={sel ? 11 : 9} fill={c} fillOpacity={crit ? 0.18 : 0.12} />
              <circle cx={n.x} cy={n.y} r={sel ? 11 : 9} fill="none" stroke={c}
                      strokeOpacity={n.tone === 'offline' ? 0.5 : 0.85} strokeWidth={sel ? 1.6 : 1.1} />
              {crit && (
                <circle cx={n.x} cy={n.y} r="9" fill="none" stroke={c} strokeWidth="1">
                  <animate attributeName="r" values="9;15;9" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* core */}
              <circle cx={n.x} cy={n.y} r={sel ? 4.2 : 3.4} fill={c}
                      stroke="#FFFDF6" strokeOpacity="0.5" strokeWidth="0.6" />
              {/* selected: radiating rings + emphasis ring */}
              {sel && (
                <>
                  {[0, 1].map((k) => (
                    <circle key={k} cx={n.x} cy={n.y} r="6" fill="none" stroke={c} strokeWidth="1.1">
                      <animate attributeName="r" values="6;17" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                      <animate attributeName="stroke-opacity" values="0.7;0" dur="2.4s" begin={`${k * 1.2}s`} repeatCount="indefinite" />
                    </circle>
                  ))}
                  <circle cx={n.x} cy={n.y} r="13" fill="none" stroke={c} strokeOpacity="0.9" strokeWidth="1.4" />
                </>
              )}
              {/* low-battery tick */}
              {lowBat && <circle cx={n.x + 7} cy={n.y - 7} r="1.8" fill="#F0B040" stroke="#121710" strokeWidth="0.5" />}
              {/* label — callout pill when selected, faint tag otherwise */}
              {sel ? (
                <g transform={`translate(${n.x}, ${n.y - 18})`}>
                  <rect x="-16" y="-7.5" width="32" height="12.5" rx="3.5" fill="#0E1312" stroke={c} strokeOpacity="0.9" strokeWidth="0.7" />
                  <text x="0" y="1.4" textAnchor="middle" fill="#ECEBE1"
                        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 6.2, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {n.id?.replace('P-', '')}
                  </text>
                </g>
              ) : (
                <text x={n.x} y={n.y - 11} textAnchor="middle" fill="#C8D3CC" fillOpacity="0.7"
                      style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 5.2, fontWeight: 500 }}>
                  {n.id?.replace('P-', '')}
                </text>
              )}
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
