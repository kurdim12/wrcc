import { Info } from 'lucide-react';

// Single source of truth for how the model's status is shown — honest by design
// (§2). Never implies certified accuracy.
//   TOY        → red    : trained on synthetic toy data, meaningless numbers
//   HEURISTIC  → slate  : transparent heuristic baseline / fusion fallback
//   PROXY      → amber  : trained on proxy boring-sound corpora (uncalibrated)
//   PROXY ✓    → gold   : proxy-trained + calibrated probability
// "Field-validated on RPW" is intentionally NOT a state we can claim yet.
export const modelState = ({ modelVersion = '', modelSource = '', calibrated = false } = {}) => {
  const v = String(modelVersion || '');
  if (/toy/i.test(v)) return { key: 'toy', label: 'TOY — not real', tone: 'crit' };
  const heuristic = modelSource === 'fallback' || modelSource === 'heuristic'
    || v.startsWith('heuristic') || v === 'fallback' || v === '';
  if (heuristic) return { key: 'heuristic', label: 'heuristic', tone: 'slate' };
  return calibrated
    ? { key: 'proxy-cal', label: 'proxy ✓', tone: 'gold' }
    : { key: 'proxy', label: 'proxy (uncalibrated)', tone: 'amber' };
};

const TONE = {
  crit:  'bg-crit/15 text-crit border-crit/30',
  slate: 'bg-muted/15 text-muted border-muted/25',
  gold:  'bg-gold/15 text-gold border-gold/30',
  amber: 'bg-caution/15 text-caution border-caution/30',
};

const TOOLTIP =
  "Palm Guard's score is an acoustic ACTIVITY estimate from an airborne mic — not a certified " +
  'RPW accuracy. Trained/validated on proxy boring sounds; real RPW field validation is the documented next step.';

export const ModelCaveatBadge = ({ modelVersion, modelSource, calibrated, size = 'sm', showInfo = true }) => {
  const s = modelState({ modelVersion, modelSource, calibrated });
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  return (
    <span title={TOOLTIP}
      className={`inline-flex items-center gap-1 rounded-full border font-bold uppercase tracking-wider ${pad} ${TONE[s.tone]}`}>
      {s.label}
      {showInfo && <Info size={size === 'xs' ? 9 : 11} className="opacity-70" />}
    </span>
  );
};

export default ModelCaveatBadge;
