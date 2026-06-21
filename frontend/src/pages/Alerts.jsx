import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Activity, Check, Syringe } from 'lucide-react';
import { Badge, severityType } from '../components/ui/Badge.jsx';
import { EvidenceStack } from '../components/EvidenceStack.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { useDoses } from '../hooks/useDoses.js';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const fmtAgo = (ts) => { if (!ts) return ''; const d = Math.floor(Date.now() / 1000) - ts; return d < 60 ? `${d}s ago` : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`; };
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
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-3">
        <div className="flex items-center gap-2"><AlertTriangle size={18} className="text-crit" /><h2 className="font-bold text-charcoal dark:text-bone">Alerts / Incidents</h2></div>
        <div className="flex gap-1 instrument p-1 overflow-x-auto">
          {FILTERS.map(([v, lbl]) => (
            <button key={v} onClick={() => setView(v)}
              className={`focus-ring px-3 py-1.5 rounded-md text-sm font-bold whitespace-nowrap transition-colors ${view === v ? 'bg-forest text-bone' : 'text-muted hover:text-charcoal dark:hover:text-bone'}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="instrument p-12 text-center hud-label">no {view === 'all' ? 'active' : view} incidents — orchard nominal</div>
      ) : (
        <div className="space-y-3">
          {shown.map((a) => {
            const crit = a.severity === 'critical';
            const ds = doseState[a.device_id];
            return (
              <div key={a.id} onClick={() => onAlertClick?.(a.device_id)}
                className="instrument p-4 cursor-pointer hover:border-forest-400/40 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${crit ? 'bg-crit/15 text-crit' : 'bg-caution/15 text-caution'}`}>
                    {crit ? <AlertTriangle size={20} /> : <Activity size={20} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-charcoal dark:text-bone telemetry-num">{a.device_id}</span>
                      <span className="hud-label instrument-inset px-1.5 py-0.5">{a.type}</span>
                      <Badge type={severityType(a.severity)} text={a.severity} />
                      {ds && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-caution/15 text-caution flex items-center gap-1"><Syringe size={10} /> dose {ds}</span>}
                      <span className="hud-label ml-auto">{fmtAgo(a.ts)}</span>
                    </div>
                    <p className="text-sm text-charcoal/80 dark:text-bone/80 mt-1">{a.message}</p>
                  </div>
                  {a.status === 'active' && (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={(e) => ack(e, a.id)} title="Acknowledge" className="focus-ring p-2 rounded-lg hover:bg-forest-400/10 text-forest-400"><Check size={16} /></button>
                      <button onClick={(e) => resolve(e, a.id)} title="Resolve" className="focus-ring p-2 rounded-lg hover:bg-forest-400/10 text-forest-400"><Check size={16} className="stroke-[3]" /></button>
                    </div>
                  )}
                </div>
                <div className="mt-3 instrument-inset px-3 py-1">
                  <div className="hud-label py-1">evidence trail</div>
                  <EvidenceStack reading={latest[a.device_id] || {}} action={ds ? { label: `Dose ${ds}`, status: ds === 'sent' ? 'watch' : 'pending' } : null} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Alerts;
