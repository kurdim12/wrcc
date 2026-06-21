import { Mic, Waves, Thermometer, Activity, ShieldCheck } from 'lucide-react';
import { ModelCaveatBadge } from './ModelCaveatBadge.jsx';

// EvidenceStack — makes the decision path explainable: each sensor channel +
// the model probability + the human/treatment action, as an evidence trail.
// `reading` is a stored/live reading row; `action` optional {label,status,ts}.
const fmt = (v, d = 1, suffix = '') => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(d)}${suffix}`);
const fmtAgo = (ts) => {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};

const Row = ({ icon: Icon, label, value, tone = 'muted', detail, badge }) => {
  const dot = { ok: 'bg-forest-400', watch: 'bg-gold', crit: 'bg-crit', muted: 'bg-muted/50' }[tone];
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <Icon size={15} className="text-muted shrink-0" />
      <div className="hud-label w-24 shrink-0">{label}</div>
      <div className="telemetry-num text-sm font-semibold text-charcoal dark:text-bone flex-1">{value}</div>
      {badge}
      {detail && <span className="text-[10px] text-muted">{detail}</span>}
    </div>
  );
};

export const EvidenceStack = ({ reading = {}, action = null }) => {
  const r = reading || {};
  const saTone = (r.sa ?? 0) >= 60 ? 'crit' : (r.sa ?? 0) >= 30 ? 'watch' : 'ok';
  const svTone = (r.sv ?? 0) >= 50 ? 'watch' : 'ok';
  const delta = r.core_c != null && r.amb_c != null ? r.core_c - r.amb_c : null;
  const stTone = delta != null && delta > 4 ? 'watch' : 'ok';
  const pTone = (r.p_activity ?? 0) >= 0.7 ? 'crit' : (r.p_activity ?? 0) >= 0.4 ? 'watch' : 'ok';

  return (
    <div className="divide-y divide-muted/10">
      <Row icon={Mic} label="Acoustic" tone={saTone}
           value={`SA ${fmt(r.sa, 0)}`} detail={`clk ${fmt(r.ac_clk, 1)}/s`} />
      <Row icon={Waves} label="Vibration" tone={svTone}
           value={`SV ${fmt(r.sv, 0)}`} detail={`${fmt(r.vib_rms, 3)} g`} />
      <Row icon={Thermometer} label="Trunk Δ" tone={stTone}
           value={delta != null ? `${delta > 0 ? '+' : ''}${fmt(delta, 1, '°C')}` : '—'}
           detail={`core ${fmt(r.core_c, 1, '°')}`} />
      <Row icon={Activity} label="Model P" tone={pTone}
           value={r.p_activity != null ? `P=${Number(r.p_activity).toFixed(2)}` : '—'}
           badge={<ModelCaveatBadge modelVersion={r.model_version} modelSource={r.model_source}
                                    calibrated={r.calibrated} size="xs" showInfo={false} />} />
      <Row icon={ShieldCheck} label="Action"
           tone={action?.status === 'done' ? 'ok' : action ? 'watch' : 'muted'}
           value={action?.label || 'Awaiting operator'}
           detail={action?.ts ? `${fmtAgo(action.ts)} ago` : 'human-gated'} />
    </div>
  );
};

export default EvidenceStack;
