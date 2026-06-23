// Palm Guard — CaseMap component kit. Map-first field-ops / evidence-review look.
// Prop-driven & presentational; uses the .cm-* / --cm-* design layer (styles.css).
// Risk is ALWAYS shown with RiskRuler (horizontal 0–100), never a circular gauge.
import {
  AudioLines, Waves, Thermometer, Cpu, Droplets, Lock, Gauge, Timer,
  ShieldCheck, CheckCircle2, Clock, FileSearch, ChevronRight, ShieldAlert,
} from 'lucide-react';

/* ── Status colours (single source) ──────────────────────────────────── */
const SC = {
  normal: '#2F7D46', healthy: '#2F7D46', verified: '#2F7D46', online: '#2F7D46',
  ready: '#2F7D46', resolved: '#2F7D46', live: '#2F7D46', confirmed: '#2F7D46',
  watch: '#B7791F', detected: '#B7791F', demo: '#B7791F',
  contributing: '#6F7D45', high: '#C05621', open: '#486581', locked: '#6E746A',
  treated: '#2B6CB0', critical: '#B42318',
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
  { key: 'normal', label: 'Normal', w: 30, c: '#2F7D46' },
  { key: 'watch', label: 'Watch', w: 25, c: '#B7791F' },
  { key: 'high', label: 'High', w: 25, c: '#C05621' },
  { key: 'critical', label: 'Critical', w: 20, c: '#B42318' },
];
export const riskBand = (s) => (s >= 80 ? 'critical' : s >= 55 ? 'high' : s >= 30 ? 'watch' : 'normal');
export const RiskRuler = ({ score = 0, delta, showLabels = true, className = '' }) => {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const band = BANDS.find((b) => b.key === riskBand(s)) || BANDS[0];
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between mb-1">
        <span className="cm-label">Risk score</span>
        <span className="cc-num cm-mono text-2xl font-bold leading-none" style={{ color: band.c }}>
          {s}<span className="text-sm cm-muted font-medium"> / 100</span>
        </span>
      </div>
      <div className="relative">
        <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'var(--cm-green-soft)' }}>
          {BANDS.map((b) => <span key={b.key} style={{ width: `${b.w}%`, background: b.c, opacity: 0.85 }} />)}
        </div>
        {/* marker */}
        <span className="absolute -top-1.5 w-1 h-5 rounded-full"
          style={{ left: `calc(${s}% - 2px)`, background: 'var(--cm-ink)', boxShadow: '0 0 0 2px var(--cm-raised)' }} />
      </div>
      {showLabels && (
        <div className="flex justify-between mt-1.5">
          {BANDS.map((b) => <span key={b.key} className="text-[10px] cm-muted" style={band.key === b.key ? { color: b.c, fontWeight: 700 } : undefined}>{b.label}</span>)}
        </div>
      )}
      {delta != null && (
        <div className="mt-1 text-[11px] font-semibold" style={{ color: delta > 0 ? '#B42318' : '#2F7D46' }}>
          {delta > 0 ? '+' : ''}{delta} points vs yesterday
        </div>
      )}
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
            style={{ borderColor: t.done ? '#2F7D46' : 'var(--cm-border)', background: t.done ? '#2F7D461A' : 'transparent' }}>
            {t.done && <CheckCircle2 size={13} style={{ color: '#2F7D46' }} />}
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
      <span className="cm-label">Palm Case File</span>
      <StatusPill status={riskBand(score)}>{level}</StatusPill>
    </div>
    <div className="px-4 py-3 space-y-4 overflow-y-auto custom-scrollbar">
      <div>
        <div className="cm-mono text-xl font-bold cm-ink">{palmId || '—'}</div>
        <div className="text-[12px] cm-muted mt-0.5">
          {[row != null ? `Row ${row}` : null, block ? `Block ${block}` : null, age != null ? `Age ${age} yrs` : null].filter(Boolean).join(' • ') || '—'}
        </div>
        {lastUpdate && <div className="text-[11px] cm-muted mt-0.5">Last update: <span className="cm-mono">{lastUpdate}</span></div>}
      </div>

      <RiskRuler score={score} delta={delta} />

      <EvidenceSummary rows={evidence} />

      <div>
        <div className="cm-label mb-2">Safety Gate</div>
        <div className="cm-surface px-3 py-2.5 space-y-1.5">
          {['Human confirmation required', 'Clear-water demo mode', 'Treatment locked until approved', 'No pumps can activate automatically'].map((t) => (
            <div key={t} className="flex items-center gap-2 text-[12px] cm-ink">
              <ShieldCheck size={13} style={{ color: '#2F7D46' }} className="shrink-0" />{t}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="px-4 py-3 border-t cm-divide flex gap-2">
      {onReviewEvidence && (
        <button onClick={onReviewEvidence}
          className="focus-ring flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg border"
          style={{ borderColor: 'var(--cm-border)', color: 'var(--cm-ink)' }}>
          <FileSearch size={14} /> Review Evidence
        </button>
      )}
      <button onClick={onOpenSafety}
        className="cc-btn focus-ring flex-1 inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg text-white"
        style={{ background: 'var(--cm-forest)' }}>
        <ShieldAlert size={14} /> Open Safety Gate
      </button>
    </div>
  </div>
);

export const Arrow = ChevronRight;
