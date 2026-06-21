import { useEffect, useMemo, useState } from 'react';
import {
  Trees, AlertTriangle, ShieldCheck, Signal, Activity, Battery, Thermometer, ChevronDown,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, Cell, CartesianGrid, Legend,
} from 'recharts';

import KpiCard from '../components/KpiCard.jsx';
import Card from '../components/ui/Card.jsx';
import AlertList from '../components/AlertList.jsx';
import PalmGridMap from '../components/PalmGridMap.jsx';
import LiveAnalysis from '../components/LiveAnalysis.jsx';
import LiveSensorPanel from '../components/LiveSensorPanel.jsx';
import DemoModeBanner from '../components/DemoModeBanner.jsx';
import LiveBadge from '../components/LiveBadge.jsx';

import { useFarmStats } from '../hooks/useFarmStats.js';
import { useAlerts }     from '../hooks/useAlerts.js';
import { useDevices }    from '../hooks/useDevices.js';
import { api }           from '../api.js';

const fmtNum = (n) => n == null ? 0 : Number(n);

export const Overview = ({ palms, onSelectPalm, selectedPalm, onAlertClick, onGotoAlerts, sysMode }) => {
  const mode = sysMode?.mode ?? 'unknown';
  const { stats }          = useFarmStats();
  const { alerts }         = useAlerts('active');
  const { devices }        = useDevices();
  const [trends, setTrends]         = useState([]);
  const [tempBuckets, setTempBuckets] = useState(null);
  const [focusDeviceId, setFocusDeviceId] = useState('');

  // Pick the focused device automatically only when the user hasn't picked one yet
  // (or when the previously-picked device disappeared from the device list).
  useEffect(() => {
    if (selectedPalm?.device_id) {
      setFocusDeviceId(selectedPalm.device_id);
      return;
    }
    if (!devices.length) return;
    const stillExists = devices.find(d => d.id === focusDeviceId);
    if (stillExists) return;     // keep the user's selection

    const online = devices.filter(d => d.last_seen && (Date.now()/1000 - d.last_seen) < 300);
    const pool = online.length ? online : devices;
    const real = pool.find(d => !d.id.startsWith('PG-DEMO'));
    setFocusDeviceId((real || pool[0]).id);
  }, [devices, selectedPalm?.device_id]);

  useEffect(() => {
    api.riskTrends(30).then(setTrends).catch(() => {});
    api.tempBuckets().then(setTempBuckets).catch(() => {});
    const i = setInterval(() => {
      api.riskTrends(30).then(setTrends).catch(() => {});
      api.tempBuckets().then(setTempBuckets).catch(() => {});
    }, 30000);
    return () => clearInterval(i);
  }, []);

  const trendsData = trends.map(t => ({
    day: t.day.slice(5),
    avg: Number((t.avg_risk ?? 0).toFixed(1)),
    max: Number((t.max_risk ?? 0).toFixed(1)),
  }));
  const tempData = tempBuckets ? [
    { name: 'Cold',   value: tempBuckets.very_low ?? 0, color: '#3b82f6' },
    { name: 'Cool',   value: tempBuckets.low ?? 0,      color: '#22c55e' },
    { name: 'Normal', value: tempBuckets.normal ?? 0,   color: '#16a34a' },
    { name: 'Warm',   value: tempBuckets.high ?? 0,     color: '#f97316' },
    { name: 'Hot',    value: tempBuckets.very_high ?? 0, color: '#dc2626' },
  ] : [];

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Mode banner */}
      <DemoModeBanner info={sysMode} />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 xl:gap-6">
        <div className="animate-fade-in-up delay-100">
          <KpiCard
            title="Total Palms"
            value={fmtNum(stats?.totalPalms)}
            sub={`${stats?.totalDevices ?? 0} devices`}
            icon={Trees}
            color="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
          />
        </div>
        <div className="animate-fade-in-up delay-200">
          <KpiCard
            title="Critical Risk"
            value={fmtNum(stats?.critical)}
            sub={(stats?.activeAlerts ?? 0) + ' active alerts'}
            icon={AlertTriangle}
            color="bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
            accent={stats?.critical > 0 ? 'critical' : undefined}
          />
        </div>
        <div className="animate-fade-in-up delay-300">
          <KpiCard
            title="Avg Health"
            value={`${(stats?.avgHealthPct ?? 0).toFixed(0)}%`}
            sub={stats?.avgRiskScore != null ? `risk ${stats.avgRiskScore.toFixed(1)}` : null}
            icon={ShieldCheck}
            color="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
            accent={stats?.avgHealthPct >= 70 ? 'good' : undefined}
          />
        </div>
        <div className="animate-fade-in-up delay-400">
          <KpiCard
            title="Sensors Online"
            value={`${(stats?.onlinePct ?? 0).toFixed(0)}%`}
            sub={`${stats?.onlineDevices ?? 0}/${stats?.totalDevices ?? 0}`}
            icon={Signal}
            color="bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400"
          />
        </div>
      </div>

      {/* CENTERPIECE: Live Analysis with device picker */}
      <div className="animate-fade-in-up delay-300">
        <Card className="p-3 md:p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="text-xs uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">
              Focused Device
            </div>
            <div className="relative">
              <select
                value={focusDeviceId}
                onChange={(e) => setFocusDeviceId(e.target.value)}
                className="appearance-none px-4 py-2 pr-10 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold cursor-pointer hover:border-green-500 transition-colors"
              >
                {devices.length === 0 && <option value="">no devices</option>}
                {devices.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.id} {d.id.startsWith('PG-DEMO') ? '(demo)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
          <LiveBadge mode={mode} size="lg" />
        </Card>

        <LiveAnalysis deviceId={focusDeviceId} mode={mode} />
      </div>

      {/* Live sensor panel */}
      <div className="animate-fade-in-up delay-400">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
            <Activity size={18} className="text-emerald-500" />
            Sensor stream
          </h3>
          <div className="text-xs text-gray-500 dark:text-gray-400">live values + 60-sample mini trends</div>
        </div>
        <LiveSensorPanel deviceId={focusDeviceId} />
      </div>

      {/* Map + Recent Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 md:gap-8 animate-fade-in-up delay-500">
        <div className="xl:col-span-2">
          <PalmGridMap
            palms={palms}
            onSelectPalm={onSelectPalm}
            selectedPalm={selectedPalm}
            height="h-[500px] md:h-[600px]"
          />
        </div>
        <div>
          <Card className="p-4 md:p-6 h-[500px] md:h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-orange-500" /> Recent Alerts
              </h3>
              <button onClick={onGotoAlerts} className="text-sm text-green-600 dark:text-green-400 font-bold hover:underline">View All</button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <AlertList alerts={alerts.slice(0, 8)} onSelect={(a) => onAlertClick?.(a.device_id)} compact />
            </div>
          </Card>
        </div>
      </div>

      {/* 30-day trends + temperature distribution + battery donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 animate-fade-in-up delay-600">
        <Card className="p-6 md:p-8 border border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Activity size={20} className="text-blue-500" /> AI Risk Trends (30 Days)
          </h3>
          <div className="h-48 md:h-56 text-gray-500 dark:text-gray-400">
            {trendsData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm">No history yet — readings will appear within seconds.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendsData} margin={{ top: 5, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'currentColor' }} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'currentColor' }} stroke="currentColor" strokeOpacity={0.3} />
                  <Tooltip
                    contentStyle={{ background: 'rgba(15, 20, 34, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#e5e7eb' }}
                    labelStyle={{ color: '#9ca3af', fontWeight: 700 }}
                    itemStyle={{ color: '#e5e7eb' }}
                  />
                  <Line type="monotone" dataKey="avg" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="avg risk" />
                  <Line type="monotone" dataKey="max" stroke="#ef4444" strokeWidth={2.5} dot={false} name="max risk" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 md:p-8 border border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Thermometer size={20} className="text-orange-500" /> Trunk Δ Distribution
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-4 mb-3">
            count of readings in the last 24 h, bucketed by (trunk core − ambient) °C
          </p>
          <div className="h-44 md:h-52 text-gray-500 dark:text-gray-400">
            {!tempData.length ? (
              <div className="h-full flex items-center justify-center text-sm">no data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tempData} margin={{ top: 5, right: 8, bottom: 0, left: -22 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} stroke="currentColor" strokeOpacity={0.3} />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} stroke="currentColor" strokeOpacity={0.3} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: 'currentColor', fillOpacity: 0.06 }}
                    contentStyle={{ background: 'rgba(15, 20, 34, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12, color: '#e5e7eb' }}
                    labelStyle={{ color: '#9ca3af', fontWeight: 700 }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {tempData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 md:p-8">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <Battery size={20} className="text-green-500" /> Battery Health
          </h3>
          <div className="flex items-center justify-center h-48 md:h-56">
            <div className="relative w-40 h-40 flex items-center justify-center">
              <svg className="absolute inset-0 transform -rotate-90 w-full h-full">
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent"
                        className="text-gray-100 dark:text-gray-800" />
                <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="transparent"
                        strokeDasharray="440"
                        strokeDashoffset={440 - 4.4 * (stats?.avgBatteryPct ?? 0)}
                        className="text-green-500 transition-all duration-1000" strokeLinecap="round" />
              </svg>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
                  {stats?.avgBatteryPct ?? '–'}%
                </div>
                <div className="text-xs text-gray-500 uppercase font-bold">
                  {stats?.minBatteryPct != null ? `min ${stats.minBatteryPct}%` : 'avg'}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
