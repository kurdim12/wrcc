// Overview — Palm Guard mission control. Matches the approved dashboard design:
// KPI row (live sparklines) · Palm Status Map + roster table · Live Spectrogram ·
// Risk Score trend · Battery & Solar health · High Risk Alerts · Recent Devices.
// EVERYTHING is wired to the real backend (/stats, /palms, /alerts, /doses) — no
// mock numbers. Renders safely with empty data (no page can break).
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ShieldPlus, FlaskConical, Signal, Sun, BatteryMedium,
  ChevronRight, MapPin, Radio, CheckCircle2, Inbox, Droplets,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts';

import PalmGridMap from '../components/PalmGridMap.jsx';
import SpectrogramConsole from '../components/SpectrogramConsole.jsx';
import { SectionCard, EmptyState } from '../components/ui/Primitives.jsx';
import { useFarmStats } from '../hooks/useFarmStats.js';
import { useAlerts } from '../hooks/useAlerts.js';
import { api } from '../api.js';

/* ── helpers ──────────────────────────────────────────────────────────── */
const rel = (ts) => {
  if (!ts) return '';
  const d = Math.floor(Date.now() / 1000) - ts;
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};
const loc = (p) => p ? `Row ${(p.row_idx ?? 0) + 1} · Bay ${(p.col_idx ?? 0) + 1}` : '—';
const num = (n) => (n == null ? '—' : Number(n).toLocaleString());
const band = (p) => {
  const c = p?.classification, s = p?.risk_score ?? 0;
  if (c === 'high' || s >= 61) return { key: 'high', label: 'High', color: '#C94A3A' };
  if (c === 'medium' || s >= 31) return { key: 'watch', label: 'Elevated', color: '#D89B2B' };
  return { key: 'low', label: 'Low', color: '#19A66A' };
};
const toSeries = (rows) => (rows || []).map((r) => ({ v: Number(r.v) || 0 }));

/* ── sparkline ────────────────────────────────────────────────────────── */
const Spark = ({ data, color = '#19A66A', id }) => {
  if (!data || data.length < 2) return <div className="w-24 h-10 sm:w-28 sm:h-11" />;
  return (
    <div className="w-24 h-10 sm:w-28 sm:h-11 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`spk-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.8}
                fill={`url(#spk-${id})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

/* ── KPI card (matches reference) ─────────────────────────────────────── */
const Kpi = ({ icon: Icon, label, value, unit, sub, spark, color, id }) => (
  <div className="pg-card pg-card-hover p-4 sm:p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}1A` }}>
            <Icon size={17} style={{ color }} />
          </span>
          <span className="cm-label">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5 mt-3">
          <span className="font-display text-[28px] sm:text-[32px] font-bold leading-none telemetry-num cm-ink">{value}</span>
          {unit && <span className="text-sm cm-muted font-medium">{unit}</span>}
        </div>
        <div className="text-[11px] sm:text-xs cm-muted mt-1.5 truncate">{sub}</div>
      </div>
      <Spark data={spark} color={color} id={id} />
    </div>
  </div>
);

/* ── small inline list rows ───────────────────────────────────────────── */
const tooltipStyle = { background: 'var(--cm-raised)', border: '1px solid var(--cm-border)', borderRadius: 10, fontSize: 11, color: 'var(--cm-ink)' };

