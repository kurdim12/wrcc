import { useState, useMemo } from 'react';
import {
  AudioLines, Waves, Thermometer, HeartPulse, Cpu, ShieldAlert,
  ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Syringe, Radio,
} from 'lucide-react';
import { RiskHalo } from '../components/RiskHalo.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { useIntelligence } from '../hooks/useIntelligence.js';

const LEVEL_TONE = {
  low: '#19A66A', watch: '#C2A14D', elevated: '#D89B2B', high: '#C94A3A', critical: '#C94A3A',
};
const REC_LABEL = {
  observe: 'Observe', resample: 'Resample', inspect: 'Inspect',
  prepare_human_confirmed_dose: 'Prepare human-confirmed dose',
};

const ExpertCard = ({ icon: Icon, title, kind, expert, healthMode = false }) => {
  if (!expert) return (
    <div className="instrument p-4 opacity-60"><div className="hud-label">{title}</div><div className="text-sm text-muted mt-2">awaiting telemetry…</div></div>
  );
  const score = healthMode ? expert.score : expert.score;
  const ok = healthMode ? expert.healthy : true;
  const tone = healthMode ? (expert.healthy ? '#19A66A' : '#C94A3A')
    : score >= 75 ? '#C94A3A' : score >= 50 ? '#D89B2B' : score >= 25 ? '#C2A14D' : '#19A66A';
  const reasons = healthMode ? [...(expert.faults || []), ...(expert.warnings || [])] : (expert.reasons || []);
  return (
    <div className="instrument p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${tone}22`, color: tone }}><Icon size={16} /></span>
          <div><div className="font-bold text-sm text-charcoal dark:text-bone">{title}</div><div className="hud-label">{kind}</div></div>
        </div>
        {healthMode
          ? (ok ? <CheckCircle2 size={18} className="text-forest-400" /> : <AlertTriangle size={18} className="text-crit" />)
          : <span className="telemetry-num text-2xl font-bold" style={{ color: tone }}>{score}</span>}
      </div>
      <div className="flex items-center justify-between">
        <span className="hud-label" style={{ color: tone }}>{healthMode ? (expert.healthy ? 'healthy' : 'degraded') : (expert.label || '').replace(/_/g, ' ')}</span>
        {!healthMode && <span className="hud-label">conf {expert.confidence}</span>}
        {healthMode && <span className="hud-label">score {expert.score}</span>}
      </div>
      <ul className="mt-1 space-y-1">
        {(reasons.length ? reasons : ['no notes']).slice(0, 2).map((r, i) => (
          <li key={i} className="text-[11px] text-charcoal/75 dark:text-bone/75 flex gap-1.5"><span className="text-muted">·</span>{r}</li>
        ))}
      </ul>
    </div>
  );
};

