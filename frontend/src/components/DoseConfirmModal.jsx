import { useEffect, useState } from 'react';
import { Syringe, AlertTriangle, X, ShieldCheck, Droplets } from 'lucide-react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';
import { useSystemMode } from '../hooks/useSystemMode.js';
import { ModelCaveatBadge } from './ModelCaveatBadge.jsx';

// The human-in-the-loop gate (§2/§10.4/§11.2). Impossible to misunderstand:
// shows the controlled-dose parameters, the model caveat, and live/demo context.
// A dose is NEVER auto-released here — the operator decides.
export const DoseConfirmModal = ({ showToast }) => {
  const [queue, setQueue] = useState([]);
  const [busy, setBusy] = useState(false);
  const { mode } = useSystemMode();
  const isLive = mode === 'live';

  const dedupe = (list) => {
    const seen = new Set(); const out = [];
    for (const d of list) if (!seen.has(d.id)) { seen.add(d.id); out.push(d); }
    return out;
  };

  useEffect(() => {
    api.doses().then((all) => setQueue(dedupe(all.filter((d) => d.status === 'pending')))).catch(() => {});
    const offPending = onEvent('dose:pending', (d) => {
      setQueue((q) => dedupe([...q, d]));
      showToast?.(`Treatment gate: dose pending on ${d.device_id}`, 'warning');
    });
    const offUpdate = onEvent('dose:update', (d) => {
      if (d.status !== 'pending') setQueue((q) => q.filter((x) => x.id !== d.id));
    });
    return () => { offPending(); offUpdate(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dose = queue[0];
  if (!dose) return null;

  const act = async (fn, verb) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r && r.error) showToast?.(`Dose ${verb} blocked: ${r.reason || r.error}`, 'warning');
      else showToast?.(`Dose ${verb} on ${dose.device_id}`, 'success');
    } catch (e) { showToast?.(`Dose ${verb} failed: ${e.message}`, 'warning'); }
    finally { setQueue((q) => q.filter((x) => x.id !== dose.id)); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink-900/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md instrument overflow-hidden border-crit/40">
        <div className="bg-crit text-bone px-5 py-4 flex items-center gap-3">
          <Syringe size={22} />
          <div>
            <div className="font-bold text-lg leading-tight">Confirm Controlled Dose</div>
            <div className="text-bone/80 text-xs hud-label">human approval required · treatment gate</div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Field label="Device" value={dose.device_id} />
            <Field label="Source" value={dose.source} />
            <Field label="Fused risk" value={dose.trigger_risk != null ? Math.round(dose.trigger_risk) : 'Manual request'} />
            <Field label="Pump / volume" value={`${dose.pump_ms} ms · ≈ ${dose.volume_ml_est} ml`} />
          </div>

          <div className="flex items-center justify-between instrument-inset px-3 py-2">
            <span className="hud-label">model</span>
            <ModelCaveatBadge size="xs" />
          </div>

          <div className={`flex items-start gap-2 text-xs rounded-lg p-3 border ${
            isLive ? 'bg-crit/10 text-crit border-crit/30' : 'bg-gold/10 text-gold border-gold/30'}`}>
            {isLive ? <AlertTriangle size={16} className="shrink-0 mt-0.5" /> : <Droplets size={16} className="shrink-0 mt-0.5" />}
            <span>
              {isLive
                ? 'LIVE MODE. Confirm only after physical inspection or an approved field protocol. The model score is not a standalone pesticide decision; a false dose harms a healthy palm.'
                : 'WRCC demo mode: clear water only. The model score is an acoustic activity estimate (proxy/heuristic), not a standalone pesticide decision.'}
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <button disabled={busy} onClick={() => act(() => api.cancelDose(dose.id), 'cancelled')}
              className="focus-ring flex-1 py-3 rounded-lg font-bold border border-muted/30 text-charcoal dark:text-bone hover:bg-muted/10 disabled:opacity-50 flex items-center justify-center gap-2">
              <X size={18} /> Cancel
            </button>
            <button disabled={busy} onClick={() => act(() => api.confirmDose(dose.id, 'operator'), 'confirmed')}
              className="focus-ring flex-1 py-3 rounded-lg font-bold bg-crit text-bone hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
              <ShieldCheck size={18} /> {isLive ? 'Confirm dose' : 'Confirm clear-water dose'}
            </button>
          </div>
          {queue.length > 1 && <div className="text-center hud-label">{queue.length - 1} more pending</div>}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="instrument-inset px-3 py-2">
    <div className="hud-label">{label}</div>
    <div className="telemetry-num text-base font-bold text-charcoal dark:text-bone capitalize">{value}</div>
  </div>
);

export default DoseConfirmModal;
