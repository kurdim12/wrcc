import { WifiOff, RefreshCw } from 'lucide-react';
import { useConnectivity } from '../hooks/useConnectivity.js';

// Thin top banner that appears only when degraded, and disappears on recovery
// (no reload). Backend-down takes precedence over a socket reconnect.
export const ConnectionBanner = () => {
  const { socketUp, backendUp } = useConnectivity();
  if (backendUp && socketUp) return null;

  const backendDown = !backendUp;
  const cls = backendDown
    ? 'bg-red-600 text-white'
    : 'bg-amber-500 text-black';
  const Icon = backendDown ? WifiOff : RefreshCw;
  const msg = backendDown
    ? 'Backend unreachable — retrying automatically. Showing last known data.'
    : 'Live link reconnecting — data may be a few seconds stale.';

  return (
    <div className={`w-full px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 ${cls}`}>
      <Icon size={14} className={backendDown ? '' : 'animate-spin'} />
      {msg}
    </div>
  );
};

export default ConnectionBanner;
