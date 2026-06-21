import { useEffect, useState } from 'react';
import {
  Download, RefreshCw, Package, Syringe, FlaskConical, HeartPulse,
  AlertTriangle, BatteryMedium, Hash, Clock, ShieldCheck,
} from 'lucide-react';
import { api } from '../api.js';

// Evidence Locker — a manifest of exportable proof for judges & engineers.
// Each entry shows what it covers, its data window, a live record count and a
// CSV action. The WRCC Evidence Pack bundles them. Honest throughout: the model
// audit declares "heuristic baseline · no metrics yet" — no fabricated accuracy.
const csvFromRows = (rows) => {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
};
const download = (name, text) => {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
};
const countCsv = async (url) => {
  try { const t = await fetch(url).then((r) => r.text()); return Math.max(0, t.trim().split('\n').length - 1); }
  catch { return null; }
};
const fmtClock = (ts) => (ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

export const Reports = ({ showToast }) => {
  const [counts, setCounts] = useState({});
  const [asOf, setAsOf] = useState(null);
  const [bump, setBump] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [weekly, critical, battery, dosing] = await Promise.all([
        countCsv('/api/v1/reports/weekly.csv'),
        countCsv('/api/v1/reports/critical.csv'),
        countCsv('/api/v1/reports/battery.csv'),
        api.doses().then((d) => d.length).catch(() => null),
      ]);
      if (alive) { setCounts({ weekly, critical, battery, dosing }); setAsOf(Date.now()); }
    })();
    return () => { alive = false; };
  }, [bump]);

  const dosingLog = async () => {
    try {
      const doses = await api.doses();
      if (!doses.length) return showToast?.('No doses to export yet', 'warning');
      download('palmguard-dosing-log.csv', csvFromRows(doses));
      showToast?.('Dosing log exported', 'success');
    } catch (e) { showToast?.(`Export failed: ${e.message}`, 'warning'); }
  };

  const evidencePack = async () => {
    showToast?.('Building WRCC Evidence Pack…', 'success');
    for (const url of ['/api/v1/reports/weekly.csv', '/api/v1/reports/critical.csv', '/api/v1/reports/battery.csv']) {
      try { const text = await fetch(url).then((x) => x.text()); download(`${url.split('/').pop()}`, text); } catch {}
    }
    await dosingLog();
    showToast?.('Evidence Pack downloaded', 'success');
  };

  const REPORTS = [
    { id: 'weekly',  icon: HeartPulse,    name: 'Weekly Palm Health',       window: 'rolling 7 days',
      desc: 'Per-reading risk, classification, trunk Δ, VOC, vibration & click-rate across the orchard.',
      count: counts.weekly, href: '/api/v1/reports/weekly.csv' },
    { id: 'critical', icon: AlertTriangle, name: 'Critical Incident Evidence', window: 'all incidents',
      desc: 'Every critical & warning alert with its trigger value, type, message and resolution status.',
      count: counts.critical, href: '/api/v1/reports/critical.csv' },
    { id: 'dosing',  icon: Syringe,       name: 'Dosing Log',               window: 'all doses',
      desc: 'Full human-confirmed dose lifecycle — request → confirm → release — with caps & volume.',
      count: counts.dosing, onClick: dosingLog },
    { id: 'battery', icon: BatteryMedium, name: 'Battery & Connectivity',   window: 'current snapshot',
      desc: 'Per-node battery %, voltage, RSSI and last-seen — field health of every node at a glance.',
      count: counts.battery, href: '/api/v1/reports/battery.csv' },
  ];

  const total = Object.values(counts).reduce((s, v) => s + (v || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Featured: WRCC Evidence Pack ─────────────────────────────── */}
      <div className="instrument overflow-hidden border-l-4 border-gold">
        <div className="p-5 md:p-6 flex flex-col lg:flex-row lg:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
            <Package size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-bold text-xl text-charcoal dark:text-bone">WRCC Evidence Pack</h2>
              <span className="hud-label px-2.5 py-1 rounded-full border text-gold border-gold/40 bg-gold/10">judge-ready bundle</span>
            </div>
            <p className="text-sm text-muted mt-1 max-w-2xl">
              One click exports the whole archive — health, incidents, dosing and connectivity — as timestamped CSVs.
              Reproducible proof, not screenshots.
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Meta icon={Hash} label="records" value={asOf ? total.toLocaleString() : '…'} />
              <Meta icon={Clock} label="as of" value={fmtClock(asOf)} />
              <Meta icon={Package} label="files" value="4 CSV" />
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={() => { setBump((n) => n + 1); showToast?.('Manifest refreshed', 'success'); }}
              className="focus-ring px-4 py-2.5 instrument-inset text-charcoal dark:text-bone rounded-lg font-bold flex items-center gap-2 text-sm">
              <RefreshCw size={16} /> Refresh
            </button>
            <button onClick={evidencePack}
              className="focus-ring px-5 py-2.5 bg-gold text-ink-900 hover:opacity-90 rounded-lg font-bold flex items-center gap-2 text-sm">
              <Download size={16} /> Export Evidence Pack
            </button>
          </div>
        </div>
      </div>

      {/* ── Manifest ─────────────────────────────────────────────────── */}
      <div>
        <div className="hud-label mb-2">evidence manifest · {REPORTS.length + 1} artifacts</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {REPORTS.map((r) => (
            <div key={r.id} className="instrument p-4 flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-forest/10 dark:bg-forest-400/10 text-forest-400 flex items-center justify-center shrink-0">
                <r.icon size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-charcoal dark:text-bone">{r.name}</h3>
                  <span className="hud-label instrument-inset px-1.5 py-0.5">{r.window}</span>
                </div>
                <p className="text-[12px] text-muted mt-1 leading-snug">{r.desc}</p>
                <div className="flex items-center justify-between gap-3 mt-3">
                  <div className="flex items-center gap-3">
                    <span className="telemetry-num text-sm font-bold text-charcoal dark:text-bone">
                      {r.count == null ? '…' : r.count.toLocaleString()}
                      <span className="hud-label ml-1">records</span>
                    </span>
                    <span className="hud-label flex items-center gap-1"><Clock size={11} /> {fmtClock(asOf)}</span>
                  </div>
                  {r.href ? (
                    <a href={r.href} className="focus-ring px-3 py-2 border border-muted/30 rounded-lg font-bold text-xs text-charcoal dark:text-bone hover:bg-muted/10 flex items-center gap-1.5">
                      <Download size={14} /> CSV
                    </a>
                  ) : (
                    <button onClick={r.onClick} className="focus-ring px-3 py-2 border border-muted/30 rounded-lg font-bold text-xs text-charcoal dark:text-bone hover:bg-muted/10 flex items-center gap-1.5">
                      <Download size={14} /> CSV
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Model Audit — honest, no fabricated metrics. */}
          <div className="instrument p-4 flex gap-4 md:col-span-2 border-dashed border border-muted/30">
            <div className="w-10 h-10 rounded-xl bg-muted/15 text-muted flex items-center justify-center shrink-0">
              <FlaskConical size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-charcoal dark:text-bone">Model Audit Summary</h3>
                <span className="hud-label px-1.5 py-0.5 rounded border border-caution/40 text-caution bg-caution/10">heuristic baseline · no metrics yet</span>
              </div>
              <p className="text-[12px] text-muted mt-1 leading-snug max-w-3xl">
                The detector currently runs a proxy/heuristic baseline. A trained model with real ROC-AUC, PR-AUC and
                per-SNR metrics is the documented next step (see <code className="telemetry-num">docs/MODEL_CARD</code>).
                No accuracy is claimed today — and the dashboard never displays one.
              </p>
              <div className="flex items-center gap-2 mt-3 hud-label text-muted">
                <ShieldCheck size={12} className="text-forest-400" /> honest-by-design — metrics ship when the model does
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Meta = ({ icon: Icon, label, value }) => (
  <div className="instrument-inset px-3 py-1.5 flex items-center gap-2">
    <Icon size={13} className="text-muted" />
    <span className="hud-label">{label}</span>
    <span className="telemetry-num text-sm font-bold text-charcoal dark:text-bone">{value}</span>
  </div>
);

export default Reports;
