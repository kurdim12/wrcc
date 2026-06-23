import { Signal, WifiOff, BatteryMedium, Radio, Cpu, Clock, Network as NetworkIcon } from 'lucide-react';
import { ConnectionThreadMap } from '../components/ConnectionThreadMap.jsx';
import { PageHeader, MetricTile, StatusPill, EmptyState } from '../components/ui/Primitives.jsx';
import { useDevices } from '../hooks/useDevices.js';

const now = () => Math.floor(Date.now() / 1000);
const STATUS_PILL = { online: 'online', idle: 'watch', offline: 'offline' };
const fmtAgo = (ts) => {
  if (!ts) return 'never';
  const d = now() - ts;
  if (d < 60) return `${d}s ago`; if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`; return `${Math.floor(d / 86400)}d ago`;
};

export const Network = ({ palms = [], onSelectPalm }) => {
  const { devices } = useDevices();
  const palmById = new Map(palms.map((p) => [p.device_id, p]));

  const stat = (d) => d.computed_status || d.status;
  const online = devices.filter((d) => stat(d) === 'online').length;
  const offline = devices.filter((d) => stat(d) === 'offline').length;
  const avg = (key) => {
    const vals = devices.map((d) => d[key]).filter((v) => v != null);
    return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };
  const avgBat = avg('battery_pct');
  const avgRssi = avg('rssi');

  return (
    <div className="space-y-5 stagger">
      <PageHeader title="Network" subtitle="Orchard nervous system — device connectivity, battery and link health." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile icon={Signal} label="Devices online" value={online} unit={`/ ${devices.length}`} status="forest" />
        <MetricTile icon={WifiOff} label="Offline" value={offline} status={offline > 0 ? 'crit' : 'muted'} />
        <MetricTile icon={BatteryMedium} label="Avg battery" value={avgBat ?? '—'} unit={avgBat != null ? '%' : ''} status={avgBat != null && avgBat < 30 ? 'caution' : 'forest'} />
        <MetricTile icon={Radio} label="Avg signal" value={avgRssi ?? '—'} unit={avgRssi != null ? 'dBm' : ''} status="muted" />
      </div>

      <ConnectionThreadMap palms={palms} devices={devices} onSelect={onSelectPalm} />

      <div className="instrument p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-muted/15 flex justify-between items-center">
          <h3 className="font-display tracking-tight text-[15px] font-semibold text-charcoal dark:text-bone">Mesh nodes</h3>
          <span className="telemetry-num text-xs text-muted">{devices.length} devices · {online} online</span>
        </div>
        {devices.length === 0 ? (
          <EmptyState icon={NetworkIcon} title="No nodes online" hint="Devices appear here as soon as they register with the gateway." />
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {devices.map((d) => {
              const s = d.computed_status || d.status || 'unknown';
              const palm = palmById.get(d.id);
              const clickable = !!palm;
              const batt = d.battery_pct;
              return (
                <div
                  key={d.id}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={() => clickable && onSelectPalm?.(palm)}
                  onKeyDown={(e) => { if (clickable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectPalm?.(palm); } }}
                  className={`instrument-inset p-3.5 flex flex-col gap-3 ${clickable ? 'lift focus-ring cursor-pointer' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-8 h-8 rounded-lg bg-forest/10 dark:bg-forest-400/10 text-forest-400 flex items-center justify-center shrink-0">
                        <Cpu size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="telemetry-num text-sm font-semibold text-charcoal dark:text-bone truncate">{d.id}</div>
                        <div className="hud-label">{d.palm_id ? `palm ${d.palm_id}` : 'unassigned'}</div>
                      </div>
                    </div>
                    <StatusPill status={STATUS_PILL[s] || 'neutral'}>{s}</StatusPill>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                    <Field label="battery">
                      <span className={`telemetry-num text-sm font-semibold ${
                        batt == null ? 'text-muted'
                        : batt < 20 ? 'text-crit'
                        : batt < 35 ? 'text-caution'
                        : 'text-forest-600 dark:text-forest-400'}`}>
                        {batt != null ? `${batt}%` : '—'}
                      </span>
                    </Field>
                    <Field label="rssi">
                      <span className="telemetry-num text-sm font-semibold text-charcoal dark:text-bone">
                        {d.rssi != null ? `${d.rssi} dBm` : '—'}
                      </span>
                    </Field>
                    <Field label="firmware">
                      <span className="telemetry-num text-xs text-muted truncate block">{d.fw_version || '—'}</span>
                    </Field>
                    <Field label="last seen">
                      <span className="telemetry-num text-xs text-muted inline-flex items-center gap-1">
                        <Clock size={11} /> {fmtAgo(d.last_seen)}
                      </span>
                    </Field>
                  </div>

                  {batt != null && (
                    <div className="h-1 rounded-full bg-muted/15 overflow-hidden" aria-hidden="true">
                      <span
                        className={`block h-full rounded-full ${
                          batt < 20 ? 'bg-crit' : batt < 35 ? 'bg-caution' : 'bg-forest-400'}`}
                        style={{ width: `${Math.max(2, Math.min(100, batt))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div className="flex flex-col gap-0.5">
    <span className="hud-label">{label}</span>
    {children}
  </div>
);

export default Network;
