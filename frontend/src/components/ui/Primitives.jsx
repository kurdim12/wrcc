// Palm Guard — premium UI primitives (presentational, prop-driven).
// Built on the existing design tokens (forest/gold/caution/crit/bone/panel/ink/muted)
// and the `.instrument` surface in styles.css. Light + dark aware. No data fetching.
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/* ─── SectionCard ─────────────────────────────────────────────────────────
   The one consistent surface every page uses. Replaces ad-hoc card styles. */
export const SectionCard = ({ title, subtitle, action, children, className = '', bodyClass = '' }) => (
  <section className={`instrument ${className}`}>
    {(title || action) && (
      <header className="flex items-start justify-between gap-3 px-4 sm:px-5 pt-4">
        <div className="min-w-0">
          {title && <h3 className="text-[15px] font-semibold text-charcoal dark:text-bone leading-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-muted mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    )}
    <div className={`px-4 sm:px-5 ${title ? 'pt-3' : 'pt-4'} pb-4 sm:pb-5 ${bodyClass}`}>{children}</div>
  </section>
);

/* ─── PageHeader ──────────────────────────────────────────────────────────
   Big clear page title + plain-English subtitle + optional actions. */
export const PageHeader = ({ title, subtitle, actions, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-1">
    <div className="min-w-0">
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-charcoal dark:text-bone">{title}</h2>
      {subtitle && <p className="text-sm text-muted mt-1 max-w-2xl leading-snug">{subtitle}</p>}
      {children}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/* ─── StatusPill ──────────────────────────────────────────────────────────
   Single source of truth for status colour. */
const PILL = {
  healthy:  'bg-forest-400/12 text-forest-600 dark:text-forest-400 border-forest-400/30',
  online:   'bg-forest-400/12 text-forest-600 dark:text-forest-400 border-forest-400/30',
  safe:     'bg-forest-400/12 text-forest-600 dark:text-forest-400 border-forest-400/30',
  ready:    'bg-forest-400/12 text-forest-600 dark:text-forest-400 border-forest-400/30',
  live:     'bg-forest-400/15 text-forest-600 dark:text-forest-400 border-forest-400/40',
  watch:    'bg-gold/15 text-[#8a6f2a] dark:text-gold border-gold/35',
  pending:  'bg-caution/15 text-[#9a6a16] dark:text-caution border-caution/35',
  elevated: 'bg-caution/15 text-[#9a6a16] dark:text-caution border-caution/35',
  demo:     'bg-gold/15 text-[#8a6f2a] dark:text-gold border-gold/40',
  high:     'bg-crit/12 text-crit border-crit/35',
  critical: 'bg-crit/14 text-crit border-crit/40',
  blocked:  'bg-crit/12 text-crit border-crit/35',
  offline:  'bg-muted/12 text-muted border-muted/30',
  neutral:  'bg-muted/12 text-muted border-muted/30',
};
export const StatusPill = ({ status = 'neutral', children, dot = true, className = '' }) => {
  const key = String(status).toLowerCase();
  const tone = PILL[key] || PILL.neutral;
  const dotColor = { healthy: '#19A66A', online: '#19A66A', safe: '#19A66A', ready: '#19A66A', live: '#19A66A',
    watch: '#C2A14D', demo: '#C2A14D', pending: '#D89B2B', elevated: '#D89B2B',
    high: '#C94A3A', critical: '#C94A3A', blocked: '#C94A3A', offline: '#8C9B91', neutral: '#8C9B91' }[key] || '#8C9B91';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone} ${className}`}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: dotColor }} />}
      {children ?? status}
    </span>
  );
};

/* ─── ModeBadge ───────────────────────────────────────────────────────────
   DEMO / LIVE — impossible to miss, not ugly. */
export const ModeBadge = ({ mode, size = 'md' }) => {
  const live = String(mode).toLowerCase() === 'live';
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold tracking-wide border ${pad} ${
      live ? 'bg-forest-400/15 text-forest-600 dark:text-forest-400 border-forest-400/40'
           : 'bg-gold/15 text-[#8a6f2a] dark:text-gold border-gold/45'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${live ? 'bg-forest-400 animate-heartbeat' : 'bg-gold'}`} />
      {live ? 'LIVE' : 'DEMO · CLEAR WATER'}
    </span>
  );
};

/* ─── MetricTile ──────────────────────────────────────────────────────────
   KPI tile: label, big value, unit, trend, status accent, icon. */
const TONE_TEXT = { forest: 'text-forest-600 dark:text-forest-400', gold: 'text-[#8a6f2a] dark:text-gold',
  caution: 'text-caution', crit: 'text-crit', muted: 'text-charcoal dark:text-bone' };
export const MetricTile = ({ label, value, unit, trend, icon: Icon, status = 'muted', sub }) => {
  const trendNum = typeof trend === 'number' ? trend : null;
  const TrendIcon = trendNum == null ? null : trendNum > 0 ? ArrowUpRight : trendNum < 0 ? ArrowDownRight : Minus;
  return (
    <div className="instrument p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="hud-label">{label}</span>
        {Icon && <Icon size={16} className={TONE_TEXT[status] || 'text-muted'} />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`telemetry-num text-3xl font-bold leading-none ${TONE_TEXT[status] || 'text-charcoal dark:text-bone'}`}>{value}</span>
        {unit && <span className="text-sm text-muted font-medium">{unit}</span>}
        {TrendIcon && (
          <span className={`ml-auto inline-flex items-center gap-0.5 text-xs font-semibold ${trendNum > 0 ? 'text-crit' : trendNum < 0 ? 'text-forest-400' : 'text-muted'}`}>
            <TrendIcon size={13} />{Math.abs(trendNum)}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-muted leading-snug">{sub}</span>}
    </div>
  );
};

/* ─── ChartCard ───────────────────────────────────────────────────────────
   Premium frame for every Recharts chart: title, subtitle, legend, action. */
export const ChartCard = ({ title, subtitle, legend, action, children, className = '', height = 'h-56' }) => (
  <div className={`instrument p-4 sm:p-5 ${className}`}>
    <div className="flex items-start justify-between gap-3 mb-3">
      <div>
        <h3 className="text-sm font-semibold text-charcoal dark:text-bone leading-tight">{title}</h3>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {legend && <div className="hidden sm:flex items-center gap-3">{legend}</div>}
        {action}
      </div>
    </div>
    <div className={height}>{children}</div>
  </div>
);

/* Tiny legend swatch for ChartCard legends. */
export const LegendDot = ({ color, label }) => (
  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />{label}
  </span>
);

/* ─── EmptyState ──────────────────────────────────────────────────────────*/
export const EmptyState = ({ icon: Icon, title = 'No data yet', hint, className = '' }) => (
  <div className={`flex flex-col items-center justify-center text-center py-8 px-4 ${className}`}>
    {Icon && <Icon size={26} className="text-muted/60 mb-2" />}
    <p className="text-sm font-medium text-charcoal dark:text-bone">{title}</p>
    {hint && <p className="text-xs text-muted mt-1 max-w-xs">{hint}</p>}
  </div>
);

export default SectionCard;
