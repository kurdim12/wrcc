import PalmGridMap from '../components/PalmGridMap.jsx';
import Card from '../components/ui/Card.jsx';
import { useDevices } from '../hooks/useDevices.js';

const dotColor = (status) =>
  status === 'online' ? 'bg-green-500' :
  status === 'idle'   ? 'bg-yellow-500' :
  status === 'offline' ? 'bg-red-500'   : 'bg-gray-400';

const fmtAgo = (ts) => {
  if (!ts) return 'never';
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60)    return `${d}s ago`;
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

export const Network = ({ palms, onSelectPalm, selectedPalm }) => {
  const { devices } = useDevices();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <PalmGridMap palms={palms} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height="h-[450px] md:h-[500px]" />

      <Card className="p-0 overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">Mesh nodes</h3>
          <div className="text-sm text-gray-500 dark:text-gray-400">{devices.length} devices</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                <th className="p-4">Device</th>
                <th className="p-4">Status</th>
                <th className="p-4">Battery</th>
                <th className="p-4">RSSI</th>
                <th className="p-4">Firmware</th>
                <th className="p-4">Palm</th>
                <th className="p-4">Last seen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {devices.map(d => (
                <tr key={d.id} className="text-sm hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-gray-900 dark:text-white">{d.id}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 capitalize text-gray-700 dark:text-gray-300">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor(d.computed_status || d.status)}`} />
                      {d.computed_status || d.status}
                    </div>
                  </td>
                  <td className="p-4 font-mono text-gray-700 dark:text-gray-300">{d.battery_pct != null ? `${d.battery_pct}%` : '–'}</td>
                  <td className="p-4 font-mono text-gray-700 dark:text-gray-300">{d.rssi != null ? `${d.rssi} dBm` : '–'}</td>
                  <td className="p-4 font-mono text-gray-700 dark:text-gray-300">{d.fw_version || '–'}</td>
                  <td className="p-4 text-gray-700 dark:text-gray-300">{d.palm_id || <span className="italic text-gray-400 dark:text-gray-500">unassigned</span>}</td>
                  <td className="p-4 text-gray-500 dark:text-gray-400">{fmtAgo(d.last_seen)}</td>
                </tr>
              ))}
              {devices.length === 0 && (
                <tr><td colSpan={7} className="p-12 text-center text-gray-400 dark:text-gray-500">
                  <div className="text-sm font-bold mb-1">No devices registered yet</div>
                  <div className="text-xs">
                    Demo mode auto-generates two devices once the backend has been running for &gt; 60 s.
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Network;
