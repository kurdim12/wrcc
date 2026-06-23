import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldOff, Droplets, Lock, Clock } from 'lucide-react';

// TreatmentLockCard — per-device actuator control. Dosing is a locked,
// human-gated, capped operation; the card stays compact and surfaces WHY an
// action is blocked. Armed cards visually lift so the operator sees live risk.
const PUMP_FLOW_ML_PER_S = 1.5;   // mirrors backend doseEngine estimate
const now = () => Math.floor(Date.now() / 1000);

const Mini = ({ label, value, alarm }) => (
  <div className="text-center">
    <div className="hud-label">{label}</div>
    <div className={`telemetry-num text-xs font-bold ${alarm ? 'text-crit' : 'text-charcoal dark:text-bone'}`}>{value}</div>
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
  const cdLabel = cdRemaining > 0 ? `${Math.floor(cdRemaining / 60)}:${String(cdRemaining % 60).padStart(2, '0')}` : `${Math.round(cooldownS / 60)}m`;

  const blockReason = !armed ? 'Arm required'
    : cdRemaining > 0 ? `Cooldown ${cdLabel}`
    : capReached ? 'Daily cap reached'
    : null;
  const canRequest = !busy && !blockReason;

  return (
    <div className={`instrument p-3.5 flex flex-col gap-2.5 transition-colors ${armed ? 'border-forest-400/40' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="font-bold text-charcoal dark:text-bone telemetry-num truncate">{d.id || '—'}</div>
          <div className="hud-label truncate">{d.variety || 'unassigned'}</div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${
          armed ? 'bg-forest-400/15 text-forest-400 border-forest-400/30'
                : 'bg-muted/15 text-muted border-muted/25'}`}>
          {armed ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
          {armed ? 'armed' : 'disarmed'}
        </span>
      </div>

      {/* compact caps strip — one row, not four tiles */}
      <div className="instrument-inset px-2 py-2 grid grid-cols-4 gap-1.5">
        <Mini label="today" value={`${dosesToday}/${maxDay}`} alarm={capReached} />
        <Mini label="cooldown" value={cdLabel} alarm={cdRemaining > 0} />
        <Mini label="pump" value={`${pumpMs}ms`} />
        <Mini label="≈ vol" value={`${volMl}ml`} />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onArm?.(!armed)} disabled={busy}
          className={`focus-ring flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors ${
            armed ? 'bg-muted/15 text-charcoal dark:text-bone hover:bg-muted/25'
                  : 'bg-forest text-bone hover:bg-forest-600'}`}>
          {armed ? <><ShieldOff size={14} /> Disarm</> : <><ShieldCheck size={14} /> Arm</>}
        </button>
        <button
          onClick={() => onRequestDose?.()} disabled={!canRequest}
          title={blockReason || 'Request a dose (still needs confirmation)'}
          className="focus-ring flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-crit text-bone hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {blockReason ? <Lock size={13} /> : <Droplets size={13} />}
          {blockReason || 'Request dose'}
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-[10px] text-muted min-h-[14px]">
        {blockReason
          ? <><Clock size={11} /> {blockReason === 'Arm required' ? 'Arm the node to enable a dose request.' : `Gate closed — ${blockReason.toLowerCase()}.`}</>
          : demo
            ? <><Droplets size={11} className="text-gold" /> <span className="text-gold">Armed · clear water only · confirm to release.</span></>
            : <><ShieldCheck size={11} className="text-forest-400" /> Armed · confirm to release.</>}
      </div>
    </div>
  );
};

export default TreatmentLockCard;
