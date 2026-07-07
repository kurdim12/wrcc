// Living Orchard Map — a realistic top-down orchard plot (not an abstract
// topology diagram). Textured ground + planted rows/avenues + top-down palm
// canopies coloured by risk, a 50 m scale bar, an N compass, and a pulsing
// target ring on the selected palm. Pure SVG, offline-safe. An optional
// `orchardImageUrl` drops a real aerial photo behind the canopies.
import { useMemo } from 'react';
import { useDevices } from '../hooks/useDevices.js';

const VB_W = 320, VB_H = 200;
const PAD_X = 26, PAD_TOP = 22, PAD_BOT = 30;

const TONES = {
  high:    '#C94A3A',
  medium:  '#D89B2B',   // watch -> brand amber (distinct from gold)
  low:     '#2BBE82',
  offline: '#8C9B91',
};
const LEGEND = [
  ['low', 'Normal'], ['medium', 'Watch'], ['high', 'High Risk'], ['offline', 'Offline'],
];

const toneKey = (p) => {
  if (p.device_status && p.device_status !== 'online') return 'offline';
  return p.classification === 'high' ? 'high' : p.classification === 'medium' ? 'medium' : 'low';
};

// Top-down date-palm canopy: a ring of fronds + a centre, tinted by risk.
const Canopy = ({ x, y, r, tone, selected, dense, hasImg }) => {
  const c = TONES[tone];
  if (dense || hasImg) {
    const rr = hasImg ? r * 0.85 : r * 0.55;
    return (
      <g>
        {hasImg && <circle cx={x} cy={y} r={rr + 3} fill={c} fillOpacity="0.20" />}
        <circle cx={x} cy={y} r={rr} fill={c} fillOpacity={tone === 'low' ? 0.92 : 1} stroke="#06140E" strokeWidth="0.5" />
        {(selected || tone === 'high') && (
          <circle cx={x} cy={y} r={rr + 2} fill="none" stroke={c} strokeWidth="1">
            <animate attributeName="r" values={`${rr + 2};${rr + 8};${rr + 2}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.8;0;0.8" dur="2s" repeatCount="indefinite" />
          </circle>
        )}
        {selected && <circle cx={x} cy={y} r={rr + 5} fill="none" stroke={c} strokeWidth="1.2" strokeDasharray="3 3" />}
      </g>
    );
  }
  const fronds = 11;
  const lines = [];
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * Math.PI * 2 + (x + y) * 0.03;   // tiny per-tree rotation
    const len = r * (0.82 + ((i % 3) * 0.06));
    lines.push(
      <line key={i} x1={x} y1={y} x2={x + Math.cos(a) * len} y2={y + Math.sin(a) * len}
            stroke={tone === 'low' ? '#1F7A4D' : '#256B3D'} strokeOpacity="0.9" strokeWidth={r * 0.16} strokeLinecap="round" />
    );
  }
  return (
    <g>
      {/* canopy shadow for orthographic depth */}
      <ellipse cx={x + r * 0.18} cy={y + r * 0.22} rx={r * 0.95} ry={r * 0.8} fill="#02100A" fillOpacity="0.35" />
      {lines}
      {/* risk ring + core so status pops above the green canopy */}
      <circle cx={x} cy={y} r={r * 0.42} fill={c} fillOpacity={tone === 'low' ? 0.9 : 1} stroke="#06140E" strokeWidth="0.5" />
      {tone === 'offline' && <line x1={x - r * 0.3} y1={y - r * 0.3} x2={x + r * 0.3} y2={y + r * 0.3} stroke="#06140E" strokeWidth="0.7" />}
      {selected && (
        <>
          <circle cx={x} cy={y} r={r + 3} fill="none" stroke={c} strokeWidth="1.4" strokeDasharray="3 3">
            <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="9s" repeatCount="indefinite" />
          </circle>
          <circle cx={x} cy={y} r={r} fill="none" stroke={c} strokeWidth="1">
            <animate attributeName="r" values={`${r};${r + 7};${r}`} dur="2s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}
    </g>
  );
};

export const PalmGridMap = ({ palms = [], onSelectPalm, selectedPalm, height = 'h-[360px]', showLegend = true, orchardImageUrl }) => {
  const { devices } = useDevices();
  const devById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);

  const { nodes, maxR } = useMemo(() => {
    const withIdx = palms.map((p, i) => ({ ...p, _r: p.row_idx ?? Math.floor(i / 4), _c: p.col_idx ?? i % 4 }));
    const maxRow = Math.max(1, ...withIdx.map((p) => p._r));
    const maxCol = Math.max(1, ...withIdx.map((p) => p._c));
    const ns = withIdx.map((p) => {
      const dev = devById[p.device_id] || {};
      return {
        ...p, tone: toneKey(p), battery: dev.battery_pct,
        x: PAD_X + (p._c / maxCol) * (VB_W - 2 * PAD_X),
        y: PAD_TOP + (p._r / maxRow) * (VB_H - PAD_TOP - PAD_BOT),
      };
    });
    return { nodes: ns, maxR: maxRow };
  }, [palms, devById]);

  const dense = nodes.length > 110;
  const hasImg = !!orchardImageUrl;
  const r = dense ? 3.2 : nodes.length > 45 ? 5 : 7;
  const counts = nodes.reduce((m, n) => ((m[n.tone] = (m[n.tone] || 0) + 1), m), {});
  const rowYs = Array.from({ length: maxR + 1 }, (_, i) => PAD_TOP + (i / Math.max(1, maxR)) * (VB_H - PAD_TOP - PAD_BOT));
  const gw = { x: VB_W / 2, y: VB_H - 12 };

  return (
    <div className={`relative overflow-hidden rounded-xl ${height}`} style={{ border: '1px solid var(--cm-border)' }}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="soil"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n" />
            <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.06 0" /></filter>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1A2A16" /><stop offset="55%" stopColor="#16331E" /><stop offset="100%" stopColor="#10271A" />
          </linearGradient>
        </defs>

        {/* ground substrate */}
        {orchardImageUrl
          ? <>
              <image href={orchardImageUrl} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="#07110C" fillOpacity="0.40" />
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="#0C4030" fillOpacity="0.20" />
            </>
          : <>
              <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#ground)" />
              <rect x="0" y="0" width={VB_W} height={VB_H} filter="url(#soil)" />
              {/* planted rows (avenues) */}
              {rowYs.map((y, i) => (
                <rect key={i} x={PAD_X - 10} y={y - 4} width={VB_W - 2 * (PAD_X - 10)} height="8" rx="3"
                      fill="#3A4D2A" fillOpacity="0.14" />
              ))}
              {/* irrigation lines */}
              {Array.from({ length: 9 }, (_, i) => {
                const x = PAD_X + (i / 8) * (VB_W - 2 * PAD_X);
                return <line key={i} x1={x} y1={PAD_TOP - 6} x2={x} y2={VB_H - PAD_BOT + 6} stroke="#0A1E12" strokeOpacity="0.4" strokeWidth="0.5" />;
              })}
            </>}

        {/* gateway (subtle, no threads) */}
        <g opacity="0.7">
          <rect x={gw.x - 4} y={gw.y - 4} width="8" height="8" rx="1.5" transform={`rotate(45 ${gw.x} ${gw.y})`} fill="#0A5C44" stroke="#2BBE82" strokeWidth="0.9" />
          <text x={gw.x} y={gw.y + 11} textAnchor="middle" fill="#9DB0A8" style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 5, letterSpacing: '0.1em' }}>GATEWAY</text>
        </g>

        {/* palms */}
        {nodes.map((n) => (
          <g key={n.id} onClick={() => onSelectPalm?.(n)} style={{ cursor: 'pointer' }}>
            <circle cx={n.x} cy={n.y} r={r + 5} fill="transparent" />
            <Canopy x={n.x} y={n.y} r={r} tone={n.tone} selected={selectedPalm?.id === n.id} dense={dense} hasImg={hasImg} />
            {n.battery != null && n.battery < 25 && n.tone !== 'offline' &&
              <circle cx={n.x + r * 0.8} cy={n.y - r * 0.8} r="1.6" fill="#D89B2B" stroke="#06140E" strokeWidth="0.4" />}
            {(selectedPalm?.id === n.id) && (
              <text x={n.x} y={n.y - r - 5} textAnchor="middle" fill="#E9F1ED"
                    style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 6.5, fontWeight: 700 }}>{n.id}</text>
            )}
          </g>
        ))}

        {/* scale bar */}
        <g transform={`translate(${PAD_X - 8}, ${VB_H - 8})`}>
          <line x1="0" y1="0" x2="34" y2="0" stroke="#E9F1ED" strokeOpacity="0.7" strokeWidth="1" />
          <line x1="0" y1="-2" x2="0" y2="2" stroke="#E9F1ED" strokeOpacity="0.7" strokeWidth="1" />
          <line x1="34" y1="-2" x2="34" y2="2" stroke="#E9F1ED" strokeOpacity="0.7" strokeWidth="1" />
          <text x="17" y="-3" textAnchor="middle" fill="#C9D6CF" style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 5 }}>50 m</text>
        </g>

        {/* N compass */}
        <g transform={`translate(${VB_W - 16}, 16)`}>
          <circle r="7.5" fill="#0A130F" fillOpacity="0.6" stroke="#9DB0A8" strokeOpacity="0.4" strokeWidth="0.5" />
          <path d="M0,-5 L2.4,2 L0,0.4 L-2.4,2 Z" fill="#2BBE82" />
          <text x="0" y="-8.5" textAnchor="middle" fill="#C9D6CF" style={{ fontFamily: 'JetBrains Mono Variable, monospace', fontSize: 4.5, fontWeight: 700 }}>N</text>
        </g>
      </svg>

      {/* status chip */}
      <div className="absolute top-3 left-3 z-10 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
           style={{ background: 'rgba(8,17,14,0.66)', border: '1px solid rgba(160,180,170,0.18)', backdropFilter: 'blur(4px)' }}>
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#2BBE82' }} />
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: '#C9D6CF' }}>
          {nodes.length} palms{counts.high ? ` · ${counts.high} high risk` : ''}
        </span>
      </div>

      {/* legend */}
      {showLegend && (
        <div className="absolute top-3 right-3 z-10 px-3 py-2 rounded-lg space-y-1"
             style={{ background: 'rgba(8,17,14,0.66)', border: '1px solid rgba(160,180,170,0.18)', backdropFilter: 'blur(4px)' }}>
          <div className="text-[9px] font-bold tracking-[0.14em] mb-1" style={{ color: '#C2A14D' }}>RISK LEVEL</div>
          {LEGEND.map(([k, lbl]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: TONES[k] }} />
              <span className="text-[10px]" style={{ color: '#C9D6CF' }}>{lbl}</span>
              <span className="text-[10px] ml-auto" style={{ fontFamily: 'JetBrains Mono Variable, monospace', color: '#9DB0A8' }}>{counts[k] || 0}</span>
            </div>
          ))}
        </div>
      )}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px]" style={{ color: '#9DB0A8' }}>awaiting orchard telemetry…</span>
        </div>
      )}
    </div>
  );
};

export default PalmGridMap;
