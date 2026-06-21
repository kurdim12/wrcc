// Mission counter — a compact telemetry tile (an instrument readout, not a
// marketing KPI card). Used across Mission Overview and the dashboard preview.
const TONES = {
  forest: 'text-forest-400',
  crit:   'text-crit',
  gold:   'text-gold',
  caution:'text-caution',
  muted:  'text-muted',
};

export const MissionCounter = ({ icon: Icon, label, value, sub, tone = 'forest' }) => {
  const c = TONES[tone] || TONES.forest;
  return (
    <div className="instrument px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="hud-label">{label}</span>
        {Icon && <Icon size={15} className={c} />}
      </div>
      <div className={`telemetry-num text-3xl font-bold mt-1 ${c}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
};

export default MissionCounter;
