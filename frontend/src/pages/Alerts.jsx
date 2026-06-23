import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { IncidentCard } from '../components/IncidentCard.jsx';
import { PageHeader, EmptyState } from '../components/ui/Primitives.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { useDoses } from '../hooks/useDoses.js';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const FILTERS = [['all', 'All'], ['critical', 'Critical'], ['watch', 'Watch'], ['dosing', 'Dosing pending'], ['resolved', 'Resolved']];

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
  }), [alerts, view, doseState]);

  const ack = async (e, id) => { e.stopPropagation(); try { await api.ackAlert(id); showToast?.('Incident acknowledged', 'success'); refresh(); } catch (err) { showToast?.(err.message, 'warning'); } };
  const resolve = async (e, id) => { e.stopPropagation(); try { await api.resolveAlert(id); showToast?.('Incident resolved', 'success'); refresh(); } catch (err) { showToast?.(err.message, 'warning'); } };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader title="Incidents"
        subtitle="What needs attention — review, acknowledge, and resolve events."
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
        <div className="space-y-3">
          {shown.map((a) => (
            <IncidentCard
              key={a.id}
              alert={a}
              doseStatus={doseState[a.device_id]}
              reading={latest[a.device_id] || {}}
              onClick={() => onAlertClick?.(a.device_id)}
              onAck={ack}
              onResolve={resolve}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Alerts;
