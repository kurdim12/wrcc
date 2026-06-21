import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

// Dose history + live lifecycle updates. Optionally scoped to one device.
export const useDoses = (deviceId = null) => {
  const [doses, setDoses] = useState([]);

  const refresh = async () => {
    try { setDoses(await api.doses(deviceId)); } catch {}
  };

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 10000);
    const off1 = onEvent('dose:update',  refresh);
    const off2 = onEvent('dose:pending', refresh);
    return () => { clearInterval(i); off1(); off2(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  return { doses, refresh };
};
