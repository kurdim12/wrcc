import { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, Trees as TreesIcon, MapPin, FileSearch } from 'lucide-react';
import { RiskRuler, StatusPill, EvidenceSummary, riskBand } from '../components/casemap/CaseMapKit.jsx';
import { useDevices } from '../hooks/useDevices.js';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const now = () => Math.floor(Date.now() / 1000);
const fmtAgo = (ts) => { if (!ts) return 'never'; const d = now() - ts; return d < 60 ? `${d}s ago` : d < 3600 ? `${Math.floor(d / 60)}m ago` : d < 86400 ? `${Math.floor(d / 3600)}h ago` : `${Math.floor(d / 86400)}d ago`; };
const fmtClock = (ts) => (ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const HEALTH = { low: 'normal', medium: 'watch', high: 'high', critical: 'critical' };
const healthLabel = (cl) => ({ low: 'Healthy', medium: 'Watch', high: 'High Risk', critical: 'Critical' }[cl] || 'Healthy');

export const Palms = ({ palms = [], onSelectPalm }) => {
  const { devices } = useDevices();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [latest, setLatest] = useState({});
  const [selId, setSelId] = useState(null);

  useEffect(() => {
    const load = () => api.readingsLatest().then((rows) => setLatest(Object.fromEntries(rows.map((r) => [r.device_id, r])))).catch(() => {});
    load();
    const off = onEvent('live:reading', (r) => setLatest((m) => ({ ...m, [r.device_id]: { ...m[r.device_id], ...r } })));
    const i = setInterval(load, 15000);
    return () => { off(); clearInterval(i); };
  }, []);

  const devById = useMemo(() => new Map(devices.map((d) => [d.id, d])), [devices]);
  const riskOf = (p) => Math.round((latest[p.device_id]?.risk_score ?? p.risk_score) ?? 0);
  const clsOf = (p) => latest[p.device_id]?.classification ?? p.classification ?? 'low';

  const rows = useMemo(() => {
    const s = q.toLowerCase();
    return palms
      .filter((p) => (!s || p.id.toLowerCase().includes(s)) && (filter === 'all' || clsOf(p) === filter))
      .slice().sort((a, b) => riskOf(b) - riskOf(a));
  }, [palms, q, filter, latest]);

  const sel = useMemo(() => rows.find((p) => p.id === selId) || rows[0] || null, [rows, selId]);
  const selDev = sel ? devById.get(sel.device_id) : null;
  const selOnline = (selDev?.computed_status || selDev?.status) === 'online';

  const FILTERS = [['all', 'All'], ['low', 'Healthy'], ['medium', 'Watch'], ['high', 'High'], ['critical', 'Critical']];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="cm-title text-xl">Trees</h2>
        <p className="text-[13px] cm-muted mt-0.5">Palm roster and tree-health overview.</p>
      </div>

      {/* filters */}
      <div className="flex flex-col md:flex-row gap-2.5 md:items-center">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 cm-muted" size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by Palm ID…"
            className="focus-ring w-full pl-9 pr-3 py-2 text-[13px] cm-raised cm-ink" style={{ outline: 'none' }} />
        </div>
        <div className="flex gap-1 cm-surface p-1 rounded-lg overflow-x-auto">
          {FILTERS.map(([v, lbl]) => (
            <button key={v} onClick={() => setFilter(v)}
              className="focus-ring px-3 py-1.5 rounded-md text-[12px] font-semibold whitespace-nowrap transition-colors"
              style={filter === v ? { background: 'var(--cm-forest)', color: '#fff' } : { color: 'var(--cm-muted)' }}>{lbl}</button>
          ))}
        </div>
        <div className="md:ml-auto inline-flex items-center gap-1.5 text-[12px] cm-muted cm-raised px-3 py-2 rounded-lg">
          Sort: Risk Score (High → Low) <ChevronDown size={13} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        {/* CaseTable */}
        <div className="cm-raised overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead><tr className="border-b cm-divide text-left">
                {['Palm ID', 'Block / Row', 'Risk', 'Health', 'Last Update', 'Device', 'Status'].map((h) => <th key={h} className="px-3 py-2.5 cm-label whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.slice(0, 150).map((p) => {
                  const r = riskOf(p); const band = riskBand(r); const active = sel?.id === p.id;
                  const dev = devById.get(p.device_id);
                  const online = (dev?.computed_status || dev?.status) === 'online';
                  return (
                    <tr key={p.id} onClick={() => setSelId(p.id)}
                      className="border-b cm-divide cursor-pointer transition-colors"
                      style={active ? { background: 'var(--cm-green-soft)' } : undefined}>
                      <td className="px-3 py-2.5 font-semibold cm-ink cm-mono whitespace-nowrap">{p.id}</td>
                      <td className="px-3 py-2.5 cm-muted whitespace-nowrap">{p.block || 'B'} / {p.row_idx != null ? `R${p.row_idx + 1}` : '—'}</td>
                      <td className="px-3 py-2.5 cm-mono font-bold" style={{ color: { normal: '#2F7D46', watch: '#B7791F', high: '#C05621', critical: '#B42318' }[band] }}>{r}</td>
                      <td className="px-3 py-2.5"><StatusPill status={HEALTH[clsOf(p)]}>{healthLabel(clsOf(p))}</StatusPill></td>
                      <td className="px-3 py-2.5 cm-muted cm-mono text-[11px] whitespace-nowrap">{fmtAgo(latest[p.device_id]?.ts || p.last_seen)}</td>
                      <td className="px-3 py-2.5 cm-muted cm-mono text-[11px]">{p.device_id || '—'}</td>
                      <td className="px-3 py-2.5"><StatusPill status={online ? 'online' : 'locked'}>{online ? 'Online' : 'Offline'}</StatusPill></td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center cm-muted text-[13px]">No palms match. Run <span className="cm-mono">npm run seed:farm</span> to seed the demo orchard.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected palm panel */}
        {sel && (
          <div className="cm-raised flex flex-col">
            <div className="px-4 py-3 border-b cm-divide flex items-center gap-3">
              <span className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--cm-green-soft)', color: 'var(--cm-forest)' }}><TreesIcon size={20} /></span>
              <div className="min-w-0">
                <div className="cm-mono font-bold cm-ink">{sel.id}</div>
                <div className="text-[11px] cm-muted">Block {sel.block || 'B'} • {sel.row_idx != null ? `Row ${sel.row_idx + 1}` : 'Row —'}{sel.age_years != null ? ` • Age ${sel.age_years} yrs` : ''}</div>
              </div>
            </div>
            <div className="px-4 py-3 space-y-3 overflow-y-auto custom-scrollbar">
              <div className="text-[11px] cm-muted">Last update: <span className="cm-mono">{fmtClock(latest[sel.device_id]?.ts || sel.last_seen)}</span></div>
              <RiskRuler score={riskOf(sel)} />
              <div className="flex gap-2">
                <div className="cm-surface px-3 py-2 flex-1"><div className="cm-label">Device health</div><StatusPill status="verified" className="mt-1">Verified</StatusPill></div>
                <div className="cm-surface px-3 py-2 flex-1"><div className="cm-label">Device status</div><StatusPill status={selOnline ? 'online' : 'locked'} className="mt-1">{selOnline ? 'Online' : 'Offline'}</StatusPill></div>
              </div>
              <EvidenceSummary />
            </div>
            <div className="px-4 py-3 border-t cm-divide">
              <button onClick={() => onSelectPalm?.(sel)}
                className="focus-ring w-full inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold px-3 py-2 rounded-lg text-white" style={{ background: 'var(--cm-forest)' }}>
                <FileSearch size={14} /> Open case file
              </button>
            </div>
          </div>
        )}
      </div>

      {/* bottom cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cm-raised p-4"><div className="cm-label mb-1">Risk Over Time</div><div className="text-[12px] cm-muted">{sel?.id || '—'} — trend builds as readings accumulate.</div></div>
        <div className="cm-raised p-4"><div className="cm-label mb-1">Last Inspections</div><div className="text-[12px] cm-muted">No field inspections logged for {sel?.id || 'this palm'} yet.</div></div>
        <div className="cm-raised p-4 flex items-center gap-2"><MapPin size={14} style={{ color: 'var(--cm-forest)' }} /><div className="text-[12px] cm-muted">Row map — Block {sel?.block || 'B'}{sel?.row_idx != null ? `, Row ${sel.row_idx + 1}` : ''}</div></div>
      </div>
    </div>
  );
};

export default Palms;
