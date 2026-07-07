// Palm Guard — CaseMap component kit. Map-first field-ops / evidence-review look.
// Prop-driven & presentational; uses the .cm-* / --cm-* design layer (styles.css).
// Risk is ALWAYS shown with RiskRuler (horizontal 0–100), never a circular gauge.
import {
  AudioLines, Waves, Thermometer, Cpu, Droplets, Lock, Gauge, Timer,
  ShieldCheck, CheckCircle2, Clock, FileSearch, ChevronRight, ShieldAlert,
} from 'lucide-react';

/* ── Status colours (single source) ──────────────────────────────────── */
const SC = {
  normal: '#43C76E', healthy: '#43C76E', verified: '#43C76E', online: '#43C76E',
  ready: '#43C76E', resolved: '#43C76E', live: '#43C76E', confirmed: '#43C76E',
  watch: '#F0B040', detected: '#F0B040', demo: '#F0B040',
  contributing: '#A6C257', high: '#F0883E', open: '#5E89A8', locked: '#8A988F',
  treated: '#4D9BE6', critical: '#EE5A48',
};
export const statusColor = (s) => SC[String(s).toLowerCase()] || '#6E746A';

export const StatusPill = ({ status = 'normal', children, className = '' }) => {
  const c = statusColor(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap ${className}`}
      style={{ color: c, background: `${c}1A`, border: `1px solid ${c}40` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {children ?? status}
    </span>
  );
};

/* ── RiskRuler — horizontal 0–100 with Normal/Watch/High/Critical bands ── */
const BANDS = [
  { key: 'normal', label: 'Normal', w: 30, c: '#43C76E' },
  { key: 'watch', label: 'Watch', w: 25, c: '#F0B040' },
  { key: 'high', label: 'High', w: 25, c: '#F0883E' },
  { key: 'critical', label: 'Critical', w: 20, c: '#EE5A48' },
];
export const riskBand = (s) => (s >= 80 ? 'critical' : s >= 55 ? 'high' : s >= 30 ? 'watch' : 'normal');
export const RiskRuler = ({ score = 0, delta, showLabels = true, className = '' }) => {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = BANDS.find((b) => b.key === riskBand(s)) || BANDS[0];
  const pos = `${s}%`;
  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-1">
        <span className="cm-label">Risk Ruler</span>
        {delta != null && (
          <span className="text-[11px] font-semibold" style={{ color: delta > 0 ? '#EE5A48' : '#43C76E' }}>
            {delta > 0 ? '▲ +' : '▼ '}{Math.abs(delta)} vs yesterday
          </span>
        )}
      </div>
      <div className="relative pt-7">
        {/* value bubble riding the marker */}
        <div className="absolute top-0" style={{ left: pos, transform: 'translateX(-50%)' }}>
          <span className="cm-display inline-flex items-center justify-center min-w-[30px] h-[22px] px-1.5 rounded-md text-[14px] font-bold text-white tabular-nums"
            style={{ background: band.c, boxShadow: `0 6px 16px -6px ${band.c}` }}>{s}</span>
        </div>
        {/* gradient track */}
        <div className="h-2.5 rounded-full cm-risk-track relative" style={{ boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)' }}>
          <span className="absolute top-1/2 w-[15px] h-[15px] rounded-full border-2"
            style={{ left: pos, transform: 'translate(-50%,-50%)', background: 'var(--cm-raised)', borderColor: band.c, boxShadow: `0 0 0 2px var(--cm-raised), 0 0 10px ${band.c}99` }} />
        </div>
        {/* numeric scale */}
        <div className="flex justify-between mt-1.5 cm-mono text-[9px] cm-muted">
          {[0, 25, 50, 75, 100].map((t) => <span key={t}>{t}</span>)}
        </div>
        {showLabels && (
          <div className="flex justify-between mt-0.5">
            {BANDS.map((b) => <span key={b.key} className="text-[10px]"
              style={{ color: band.key === b.key ? b.c : 'var(--cm-muted)', fontWeight: band.key === b.key ? 700 : 500 }}>{b.label}</span>)}
          </div>
        )}
      </div>
    </div>
  );
};

/* ── EvidenceSummary ──────────────────────────────────────────────────── */
const DEFAULT_EVIDENCE = [
  { icon: AudioLines, title: 'Acoustic anomaly detected', meta: 'Confidence 0.86', status: 'detected' },
  { icon: Waves, title: 'Vibration confirms trunk source', meta: 'Corroborated', status: 'confirmed' },
  { icon: Thermometer, title: 'Environment supports risk', meta: 'Context', status: 'contributing' },
  { icon: Cpu, title: 'Device health verified', meta: 'All sensors OK', status: 'verified' },
];
export const EvidenceSummary = ({ rows = DEFAULT_EVIDENCE, title = 'Evidence Summary' }) => (
  <div>
    {title && <div className="cm-label mb-2">{title}</div>}
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2.5 cm-surface px-3 py-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${statusColor(r.status)}1A`, color: statusColor(r.status) }}>
            <r.icon size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium cm-ink leading-tight truncate">{r.title}</div>
            {r.meta && <div className="text-[11px] cm-muted">{r.meta}</div>}
          </div>
          <StatusPill status={r.status} className="shrink-0" />
        </div>
      ))}
    </div>
  </div>
);

