// PalmPulseStrip — every palm as a compact vertical telemetry bar so judges see
// orchard health in one glance. Height = risk, color = status, pulsing cap = a
// live reading arrived recently.
const COLOR = { high: '#C94A3A', medium: '#C2A14D', low: '#19A66A', offline: '#8C9B91' };
const now = () => Math.floor(Date.now() / 1000);

const statusOf = (p) => {
  if (p.device_id == null) return 'offline';
  if (p.last_seen && now() - p.last_seen > 1800) return 'offline';
  return (p.classification || 'low');
};

export const PalmPulseStrip = ({ palms = [], onSelect }) => {
  if (!palms.length) {
    return <div className="hud-label py-6 text-center w-full">no palms registered</div>;
  }
  return (
    <div className="flex items-end gap-[3px] h-24 w-full overflow-x-auto pb-1">
      {palms.map((p) => {
        const s = statusOf(p);
        const color = COLOR[s] || COLOR.low;
        const risk = Math.max(6, Math.min(100, p.risk_score ?? 6));
        const fresh = p.last_seen && now() - p.last_seen < 20;
        return (
          <button
            key={p.id}
            onClick={() => onSelect?.(p)}
            title={`${p.id} · ${s} · risk ${Math.round(p.risk_score ?? 0)}${p.last_seen ? ` · seen ${Math.max(0, now() - p.last_seen)}s ago` : ''}`}
            className="focus-ring group relative flex-1 min-w-[6px] max-w-[18px] h-full flex flex-col justify-end"
          >
            {fresh && (
              <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full animate-heartbeat"
                    style={{ background: color }} />
            )}
            <span className="w-full rounded-sm transition-all group-hover:opacity-100 opacity-80"
                  style={{ height: `${risk}%`, background: color }} />
          </button>
        );
      })}
    </div>
  );
};

export default PalmPulseStrip;
