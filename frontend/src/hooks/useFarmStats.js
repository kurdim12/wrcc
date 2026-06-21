import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

// Polls the farm-stats KPI endpoint every 5 s, plus refreshes on every
// `live:reading` event so the cards feel responsive without thrashing the API.
export const useFarmStats = () => {
  const [stats, setStats]   = useState(null);
  const [error, setError]   = useState(null);

  const refresh = async () => {
    try {
      const s = await api.farmStats();
      setStats(s);
    } catch (e) { setError(e); }
  };

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 5000);
    const off = onEvent('live:reading', refresh);
    return () => { clearInterval(i); off(); };
  }, []);

  return { stats, error, refresh };
};
