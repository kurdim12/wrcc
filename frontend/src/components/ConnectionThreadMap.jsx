import { Radio } from 'lucide-react';

// ConnectionThreadMap — the orchard's nervous system: each node wired to the
// gateway by a thin signal thread whose opacity tracks link health. Engineering
// schematic, not cartoon roots.
const now = () => Math.floor(Date.now() / 1000);
const STATE = {
  online:  { c: '#19A66A', label: 'online' },
  idle:    { c: '#C2A14D', label: 'idle' },
  weak:    { c: '#D89B2B', label: 'weak' },
  offline: { c: '#8C9B91', label: 'offline' },
  lowbatt: { c: '#C94A3A', label: 'low battery' },
};

const nodeState = (p, dev) => {
  const seen = p.last_seen ?? dev?.last_seen;
  if (!seen || now() - seen > 1800) return 'offline';
  if ((dev?.battery_pct ?? 100) < 20) return 'lowbatt';
  if ((dev?.rssi ?? -60) < -82) return 'weak';
  if (now() - seen > 300) return 'idle';
  return 'online';
};

export const ConnectionThreadMap = ({ palms = [], devices = [], onSelect, height = 'h-[460px]' }) => {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const nodes = palms.filter((p) => p.device_id);
  const cols = Math.max(1, ...nodes.map((p) => (p.col_idx ?? 0) + 1));
  const rows = Math.max(1, ...nodes.map((p) => (p.row_idx ?? 0) + 1));
  const gw = { x: 50, y: 95 };

  const pos = (p, i) => {
    const col = p.col_idx ?? i % cols;
    const row = p.row_idx ?? Math.floor(i / cols);
    return { x: ((col + 0.5) / cols) * 92 + 4, y: ((row + 0.5) / rows) * 70 + 8 };
  };

  const counts = nodes.reduce((a, p) => { const s = nodeState(p, byId.get(p.device_id)); a[s] = (a[s] || 0) + 1; return a; }, {});

  const linkCount = nodes.length;

  return (
    <div className={`instrument scanlines relative ${height} overflow-hidden`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* signal threads */}
        {nodes.map((p, i) => {
          const s = nodeState(p, byId.get(p.device_id));
          const a = pos(p, i);
          const op = s === 'offline' ? 0.08 : s === 'weak' || s === 'idle' ? 0.22 : 0.4;
          return <line key={`l-${p.id}`} x1={a.x} y1={a.y} x2={gw.x} y2={gw.y}
                       stroke={STATE[s].c} strokeWidth="0.25" strokeOpacity={op} vectorEffect="non-scaling-stroke" />;
        })}
      </svg>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        {nodes.map((p, i) => {
          const dev = byId.get(p.device_id);
          const s = nodeState(p, dev);
          const a = pos(p, i);
          return (
            <g key={p.id} className="cursor-pointer group" onClick={() => onSelect?.(p)}>
              {/* hover/focus halo */}
              <circle cx={a.x} cy={a.y} r="3.4" fill="none" stroke={STATE[s].c} strokeWidth="0.4"
                      vectorEffect="non-scaling-stroke" className="opacity-0 group-hover:opacity-70 transition-opacity" />
              {s === 'online' && <circle cx={a.x} cy={a.y} r="2.6" fill={STATE[s].c} opacity="0.25" className="animate-heartbeat" />}
              <circle cx={a.x} cy={a.y} r="1.5" fill={STATE[s].c}>
                <title>{`${p.id} · ${STATE[s].label} · batt ${dev?.battery_pct ?? '?'}% · rssi ${dev?.rssi ?? '?'}`}</title>
              </circle>
            </g>
          );
        })}
        {/* gateway hub */}
        <g>
          <circle cx={gw.x} cy={gw.y} r="3.4" fill="none" stroke="#19A66A" strokeWidth="0.3" strokeOpacity="0.4" vectorEffect="non-scaling-stroke" />
          <circle cx={gw.x} cy={gw.y} r="2.2" fill="#0A5C44" stroke="#19A66A" strokeWidth="0.4" />
        </g>
      </svg>

      <div className="absolute top-3 left-4 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-forest/10 dark:bg-forest-400/10 text-forest-400 flex items-center justify-center"><Radio size={12} /></span>
        <span className="font-display tracking-tight text-[13px] font-semibold text-charcoal dark:text-bone">Orchard nervous system</span>
      </div>
      <div className="absolute top-3 right-4 cm-mono text-[10px] text-muted">{linkCount} {linkCount === 1 ? 'link' : 'links'}</div>

      <div className="absolute bottom-3 left-4 flex flex-wrap gap-x-3 gap-y-1.5">
        {Object.entries(STATE).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5 text-[10px] text-muted">
            <span className="w-2 h-2 rounded-full" style={{ background: v.c }} /> {v.label}
            {counts[k] ? <span className="cm-mono text-charcoal/70 dark:text-bone/70">({counts[k]})</span> : null}
          </span>
        ))}
      </div>
      <div className="absolute bottom-3 right-4 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: '#0A5C44', boxShadow: '0 0 0 1.5px rgba(25,166,106,0.6)' }} />
        <span className="hud-label">gateway</span>
      </div>
    </div>
  );
};

export default ConnectionThreadMap;
