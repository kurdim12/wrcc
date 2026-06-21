// Tiny fetch wrapper for the Palm Guard REST API. All endpoints live under
// /api/v1/*; in dev Vite proxies them to the Node backend on :4000.

const BASE = '/api/v1';

const json = async (path, opts = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status} ${path}: ${text || res.statusText}`);
  }
  // CSV/text endpoints return non-JSON
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
};

export const api = {
  health:        () => json('/health'),

  // Devices
  devices:       () => json('/devices').then(d => d.devices),
  device:        (id) => json(`/devices/${id}`).then(d => d.device),
  upsertDevice:  (body) => json('/devices', { method: 'POST', body: JSON.stringify(body) }),

  // Dosing (human-in-the-loop): arm/disarm, edit caps, manual request, confirm/cancel.
  armDevice:     (id, armed) => json(`/devices/${id}/arm`,
                    { method: 'POST', body: JSON.stringify({ armed }) }),
  setDosePolicy: (id, body) => json(`/devices/${id}/policy`,
                    { method: 'PATCH', body: JSON.stringify(body) }),
  requestDose:   (id, by) => json(`/devices/${id}/dose`,
                    { method: 'POST', body: JSON.stringify({ requested_by: by }) }),
  doses:         (deviceId) => json(`/doses${deviceId ? `?device_id=${deviceId}` : ''}`).then(d => d.doses),
  confirmDose:   (id, by) => json(`/doses/${id}/confirm`,
                    { method: 'POST', body: JSON.stringify({ confirmed_by: by }) }),
  cancelDose:    (id) => json(`/doses/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }),

  // Palms
  palms:         () => json('/palms').then(d => d.palms),
  palm:          (id) => json(`/palms/${id}`).then(d => d.palm),
  createPalm:    (body) => json('/palms', { method: 'POST', body: JSON.stringify(body) }),

  // Readings
  readingsLatest: () => json('/readings/latest').then(d => d.readings),
  readings:      (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return json(`/readings${q ? '?' + q : ''}`).then(d => d.readings);
  },

  // Alerts
  alerts:        (status = 'active', limit = 200) =>
    json(`/alerts?status=${status}&limit=${limit}`).then(d => d.alerts),
  alertCounts:   () => json('/alerts/counts'),
  ackAlert:      (id) => json(`/alerts/${id}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'acknowledged' })
  }),
  resolveAlert:  (id) => json(`/alerts/${id}`, {
    method: 'PATCH', body: JSON.stringify({ status: 'resolved' })
  }),

  // Stats
  farmStats:     () => json('/stats/farm'),
  riskTrends:    (days = 30) => json(`/stats/risk-trends?days=${days}`).then(d => d.points),
  tempBuckets:   () => json('/stats/temperature-distribution').then(d => d.buckets),

  // Reports
  reportsList:   () => json('/reports/list').then(d => d.reports),
  reportUrl:     (id) => `${BASE}/reports/${id}.csv`,

  // AI Chat (OpenRouter)
  chatStatus:    () => json('/chat/status'),
  chat:          (body) => json('/chat', { method: 'POST', body: JSON.stringify(body) }),
};
