import { useEffect, useMemo, useState } from 'react';
import { Trees, AlertTriangle, Signal, ShieldCheck } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, CartesianGrid,
} from 'recharts';

import PalmGridMap from '../components/PalmGridMap.jsx';
import AlertList from '../components/AlertList.jsx';
import { PalmPulseStrip } from '../components/PalmPulseStrip.jsx';
import { PalmVitalCard } from '../components/PalmVitalCard.jsx';
import { useFarmStats } from '../hooks/useFarmStats.js';
import { useAlerts } from '../hooks/useAlerts.js';
import { useDevices } from '../hooks/useDevices.js';
import { api } from '../api.js';

// Mission counter — a compact telemetry tile (not a marketing KPI card).
const Counter = ({ icon: Icon, label, value, sub, tone = 'forest' }) => {
  const c = { forest: 'text-forest-400', crit: 'text-crit', gold: 'text-gold', muted: 'text-muted' }[tone];
  return (
    <div className="instrument px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="hud-label">{label}</span>
        <Icon size={15} className={c} />
      </div>
      <div className={`telemetry-num text-3xl font-bold mt-1 ${c}`}>{value}</div>
      <div className="text-[11px] text-muted">{sub}</div>
    </div>
  );
};

export const Overview = ({ palms, onSelectPalm, selectedPalm, onAlertClick }) => {
  const { stats } = useFarmStats();
  const { alerts } = useAlerts('active');
  const { devices } = useDevices();
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

  const armed = devices.filter((d) => d.armed).length;
  const trendsData = trends.map((t) => ({ day: (t.day || '').slice(5), avg: +(t.avg_risk ?? 0).toFixed(1), max: +(t.max_risk ?? 0).toFixed(1) }));
  const tempData = tempBuckets ? [
    { name: 'Cold', value: tempBuckets.very_low ?? 0, color: '#0A5C44' },
    { name: 'Cool', value: tempBuckets.low ?? 0, color: '#19A66A' },
    { name: 'Normal', value: tempBuckets.normal ?? 0, color: '#C2A14D' },
    { name: 'Warm', value: tempBuckets.high ?? 0, color: '#D89B2B' },
    { name: 'Hot', value: tempBuckets.very_high ?? 0, color: '#C94A3A' },
  ] : [];

  return (
    <div className="space-y-5">
      {/* mission counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Counter icon={Trees} label="Palms monitored" value={stats?.totalPalms ?? 0} sub={`${stats?.totalDevices ?? 0} field nodes`} />
        <Counter icon={Signal} label="Devices online" value={`${stats?.onlinePct ?? 0}%`} sub={`${stats?.onlineDevices ?? 0}/${stats?.totalDevices ?? 0} reporting`} tone="forest" />
        <Counter icon={AlertTriangle} label="Critical incidents" value={stats?.criticalAlerts ?? 0} sub={`${stats?.activeAlerts ?? 0} active total`} tone={(stats?.criticalAlerts ?? 0) > 0 ? 'crit' : 'muted'} />
        <Counter icon={ShieldCheck} label="Treatment armed" value={`${armed}`} sub={armed ? `${armed} node${armed === 1 ? '' : 's'} ready` : 'all locked'} tone={armed ? 'gold' : 'muted'} />
      </div>

      {/* orchard at a glance */}
      <div className="instrument p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="hud-label">orchard pulse · {palms.length} palms</span>
          <span className="hud-label">tap a bar to open a palm</span>
        </div>
        <PalmPulseStrip palms={palms} onSelect={onSelectPalm} />
      </div>

      {/* vitals · map · incidents */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-4">
          <div className="hud-label mb-2">selected palm vitals</div>
          <PalmVitalCard palm={focusPalm} />
        </div>
        <div className="xl:col-span-5">
          <div className="hud-label mb-2">orchard live map</div>
          <PalmGridMap palms={palms} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height="h-[360px]" />
        </div>
        <div className="xl:col-span-3">
          <div className="hud-label mb-2">active incidents</div>
          <div className="instrument p-3 max-h-[360px] overflow-y-auto custom-scrollbar">
            <AlertList alerts={alerts} onSelect={(a) => onAlertClick?.(a.device_id)} compact />
          </div>
        </div>
      </div>

      {/* trends */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="instrument p-4 lg:col-span-2">
          <div className="hud-label mb-3">risk trend · 30 days (avg / max)</div>
          <div className="h-56">
            {trendsData.length < 2 ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8C9B91" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                  <Tooltip contentStyle={{ background: '#101C17', border: '1px solid rgba(140,155,145,0.2)', borderRadius: 8, fontSize: 11, color: '#F4EFE2' }} />
                  <Line type="monotone" dataKey="avg" stroke="#19A66A" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="max" stroke="#C94A3A" strokeWidth={1.5} dot={false} strokeDasharray="4 3" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="instrument p-4">
          <div className="hud-label mb-3">trunk Δ distribution · 24 h</div>
          <div className="h-56">
            {!tempData.length ? <Empty /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tempData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#8C9B91" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                  <YAxis tick={{ fontSize: 10, fill: '#8C9B91' }} stroke="#8C9B91" strokeOpacity={0.2} />
                  <Tooltip contentStyle={{ background: '#101C17', border: '1px solid rgba(140,155,145,0.2)', borderRadius: 8, fontSize: 11, color: '#F4EFE2' }} cursor={{ fill: 'rgba(140,155,145,0.08)' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {tempData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Empty = () => <div className="h-full flex items-center justify-center hud-label">collecting telemetry…</div>;

export default Overview;
