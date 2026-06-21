import { Info } from 'lucide-react';

// Model-confidence display (§2 / §11.2). Shows P(activity) as a probability with
// an honest badge — never "98% accurate".
//   - calibrated model  -> "proxy-validated" badge
//   - heuristic/fallback -> "heuristic" badge, NO probability framing as accuracy
// The tooltip spells out the airborne-mic + proxy-validation limitation.
const TOOLTIP =
  'Airborne MEMS mic; RPW larvae feed inside the trunk, so detection is most ' +
  'reliable in quiet/close/night conditions. The model is validated on PROXY ' +
  'boring/feeding sounds (grain weevils, wood borers), not real airborne RPW. ' +
  'This is a probability, not a certified accuracy.';

export const ConfidenceBadge = ({ pActivity, modelVersion, modelSource, calibrated, size = 'md' }) => {
  const ver = modelVersion || '';
  const isToy = /toy/i.test(ver);
  const heuristic = modelSource === 'fallback' || modelSource === 'heuristic'
    || ver.startsWith('heuristic') || ver === 'fallback';
  const pct = pActivity == null ? null : Math.round(pActivity * 100);

  const label = isToy ? 'TOY — not real'
    : heuristic ? 'heuristic'
    : (calibrated ? 'proxy-validated' : 'proxy (uncalibrated)');
  const badgeColor = isToy
    ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'
    : heuristic
      ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300';

  const big = size === 'lg';

  return (
    <div className="inline-flex items-center gap-2" title={TOOLTIP}>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
          Acoustic activity
        </span>
        <span className={`font-black tabular-nums ${big ? 'text-2xl' : 'text-lg'} text-gray-900 dark:text-white`}>
          {heuristic && pct == null ? '—' : (pct == null ? '—' : `P=${(pActivity).toFixed(2)}`)}
          {pct != null && <span className="text-xs font-medium text-gray-400 ml-1">({pct}%)</span>}
        </span>
      </div>
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}`}>
        {label}
        <Info size={11} className="opacity-70" />
      </span>
    </div>
  );
};

export default ConfidenceBadge;
