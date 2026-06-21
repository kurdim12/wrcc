// Pulsing LIVE / DEMO badge used across the dashboard.
import { Radio, Beaker } from 'lucide-react';

export const LiveBadge = ({ mode = 'unknown', size = 'md' }) => {
  const isLive = mode === 'live';
  const isDemo = mode === 'demo';

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
    lg: 'text-sm px-3 py-1.5 gap-2',
  };

  if (isLive) {
    return (
      <span className={`inline-flex items-center font-bold uppercase tracking-widest rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 ${sizes[size]}`}>
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
        </span>
        LIVE
      </span>
    );
  }
  if (isDemo) {
    return (
      <span className={`inline-flex items-center font-bold uppercase tracking-widest rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 ${sizes[size]}`}>
        <Beaker size={12} /> DEMO
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-widest rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/30 ${sizes[size]}`}>
      <Radio size={12} /> ...
    </span>
  );
};

export default LiveBadge;
