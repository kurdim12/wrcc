// Status banner shown across the top of the dashboard.
import { Beaker, Cable, Radio } from 'lucide-react';

export const DemoModeBanner = ({ info }) => {
  if (!info || info.mode === 'unknown') {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-5 py-3 flex items-center gap-3 animate-fade-in-up">
        <Radio size={16} className="text-gray-400 animate-pulse" />
        <span className="text-sm text-gray-600 dark:text-gray-400">Connecting to backend...</span>
      </div>
    );
  }

  if (info.mode === 'live') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-300/60 dark:border-emerald-500/30 bg-gradient-to-r from-emerald-50 via-emerald-50/40 to-transparent dark:from-emerald-500/15 dark:via-emerald-500/5 dark:to-transparent backdrop-blur px-5 py-3 flex items-center gap-3 animate-fade-in-up">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <div className="text-sm flex-1 min-w-0">
          <span className="font-bold text-emerald-700 dark:text-emerald-300">LIVE</span>
          <span className="text-gray-700 dark:text-gray-300 ml-2">
            Streaming real sensor data from <strong>{info.live_devices ?? '?'}</strong> ESP32 device{(info.live_devices ?? 0) === 1 ? '' : 's'}.
          </span>
        </div>
      </div>
    );
  }

  // demo mode
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-300/60 dark:border-amber-500/30 bg-gradient-to-r from-amber-50 via-amber-50/40 to-transparent dark:from-amber-500/15 dark:via-amber-500/5 dark:to-transparent backdrop-blur px-5 py-3 flex items-center gap-3 animate-fade-in-up">
      <Beaker className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
      <div className="text-sm flex-1 min-w-0">
        <span className="font-bold text-amber-700 dark:text-amber-300">DEMO MODE</span>
        <span className="text-gray-700 dark:text-gray-300 ml-2">
          No ESP32 connected. Generating realistic simulated readings — flash an ESP32 from{' '}
          <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">firmware/palmguard-esp32s3</code>{' '}
          to see real data flow in.
        </span>
      </div>
      <Cable size={16} className="hidden md:block text-amber-600/60 dark:text-amber-400/60 shrink-0" />
    </div>
  );
};

export default DemoModeBanner;
