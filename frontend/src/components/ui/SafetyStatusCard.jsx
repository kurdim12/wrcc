// Palm Guard — SafetyStatusCard. Makes the human-in-the-loop, clear-water,
// hard-capped treatment posture impossible to misunderstand. Presentational.
import { ShieldCheck, Droplets, UserCheck, Timer, Server, Cpu, Lock, Unlock } from 'lucide-react';
import { StatusPill, ModeBadge } from './Primitives.jsx';

const Row = ({ icon: Icon, label, value, ok = true }) => (
  <div className="flex items-center gap-2.5 py-1.5">
    <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${ok ? 'bg-forest-400/12 text-forest-600 dark:text-forest-400' : 'bg-caution/15 text-caution'}`}>
      <Icon size={13} />
    </span>
    <span className="text-sm text-charcoal/90 dark:text-bone/90 flex-1">{label}</span>
    <span className="text-xs font-semibold text-muted">{value}</span>
  </div>
);

export const SafetyStatusCard = ({
  mode = 'demo', armed = false, cooldown = false,
  serverCaps = true, deviceCaps = true, clearWaterOnly = true, humanConfirmation = true,
  className = '',
}) => {
  // Overall posture: blocked-by-design unless a human acts; never "auto".
  const state = armed ? (cooldown ? 'pending' : 'ready') : 'safe';
  const stateLabel = { safe: 'Safety gate active', ready: 'Ready for human confirmation', pending: 'Cooldown active' }[state];
  return (
    <div className={`instrument overflow-hidden ${className}`}>
      <div className="px-4 sm:px-5 py-4 flex items-center justify-between gap-3 border-b border-muted/12">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-forest text-bone flex items-center justify-center">
            <ShieldCheck size={20} />
          </span>
          <div>
            <div className="text-[15px] font-semibold text-charcoal dark:text-bone">{stateLabel}</div>
            <div className="text-xs text-muted">Treatment is human-confirmed — nothing actuates on its own.</div>
          </div>
        </div>
        <ModeBadge mode={mode} />
      </div>

      <div className="px-4 sm:px-5 py-3">
        <div className="flex flex-wrap gap-2 mb-2">
          {clearWaterOnly && <StatusPill status="safe">Clear-water demo</StatusPill>}
          {humanConfirmation && <StatusPill status="safe">Operator approval required</StatusPill>}
          <StatusPill status={armed ? (cooldown ? 'pending' : 'ready') : 'blocked'}>
            {armed ? (cooldown ? 'Cooldown active' : 'Armed — awaiting confirm') : 'Disarmed'}
          </StatusPill>
        </div>
        <div className="divide-y divide-muted/10">
          <Row icon={Droplets}  label="Demo medium" value="Clear water only" />
          <Row icon={UserCheck} label="Operator approval" value={humanConfirmation ? 'Required' : 'Off'} ok={humanConfirmation} />
          <Row icon={Server}    label="Server safety caps" value={serverCaps ? 'Active' : 'Off'} ok={serverCaps} />
          <Row icon={Cpu}       label="Device safety caps" value={deviceCaps ? 'Active' : 'Off'} ok={deviceCaps} />
          <Row icon={Timer}     label="Cooldown" value={cooldown ? 'Active' : 'Clear'} ok={!cooldown} />
          <Row icon={armed ? Unlock : Lock} label="Arm state" value={armed ? 'Armed' : 'Disarmed (safe)'} ok={!armed} />
        </div>
      </div>
    </div>
  );
};

export default SafetyStatusCard;
