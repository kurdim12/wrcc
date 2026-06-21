import { Mic, Waves, Thermometer, Battery, Signal, Lock, ShieldCheck } from 'lucide-react';
import { useLiveReadings } from '../hooks/useLiveReadings.js';
import { RiskHalo } from './RiskHalo.jsx';

// PalmVitalCard — a tree's "medical monitor": risk halo + live vitals + a small
// heartbeat trace. Self-contained: streams the device's readings itself.
const fmt = (v, d = 1, s = '') => (v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v).toFixed(d)}${s}`);

const Heartbeat = ({ values, color = '#19A66A' }) => {
  if (!values || values.length < 2) return <div className="h-8 instrument-inset" />;
  const max = Math.max(1, ...values), min = Math.min(0, ...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${28 - ((v - min) / span) * 26}`).join(' ');
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className="w-full h-8 instrument-inset">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const Vital = ({ icon: Icon, label, value }) => (
  <div className="instrument-inset px-2.5 py-1.5">
    <div className="flex items-center gap-1.5 text-muted mb-0.5"><Icon size={12} /><span className="hud-label">{label}</span></div>
    <div className="telemetry-num text-sm font-semibold text-charcoal dark:text-bone">{value}</div>
  </div>
);

export const PalmVitalCard = ({ palm, device, className = '' }) => {
  const deviceId = palm?.device_id || device?.id;
  const { readings, latest } = useLiveReadings(deviceId, { keep: 40 });
  const r = latest || {};
  const risk = r.risk_score ?? palm?.risk_score ?? 0;
  const armed = r?.act?.armed ?? device?.armed ?? false;
  const trace = readings.slice(-40).map((x) => x.sa ?? 0);

  if (!palm && !device) {
    return <div className={`instrument p-6 text-center hud-label ${className}`}>select a palm</div>;
  }

  return (
    <div className={`instrument p-4 flex flex-col gap-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-lg text-charcoal dark:text-bone">{palm?.id || deviceId}</div>
          <div className="hud-label">{palm?.farm_id || 'orchard'}{palm?.row_idx != null ? ` · row ${palm.row_idx + 1}` : ''}</div>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
          armed ? 'bg-forest-400/15 text-forest-400 border-forest-400/30' : 'bg-muted/15 text-muted border-muted/25'}`}>
          {armed ? <ShieldCheck size={11} /> : <Lock size={11} />}{armed ? 'ARMED' : 'LOCKED'}
        </span>
      </div>

      <div className="flex items-center gap-4">
        <RiskHalo risk={risk} pActivity={r.p_activity} modelVersion={r.model_version}
                  modelSource={r.model_source} calibrated={r.calibrated} size={108} />
        <div className="flex-1 grid grid-cols-2 gap-2">
          <Vital icon={Mic} label="Acoustic" value={`${fmt(r.ac_clk, 1)}/s`} />
          <Vital icon={Waves} label="Vib RMS" value={fmt(r.vib_rms, 3, ' g')} />
          <Vital icon={Thermometer} label="Trunk Δ" value={r.core_c != null && r.amb_c != null ? fmt(r.core_c - r.amb_c, 1, '°C') : '—'} />
          <Vital icon={Battery} label="Battery" value={r.battery_pct != null ? `${r.battery_pct}%` : (device?.battery_pct != null ? `${device.battery_pct}%` : '—')} />
        </div>
      </div>

      <div>
        <div className="hud-label mb-1 flex items-center gap-2"><Signal size={11} /> acoustic pulse (SA, last 40)</div>
        <Heartbeat values={trace} color={risk >= 61 ? '#C94A3A' : risk >= 31 ? '#C2A14D' : '#19A66A'} />
      </div>
    </div>
  );
};

export default PalmVitalCard;
