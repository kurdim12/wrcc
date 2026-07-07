import { useMemo, useState } from 'react';
import { AudioLines, Waves, Thermometer, Cpu } from 'lucide-react';
import PalmGridMap from '../components/PalmGridMap.jsx';
import {
  PalmCaseFile, EvidenceSummary, OperatorTasks, ProofLog, riskBand,
} from '../components/casemap/CaseMapKit.jsx';
import { useFarmStats } from '../hooks/useFarmStats.js';
import { useDoses } from '../hooks/useDoses.js';
import { useIntelligence } from '../hooks/useIntelligence.js';

const fmt = (ts) => (ts ? new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');
const levelLabel = (b) => ({ normal: 'Normal', watch: 'Watch', high: 'High Risk', critical: 'Critical' }[b] || 'Normal');

// Build REAL per-palm evidence from the multi-sensor experts (no fabricated rows).
const buildEvidence = (intel) => {
  const ex = intel?.experts;
  if (!ex) return [];
  const st = (s) => (s >= 75 ? 'high' : s >= 50 ? 'detected' : s >= 25 ? 'contributing' : 'verified');
  const rows = [];
  if (ex.acoustic)  rows.push({ icon: AudioLines, title: 'Acoustic activity (proxy)', meta: `score ${Math.round(ex.acoustic.score ?? 0)} · conf ${ex.acoustic.confidence ?? '—'}`, status: st(ex.acoustic.score ?? 0) });
  if (ex.vibration) rows.push({ icon: Waves, title: 'Vibration corroboration', meta: `score ${Math.round(ex.vibration.score ?? 0)} · conf ${ex.vibration.confidence ?? '—'}`, status: st(ex.vibration.score ?? 0) });
  if (ex.environment || ex.env) rows.push({ icon: Thermometer, title: 'Environmental context', meta: 'supporting context only', status: 'contributing' });
  const h = ex.sensorHealth || ex.health;
  if (h) rows.push({ icon: Cpu, title: 'Device health', meta: h.healthy ? 'all sensors reporting' : 'sensor fault', status: h.healthy ? 'verified' : 'high' });
  return rows;
};

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
  const evidence = useMemo(() => buildEvidence(intel), [intel]);

  const proof = useMemo(() => doses.slice(0, 5).map((d) => ({
    time: fmt(d.done_ts || d.sent_ts || d.ts),
    event: `${d.status === 'done' ? 'Clear-water demo dose completed' : `Dose ${d.status}`} · ${d.device_id}`,
    by: d.source || 'operator',
    mode: (sysMode?.mode === 'live') ? 'Live' : 'Demo — Clear Water Only',
  })), [doses, sysMode]);

  const tasks = [
    { label: focusPalm ? `Inspect ${focusPalm.id}` : 'Inspect highest-risk palm', tag: 'High', tagStatus: 'high', act: () => focusPalm && onSelectPalm?.(focusPalm) },
    { label: 'Review acoustic evidence for flagged palms', tag: 'Open', tagStatus: 'open', act: () => focusPalm && onSelectPalm?.(focusPalm) },
    { label: 'Continue monitoring Watch-level palms', tag: 'Watch', tagStatus: 'watch' },
    { label: 'Prepare human-confirmed clear-water demo (Safety Gate)', tag: 'Locked', tagStatus: 'locked', act: () => onGotoSafety?.() },
  ];

  const FILTERS = [
    ['all', `All (${counts.all.toLocaleString()})`], ['low', 'Normal'], ['medium', 'Watch'],
    ['high', 'High Risk'], ['treated', 'Treated'],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        {/* map workspace */}
        <div className="cm-raised overflow-hidden flex flex-col">
          <div className="px-3 py-2.5 border-b cm-divide flex items-center gap-1.5 flex-wrap">
            {FILTERS.map(([v, lbl]) => (
              <button key={v} onClick={() => setFilter(v)}
                className="pg-focus px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors"
                style={filter === v ? { background: '#0A6E4C', color: '#fff' } : { color: 'var(--cm-muted)', background: 'var(--cm-surface)', border: '1px solid var(--cm-border-soft)' }}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="p-2.5">
            <PalmGridMap palms={filtered} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height="h-[300px] sm:h-[460px]" orchardImageUrl="/orchard.jpg" />
          </div>
        </div>

        {/* right case file — real evidence */}
        <PalmCaseFile
          className="h-full"
          palmId={focusPalm?.id || focusPalm?.device_id}
          level={levelLabel(riskBand(score))}
          block={focusPalm?.block}
          row={focusPalm?.row_idx != null ? focusPalm.row_idx + 1 : undefined}
          age={focusPalm?.age_years}
          lastUpdate={focusPalm?.last_seen ? new Date(focusPalm.last_seen * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined}
          score={score}
          evidence={evidence}
          onReviewEvidence={() => focusPalm && onSelectPalm?.(focusPalm)}
          onOpenSafety={onGotoSafety}
        />
      </div>

      {/* bottom tray: Evidence · Tasks · Proof Log */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="cm-raised p-4"><EvidenceSummary title="Evidence" rows={evidence} /></div>
        <div className="cm-raised p-4"><OperatorTasks title="Tasks" tasks={tasks} onTask={(t) => t.act?.()} /></div>
        <div className="cm-raised p-4"><ProofLog title="Proof Log" events={proof} /></div>
      </div>
    </div>
  );
}