/* ── SafetyGateChecklist ──────────────────────────────────────────────── */
const DEFAULT_SAFETY = [
  { icon: Droplets, label: 'Clear-water demonstration mode', status: 'verified', value: 'Verified' },
  { icon: Lock, label: 'Treatment locked until approved', status: 'locked', value: 'Locked' },
  { icon: Gauge, label: 'Dose within safe limit', status: 'verified', value: 'Within limit' },
  { icon: Timer, label: 'Cooldown period observed', status: 'ready', value: 'Ready' },
  { icon: ShieldCheck, label: 'Device health verified', status: 'verified', value: 'All good' },
];
export const SafetyGateChecklist = ({ items = DEFAULT_SAFETY, title = 'Safety Checklist' }) => (
  <div>
    {title && <div className="cm-label mb-2">{title}</div>}
    <div className="space-y-1.5">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2.5 cm-surface px-3 py-2">
          <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${statusColor(it.status)}1A`, color: statusColor(it.status) }}>
            <it.icon size={15} />
          </span>
          <span className="text-[13px] cm-ink flex-1 leading-tight">{it.label}</span>
          <StatusPill status={it.status} className="shrink-0">{it.value || it.status}</StatusPill>
        </div>
      ))}
    </div>
  </div>
);

/* ── ProofLog ─────────────────────────────────────────────────────────── */
export const ProofLog = ({ events = [], title = 'Proof Log' }) => (
  <div>
    {title && <div className="cm-label mb-2">{title}</div>}
    {events.length === 0 ? (
      <div className="cm-surface px-3 py-6 text-center text-[12px] cm-muted">No recorded events yet.</div>
    ) : (
      <div className="space-y-1.5">
        {events.map((e, i) => (
          <div key={i} className="cm-surface px-3 py-2">
            <div className="flex items-center gap-2">
              <Clock size={12} className="cm-muted shrink-0" />
              <span className="cm-mono text-[11px] cm-muted">{e.time}</span>
              {e.mode && <StatusPill status={String(e.mode).toLowerCase().includes('demo') ? 'demo' : 'live'} className="ml-auto">{e.mode}</StatusPill>}
            </div>
            <div className="text-[13px] cm-ink mt-0.5">{e.event}</div>
            {e.by && <div className="text-[11px] cm-muted">by {e.by}</div>}
          </div>
        ))}
      </div>
    )}
  </div>
);

/* ── OperatorTasks ────────────────────────────────────────────────────── */
export const OperatorTasks = ({ tasks = [], title = 'Operator Tasks', onTask }) => (
  <div>
    {title && <div className="cm-label mb-2">{title}</div>}
    <div className="space-y-1.5">
      {tasks.map((t, i) => (
        <button key={i} onClick={() => onTask?.(t)} disabled={!onTask}
          className="focus-ring w-full text-left cm-surface px-3 py-2 flex items-center gap-2.5 hover:border-[var(--cm-forest)] transition-colors disabled:cursor-default">
          <span className="w-5 h-5 rounded-md border flex items-center justify-center shrink-0"
            style={{ borderColor: t.done ? '#43C76E' : 'var(--cm-border)', background: t.done ? '#43C76E1A' : 'transparent' }}>
            {t.done && <CheckCircle2 size={13} style={{ color: '#43C76E' }} />}
          </span>
          <span className="text-[13px] cm-ink flex-1 leading-tight">{t.label}</span>
          {t.tag && <StatusPill status={t.tagStatus || 'open'}>{t.tag}</StatusPill>}
        </button>
      ))}
    </div>
  </div>
);

/* ── ChartCard — calm, compact frame for Recharts ─────────────────────── */
export const ChartCard = ({ title, subtitle, action, children, height = 'h-44', className = '' }) => (
  <div className={`cm-raised p-4 ${className}`}>
    <div className="flex items-start justify-between gap-2 mb-2">
      <div>
        <div className="text-[13px] font-semibold cm-ink leading-tight">{title}</div>
        {subtitle && <div className="text-[11px] cm-muted">{subtitle}</div>}
      </div>
      {action}
    </div>
    <div className={height}>{children}</div>
  </div>
);

/* ── PalmCaseFile — the right-side inspector ──────────────────────────── */
export const PalmCaseFile = ({
  palmId, level = 'High Risk', block, row, age, lastUpdate,
  score = 0, delta, evidence, onOpenSafety, onReviewEvidence, className = '',
}) => (
  <div className={`cm-raised flex flex-col ${className}`}>
    <div className="px-4 py-3 border-b cm-divide flex items-center justify-between">
      <span className="cm-display text-[11px] font-semibold uppercase tracking-[0.14em] cm-muted">Palm Case File</span>
      <StatusPill status={riskBand(score)}>{level}</StatusPill>
    </div>
    <div className="px-4 py-4 space-y-4 overflow-y-auto custom-scrollbar">
      {/* identity row */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[22px] shrink-0 leading-none"
          style={{ background: 'linear-gradient(160deg,#16482F,#0B281B)', border: '1px solid var(--cm-border)' }}>🌴</div>
        <div className="min-w-0">
          <div className="cm-display text-2xl font-bold cm-ink leading-none truncate">{palmId || '—'}</div>
          <div className="text-[12px] cm-muted mt-1.5">
            {[row != null ? `Row ${row}` : null, block ? `Block ${block}` : null, age != null ? `Age ${age} yrs` : null].filter(Boolean).join(' • ') || '—'}
          </div>
        </div>
      </div>
      {lastUpdate && <div className="text-[11px] cm-muted -mt-2">Last update: <span className="cm-mono cm-ink">{lastUpdate}</span></div>}

      <RiskRuler score={score} delta={delta} />

      <EvidenceSummary rows={evidence} />

      <div>
        <div className="cm-label mb-2">Safety Gate</div>
        <div className="cm-surface px-3 py-2.5 space-y-1.5 rounded-xl">
          {['Human confirmation required', 'Clear-water demo mode', 'Treatment locked until approved', 'No pumps can activate automatically'].map((t) => (
            <div key={t} className="flex items-center gap-2 text-[12px] cm-ink">
              <ShieldCheck size={13} style={{ color: '#43C76E' }} className="shrink-0" />{t}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="px-4 py-3 border-t cm-divide flex gap-2">
      {onReviewEvidence && (
        <button onClick={onReviewEvidence}
          className="focus-ring flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg border hover:border-[var(--cm-forest)] transition-colors"
          style={{ borderColor: 'var(--cm-border)', color: 'var(--cm-ink)' }}>
          <FileSearch size={14} /> Review Evidence
        </button>
      )}
      <button onClick={onOpenSafety}
        className="cm-cta focus-ring flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-bold px-3 py-2 rounded-lg">
        <ShieldAlert size={14} /> Open Safety Gate
      </button>
    </div>
  </div>
);

export const Arrow = ChevronRight;
