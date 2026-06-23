// Palm Guard — EvidenceCard. One compact, plain-English evidence tile used for
// Acoustic / Vibration / Environment / Sensor-health. Presentational.
import { StatusPill } from './Primitives.jsx';

export const EvidenceCard = ({ title, score, status = 'neutral', description, icon: Icon, unit }) => (
  <div className="instrument p-3.5 flex flex-col gap-2 h-full">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && (
          <span className="w-7 h-7 rounded-lg bg-forest-400/10 text-forest-600 dark:text-forest-400 flex items-center justify-center shrink-0">
            <Icon size={15} />
          </span>
        )}
        <span className="text-sm font-semibold text-charcoal dark:text-bone truncate">{title}</span>
      </div>
      <StatusPill status={status} dot={false} className="shrink-0" />
    </div>

    {score != null && (
      <div className="flex items-baseline gap-1">
        <span className="telemetry-num text-2xl font-bold text-charcoal dark:text-bone">{score}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
    )}

    {description && <p className="text-xs text-muted leading-snug">{description}</p>}
  </div>
);

export default EvidenceCard;
