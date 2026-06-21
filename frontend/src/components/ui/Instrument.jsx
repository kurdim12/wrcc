// Instrument — the base surface for the Living Telemetry Interface. Crisp,
// hairline-bordered panel (not a marketing card). Optional HUD label header.
export const Instrument = ({ label, right, children, className = '', inset = false, as: Tag = 'div' }) => (
  <Tag className={`instrument ${className}`}>
    {(label || right) && (
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        {label && <span className="hud-label">{label}</span>}
        {right}
      </div>
    )}
    <div className={inset ? 'p-3' : 'px-4 pb-4'}>{children}</div>
  </Tag>
);

export default Instrument;
