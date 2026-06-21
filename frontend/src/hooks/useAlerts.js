import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

export const useAlerts = (status = 'active') => {
  const [alerts, setAlerts] = useState([]);

  const refresh = async () => {
    try { setAlerts(await api.alerts(status, 200)); } catch {}
  };

  useEffect(() => {
    refresh();
    const off = onEvent('live:alert', () => refresh());
    const i = setInterval(refresh, 15000);
    return () => { off(); clearInterval(i); };
  }, [status]);

  return { alerts, refresh };
};
