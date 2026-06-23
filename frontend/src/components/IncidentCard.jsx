import { AlertTriangle, Activity, Check, Syringe } from 'lucide-react';
import { Badge, severityType } from './ui/Badge.jsx';
import { EvidenceStack } from './EvidenceStack.jsx';

const fmtAgo = (ts) => {
  if (!ts) return '';
  const d = Math.floor(Date.now() / 1000) - ts;
  return d < 60 ? `${d}s ago` : d < 3600 ? `${Math.floor(d / 60)}m ago`
    : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`;
};

// One incident, rendered as an instrument row: header chips + message +
// an inline evidence trail (acoustic → vibration → trunkΔ → model P → action).
// Behaviour is unchanged from the old inline card; this is just reusable now.
export const IncidentCard = ({ alert, doseStatus, reading = {}, onClick, onAck, onResolve }) => {
  const crit = alert.severity === 'critical';
  return (
    <div onClick={onClick}
      className="instrument p-4 cursor-pointer hover:border-forest-400/40 transition-colors">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${crit ? 'bg-crit/15 text-crit' : 'bg-caution/15 text-caution'}`}>
          {crit ? <AlertTriangle size={20} /> : <Activity size={20} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-charcoal dark:text-bone telemetry-num">{alert.device_id}</span>
            <span className="hud-label instrument-inset px-1.5 py-0.5">{alert.type}</span>
            <Badge type={severityType(alert.severity)} text={alert.severity} />
            {doseStatus && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-caution/15 text-caution flex items-center gap-1"><Syringe size={10} /> dose {doseStatus}</span>}
            <span className="hud-label ml-auto">{fmtAgo(alert.ts)}</span>
          </div>
          <p className="text-sm text-charcoal/80 dark:text-bone/80 mt-1">{alert.message}</p>
        </div>
        {alert.status === 'active' && (onAck || onResolve) && (
          <div className="flex gap-1 shrink-0">
            {onAck && <button onClick={(e) => onAck(e, alert.id)} title="Acknowledge" className="focus-ring p-2 rounded-lg hover:bg-forest-400/10 text-forest-400"><Check size={16} /></button>}
            {onResolve && <button onClick={(e) => onResolve(e, alert.id)} title="Resolve" className="focus-ring p-2 rounded-lg hover:bg-forest-400/10 text-forest-400"><Check size={16} className="stroke-[3]" /></button>}
          </div>
        )}
      </div>
      <div className="mt-3 instrument-inset px-3 py-1">
        <div className="hud-label py-1">evidence trail</div>
        <EvidenceStack reading={reading} action={doseStatus ? { label: `Dose ${doseStatus}`, status: doseStatus === 'sent' ? 'watch' : 'pending' } : null} />
      </div>
    </div>
  );
};

export default IncidentCard;
