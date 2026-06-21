import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

export const useDevices = () => {
  const [devices, setDevices] = useState([]);
  const [error, setError]     = useState(null);

  const refresh = async () => {
    try { setDevices(await api.devices()); }
    catch (e) { setError(e); }
  };

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 10000);
    const off = onEvent('device:status', refresh);
    return () => { clearInterval(i); off(); };
  }, []);

  return { devices, error, refresh };
};
