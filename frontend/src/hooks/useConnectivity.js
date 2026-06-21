import { useEffect, useState } from 'react';
import { onConnection } from '../socket.js';

// Tracks live-link + backend health so the dashboard can degrade visibly and
// recover WITHOUT a reload (Phase 3 resilience DoD):
//   - socketUp:  Socket.IO connected (false while reconnecting after a drop)
//   - backendUp: GET /api/v1/health succeeds (false when the backend is down)
// The ML service being down is handled server-side (heuristic fallback), so it
// never breaks the dashboard — readings just show a "heuristic" badge.
export const useConnectivity = () => {
  const [socketUp, setSocketUp] = useState(true);
  const [backendUp, setBackendUp] = useState(true);

  useEffect(() => {
    const off = onConnection(setSocketUp);
    let alive = true;
    const ping = async () => {
      try {
        const r = await fetch('/api/v1/health', { cache: 'no-store' });
        if (alive) setBackendUp(r.ok);
      } catch {
        if (alive) setBackendUp(false);
      }
    };
    ping();
    const i = setInterval(ping, 5000);
    return () => { alive = false; clearInterval(i); off(); };
  }, []);

  return { socketUp, backendUp };
};
