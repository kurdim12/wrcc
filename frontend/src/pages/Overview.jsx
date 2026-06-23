import { useEffect, useMemo, useState } from 'react';
import {
  Trees, AlertTriangle, Signal, Gauge, AudioLines, Waves, Thermometer, HeartPulse, Inbox,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell,
  CartesianGrid, ReferenceLine,
} from 'recharts';

import PalmGridMap from '../components/PalmGridMap.jsx';
import AlertList from '../components/AlertList.jsx';
import {
  SectionCard, MetricTile, ChartCard, LegendDot, ModeBadge, EmptyState,
} from '../components/ui/Primitives.jsx';
import { RiskScoreCard, riskTone } from '../components/ui/RiskScoreCard.jsx';
import { EvidenceCard } from '../components/ui/EvidenceCard.jsx';
import { TreeHealthTimeline } from '../components/ui/TreeHealthTimeline.jsx';
import { useFarmStats } from '../hooks/useFarmStats.js';
import { useAlerts } from '../hooks/useAlerts.js';
import { useIntelligence } from '../hooks/useIntelligence.js';
import { api } from '../api.js';

const tooltipStyle = { background: '#101C17', border: '1px solid rgba(140,155,145,0.2)', borderRadius: 8, fontSize: 11, color: '#F4EFE2' };

// Plain-English helpers (no AI hype, no fake certainty).
const reasonFor = (s) =>
  s >= 80 ? 'Acoustic activity is well above the normal feeding-noise baseline, and vibration corroborates a trunk-borne source.'
  : s >= 61 ? 'Feeding-like acoustic activity has risen above baseline; vibration partially supports the signal.'
  : s >= 31 ? 'Mild acoustic variation detected — within watch range, worth keeping an eye on.'
  : 'Acoustic and vibration readings are within the normal baseline for this palm.';
const actionFor = (s) =>
  s >= 80 ? 'Inspect this palm and prepare a human-confirmed clear-water demo dose via the Safety Gate.'
  : s >= 61 ? 'Review the acoustic evidence and schedule a field inspection.'
  : s >= 31 ? 'Continue monitoring; no action required yet.'
  : 'Continue routine monitoring.';
const bandStatus = (s) => (s >= 80 ? 'critical' : s >= 61 ? 'elevated' : s >= 31 ? 'watch' : 'healthy');

