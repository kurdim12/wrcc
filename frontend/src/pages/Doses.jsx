import { useMemo, useState } from 'react';
import { Syringe, ShieldCheck, Lock } from 'lucide-react';
import { api } from '../api.js';
import { useDevices } from '../hooks/useDevices.js';
import { useDoses } from '../hooks/useDoses.js';
import { useSystemMode } from '../hooks/useSystemMode.js';
import { TreatmentLockCard } from '../components/TreatmentLockCard.jsx';

const now = () => Math.floor(Date.now() / 1000);
const fmtTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '—');
const STATUS = {
  pending:   'bg-caution/15 text-caution', sent: 'bg-forest-400/15 text-forest-400',
  done:      'bg-forest-400/20 text-forest-400', failed: 'bg-crit/15 text-crit',
  cancelled: 'bg-muted/15 text-muted',
};

export default function Doses({ showToast }) {
  const { devices, refresh } = useDevices();
  const { doses } = useDoses();
  const { mode } = useSystemMode();
  const [busy, setBusy] = useState(null);

  const dosesToday = useMemo(() => {
    const m = {}; const cutoff = now() - 86400;
    for (const d of doses) if (d.status === 'done' && (d.done_ts ?? 0) >= cutoff) m[d.device_id] = (m[d.device_id] || 0) + 1;
    return m;
  }, [doses]);

  const armedCount = devices.filter((d) => d.armed).length;
  const pending = doses.filter((d) => d.status === 'pending' || d.status === 'sent');

  const arm = async (d, armed) => {
    setBusy(d.id);
    try { await api.armDevice(d.id, armed); showToast?.(`${d.id} ${armed ? 'armed' : 'disarmed'}`, armed ? 'warning' : 'success'); refresh(); }
    catch (e) { showToast?.(`Arm failed: ${e.message}`, 'warning'); } finally { setBusy(null); }
  };
  const requestDose = async (d) => {
    setBusy(d.id);
    try {
      const r = await api.requestDose(d.id, 'operator');
      if (r?.error) showToast?.(`Dose request blocked: ${r.reason}`, 'warning');
      else showToast?.(`Manual dose requested on ${d.id} — confirm to release`, 'warning');
    } catch (e) { showToast?.(`Request failed: ${e.message}`, 'warning'); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-6">
      {/* safety summary */}
      <div className="instrument p-4 md:p-5">
        <div className="flex items-center gap-2 mb-2">
          <Syringe size={18} className="text-crit" />
          <h2 className="font-bold text-charcoal dark:text-bone">Treatment Control</h2>
        </div>
        <p className="text-sm text-muted max-w-3xl">
          Human confirmation is required before any treatment. The model score is <strong>not</strong> a
          standalone pesticide decision. Every dose passes independent caps on <strong>both</strong> the server
          and the device (max doses/day, cooldown, max pump duration). {mode !== 'live' && <span className="text-gold">WRCC demo mode uses clear water only.</span>}
        </p>
        <div className="flex flex-wrap gap-3 mt-3">
          <Stat icon={ShieldCheck} label="Armed nodes" value={`${armedCount} / ${devices.length}`} />
          <Stat icon={Lock} label="Open requests" value={pending.length} />
          <Stat icon={Syringe} label="Doses (24h)" value={doses.filter((d) => d.status === 'done' && (d.done_ts ?? 0) >= now() - 86400).length} />
        </div>
      </div>

      {/* per-device lock cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {devices.map((d) => (
          <TreatmentLockCard key={d.id} device={d} dosesToday={dosesToday[d.id] || 0}
            demo={mode !== 'live'} busy={busy === d.id}
            onArm={(armed) => arm(d, armed)} onRequestDose={() => requestDose(d)} />
        ))}
        {devices.length === 0 && <div className="hud-label">no devices yet</div>}
      </div>

      {/* dose history */}
      <div>
        <div className="hud-label mb-2">dose history</div>
        <div className="instrument overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left border-b border-muted/15">
              <tr className="hud-label">
                <th className="px-4 py-3">Time</th><th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Trigger</th><th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {doses.map((d) => (
                <tr key={d.id} className="border-b border-muted/8">
                  <td className="px-4 py-3 text-muted whitespace-nowrap telemetry-num text-xs">{fmtTime(d.done_ts || d.sent_ts || d.ts)}</td>
                  <td className="px-4 py-3 font-medium text-charcoal dark:text-bone">{d.device_id}</td>
                  <td className="px-4 py-3 telemetry-num">{d.trigger_risk != null ? Math.round(d.trigger_risk) : '—'}</td>
                  <td className="px-4 py-3 telemetry-num">{d.volume_ml_est ?? '—'} ml</td>
                  <td className="px-4 py-3 capitalize">{d.source}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS[d.status] || ''}`}>{d.status}</span></td>
                </tr>
              ))}
              {doses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center hud-label">no doses yet</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="instrument-inset px-3 py-2 flex items-center gap-2">
    <Icon size={15} className="text-muted" />
    <span className="hud-label">{label}</span>
    <span className="telemetry-num text-sm font-bold text-charcoal dark:text-bone ml-1">{value}</span>
  </div>
);
