import { useEffect, useMemo, useState } from 'react';
import { Search, Trees as TreesIcon, ShieldCheck, Eye, AlertTriangle, Signal } from 'lucide-react';
import { Badge, severityType } from '../components/ui/Badge.jsx';
import { ModelCaveatBadge } from '../components/ModelCaveatBadge.jsx';
import { PageHeader, MetricTile } from '../components/ui/Primitives.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

// Palm Roster — a patient roster for trees. Hybrid telemetry rows (not a plain
// table): live risk, P(activity) + caveat, acoustic pulse, battery, signal,
// dose-lock, last seen.
const now = () => Math.floor(Date.now() / 1000);
const fmtAgo = (ts) => { if (!ts) return 'never'; const d = now() - ts; return d < 60 ? `${d}s` : d < 3600 ? `${Math.floor(d / 60)}m` : d < 86400 ? `${Math.floor(d / 3600)}h` : `${Math.floor(d / 86400)}d`; };
const riskColor = (r) => (r >= 61 ? 'text-crit' : r >= 31 ? 'text-gold' : 'text-forest-400');

export const Palms = ({ palms = [], onSelectPalm }) => {
  const { devices } = useDevices();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [latest, setLatest] = useState({});   // device_id -> latest reading

  useEffect(() => {
    const load = () => api.readingsLatest().then((rows) => {
      setLatest(Object.fromEntries(rows.map((r) => [r.device_id, r])));
    }).catch(() => {});
    load();
    const off = onEvent('live:reading', (r) => setLatest((m) => ({ ...m, [r.device_id]: { ...m[r.device_id], ...r } })));
    const i = setInterval(load, 15000);
    return () => { off(); clearInterval(i); };
  }, []);

  const devById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const sample = useMemo(() => Object.values(latest).find((r) => r?.p_activity != null) || {}, [latest]);

  const filtered = useMemo(() => {
    const s = q.toLowerCase();
    return palms.filter((p) => {
      const mq = !s || p.id.toLowerCase().includes(s) || (p.classification || '').toLowerCase().includes(s);
      const mf = filter === 'all' || (p.classification || 'low') === filter;
      return mq && mf;
    });
  }, [palms, q, filter]);

  const fleet = useMemo(() => {
    const cls = (p) => p.classification || 'low';
    return {
      total: palms.length,
      healthy: palms.filter((p) => cls(p) === 'low').length,
      watch: palms.filter((p) => cls(p) === 'medium').length,
      critical: palms.filter((p) => cls(p) === 'high').length,
      online: devices.filter((d) => (d.computed_status || d.status) === 'online').length,
    };
  }, [palms, devices]);

  return (
    <div className="space-y-4 animate-fade-in-up">
      <PageHeader title="Trees" subtitle="Palm roster — your monitored fleet at a glance. Search, filter, and open any palm." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricTile icon={TreesIcon} label="Palms monitored" value={fleet.total} sub={`${fleet.online} devices online`} status="muted" />
        <MetricTile icon={ShieldCheck} label="Healthy" value={fleet.healthy} status="forest" />
        <MetricTile icon={Eye} label="Watch" value={fleet.watch} status="gold" />
        <MetricTile icon={AlertTriangle} label="Critical" value={fleet.critical} status={fleet.critical > 0 ? 'crit' : 'muted'} />
      </div>

      <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search palm ID or status…"
            className="focus-ring w-full pl-10 pr-4 py-2.5 instrument text-charcoal dark:text-bone placeholder:text-muted" />
        </div>
        <div className="flex gap-1 instrument p-1 w-full md:w-auto">
          {[['all', 'All'], ['low', 'Healthy'], ['medium', 'Watch'], ['high', 'Critical']].map(([v, lbl]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`focus-ring flex-1 md:flex-none px-3 py-1.5 rounded-md text-sm font-bold transition-colors ${
                filter === v ? 'bg-forest text-bone' : 'text-muted hover:text-charcoal dark:hover:text-bone'}`}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* single model caveat for the whole roster (not repeated per row) */}
      <div className="flex items-center gap-2 px-1">
        <ModelCaveatBadge {...(sample.p_activity != null ? { modelVersion: sample.model_version, modelSource: sample.model_source, calibrated: sample.calibrated } : {})} size="xs" showInfo={false} />
        <span className="hud-label normal-case tracking-normal text-muted">P(activity) is a proxy/heuristic activity estimate — not validated accuracy.</span>
      </div>

      {/* column header (desktop) */}
      <div className="hidden lg:grid grid-cols-[1.4fr_0.8fr_0.7fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] gap-3 px-4 hud-label">
        <span>Palm</span><span>Status</span><span>Risk</span><span>P(activity)</span><span>Pulse</span><span>Battery</span><span>Dose lock</span><span>Last seen</span>
      </div>

      <div className="space-y-2">
        {filtered.slice(0, 120).map((p) => {
          const r = latest[p.device_id] || {};
          const dev = devById.get(p.device_id);
          const risk = r.risk_score ?? p.risk_score ?? 0;
          const cls = r.classification ?? p.classification ?? 'low';
          const armed = r?.act?.armed ?? dev?.armed ?? false;
          const fresh = (r.ts && now() - r.ts < 20) || (p.last_seen && now() - p.last_seen < 20);
          return (
            <button key={p.id} onClick={() => onSelectPalm?.(p)}
              className="focus-ring w-full instrument px-4 py-3 grid grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.7fr_1fr_0.7fr_0.6fr_0.7fr_0.7fr] gap-3 items-center text-left hover:border-forest-400/40 transition-colors">
              <div>
                <div className="font-bold text-charcoal dark:text-bone telemetry-num">{p.id}</div>
                <div className="hud-label">{p.variety || 'unassigned'}{p.row_idx != null ? ` · R${p.row_idx + 1}` : ''}</div>
              </div>
              <div><Badge type={severityType(cls)} text={cls} /></div>
              <div className={`telemetry-num font-bold text-lg ${riskColor(risk)}`}>{Math.round(risk)}</div>
              <div className="flex items-center gap-1.5">
                <span className="telemetry-num text-sm text-charcoal dark:text-bone">{r.p_activity != null ? r.p_activity.toFixed(2) : '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${fresh ? 'bg-forest-400 animate-heartbeat' : 'bg-muted/50'}`} />
                <span className="telemetry-num text-xs text-muted">{r.ac_clk != null ? `${r.ac_clk.toFixed(0)}/s` : '—'}</span>
              </div>
              <div className="telemetry-num text-sm text-muted">{r.battery_pct != null ? `${r.battery_pct}%` : (dev?.battery_pct != null ? `${dev.battery_pct}%` : '—')}</div>
              <div><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${armed ? 'bg-forest-400/15 text-forest-400' : 'bg-muted/15 text-muted'}`}>{armed ? 'armed' : 'locked'}</span></div>
              <div className="telemetry-num text-xs text-muted">{fmtAgo(r.ts || p.last_seen)}</div>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="instrument p-12 text-center text-muted text-sm">
          No palms found. Run <code className="font-mono text-forest-400">npm run seed:farm</code> (backend) to seed the demo orchard.
        </div>
      )}
    </div>
  );
};

export default Palms;
