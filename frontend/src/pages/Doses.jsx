import { useMemo, useState } from 'react';
import { Syringe, Lock, Clock, Droplets, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';
import { useDevices } from '../hooks/useDevices.js';
import { useDoses } from '../hooks/useDoses.js';
import { useSystemMode } from '../hooks/useSystemMode.js';
import { TreatmentLockCard } from '../components/TreatmentLockCard.jsx';
import { SafetyGateChecklist, StatusPill } from '../components/casemap/CaseMapKit.jsx';

const now = () => Math.floor(Date.now() / 1000);
const fmtTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '—');
const DOSE_PILL = { pending: 'pending', sent: 'open', done: 'verified', failed: 'critical', cancelled: 'locked' };

export default function Doses({ showToast }) {
  const { devices, refresh } = useDevices();
  const { doses } = useDoses();
  const { mode } = useSystemMode();
  const [busy, setBusy] = useState(null);
  const isLive = mode === 'live';

  const dosesToday = useMemo(() => {
    const m = {}; const cutoff = now() - 86400;
    for (const d of doses) if (d.status === 'done' && (d.done_ts ?? 0) >= cutoff) m[d.device_id] = (m[d.device_id] || 0) + 1;
    return m;
  }, [doses]);

  const armedCount = devices.filter((d) => d.armed).length;
  const pending = doses.filter((d) => d.status === 'pending' || d.status === 'sent');
  const doses24h = doses.filter((d) => d.status === 'done' && (d.done_ts ?? 0) >= now() - 86400).length;
  const ordered = useMemo(() => [...devices].sort((a, b) => (b.armed ? 1 : 0) - (a.armed ? 1 : 0)), [devices]);

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

  const Auth = ({ label, value }) => (
    <div className="flex items-center justify-between py-1.5 border-b cm-divide last:border-0">
      <span className="text-[12px] cm-muted">{label}</span>
      <span className="text-[12px] font-semibold cm-ink cm-mono">{value}</span>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* header */}
      <div>
        <h2 className="cm-title text-xl">Safety Gate</h2>
        <p className="text-[13px] cm-muted mt-0.5">Human-confirmed treatment control. Nothing actuates on its own.</p>
      </div>

      {/* mode band */}
      <div className="cm-raised px-4 py-3 flex flex-wrap items-center gap-3" style={{ borderLeft: '3px solid #B7791F' }}>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold" style={{ color: '#B7791F' }}>
          <Droplets size={15} /> Current Mode: {isLive ? 'LIVE' : 'DEMO — Clear Water Only'}
        </span>
        <span className="cm-muted text-[13px]">•</span>
        <span className="inline-flex items-center gap-1.5 text-[13px] cm-ink">
          <Lock size={14} style={{ color: '#6E746A' }} /> Treatment locked until approved
        </span>
        <StatusPill status={armedCount ? 'ready' : 'locked'} className="ml-auto">
          {armedCount ? `${armedCount} node${armedCount === 1 ? '' : 's'} armed` : 'All nodes locked'}
        </StatusPill>
      </div>

      {/* checklist · authorization · live status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cm-raised p-4"><SafetyGateChecklist /></div>

        <div className="cm-raised p-4">
          <div className="cm-label mb-2">Treatment Authorization</div>
          <p className="text-[13px] cm-ink mb-3">Human-confirmed action is required to proceed. No pumps can activate automatically.</p>
          <Auth label="Mode" value={isLive ? 'Live' : 'Demo — Clear Water'} />
          <Auth label="Medium" value="Clear water only" />
          <Auth label="Max demo dose" value="≤ 3000 ms" />
          <Auth label="Confirmation" value="Per-event, operator" />
          <Auth label="Anti-replay nonce" value="Active" />
          <p className="text-[12px] cm-muted mt-3">
            No treatment is delivered until an operator arms a node below and confirms the clear-water demo dose in the Safety Gate prompt.
          </p>
        </div>

        <div className="cm-raised p-4">
          <div className="cm-label mb-2">Live Status</div>
          <div className="space-y-2">
            <Stat icon={ShieldCheck} label="Armed nodes" value={`${armedCount} / ${devices.length}`} />
            <Stat icon={Lock} label="Pending confirmations" value={pending.length} />
            <Stat icon={Syringe} label="Clear-water demos · 24h" value={doses24h} />
          </div>
        </div>
      </div>

      {/* pending */}
      <div>
        <div className="cm-label mb-2">Pending treatment actions</div>
        {pending.length === 0 ? (
          <div className="cm-raised px-4 py-3 flex items-center gap-2.5 cm-muted text-[13px]">
            <Lock size={15} style={{ color: '#2F7D46' }} /> Gate closed — no treatment actions awaiting confirmation.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <div key={d.id} className="cm-raised px-3.5 py-3 flex items-center gap-3" style={{ borderLeft: '3px solid #B7791F' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: '#B7791F1A', color: '#B7791F' }}><Syringe size={17} /></div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold cm-ink cm-mono">{d.device_id}</div>
                  <div className="text-[11px] cm-muted">{d.source} request · {d.pump_ms} ms · ≈ {d.volume_ml_est} ml</div>
                </div>
                <StatusPill status={DOSE_PILL[d.status] || 'open'}>{d.status}</StatusPill>
                <span className="hidden sm:flex items-center gap-1.5 text-[11px]" style={{ color: '#B7791F' }}><Clock size={12} /> awaiting confirm</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* per-node actuators (functional arm/request) */}
      <div>
        <div className="cm-label mb-2">Node actuators · {devices.length}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((d) => (
            <TreatmentLockCard key={d.id} device={d} dosesToday={dosesToday[d.id] || 0}
              demo={!isLive} busy={busy === d.id}
              onArm={(armed) => arm(d, armed)} onRequestDose={() => requestDose(d)} />
          ))}
          {devices.length === 0 && <div className="cm-muted text-[13px]">No devices yet.</div>}
        </div>
      </div>

      {/* dose history / proof log */}
      <div>
        <div className="cm-label mb-2">Dose History · Proof Log</div>
        <div className="cm-raised overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="border-b cm-divide text-left">
              {['Time', 'Device', 'Trigger', 'Volume', 'Source', 'Status'].map((h) => <th key={h} className="px-4 py-2.5 cm-label">{h}</th>)}
            </tr></thead>
            <tbody>
              {doses.map((d) => (
                <tr key={d.id} className="border-b cm-divide">
                  <td className="px-4 py-2.5 cm-muted cm-mono text-[11px] whitespace-nowrap">{fmtTime(d.done_ts || d.sent_ts || d.ts)}</td>
                  <td className="px-4 py-2.5 font-medium cm-ink cm-mono">{d.device_id}</td>
                  <td className="px-4 py-2.5 cm-mono">{d.trigger_risk != null ? Math.round(d.trigger_risk) : 'manual'}</td>
                  <td className="px-4 py-2.5 cm-mono">{d.volume_ml_est ?? '—'} ml</td>
                  <td className="px-4 py-2.5 capitalize">{d.source}</td>
                  <td className="px-4 py-2.5"><StatusPill status={DOSE_PILL[d.status] || 'open'}>{d.status}</StatusPill></td>
                </tr>
              ))}
              {doses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center cm-muted text-[13px]">No clear-water demo doses yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2.5">
    <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--cm-green-soft)', color: 'var(--cm-forest)' }}><Icon size={15} /></span>
    <span className="text-[13px] cm-ink flex-1">{label}</span>
    <span className="cm-mono text-base font-bold cm-ink">{value}</span>
  </div>
);
