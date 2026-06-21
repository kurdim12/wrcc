// Tracks whether the backend is currently serving real ESP32 data ("live") or
// auto-falling back to its internal demo generator ("demo"). Updates instantly
// via the `system:mode` Socket.IO event, with a 5s polling fallback.
import { useEffect, useState } from 'react';
import { onEvent } from '../socket.js';

const DEFAULT = { mode: 'unknown', live_devices: 0, seconds_since_real: null, demo_active: false };

export const useSystemMode = () => {
  const [info, setInfo] = useState(DEFAULT);

  const refresh = async () => {
    try {
      const r = await fetch('/api/v1/system/mode');
      if (r.ok) setInfo(await r.json());
    } catch {}
  };

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    const off = onEvent('system:mode', (data) => setInfo(prev => ({ ...prev, ...data })));
    return () => { clearInterval(i); off(); };
  }, []);

  return info;
};
