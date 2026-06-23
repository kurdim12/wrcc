import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { IncidentCard } from '../components/IncidentCard.jsx';
import { PageHeader, EmptyState, StatusPill } from '../components/ui/Primitives.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { useDoses } from '../hooks/useDoses.js';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const FILTERS = [['all', 'All'], ['critical', 'Critical'], ['watch', 'Watch'], ['dosing', 'Dosing pending'], ['resolved', 'Resolved']];
const sevColor = (s) => (s === 'critical' ? '#C94A3A' : s === 'warning' ? '#D89B2B' : '#C2A14D');

// Bucket incidents into a human timeline.
const now = () => Math.floor(Date.now() / 1000);
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); };
const bucketOf = (ts) => {
  const t0 = startOfToday();
  if (!ts) return 'Earlier';
  if (ts >= t0) return 'Today';
  if (ts >= t0 - 86400) return 'Yesterday';
  if (ts >= t0 - 6 * 86400) return 'This week';
  return 'Earlier';
};
const ORDER = ['Today', 'Yesterday', 'This week', 'Earlier'];

export const Alerts = ({ onAlertClick, showToast }) => {
  const [view, setView] = useState('all');
  const { alerts, refresh } = useAlerts(view === 'resolved' ? 'resolved' : 'active');
  const { doses } = useDoses();
  const [latest, setLatest] = useState({});

  useEffect(() => {
    const load = () => api.readingsLatest().then((rows) => setLatest(Object.fromEntries(rows.map((r) => [r.device_id, r])))).catch(() => {});
    load();
    const off = onEvent('live:reading', (r) => setLatest((m) => ({ ...m, [r.device_id]: { ...m[r.device_id], ...r } })));
    return off;
  }, []);

  const doseState = useMemo(() => {
    const m = {};
    for (const d of doses) if (['pending', 'sent'].includes(d.status)) m[d.device_id] = d.status;
    return m;
  }, [doses]);

  const shown = useMemo(() => alerts.filter((a) => {
    if (view === 'critical') return a.severity === 'critical';
    if (view === 'watch') return a.severity === 'warning';
    if (view === 'dosing') return !!doseState[a.device_id];
    return true;
  }).slice().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)), [alerts, view, doseState]);

  // Group the (already newest-first) incidents into timeline buckets.
  const groups = useMemo(() => {
    const m = {};
    for (const a of shown) { const b = bucketOf(a.ts); (m[b] ||= []).push(a); }
    return ORDER.filter((k) => m[k]?.length).map((k) => ({ label: k, items: m[k] }));
  }, [shown]);

  const ack = async (e, id) => { e.stopPropagation(); try { await api.ackAlert(id); showToast?.('Incident acknowledged', 'success'); refresh(); } catch (err) { showToast?.(err.message, 'warning'); } };
  const resolve = async (e, id) => { e.stopPropagation(); try { await api.resolveAlert(id); showToast?.('Incident resolved', 'success'); refresh(); } catch (err) { showToast?.(err.message, 'warning'); } };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader title="Incidents"
        subtitle="A timeline of what needs attention — newest first. Review, acknowledge, and resolve events."
        actions={
          <div className="flex gap-1 instrument p-1 overflow-x-auto">
            {FILTERS.map(([v, lbl]) => (
              <button key={v} onClick={() => setView(v)}
                className={`focus-ring px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${view === v ? 'bg-forest text-bone' : 'text-muted hover:text-charcoal dark:hover:text-bone'}`}>{lbl}</button>
            ))}
          </div>
        } />

      {shown.length === 0 ? (
        <div className="instrument"><EmptyState icon={AlertTriangle} title="Orchard nominal" hint={`No ${view === 'all' ? 'active' : view} incidents right now.`} /></div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-3">
                <span className="hud-label">{g.label}</span>
                <span className="h-px flex-1 bg-muted/15" />
                <StatusPill status={view === 'resolved' ? 'safe' : 'pending'} dot={false}>
                  {g.items.length} {view === 'resolved' ? 'resolved' : 'active'}
                </StatusPill>
              </div>
              <div className="relative ml-2 pl-6 border-l-2 border-muted/15 space-y-3">
                {g.items.map((a) => (
                  <div key={a.id} className="relative">
                    <span className="absolute -left-[30px] top-5 w-3 h-3 rounded-full ring-4 ring-bone dark:ring-ink-900"
                          style={{ background: sevColor(a.severity) }} />
                    <IncidentCard
                      alert={a}
                      doseStatus={doseState[a.device_id]}
                      reading={latest[a.device_id] || {}}
                      onClick={() => onAlertClick?.(a.device_id)}
                      onAck={ack}
                      onResolve={resolve}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