const FlowStep = ({ label, sub, tone = 'muted', last }) => (
  <div className="flex items-center gap-2 shrink-0">
    <div className="instrument-inset px-3 py-2 text-center min-w-[96px]">
      <div className="hud-label" style={tone !== 'muted' ? { color: tone } : undefined}>{label}</div>
      {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
    </div>
    {!last && <ChevronRight size={16} className="text-muted shrink-0" />}
  </div>
);

const SafetyRow = ({ label, value, ok }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-muted/10 last:border-0">
    <span className="hud-label">{label}</span>
    <span className={`telemetry-num text-xs font-bold ${ok === false ? 'text-crit' : ok === true ? 'text-forest-400' : 'text-charcoal dark:text-bone'}`}>{value}</span>
  </div>
);

export default function Intelligence({ deviceId: controlled }) {
  const { devices } = useDevices();
  const [picked, setPicked] = useState('');
  const deviceId = controlled || picked || '';
  const intel = useIntelligence(deviceId);

  const f = intel?.fusion;
  const ex = intel?.experts;
  const safety = intel?.safety;
  const tone = f ? (LEVEL_TONE[f.level] || '#8C9B91') : '#8C9B91';
  const recDose = f?.recommendation === 'prepare_human_confirmed_dose';

  return (
    <div className="space-y-5">
      {/* header + device picker */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-charcoal dark:text-bone"><Cpu size={18} className="text-forest-400" /><h2 className="font-bold text-lg">Intelligence Layer · Sensor Fusion</h2></div>
          <p className="hud-label mt-1">multi-sensor expert architecture — not a single black-box detector</p>
        </div>
        {!controlled && (
          <div className="relative">
            <select value={picked} onChange={(e) => setPicked(e.target.value)}
              className="focus-ring appearance-none instrument-inset px-3 py-2 pr-9 text-sm font-bold text-charcoal dark:text-bone cursor-pointer">
              <option value="">PG-DEMO-101 (default)</option>
              {devices.map((d) => <option key={d.id} value={d.id}>{d.id}{d.id?.startsWith('PG-DEMO') ? ' (demo)' : ''}</option>)}
            </select>
            <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted" />
          </div>
        )}
      </div>

      {/* risk hero */}
      <div className="instrument p-5 grid md:grid-cols-[auto_1fr] gap-5 items-center">
        <RiskHalo risk={f?.risk ?? 0} pActivity={null} size={132} caveat={false} />
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: `${tone}22`, color: tone }}>{f?.level || '—'}</span>
            <span className="hud-label">confidence <span className="telemetry-num text-charcoal dark:text-bone font-bold">{f?.confidence ?? '—'}</span></span>
            <span className="hud-label instrument-inset px-2 py-0.5 text-caution">acoustic activity · proxy — not confirmed RPW</span>
          </div>
          <div className="mt-3">
            <div className="hud-label">recommendation</div>
            <div className="text-xl font-bold mt-0.5" style={{ color: recDose ? tone : undefined }}>{f ? (REC_LABEL[f.recommendation] || f.recommendation) : 'awaiting telemetry…'}</div>
          </div>
          {recDose && <div className="mt-2 text-[12px] text-caution flex items-center gap-1.5"><ShieldAlert size={14} /> advisory only — arm + human confirmation + caps still required</div>}
        </div>
      </div>

      {/* expert cards */}
      <div>
        <div className="hud-label mb-2">expert models</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <ExpertCard icon={AudioLines}  title="Acoustic Activity"     kind="primary signal"    expert={ex?.acoustic} />
          <ExpertCard icon={Waves}       title="Vibration Validation"  kind="corroboration"     expert={ex?.vibration} />
          <ExpertCard icon={Thermometer} title="Environmental Context" kind="context only"      expert={ex?.environment} />
          <ExpertCard icon={HeartPulse}  title="Sensor Health"         kind="reliability gate"  expert={ex?.sensorHealth} healthMode />
        </div>
      </div>

      {/* decision flow */}
      <div className="instrument p-4">
        <div className="hud-label mb-3">decision flow</div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
          <FlowStep label="Sensors" sub="mic·IMU·temp·VOC" />
          <FlowStep label="Experts" sub="4 models" tone="#19A66A" />
          <FlowStep label="Fusion" sub={f ? `${f.risk}/100` : '—'} tone={tone} />
          <FlowStep label="Safety Agent" sub="server+device caps" tone="#C2A14D" />
          <FlowStep label="Human Confirm" sub="mandatory" tone="#C94A3A" />
          <FlowStep label="Capped Demo Dose" sub="clear water" tone="#C2A14D" last />
        </div>
      </div>

      {/* explanation + safety */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="instrument p-4">
          <div className="hud-label mb-2">explanation</div>
          <p className="text-sm leading-relaxed text-charcoal/85 dark:text-bone/85">{intel?.explanation || 'Awaiting the first fused decision…'}</p>
          {intel?.model && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {Object.entries(intel.model).map(([k, v]) => (
                <span key={k} className="hud-label instrument-inset px-2 py-0.5">{String(v).replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
        </div>

        <div className="instrument p-4">
          <div className="flex items-center gap-2 mb-2"><Syringe size={15} className="text-crit" /><div className="hud-label">safety — human-gated, capped, clear water (demo)</div></div>
          {safety ? (
            <div>
              <SafetyRow label="Node armed" value={safety.caps.armed ? 'ARMED' : 'disarmed'} ok={safety.caps.armed ? null : true} />
              <SafetyRow label="Human confirmation" value="required" ok={true} />
              <SafetyRow label="Dose allowed by caps" value={safety.allowed ? 'caps pass' : `blocked: ${safety.blockedReason}`} ok={safety.allowed} />
              <SafetyRow label="Server + device caps" value="both enforced" ok={true} />
              <SafetyRow label="Doses today" value={`${safety.caps.dosesToday} / ${safety.caps.maxDosesDay}`} ok={safety.caps.dosesToday >= safety.caps.maxDosesDay ? false : null} />
              <SafetyRow label="Cooldown" value={safety.caps.cooldownRemainingS > 0 ? `${Math.ceil(safety.caps.cooldownRemainingS / 60)}m left` : `${Math.round(safety.caps.cooldownS / 60)}m`} ok={safety.caps.cooldownRemainingS > 0 ? false : null} />
              <SafetyRow label="Pump-ms ceiling" value={`${safety.caps.pumpMs} / ${safety.caps.pumpMsCeiling} ms`} />
              <SafetyRow label="Anti-replay nonce" value="active" ok={true} />
              <SafetyRow label="Demo medium" value={safety.demoClearWaterOnly ? 'CLEAR WATER ONLY' : 'live'} ok={safety.demoClearWaterOnly ? true : null} />
            </div>
          ) : <div className="text-sm text-muted flex items-center gap-2"><Radio size={14} /> awaiting safety telemetry…</div>}
        </div>
      </div>
    </div>
  );
}
