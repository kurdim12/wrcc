import { useMemo, useState } from 'react';
import { Layers, Plus, Minus, Crosshair } from 'lucide-react';
import PalmGridMap from '../components/PalmGridMap.jsx';
import {
  PalmCaseFile, EvidenceSummary, OperatorTasks, ProofLog, riskBand,
} from '../components/casemap/CaseMapKit.jsx';
import { useFarmStats } from '../hooks/useFarmStats.js';
import { useDoses } from '../hooks/useDoses.js';
import { useIntelligence } from '../hooks/useIntelligence.js';

const fmt = (ts) => (ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const LEGEND = [
  { c: '#2F7D46', label: 'Healthy' }, { c: '#B7791F', label: 'Watch' },
  { c: '#C05621', label: 'High' }, { c: '#B42318', label: 'Critical' }, { c: '#2B6CB0', label: 'Treated' },
];
const levelLabel = (b) => ({ normal: 'Normal', watch: 'Watch', high: 'High Risk', critical: 'Critical' }[b] || 'Normal');

export default function CaseMap({ palms = [], onSelectPalm, selectedPalm, onGotoSafety, sysMode }) {
  const { stats } = useFarmStats();
  const { doses } = useDoses();
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = (cl) => palms.filter((p) => (p.classification || 'low') === cl).length;
    return { all: palms.length, low: c('low'), medium: c('medium'), high: c('high'), treated: palms.filter((p) => p.treated).length };
  }, [palms]);

  const filtered = useMemo(() => {
    if (filter === 'all') return palms;
    if (filter === 'treated') return palms.filter((p) => p.treated);
    return palms.filter((p) => (p.classification || 'low') === filter);
  }, [palms, filter]);

  const focusPalm = useMemo(() => {
    if (selectedPalm?.device_id) return selectedPalm;
    return palms.filter((p) => p.device_id).slice().sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))[0] || null;
  }, [palms, selectedPalm]);

  const intel = useIntelligence(focusPalm?.device_id);
  const score = Math.round(focusPalm?.risk_score ?? intel?.fusion?.risk ?? 0);

  const proof = useMemo(() => doses.slice(0, 5).map((d) => ({
    time: fmt(d.done_ts || d.sent_ts || d.ts),
    event: `${d.status === 'done' ? 'Clear-water demo dose completed' : `Dose ${d.status}`} · ${d.device_id}`,
    by: d.source || 'operator',
    mode: (sysMode?.mode === 'live') ? 'Live' : 'Demo — Clear Water Only',
  })), [doses, sysMode]);

  const tasks = [
    { label: focusPalm ? `Inspect ${focusPalm.id} (Block B)` : 'Inspect highest-risk palm', tag: 'High', tagStatus: 'high' },
    { label: 'Review acoustic evidence for flagged palms', tag: 'Open', tagStatus: 'open' },
    { label: 'Continue monitoring Watch-level palms', tag: 'Watch', tagStatus: 'watch' },
    { label: 'Prepare human-confirmed clear-water demo (Safety Gate)', tag: 'Locked', tagStatus: 'locked' },
  ];

  const FILTERS = [
    ['all', `All (${counts.all.toLocaleString()})`], ['low', 'Normal'], ['medium', 'Watch'],
    ['high', 'High Risk'], ['treated', 'Treated'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        {/* map workspace */}
        <div className="cm-raised overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b cm-divide flex items-center gap-1.5 flex-wrap">
            {FILTERS.map(([v, lbl]) => (
              <button key={v} onClick={() => setFilter(v)}
                className="focus-ring px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors"
                style={filter === v ? { background: 'var(--cm-forest)', color: '#fff' } : { color: 'var(--cm-muted)', background: 'var(--cm-surface)', border: '1px solid var(--cm-border-soft)' }}>
                {lbl}
              </button>
            ))}
            <button className="focus-ring ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold cm-muted" style={{ border: '1px solid var(--cm-border)' }}>
              <Layers size={13} /> Layers
            </button>
          </div>

          <div className="relative" style={{ background: 'var(--cm-green-soft)' }}>
            <PalmGridMap palms={filtered} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height="h-[300px] sm:h-[440px]" />

            {/* zoom controls (visual) */}
            <div className="absolute top-3 right-3 flex flex-col cm-raised overflow-hidden">
              <button className="focus-ring p-1.5 cm-muted hover:text-[var(--cm-forest)]"><Plus size={15} /></button>
              <span className="h-px" style={{ background: 'var(--cm-border)' }} />
              <button className="focus-ring p-1.5 cm-muted hover:text-[var(--cm-forest)]"><Minus size={15} /></button>
            </div>

            {/* legend */}
            <div className="absolute bottom-3 left-3 cm-raised px-3 py-2">
              <div className="cm-label mb-1.5">Risk</div>
              <div className="flex flex-col gap-1">
                {LEGEND.map((l) => (
                  <span key={l.label} className="inline-flex items-center gap-1.5 text-[11px] cm-ink">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.c }} />{l.label}
                  </span>
                ))}
              </div>
            </div>

            {/* scale + farm tag */}
            <div className="absolute bottom-3 right-3 cm-raised px-2.5 py-1 text-[10px] cm-mono cm-muted flex items-center gap-1.5">
              <Crosshair size={11} /> Ain Farm • Block B
            </div>
          </div>
        </div>

        {/* right case file */}
        <PalmCaseFile
          className="h-full"
          palmId={focusPalm?.id || focusPalm?.device_id}
          level={levelLabel(riskBand(score))}
          block={focusPalm?.block || 'B'}
          row={focusPalm?.row_idx != null ? focusPalm.row_idx + 1 : undefined}
          age={focusPalm?.age_years}
          lastUpdate={focusPalm?.last_seen ? new Date(focusPalm.last_seen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined}
          score={score}
          onReviewEvidence={() => focusPalm && onSelectPalm?.(focusPalm)}
          onOpenSafety={onGotoSafety}
        />
      </div>

      {/* bottom tray: Evidence · Tasks · Proof Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cm-raised p-4"><EvidenceSummary title="Evidence" /></div>
        <div className="cm-raised p-4"><OperatorTasks title="Tasks" tasks={tasks} /></div>
        <div className="cm-raised p-4"><ProofLog title="Proof Log" events={proof} /></div>
      </div>
    </div>
  );
}