export default function Overview({ palms = [], onSelectPalm, onGotoPalms, onGotoAlerts, onGotoSafety, onGotoReports }) {
  const { stats } = useFarmStats();
  const { alerts } = useAlerts('active');
  const [trends, setTrends] = useState([]);
  const [kpi, setKpi] = useState(null);
  const [doses, setDoses] = useState([]);

  useEffect(() => {
    const load = () => {
      api.riskTrends(14).then(setTrends).catch(() => {});
      api.kpiTrends(14).then(setKpi).catch(() => {});
      api.doses().then((d) => setDoses(d || [])).catch(() => {});
    };
    load();
    const i = setInterval(load, 20000);
    return () => clearInterval(i);
  }, []);

  const palmByDevice = useMemo(
    () => Object.fromEntries(palms.filter((p) => p.device_id).map((p) => [p.device_id, p])),
    [palms]
  );

  const topPalms = useMemo(
    () => palms.slice().sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0)).slice(0, 6),
    [palms]
  );

  const highAlerts = useMemo(
    () => alerts.slice().sort((a, b) => (b.trigger_value ?? 0) - (a.trigger_value ?? 0)).slice(0, 5),
    [alerts]
  );

  const recentDoses = useMemo(
    () => doses.slice().sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0)).slice(0, 5),
    [doses]
  );

  const trendsData = trends.map((t) => ({ day: (t.day || '').slice(5), avg: +(t.avg_risk ?? 0).toFixed(1) }));
  const avgBattery = stats?.avgBatteryPct;
  const solar = avgBattery == null ? { label: '—', tone: '#8C9B91' }
    : avgBattery >= 80 ? { label: 'Excellent', tone: '#19A66A' }
    : avgBattery >= 60 ? { label: 'Good', tone: '#C2A14D' }
    : { label: 'Fair', tone: '#D89B2B' };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <Kpi id="palms" icon={Signal} color="#19A66A" label="Total Palms"
          value={num(stats?.totalPalms)} unit={stats?.totalDevices ? `/ ${num(stats.totalDevices)}` : ''}
          sub={`${stats?.onlinePct ?? 0}% online`} spark={toSeries(kpi?.online)} />
        <Kpi id="alerts" icon={AlertTriangle} color="#D89B2B" label="Active Alerts"
          value={num(stats?.activeAlerts)} sub={`${stats?.criticalAlerts ?? 0} critical now`}
          spark={toSeries(kpi?.alerts)} />
        <Kpi id="risk" icon={ShieldPlus} color="#19A66A" label="Average Risk"
          value={Math.round(stats?.avgRiskScore ?? 0)} unit="/ 100" sub="Risk Score 0–100"
          spark={toSeries(kpi?.risk)} />
        <Kpi id="treated" icon={FlaskConical} color="#C2A14D" label="Trees Treated"
          value={num(stats?.treesTreated)} sub="Human-confirmed dosing"
          spark={toSeries(kpi?.treated)} />
      </div>

      {/* ── Map + Spectrogram ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard
          title={<span className="inline-flex items-center gap-2"><MapPin size={16} className="text-forest-400" /> Palm Status Map</span>}
          action={<button onClick={onGotoPalms} className="pg-focus text-xs font-semibold text-forest-600 dark:text-forest-400 hover:underline">View all palms →</button>}>
          <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-4">
            <PalmGridMap palms={palms} onSelectPalm={onSelectPalm} height="h-[300px]" orchardImageUrl="/orchard.jpg" />
            <div className="min-w-0">
              <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-1 pb-2 cm-label">
                <span>Palm · Location</span><span className="text-right">Risk</span><span className="text-right">Status</span>
              </div>
              <div className="space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                {topPalms.length === 0 && <EmptyState icon={Radio} title="No palms yet" hint="Seed the farm to populate." />}
                {topPalms.map((p) => {
                  const b = band(p);
                  return (
                    <button key={p.id} onClick={() => onSelectPalm?.(p)}
                      className="pg-focus w-full grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-1.5 py-2 rounded-lg hover:bg-[var(--cm-green-soft)] transition-colors text-left">
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold cm-ink truncate">{p.id}</span>
                        <span className="block text-[11px] cm-muted truncate">{loc(p)}</span>
                      </span>
                      <span className="telemetry-num text-[13px] font-bold text-right" style={{ color: b.color }}>{Math.round(p.risk_score ?? 0)}</span>
                      <span className="inline-flex items-center justify-end gap-1.5 text-[11px] font-semibold" style={{ color: b.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />{b.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Live spectrogram — the real instrument, self-contained */}
        <SpectrogramConsole />
      </div>

      {/* ── Risk trend + Battery/Solar · Alerts · Recent devices ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* left column: risk chart + battery/solar */}
        <div className="space-y-4">
          <SectionCard title="Risk Score (0–100)" subtitle="Orchard average · last 14 days">
            <div className="h-44">
              {trendsData.length < 2
                ? <EmptyState icon={Activity} title="Collecting telemetry" hint="Risk trend builds as readings arrive." />
                : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendsData} margin={{ top: 6, right: 8, bottom: 0, left: -22 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#8C9B91" strokeOpacity={0.12} vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <ReferenceLine y={61} stroke="#D89B2B" strokeDasharray="4 4" strokeOpacity={0.55} label={{ value: 'heuristic baseline', fontSize: 9, fill: '#8C9B91', position: 'insideTopRight' }} />
                      <Line type="monotone" dataKey="avg" stroke="#19A66A" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
            </div>
          </SectionCard>

          <SectionCard title={<span className="inline-flex items-center gap-2"><BatteryMedium size={16} className="text-forest-400" /> Battery &amp; Solar Health</span>}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="cm-label">Avg battery</div>
                <div className="font-display text-3xl font-bold telemetry-num cm-ink mt-1">{avgBattery != null ? `${avgBattery}%` : '—'}</div>
                <div className="text-[11px] cm-muted mt-1">{stats?.minBatteryPct != null ? `min ${stats.minBatteryPct}%` : 'solar-charged nodes'}</div>
              </div>
              <div>
                <div className="cm-label">Solar health</div>
                <div className="flex items-center gap-2 mt-1">
                  <Sun size={22} style={{ color: solar.tone }} />
                  <span className="font-display text-2xl font-bold" style={{ color: solar.tone }}>{solar.label}</span>
                </div>
                <div className="text-[11px] cm-muted mt-1">derived from fleet battery</div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* middle: high-risk alerts */}
        <SectionCard
          title={<span className="inline-flex items-center gap-2"><AlertTriangle size={16} className="text-crit" /> High Risk Alerts</span>}
          action={<button onClick={onGotoAlerts} className="pg-focus text-xs font-semibold text-forest-600 dark:text-forest-400 hover:underline">View all alerts →</button>}>
          <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar">
            {highAlerts.length === 0
              ? <EmptyState icon={Inbox} title="All clear" hint="No active high-risk alerts." />
              : highAlerts.map((a) => {
                const p = palmByDevice[a.device_id];
                return (
                  <button key={a.id} onClick={() => { onSelectPalm?.(p); onGotoAlerts?.(); }}
                    className="pg-focus w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-[var(--cm-green-soft)] transition-colors text-left group">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: a.severity === 'critical' ? '#C94A3A' : '#D89B2B' }} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold cm-ink truncate">{a.device_id} <span className="cm-muted font-normal">· {loc(p)}</span></span>
                      <span className="block text-[11px] cm-muted truncate">
                        {a.trigger_value != null ? `Risk ${Math.round(a.trigger_value)} · ` : ''}{onGotoSafety ? 'Confirm dose' : a.type}
                      </span>
                    </span>
                    <span className="text-[10px] cm-muted whitespace-nowrap">{rel(a.ts)}</span>
                    <ChevronRight size={14} className="cm-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
          </div>
        </SectionCard>

        {/* right: recent devices / treatments */}
        <SectionCard
          title={<span className="inline-flex items-center gap-2"><Droplets size={16} className="text-forest-400" /> Recent Devices</span>}
          action={<button onClick={onGotoSafety} className="pg-focus text-xs font-semibold text-forest-600 dark:text-forest-400 hover:underline">View history →</button>}>
          <div className="space-y-1 max-h-[360px] overflow-y-auto custom-scrollbar">
            {recentDoses.length === 0
              ? <EmptyState icon={Droplets} title="No treatments yet" hint="Confirmed doses will appear here." />
              : recentDoses.map((d) => {
                const p = palmByDevice[d.device_id];
                const done = d.status === 'done';
                return (
                  <div key={d.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg">
                    <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--cm-green-soft)' }}>
                      <CheckCircle2 size={15} className="text-forest-400" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold cm-ink truncate">{d.device_id} <span className="cm-muted font-normal">· {loc(p)}</span></span>
                      <span className="block text-[11px] cm-muted truncate">
                        {rel(d.done_ts || d.ts)} · {d.volume_ml_est ? `~${(+d.volume_ml_est).toFixed(1)} mL` : `${d.pump_ms ?? 0} ms`} · human-confirmed
                      </span>
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap"
                      style={done
                        ? { color: 'var(--cm-healthy)', background: 'color-mix(in srgb, var(--cm-healthy) 14%, transparent)' }
                        : { color: 'var(--cm-watch)', background: 'color-mix(in srgb, var(--cm-watch) 14%, transparent)' }}>
                      {done ? 'Confirmed' : (d.status || 'pending')}
                    </span>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
