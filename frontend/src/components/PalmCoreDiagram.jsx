// Vertical trunk silhouette with the clamped device + a labelled "activity zone".
// Honest: this is an activity VISUALISATION, never an exact larvae location.
export const PalmCoreDiagram = ({ risk = 0 }) => {
  const tone = risk >= 61 ? '#C94A3A' : risk >= 31 ? '#C2A14D' : '#19A66A';
  return (
    <div className="instrument-inset p-3 flex gap-3 items-stretch">
      <svg viewBox="0 0 60 160" className="h-40 w-16 shrink-0">
        <rect x="22" y="10" width="16" height="140" rx="7" className="fill-muted/20" />
        <rect x="24" y="12" width="12" height="136" rx="6" className="fill-forest/30 dark:fill-forest-400/10" />
        {/* activity zone around the device */}
        <rect x="16" y="78" width="28" height="34" rx="6" fill={tone} opacity="0.18">
          {risk >= 61 && <animate attributeName="opacity" values="0.12;0.30;0.12" dur="1.6s" repeatCount="indefinite" />}
        </rect>
        {/* device clamp */}
        <rect x="14" y="92" width="8" height="6" rx="1.5" fill={tone} />
        <circle cx="30" cy="95" r="2.2" fill={tone} />
      </svg>
      <div className="flex flex-col justify-center gap-2">
        <div><div className="hud-label">device</div><div className="text-xs text-charcoal dark:text-bone">clamped on trunk</div></div>
        <div><div className="hud-label">activity zone</div><div className="text-xs" style={{ color: tone }}>elevated acoustic/vib region</div></div>
        <div className="text-[10px] text-muted leading-snug">Activity visualization — not an exact larvae location.</div>
      </div>
    </div>
  );
};

export default PalmCoreDiagram;
