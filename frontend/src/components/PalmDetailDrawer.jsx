import { useEffect, useState } from 'react';
import { X, MapPin, Activity, Thermometer, Wind, Battery, User, Syringe, Clock } from 'lucide-react';
import { Badge, severityType } from './ui/Badge.jsx';
import { RiskHalo } from './RiskHalo.jsx';
import { EvidenceStack } from './EvidenceStack.jsx';
import { TreatmentLockCard } from './TreatmentLockCard.jsx';
import { PalmCoreDiagram } from './PalmCoreDiagram.jsx';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const fmt = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
};

export const PalmDetailDrawer = ({ palm, onClose, showToast }) => {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [device, setDevice] = useState(null);
  const [deviceDoses, setDeviceDoses] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!palm) return;
    let alive = true;
    const load = async () => {
      try {
        const all = await api.readingsLatest();
        const r = all.find((x) => x.device_id === palm.device_id) || null;
        if (alive) setLatest(r);
        if (palm.device_id) {
          const rows = await api.readings({ device_id: palm.device_id, limit: 30 });
          if (alive) setHistory(rows.reverse());
          api.device(palm.device_id).then((d) => alive && setDevice(d)).catch(() => {});
          api.doses(palm.device_id).then((ds) => alive && setDeviceDoses(ds)).catch(() => {});
        }
      } catch {}
    };
    load();
    const off = onEvent('live:reading', (r) => {
      if (palm.device_id && r.device_id === palm.device_id) {
        setLatest(r); setHistory((prev) => [...prev.slice(-29), r]);
      }
    });
    return () => { alive = false; off(); };
  }, [palm?.id, palm?.device_id]);

  // Close on Escape (matches the backdrop click).
  useEffect(() => {
    if (!palm) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [palm, onClose]);

  if (!palm) return null;

  const cls = latest?.classification ?? palm.classification ?? 'low';
  const risk = latest?.risk_score ?? palm.risk_score ?? 0;
  const explain = cls === 'high'
    ? 'Strong multi-sensor evidence of internal activity. Inspect before any treatment.'
    : cls === 'medium' ? 'Elevated readings — inspection within 24–48 h.'
    : 'No abnormal acoustic, vibration or thermal signature.';

  const now = Math.floor(Date.now() / 1000);
  const dosesToday = deviceDoses.filter((d) => d.status === 'done' && (d.done_ts ?? 0) >= now - 86400).length;
  const lastDone = deviceDoses.find((d) => d.status === 'done');

  const toggleArm = async (next) => {
    if (!palm.device_id) { showToast?.('No device on this palm', 'warning'); return; }
    setBusy(true);
    try { await api.armDevice(palm.device_id, next); setDevice((d) => ({ ...(d || { id: palm.device_id }), armed: next ? 1 : 0 })); showToast?.(`${palm.device_id} ${next ? 'armed' : 'disarmed'}`, next ? 'warning' : 'success'); }
    catch (e) { showToast?.(`Arm failed: ${e.message}`, 'warning'); } finally { setBusy(false); }
  };
  const requestDose = async () => {
    setBusy(true);
    try { const r = await api.requestDose(palm.device_id, 'operator');
      if (r?.error) showToast?.(`Dose request blocked: ${r.reason}`, 'warning');
      else showToast?.('Manual dose requested — confirm to release', 'warning');
    } catch (e) { showToast?.(`Request failed: ${e.message}`, 'warning'); } finally { setBusy(false); }
  };

  const Section = ({ title, children }) => (
    <div className="space-y-2"><div className="hud-label">{title}</div>{children}</div>
  );

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-bone dark:bg-ink-800 shadow-2xl z-50 overflow-y-auto custom-scrollbar border-l border-muted/15 animate-slide-in-right">
      <div className="sticky top-0 bg-bone/90 dark:bg-ink-800/90 backdrop-blur-md px-5 py-4 border-b border-muted/15 z-20 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-charcoal dark:text-bone telemetry-num">{palm.id}</h2>
            <Badge type={severityType(cls)} text={cls} />
          </div>
          <p className="hud-label flex items-center gap-1.5"><MapPin size={12} />{palm.farm_id || 'orchard'}{palm.row_idx != null ? ` · row ${palm.row_idx + 1}` : ''}</p>
        </div>
        <button onClick={onClose} className="focus-ring p-2 instrument-inset text-muted hover:text-charcoal dark:hover:text-bone"><X size={18} /></button>
      </div>

      <div className="p-5 space-y-6">
        <Section title="diagnosis">
          <div className="instrument p-4 flex items-center gap-4">
            <RiskHalo risk={risk} pActivity={latest?.p_activity} modelVersion={latest?.model_version}
                      modelSource={latest?.model_source} calibrated={latest?.calibrated} size={120} />
            <p className="text-sm text-charcoal/80 dark:text-bone/80 leading-relaxed flex-1">{explain}</p>
          </div>
        </Section>

        <Section title="vitals">
          <div className="grid grid-cols-3 gap-2">
            <Vital icon={Activity} label="Acoustic" value={`${fmt(latest?.ac_clk, 1)}/s`} />
            <Vital icon={Activity} label="Vib RMS" value={`${fmt(latest?.vib_rms, 3)} g`} />
            <Vital icon={Thermometer} label="Trunk" value={`${fmt(latest?.core_c, 1)}°`} />
            <Vital icon={Thermometer} label="Ambient" value={`${fmt(latest?.amb_c, 1)}°`} />
            <Vital icon={Wind} label="Gas kΩ" value={fmt(latest?.gas_kohm, 0)} />
            <Vital icon={Battery} label="Battery" value={latest?.battery_pct != null ? `${latest.battery_pct}%` : '—'} />
          </div>
        </Section>

        <Section title="evidence trail">
          <div className="instrument p-3"><EvidenceStack reading={latest || {}} action={lastDone ? { label: 'Dose delivered', status: 'done', ts: lastDone.done_ts } : null} /></div>
          <PalmCoreDiagram risk={risk} />
        </Section>

        <Section title="treatment">
          <TreatmentLockCard device={device || { id: palm.device_id, armed: latest?.act?.armed }} dosesToday={dosesToday}
            demo busy={busy} onArm={toggleArm} onRequestDose={requestDose} />
        </Section>

        <Section title="timeline">
          <div className="instrument p-3 space-y-2">
            {deviceDoses.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-2 text-xs">
                <Syringe size={13} className="text-muted shrink-0" />
                <span className="capitalize text-charcoal dark:text-bone flex-1">Dose {d.status} · {d.source}</span>
                <span className="hud-label">{fmtAgo(d.done_ts || d.sent_ts || d.ts)}</span>
              </div>
            ))}
            {deviceDoses.length === 0 && <div className="flex items-center gap-2 hud-label"><Clock size={12} /> no treatment events</div>}
          </div>
        </Section>

        <button onClick={() => showToast?.(`Inspector dispatched to ${palm.id}`, 'success')}
          className="focus-ring w-full py-2.5 border border-muted/30 text-charcoal dark:text-bone hover:bg-muted/10 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
          <User size={16} /> Dispatch inspector
        </button>
      </div>
    </div>
  );
};

const Vital = ({ icon: Icon, label, value }) => (
  <div className="instrument-inset px-2.5 py-2">
    <div className="flex items-center gap-1.5 text-muted mb-0.5"><Icon size={12} /><span className="hud-label">{label}</span></div>
    <div className="telemetry-num text-sm font-bold text-charcoal dark:text-bone">{value}</div>
  </div>
);

export default PalmDetailDrawer;
