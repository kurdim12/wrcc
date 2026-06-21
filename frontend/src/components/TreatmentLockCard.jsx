import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Droplets, Lock, Clock } from 'lucide-react';

// TreatmentLockCard — per-device dosing control. Treats dosing as a locked,
// human-gated, capped operation. Surfaces WHY an action is blocked.
const PUMP_FLOW_ML_PER_S = 1.5;   // mirrors backend doseEngine estimate
const now = () => Math.floor(Date.now() / 1000);

const Field = ({ label, value, alarm }) => (
  <div className="instrument-inset px-3 py-2">
    <div className="hud-label">{label}</div>
    <div className={`telemetry-num text-sm font-semibold ${alarm ? 'text-crit' : 'text-charcoal dark:text-bone'}`}>{value}</div>
  </div>
);

export const TreatmentLockCard = ({ device, dosesToday = 0, demo = true, busy = false, onArm, onRequestDose }) => {
  const d = device || {};
  const armed = !!d.armed;
  const maxDay = d.max_doses_day ?? 4;
  const cooldownS = d.cooldown_s ?? 1800;
  const pumpMs = d.pump_ms ?? 2000;
  const volMl = ((pumpMs / 1000) * PUMP_FLOW_ML_PER_S).toFixed(1);

  // Live cooldown countdown.
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  const cdRemaining = d.last_dose_ts ? Math.max(0, cooldownS - (now() - d.last_dose_ts)) : 0;
  const capReached = dosesToday >= maxDay;

  const blockReason = !armed ? 'Arm required'
    : cdRemaining > 0 ? `Cooldown ${Math.floor(cdRemaining / 60)}:${String(cdRemaining % 60).padStart(2, '0')}`
    : capReached ? 'Daily cap reached'
    : null;
  const canRequest = !busy && !blockReason;

  return (
    <div className="instrument p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-charcoal dark:text-bone">{d.id || '—'}</div>
          <div className="hud-label">{d.variety || 'unassigned'}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
          armed ? 'bg-forest-400/15 text-forest-400 border-forest-400/30'
                : 'bg-muted/15 text-muted border-muted/25'}`}>
          {armed ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
          {armed ? 'ARMED' : 'DISARMED'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Doses today" value={`${dosesToday} / ${maxDay}`} alarm={capReached} />
        <Field label="Cooldown" value={cdRemaining > 0 ? `${Math.floor(cdRemaining / 60)}:${String(cdRemaining % 60).padStart(2, '0')}` : `${Math.round(cooldownS / 60)} min`} alarm={cdRemaining > 0} />
        <Field label="Pump" value={`${pumpMs} ms`} />
        <Field label="Est. volume" value={`≈ ${volMl} ml`} />
      </div>

      {demo && (
        <div className="flex items-center gap-2 text-[11px] text-gold instrument-inset px-3 py-2">
          <Droplets size={13} /> WRCC demo: clear water only.
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onArm?.(!armed)} disabled={busy}
          className={`focus-ring flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
            armed ? 'bg-muted/15 text-charcoal dark:text-bone hover:bg-muted/25'
                  : 'bg-forest text-bone hover:bg-forest-600'}`}>
          {armed ? <><ShieldOff size={16} /> Disarm</> : <><ShieldCheck size={16} /> Arm</>}
        </button>
        <button
          onClick={() => onRequestDose?.()} disabled={!canRequest}
          title={blockReason || 'Request a dose (still needs confirmation)'}
          className="focus-ring flex-1 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 bg-crit text-bone hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {blockReason ? <Lock size={15} /> : <Droplets size={15} />}
          {blockReason || 'Request dose'}
        </button>
      </div>
      {blockReason && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted">
          <Clock size={11} /> {blockReason === 'Arm required' ? 'Arm the node to enable a dose request.' : `Treatment gate closed — ${blockReason.toLowerCase()}.`}
        </div>
      )}
    </div>
  );
};

export default TreatmentLockCard;
