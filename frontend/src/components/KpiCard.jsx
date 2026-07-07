import Card from './ui/Card.jsx';
import { useCountUp } from '../hooks/useCountUp.js';

// KpiCard - shows a single farm-wide metric.
//   value:  number (animated) | string (rendered as-is, never animated)
//   sub:    optional small chip (e.g. "+1 from yesterday", "5 active alerts")
//   accent: 'good' | 'critical' | undefined  (chip color)
//   color:  CSS class set for the icon backdrop
const SUFFIX_REGEX = /([%]|\s?[a-zA-Z]+)$/;

const splitNumeric = (value) => {
  if (value == null) return { isNum: false };
  if (typeof value === 'number') return { isNum: Number.isFinite(value), num: value, suffix: '' };
  const str = String(value);
  const m = str.match(/^(-?\d+(?:\.\d+)?)\s*(.*)$/);
  if (!m) return { isNum: false };
  const num = parseFloat(m[1]);
  return { isNum: Number.isFinite(num), num, suffix: m[2] };
};

export const KpiCard = ({ title, value, sub, icon: Icon, color = 'bg-[#43C76E]/12 text-[#2BAE5E] dark:text-[#43C76E]', accent }) => {
  const { isNum, num, suffix } = splitNumeric(value);
  const decimals = isNum && !Number.isInteger(num) ? 1 : 0;
  const display = useCountUp(isNum ? num : 0, { duration: 700, decimals });

  const formatted = isNum
    ? `${decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}${suffix ? (/^\s*[a-zA-Z]/.test(suffix) ? ' ' + suffix.trim() : suffix) : ''}`
    : (value ?? '–');

  return (
    <Card className="p-5 md:p-6 relative overflow-hidden border border-black/5 dark:border-white/8 shadow-sm hover:shadow-xl dark:hover:border-white/12 transition-all group">
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-current opacity-[0.04] group-hover:opacity-[0.08] transition-opacity blur-xl pointer-events-none" />
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-4 gap-3">
          <div className={`p-3 rounded-2xl ${color} transition-transform group-hover:scale-110 shrink-0`}>
            <Icon size={22} />
          </div>
          {sub && (
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${
              accent === 'critical' ? 'bg-[#EE5A48]/12 text-[#EE5A48] dark:bg-[#EE5A48]/15 dark:text-[#EE5A48]' :
              accent === 'good'     ? 'bg-[#43C76E]/12 text-[#2BAE5E] dark:bg-[#43C76E]/15 dark:text-[#43C76E]' :
                                       'bg-[#98A69D]/12 text-gray-600 dark:bg-[#98A69D]/12 dark:text-muted'
            }`}>{sub}</span>
          )}
        </div>
        <h3 className="cm-display text-3xl md:text-4xl font-black text-gray-900 dark:text-bone tracking-tight mb-1 tabular-nums leading-tight">
          {formatted}
        </h3>
        <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-muted">{title}</p>
      </div>
    </Card>
  );
};

export default KpiCard;
