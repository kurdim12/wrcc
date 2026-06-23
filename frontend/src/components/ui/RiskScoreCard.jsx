// Palm Guard — RiskScoreCard. The "Now Attention" hero: which palm, how risky,
// why, and what to do. Color-coded, confidence bar, plain-English reason, CTAs.
// Presentational: pass score/level/confidence/reason/action + optional callbacks.
import { ShieldAlert, FileSearch, Activity } from 'lucide-react';
import { StatusPill } from './Primitives.jsx';

export function riskTone(level, score = 0) {
  const l = String(level || '').toLowerCase();
  if (l.includes('crit') || score >= 80) return { color: '#C94A3A', key: 'critical', label: 'Critical' };
  if (l.includes('high') || l.includes('elev') || score >= 61) return { color: '#D89B2B', key: 'elevated', label: level ? cap(level) : 'Elevated' };
  if (l.includes('watch') || l.includes('med') || score >= 31) return { color: '#C2A14D', key: 'watch', label: level ? cap(level) : 'Watch' };
  return { color: '#19A66A', key: 'healthy', label: level ? cap(level) : 'Healthy' };
}
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);

// A calm waveform accent (NOT an AI brain) sized by score.
const Wave = ({ color, intensity = 0.5 }) => {
  const n = 26;
  const bars = Array.from({ length: n }, (_, i) => {
    const base = Math.sin((i / n) * Math.PI * 3) * 0.5 + 0.5;
    return Math.max(0.12, base * (0.4 + intensity * 0.9));
  });
  return (
    <div className="flex items-end gap-[3px] h-8" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className="flex-1 rounded-sm" style={{ height: `${h * 100}%`, background: color, opacity: 0.25 + h * 0.55 }} />
      ))}
    </div>
  );
};

export const RiskScoreCard = ({ palmId, score = 0, level, confidence, reason, action, onEvidence, onSafety, className = '' }) => {
  const t = riskTone(level, score);
  const conf = confidence == null ? null : Math.round(confidence > 1 ? confidence : confidence * 100);
  const showSafety = onSafety && (t.key === 'elevated' || t.key === 'critical');
  return (
    <div className={`instrument overflow-hidden ${className}`} style={{ borderTop: `3px solid ${t.color}` }}>
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="hud-label">highest-risk palm</span>
          <StatusPill status={t.key}>{t.label}</StatusPill>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs text-muted">{palmId ? 'Palm' : 'Awaiting telemetry'}</div>
            <div className="telemetry-num text-lg font-semibold text-charcoal dark:text-bone truncate">{palmId || '—'}</div>
          </div>
          <div className="text-right leading-none">
            <span className="telemetry-num text-5xl font-bold" style={{ color: t.color }}>{Math.round(score)}</span>
            <span className="text-base text-muted font-medium">/100</span>
          </div>
        </div>

        <div className="mt-3"><Wave color={t.color} intensity={Math.min(1, score / 100)} /></div>

        {conf != null && (
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted">AI confidence</span>
              <span className="telemetry-num font-semibold text-charcoal dark:text-bone">{conf}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted/15 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${conf}%`, background: t.color }} />
            </div>
          </div>
        )}

        {reason && (
          <div className="mt-3 instrument-inset p-2.5 flex gap-2">
            <Activity size={14} className="text-muted shrink-0 mt-0.5" />
            <p className="text-xs text-charcoal/90 dark:text-bone/90 leading-snug">{reason}</p>
          </div>
        )}

        {action && (
          <div className="mt-2.5">
            <span className="hud-label">recommended action</span>
            <p className="text-sm font-medium text-charcoal dark:text-bone mt-0.5">{action}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {onEvidence && (
            <button onClick={onEvidence}
              className="focus-ring inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg bg-forest text-bone hover:bg-forest-600 transition-colors">
              <FileSearch size={15} /> Review evidence
            </button>
          )}
          {showSafety && (
            <button onClick={onSafety}
              className="focus-ring inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-lg border border-caution/40 text-[#9a6a16] dark:text-caution hover:bg-caution/10 transition-colors">
              <ShieldAlert size={15} /> Open Safety Gate
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiskScoreCard;
