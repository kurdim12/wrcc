// Palm Guard — TreeHealthTimeline. The 6-step story judges grasp instantly:
// Healthy Signal → Abnormal Activity → Risk Score → Farmer Alert →
// Human Confirmation → Proof Log. `activeStep` (0-5) lights the progress.
import { Activity, AudioLines, Gauge, BellRing, ShieldCheck, FileCheck, ChevronRight } from 'lucide-react';

const STEPS = [
  { icon: Activity,    label: 'Healthy Signal',     hint: 'Baseline trunk acoustics' },
  { icon: AudioLines,  label: 'Abnormal Activity',  hint: 'Feeding-like pattern rises' },
  { icon: Gauge,       label: 'Risk Score',         hint: 'Multi-sensor fusion' },
  { icon: BellRing,    label: 'Farmer Alert',       hint: 'Operator notified' },
  { icon: ShieldCheck, label: 'Human Confirmation', hint: 'Safety gate + approval' },
  { icon: FileCheck,   label: 'Proof Log',          hint: 'Evidence recorded' },
];

export const TreeHealthTimeline = ({ activeStep = -1, className = '' }) => (
  <div className={`flex items-stretch gap-1 overflow-x-auto custom-scrollbar ${className}`}>
    {STEPS.map((s, i) => {
      const done = activeStep >= 0 && i <= activeStep;
      const current = i === activeStep;
      return (
        <div key={s.label} className="flex items-center shrink-0">
          <div className={`flex flex-col items-center text-center w-[112px] px-1 ${done ? '' : 'opacity-55'}`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-colors ${
              current ? 'bg-forest text-bone border-forest'
              : done ? 'bg-forest-400/15 text-forest-600 dark:text-forest-400 border-forest-400/40'
              : 'bg-muted/10 text-muted border-muted/20'}`}>
              <s.icon size={17} />
            </span>
            <span className="text-[11px] font-semibold text-charcoal dark:text-bone mt-1.5 leading-tight">{s.label}</span>
            <span className="text-[10px] text-muted leading-tight mt-0.5">{s.hint}</span>
          </div>
          {i < STEPS.length - 1 && <ChevronRight size={15} className="text-muted/40 shrink-0 -mx-0.5" />}
        </div>
      );
    })}
  </div>
);

export default TreeHealthTimeline;
