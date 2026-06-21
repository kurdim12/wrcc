import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

/**
 * Subscribe to live readings for a specific device. Keeps an in-memory ring
 * of the last `keep` readings. Initial state is hydrated from the backend
 * history endpoint so charts have data even before the next reading lands.
 */
export const useLiveReadings = (deviceId, { keep = 200, since } = {}) => {
  const [readings, setReadings] = useState([]);
  const [latest, setLatest]     = useState(null);

  useEffect(() => {
    if (!deviceId) return;
    let mounted = true;

    api.readings({ device_id: deviceId, since: since ?? Math.floor(Date.now()/1000) - 3600, limit: keep })
      .then((rows) => { if (mounted) { setReadings(rows.reverse()); setLatest(rows[rows.length - 1] ?? null); } })
      .catch(() => {});

    const off = onEvent('live:reading', (r) => {
      if (r.device_id !== deviceId) return;
      setReadings(prev => {
        const next = [...prev, r];
        return next.length > keep ? next.slice(-keep) : next;
      });
      setLatest(r);
    });

    return () => { mounted = false; off(); };
  }, [deviceId, keep, since]);

  return { readings, latest };
};
