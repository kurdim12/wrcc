import { useMemo, useState } from 'react';
import { Syringe, ShieldCheck, ShieldAlert, Lock, Droplets, CheckCircle2, Clock } from 'lucide-react';
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

// The four guarantees the gate enforces — stated plainly, no hedging.
const GUARANTEES = [
  'Human confirmation required before any dose is released.',
  'Independent caps on BOTH server and device — max doses/day, cooldown, pump ceiling.',
  'The model score is an activity estimate, NOT a standalone pesticide decision.',
];

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

  // Armed nodes float to the top — they are the live-risk surface.
  const ordered = useMemo(
    () => [...devices].sort((a, b) => (b.armed ? 1 : 0) - (a.armed ? 1 : 0)),
    [devices]);

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
      {/* ── Safety Gate hero ─────────────────────────────────────────── */}
      <div className="instrument overflow-hidden border-l-4 border-crit">
        <div className="p-5 md:p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-crit/12 text-crit flex items-center justify-center shrink-0">
              <ShieldAlert size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-bold text-xl text-charcoal dark:text-bone">Treatment Safety Gate</h2>
                <span className={`hud-label px-2.5 py-1 rounded-full border ${
                  armedCount ? 'text-caution border-caution/40 bg-caution/10' : 'text-forest-400 border-forest-400/40 bg-forest-400/10'}`}>
                  {armedCount ? `${armedCount} node${armedCount === 1 ? '' : 's'} armed` : 'all nodes locked'}
                </span>
                {!isLive && (
                  <span className="hud-label px-2.5 py-1 rounded-full border text-gold border-gold/40 bg-gold/10 flex items-center gap-1.5">
                    <Droplets size={12} /> clear water only
                  </span>
                )}
              </div>
              <p className="text-sm text-muted mt-1 max-w-3xl">
                Actuation is locked behind a human. Nothing here sprays autonomously — arming only <em>enables</em> a
                request, and a dose is released only after explicit confirmation.
              </p>
            </div>
          </div>

          {/* guarantees */}
          <div className="grid md:grid-cols-3 gap-2 mt-4">
            {GUARANTEES.map((g) => (
              <div key={g} className="instrument-inset px-3 py-2.5 flex items-start gap-2">
                <CheckCircle2 size={15} className="text-forest-400 shrink-0 mt-0.5" />
                <span className="text-[12px] leading-snug text-charcoal/80 dark:text-bone/80">{g}</span>
              </div>
            ))}
          </div>

          {/* live counters */}
          <div className="flex flex-wrap gap-2.5 mt-4">
            <Counter icon={ShieldCheck} label="Armed nodes" value={`${armedCount} / ${devices.length}`} tone={armedCount ? 'caution' : 'muted'} />
            <Counter icon={Lock} label="Pending requests" value={pending.length} tone={pending.length ? 'caution' : 'muted'} />
            <Counter icon={Syringe} label="Doses · 24h" value={doses24h} tone="muted" />
          </div>
        </div>
      </div>

      {/* ── Pending actions queue ────────────────────────────────────── */}
      <div>
        <div className="hud-label mb-2">pending treatment actions</div>
        {pending.length === 0 ? (
          <div className="instrument p-4 flex items-center gap-2.5 text-muted">
            <Lock size={15} className="text-forest-400" />
            <span className="text-sm">Gate closed — no treatment actions awaiting confirmation.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((d) => (
              <div key={d.id} className="instrument p-3.5 flex items-center gap-3 border-caution/40">
                <div className="w-9 h-9 rounded-lg bg-caution/15 text-caution flex items-center justify-center shrink-0">
                  <Syringe size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-charcoal dark:text-bone telemetry-num">{d.device_id}</div>
                  <div className="hud-label">{d.source} request · {d.pump_ms} ms · ≈ {d.volume_ml_est} ml</div>
                </div>
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS[d.status] || ''}`}>{d.status}</span>
                <span className="hud-label hidden sm:flex items-center gap-1.5 text-caution"><Clock size={12} /> awaiting confirm</span>
              </div>
            ))}
            <div className="hud-label text-muted px-1">the confirmation gate opens automatically — confirm or cancel each request there.</div>
          </div>
        )}
      </div>

      {/* ── Per-node actuator controls ───────────────────────────────── */}
      <div>
        <div className="hud-label mb-2">node actuators · {devices.length}</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {ordered.map((d) => (
            <TreatmentLockCard key={d.id} device={d} dosesToday={dosesToday[d.id] || 0}
              demo={!isLive} busy={busy === d.id}
              onArm={(armed) => arm(d, armed)} onRequestDose={() => requestDose(d)} />
          ))}
          {devices.length === 0 && <div className="hud-label">no devices yet</div>}
        </div>
      </div>

      {/* ── Dose history ─────────────────────────────────────────────── */}
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
                  <td className="px-4 py-3 telemetry-num">{d.trigger_risk != null ? Math.round(d.trigger_risk) : 'manual'}</td>
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

const Counter = ({ icon: Icon, label, value, tone = 'muted' }) => {
  const c = { caution: 'text-caution', forest: 'text-forest-400', muted: 'text-muted' }[tone];
  return (
    <div className="instrument-inset px-3 py-2 flex items-center gap-2">
      <Icon size={15} className={c} />
      <span className="hud-label">{label}</span>
      <span className={`telemetry-num text-sm font-bold ml-1 ${tone === 'muted' ? 'text-charcoal dark:text-bone' : c}`}>{value}</span>
    </div>
  );
};