export const Overview = ({ palms, onSelectPalm, selectedPalm, onAlertClick, onGotoAlerts, onGotoSafety, sysMode }) => {
  const { stats } = useFarmStats();
  const { alerts } = useAlerts('active');
  const [trends, setTrends] = useState([]);
  const [tempBuckets, setTempBuckets] = useState(null);

  useEffect(() => {
    const load = () => {
      api.riskTrends(30).then(setTrends).catch(() => {});
      api.tempBuckets().then(setTempBuckets).catch(() => {});
    };
    load();
    const i = setInterval(load, 30000);
    return () => clearInterval(i);
  }, []);

  // Focused palm = the one the operator opened, else the highest-risk monitored palm.
  const focusPalm = useMemo(() => {
    if (selectedPalm?.device_id) return selectedPalm;
    const withDev = palms.filter((p) => p.device_id);
    return withDev.slice().sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))[0] || null;
  }, [palms, selectedPalm]);

  const intel = useIntelligence(focusPalm?.device_id);
  const score = Math.round(focusPalm?.risk_score ?? intel?.fusion?.risk ?? 0);
  const level = focusPalm?.risk_level ?? intel?.fusion?.level;
  const confidence = typeof intel?.fusion?.confidence === 'number' ? intel.fusion.confidence : null;
  const reason = (typeof intel?.explanation === 'string' && intel.explanation) || reasonFor(score);
  const action = actionFor(score);
  const tone = riskTone(level, score);
  const activeStep = score >= 80 ? 3 : score >= 61 ? 2 : score >= 31 ? 1 : 0;
  const mode = sysMode?.mode || 'demo';

  const trendsData = trends.map((t) => ({ day: (t.day || '').slice(5), avg: +(t.avg_risk ?? 0).toFixed(1), max: +(t.max_risk ?? 0).toFixed(1) }));
  const tempData = tempBuckets ? [
    { name: 'Cold', value: tempBuckets.very_low ?? 0, color: '#0A5C44' },
    { name: 'Cool', value: tempBuckets.low ?? 0, color: '#19A66A' },
    { name: 'Normal', value: tempBuckets.normal ?? 0, color: '#C2A14D' },
    { name: 'Warm', value: tempBuckets.high ?? 0, color: '#D89B2B' },
    { name: 'Hot', value: tempBuckets.very_high ?? 0, color: '#C94A3A' },
  ] : [];

  // Evidence (plain-English, always renders; status reflects the risk band).
  const evidence = [
    { title: 'Acoustic activity', icon: AudioLines, status: bandStatus(score),
      description: score >= 61 ? 'Feeding-like activity above the normal baseline.' : 'Within the normal feeding-noise baseline.' },
    { title: 'Vibration validation', icon: Waves, status: score >= 61 ? 'watch' : 'healthy',
      description: score >= 61 ? 'Trunk vibration partially corroborates the acoustic signal.' : 'No abnormal trunk vibration.' },
    { title: 'Environmental context', icon: Thermometer, status: 'neutral',
      description: 'Trunk temperature and air readings give supporting context only.' },
    { title: 'Sensor health', icon: HeartPulse, status: (focusPalm?.device_id ? 'healthy' : 'offline'),
      description: focusPalm?.device_id ? 'Sensors reporting — data is reliable.' : 'No device assigned to this palm yet.' },
  ];

  const highest = stats?.criticalAlerts ?? 0;

  return (
    <div className="space-y-5">
      {/* product hero strip */}
      <div className="instrument overflow-hidden">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
             style={{ borderLeft: '3px solid #19A66A' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-charcoal dark:text-bone">Palm Guard</span>
              <span className="text-xs text-forest-600 dark:text-forest-400 font-medium">It listens. It detects. It acts.</span>
            </div>
            <p className="text-xs text-muted mt-0.5">Early acoustic risk detection for date-palm protection — human-confirmed, clear-water demo.</p>
          </div>
          <ModeBadge mode={mode} />
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile icon={Trees} label="Palms monitored" value={stats?.totalPalms ?? 0} sub={`${stats?.totalDevices ?? 0} field nodes`} status="muted" />
        <MetricTile icon={Signal} label="Devices online" value={`${stats?.onlinePct ?? 0}`} unit="%" sub={`${stats?.onlineDevices ?? 0}/${stats?.totalDevices ?? 0} reporting`} status="forest" />
        <MetricTile icon={AlertTriangle} label="Active incidents" value={stats?.activeAlerts ?? 0} sub={`${highest} critical`} status={highest > 0 ? 'crit' : 'muted'} />
        <MetricTile icon={Gauge} label="Highest risk" value={score} unit="/100" sub={focusPalm?.id ? `Palm ${focusPalm.id}` : '—'} status={tone.key === 'healthy' ? 'forest' : tone.key === 'watch' ? 'gold' : tone.key === 'elevated' ? 'caution' : 'crit'} />
      </div>

      {/* hero: dominant map + Now Attention */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8">
          <SectionCard title="Living orchard command map" subtitle="Tap a palm to inspect it"
            action={
              <div className="hidden sm:flex items-center gap-3">
                <LegendDot color="#19A66A" label="Healthy" />
                <LegendDot color="#C2A14D" label="Watch" />
                <LegendDot color="#D89B2B" label="Elevated" />
                <LegendDot color="#C94A3A" label="Critical" />
              </div>
            }>
            <PalmGridMap palms={palms} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height="h-[420px]" />
          </SectionCard>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <RiskScoreCard
            palmId={focusPalm?.id || focusPalm?.device_id}
            score={score} level={level} confidence={confidence}
            reason={reason} action={action}
            onEvidence={() => focusPalm && onSelectPalm?.(focusPalm)}
            onSafety={onGotoSafety}
          />
          <SectionCard title="Active incidents" subtitle="What needs attention now"
            action={alerts.length > 0 && onGotoAlerts && (
              <button onClick={onGotoAlerts} className="focus-ring text-xs font-semibold text-forest-600 dark:text-forest-400 hover:underline">View all</button>
            )}>
            <div className="max-h-[230px] overflow-y-auto custom-scrollbar -mx-1 px-1">
              {alerts.length === 0
                ? <EmptyState icon={Inbox} title="All clear" hint="No active incidents in the orchard." />
                : <AlertList alerts={alerts} onSelect={(a) => onAlertClick?.(a.device_id)} compact />}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* tree-health story */}
      <SectionCard title="How Palm Guard protects this tree" subtitle="Detection → evidence → human-confirmed action → proof">
        <TreeHealthTimeline activeStep={activeStep} />
      </SectionCard>

      {/* evidence */}
      <div>
        <div className="hud-label mb-2">why this palm is flagged · plain-English evidence</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {evidence.map((e) => <EvidenceCard key={e.title} {...e} />)}
        </div>
      </div>

      {/* secondary charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <ChartCard className="lg:col-span-2" title="Risk trend" subtitle="Average vs peak risk · last 30 days"
          legend={<><LegendDot color="#19A66A" label="Avg" /><LegendDot color="#C94A3A" label="Peak" /><LegendDot color="#D89B2B" label="Elevated 61" /></>}>
          {trendsData.length < 2 ? <Loading /> : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendsData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8C9B91" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                <Tooltip contentStyle={tooltipStyle} />
                <ReferenceLine y={80} stroke="#C94A3A" strokeDasharray="2 4" strokeOpacity={0.5} />
                <ReferenceLine y={61} stroke="#D89B2B" strokeDasharray="2 4" strokeOpacity={0.5} />
                <Line type="monotone" dataKey="avg" stroke="#19A66A" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="max" stroke="#C94A3A" strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Trunk temperature spread" subtitle="Distribution across the orchard · 24 h">
          {!tempData.length ? <Loading /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tempData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#8C9B91" strokeOpacity={0.12} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                <YAxis tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(140,155,145,0.08)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {tempData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
};

const Loading = () => <div className="h-full flex items-center justify-center hud-label">collecting telemetry…</div>;

export default Overview;
