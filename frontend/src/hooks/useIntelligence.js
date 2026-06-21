import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

// Subscribes to the multi-sensor expert architecture for one device.
// Hydrates from REST (so the page isn't empty before the first socket tick),
// then stays live on `risk:fusion` + `agents:update`. Falls back to the
// highest-traffic demo node when no device is selected.
export function useIntelligence(deviceId) {
  const [intel, setIntel] = useState(null);
  const idRef = useRef(deviceId);
  idRef.current = deviceId;

  useEffect(() => {
    let alive = true;
    setIntel(null);

    const load = () => {
      const path = deviceId || 'PG-DEMO-101';
      api.intelligence(path)
        .then((r) => { if (alive && r && !r.error) setIntel(r); })
        .catch(() => {});
    };
    load();

    const matches = (d) => (deviceId ? d === deviceId : d === 'PG-DEMO-101');
    const offFusion = onEvent('risk:fusion', (f) => {
      if (!matches(f.device_id)) return;
      setIntel((prev) => ({ ...(prev || { device_id: f.device_id }), fusion: f, explanation: f.explanation ?? prev?.explanation }));
    });
    const offAgents = onEvent('agents:update', (a) => {
      if (!matches(a.device_id)) return;
      setIntel((prev) => ({ ...(prev || { device_id: a.device_id }), experts: a.experts, safety: a.safety, model: a.model }));
    });
    return () => { alive = false; offFusion(); offAgents(); };
  }, [deviceId]);

  return intel;
}

export default useIntelligence;
