// Status banner shown across the top of the dashboard.
import { Beaker, Cable, Radio } from 'lucide-react';

export const DemoModeBanner = ({ info }) => {
  if (!info || info.mode === 'unknown') {
    return (
      <div className="rounded-2xl border border-black/10 dark:border-white/8 bg-bone dark:bg-ink-800 px-5 py-3 flex items-center gap-3 animate-fade-in-up">
        <Radio size={16} className="text-muted animate-pulse" />
        <span className="text-sm text-gray-600 dark:text-muted">Connecting to backend...</span>
      </div>
    );
  }

  if (info.mode === 'live') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-[#43C76E]/40 dark:border-[#43C76E]/30 bg-gradient-to-r from-[#43C76E]/10 via-[#43C76E]/[0.04] to-transparent dark:from-[#43C76E]/15 dark:via-[#43C76E]/5 dark:to-transparent backdrop-blur px-5 py-3 flex items-center gap-3 animate-fade-in-up">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#43C76E] opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[#43C76E]" />
        </span>
        <div className="text-sm flex-1 min-w-0">
          <span className="font-bold cm-display text-[#2BAE5E] dark:text-[#43C76E]">LIVE</span>
          <span className="text-gray-700 dark:text-bone/85 ml-2">
            Streaming real sensor data from <strong>{info.live_devices ?? '?'}</strong> ESP32 device{(info.live_devices ?? 0) === 1 ? '' : 's'}.
          </span>
        </div>
      </div>
    );
  }

  // demo mode
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#F0B040]/50 dark:border-[#F0B040]/30 bg-gradient-to-r from-[#F0B040]/10 via-[#F0B040]/[0.04] to-transparent dark:from-[#F0B040]/15 dark:via-[#F0B040]/5 dark:to-transparent backdrop-blur px-5 py-3 flex items-center gap-3 animate-fade-in-up">
      <Beaker className="w-5 h-5 text-[#C98A1E] dark:text-[#F0B040] shrink-0 animate-pulse" />
      <div className="text-sm flex-1 min-w-0">
        <span className="font-bold cm-display text-[#B57A12] dark:text-[#F0B040]">DEMO MODE</span>
        <span className="text-gray-700 dark:text-bone/85 ml-2">
          No ESP32 connected. Generating realistic simulated readings — flash an ESP32 from{' '}
          <code className="font-mono text-[11px] bg-[#F0B040]/15 dark:bg-[#F0B040]/15 text-[#B57A12] dark:text-[#F0B040] px-1.5 py-0.5 rounded">firmware/palmguard-esp32s3</code>{' '}
          to see real data flow in.
        </span>
      </div>
      <Cable size={16} className="hidden md:block text-[#C98A1E]/70 dark:text-[#F0B040]/60 shrink-0" />
    </div>
  );
};

export default DemoModeBanner;
