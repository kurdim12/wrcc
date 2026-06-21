import { ModelCaveatBadge } from './ModelCaveatBadge.jsx';

// RiskHalo — calm circular ring for a fused risk score (0–100), with the model
// caveat badge alongside. Green (low) → gold (watch) → red (critical).
const band = (risk) => (risk >= 61 ? 'crit' : risk >= 31 ? 'watch' : 'ok');
const RING = { ok: '#19A66A', watch: '#C2A14D', crit: '#C94A3A' };
const LABEL = { ok: 'NOMINAL', watch: 'UNDER WATCH', crit: 'CRITICAL' };

export const RiskHalo = ({
  risk = 0, pActivity = null, modelVersion, modelSource, calibrated,
  size = 132, caveat = true,
}) => {
  const r = Math.max(0, Math.min(100, Number(risk) || 0));
  const b = band(r);
  const color = RING[b];
  const stroke = 9;
  const radius = (size - stroke) / 2 - 6;
  const circ = 2 * Math.PI * radius;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
                  className="stroke-muted/20" />
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color}
                  strokeWidth={stroke} strokeLinecap="round"
                  strokeDasharray={circ} strokeDashoffset={circ * (1 - r / 100)}
                  style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16,1,0.3,1), stroke 300ms' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="telemetry-num text-3xl font-bold leading-none" style={{ color }}>{Math.round(r)}</div>
          <div className="hud-label mt-1" style={{ color }}>{LABEL[b]}</div>
          {pActivity != null && (
            <div className="telemetry-num text-[10px] text-muted mt-1">P={Number(pActivity).toFixed(2)}</div>
          )}
        </div>
      </div>
      {caveat && (
        <ModelCaveatBadge modelVersion={modelVersion} modelSource={modelSource} calibrated={calibrated} size="xs" />
      )}
    </div>
  );
};

export default RiskHalo;
