import { useEffect, useState } from 'react';
import { Syringe, AlertTriangle, X, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

// The human-in-the-loop gate (§2/§10.4/§11.2). When a dose goes 'pending' the
// backend emits dose:pending; we raise an unmissable modal showing the tree,
// fused risk, P(activity), and Confirm / Cancel. A dose is NEVER auto-released
// here — the operator decides. (auto_confirm is a backend demo policy, separate.)
export const DoseConfirmModal = ({ showToast }) => {
  const [queue, setQueue] = useState([]);   // pending doses awaiting a decision
  const [busy, setBusy] = useState(false);

  const dedupe = (list) => {
    const seen = new Set(); const out = [];
    for (const d of list) { if (!seen.has(d.id)) { seen.add(d.id); out.push(d); } }
    return out;
  };

  useEffect(() => {
    // Hydrate any already-pending doses (survives a page refresh).
    api.doses().then((all) => setQueue(dedupe(all.filter((d) => d.status === 'pending')))).catch(() => {});

    const offPending = onEvent('dose:pending', (d) => {
      setQueue((q) => dedupe([...q, d]));
      showToast?.(`Dose pending on ${d.device_id} — confirmation required`, 'warning');
    });
    // Remove from the queue once it leaves 'pending' (confirmed/cancelled elsewhere).
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
      if (r && r.error) showToast?.(`Dose ${verb} rejected: ${r.reason || r.error}`, 'warning');
      else showToast?.(`Dose ${verb} on ${dose.device_id}`, 'success');
    } catch (e) {
      showToast?.(`Dose ${verb} failed: ${e.message}`, 'warning');
    } finally {
      setQueue((q) => q.filter((x) => x.id !== dose.id));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
        <div className="bg-red-600 text-white px-6 py-4 flex items-center gap-3">
          <Syringe size={22} />
          <div>
            <div className="font-bold text-lg leading-tight">Confirm treatment dose</div>
            <div className="text-red-100 text-xs">Human approval required before any pesticide release</div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Device" value={dose.device_id} />
            <Field label="Source" value={dose.source} />
            <Field label="Fused risk" value={dose.trigger_risk != null ? Math.round(dose.trigger_risk) : '—'} />
            <Field label="Pump" value={`${dose.pump_ms} ms ≈ ${dose.volume_ml_est} ml`} />
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 border border-amber-100 dark:border-amber-900/40">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              The detector is <strong>proxy-validated</strong> (boring sounds, not real airborne RPW).
              Confirm only after reviewing the spectrogram/sensors. A false dose pesticides a healthy palm.
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              disabled={busy}
              onClick={() => act(() => api.cancelDose(dose.id), 'cancelled')}
              className="flex-1 py-3 rounded-2xl font-bold border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <X size={18} /> Cancel
            </button>
            <button
              disabled={busy}
              onClick={() => act(() => api.confirmDose(dose.id, 'operator'), 'confirmed')}
              className="flex-1 py-3 rounded-2xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ShieldCheck size={18} /> Confirm dose
            </button>
          </div>
          {queue.length > 1 && (
            <div className="text-center text-xs text-gray-400">{queue.length - 1} more pending</div>
          )}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-3 border border-gray-100 dark:border-gray-800">
    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</div>
    <div className="text-base font-bold text-gray-900 dark:text-white capitalize">{value}</div>
  </div>
);

export default DoseConfirmModal;
