import { Signal, WifiOff, BatteryMedium, Radio } from 'lucide-react';
import { ConnectionThreadMap } from '../components/ConnectionThreadMap.jsx';
import { PageHeader, MetricTile } from '../components/ui/Primitives.jsx';
import { useDevices } from '../hooks/useDevices.js';

const now = () => Math.floor(Date.now() / 1000);
const dotColor = (s) => (s === 'online' ? 'bg-forest-400' : s === 'idle' ? 'bg-gold' : s === 'offline' ? 'bg-crit' : 'bg-muted');
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
    <div className="space-y-5 animate-fade-in-up">
      <PageHeader title="Network" subtitle="Orchard nervous system — device connectivity, battery and link health." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile icon={Signal} label="Devices online" value={online} unit={`/ ${devices.length}`} status="forest" />
        <MetricTile icon={WifiOff} label="Offline" value={offline} status={offline > 0 ? 'crit' : 'muted'} />
        <MetricTile icon={BatteryMedium} label="Avg battery" value={avgBat ?? '—'} unit={avgBat != null ? '%' : ''} status={avgBat != null && avgBat < 30 ? 'caution' : 'forest'} />
        <MetricTile icon={Radio} label="Avg signal" value={avgRssi ?? '—'} unit={avgRssi != null ? 'dBm' : ''} status="muted" />
      </div>

      <ConnectionThreadMap palms={palms} devices={devices} onSelect={onSelectPalm} />

      <div className="instrument p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-muted/15 flex justify-between items-center">
          <span className="hud-label">mesh nodes</span>
          <span className="telemetry-num text-xs text-muted">{devices.length} devices · {devices.filter((d) => (d.computed_status || d.status) === 'online').length} online</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead><tr className="hud-label border-b border-muted/10">
              <th className="p-4">Device</th><th className="p-4">Status</th><th className="p-4">Battery</th>
              <th className="p-4">RSSI</th><th className="p-4">Firmware</th><th className="p-4">Palm</th><th className="p-4">Last seen</th>
            </tr></thead>
            <tbody>
              {devices.map((d) => {
                const s = d.computed_status || d.status || 'unknown';
                const palm = palmById.get(d.id);
                return (
                  <tr key={d.id} onClick={() => palm && onSelectPalm?.(palm)}
                      className="border-b border-muted/8 hover:bg-muted/5 cursor-pointer">
                    <td className="p-4 font-semibold text-charcoal dark:text-bone telemetry-num">{d.id}</td>
                    <td className="p-4"><span className="flex items-center gap-2"><span className={`w-2 h-2 rounded-full ${dotColor(s)}`} /><span className="capitalize text-muted">{s}</span></span></td>
                    <td className="p-4 telemetry-num">{d.battery_pct != null ? `${d.battery_pct}%` : '—'}</td>
                    <td className="p-4 telemetry-num">{d.rssi != null ? `${d.rssi} dBm` : '—'}</td>
                    <td className="p-4 telemetry-num text-xs text-muted">{d.fw_version || '—'}</td>
                    <td className="p-4">{d.palm_id || '—'}</td>
                    <td className="p-4 telemetry-num text-xs text-muted">{fmtAgo(d.last_seen)}</td>
                  </tr>
                );
              })}
              {devices.length === 0 && <tr><td colSpan={7} className="p-8 text-center hud-label">no nodes online</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Network;
