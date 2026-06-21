import { useEffect, useState } from 'react';
import { FileText, Download, RefreshCw, Package, Syringe, ShieldCheck } from 'lucide-react';
import { api } from '../api.js';

// Evidence Locker — exportable proof for judges & engineers.
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

export const Reports = ({ showToast }) => {
  const [reports, setReports] = useState([]);
  useEffect(() => { api.reportsList().then(setReports).catch(() => {}); }, []);

  const dosingLog = async () => {
    try {
      const doses = await api.doses();
      if (!doses.length) return showToast?.('No doses to export yet', 'warning');
      download('palmguard-dosing-log.csv', csvFromRows(doses));
      showToast?.('Dosing log exported', 'success');
    } catch (e) { showToast?.(`Export failed: ${e.message}`, 'warning'); }
  };

  const evidencePack = async () => {
    // Sequentially fetch every backend CSV + the client-side dosing log.
    showToast?.('Building WRCC Evidence Pack…', 'success');
    for (const r of reports) {
      try { const text = await fetch(r.endpoint).then((x) => x.text()); download(`${r.id}.csv`, text); } catch {}
    }
    await dosingLog();
  };

  return (
    <div className="space-y-5 animate-fade-in-up">
      <div className="instrument p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><FileText size={18} className="text-gold" /><h2 className="font-bold text-charcoal dark:text-bone">Evidence Locker</h2></div>
          <p className="text-sm text-muted mt-1">Exportable proof — readings, incidents, dosing log, connectivity. CSV today; the Evidence Pack bundles them.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { api.reportsList().then(setReports); showToast?.('Refreshed', 'success'); }}
            className="focus-ring px-4 py-2.5 instrument-inset text-charcoal dark:text-bone rounded-lg font-bold flex items-center gap-2 text-sm"><RefreshCw size={16} /> Refresh</button>
          <button onClick={evidencePack}
            className="focus-ring px-4 py-2.5 bg-forest text-bone hover:bg-forest-600 rounded-lg font-bold flex items-center gap-2 text-sm"><Package size={16} /> Export WRCC Evidence Pack</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map((report) => (
          <div key={report.id} className="instrument p-5 flex flex-col gap-3">
            <div className="p-2.5 rounded-lg instrument-inset text-gold w-fit"><FileText size={22} /></div>
            <div><h3 className="font-bold text-charcoal dark:text-bone">{report.name}</h3><div className="hud-label mt-0.5">live · {report.type}</div></div>
            <a href={report.endpoint} className="focus-ring mt-auto w-full py-2.5 border border-muted/30 rounded-lg font-bold text-sm text-charcoal dark:text-bone hover:bg-muted/10 flex items-center justify-center gap-2"><Download size={15} /> Download {report.type}</a>
          </div>
        ))}

        {/* Client-side dosing log (built from /doses). */}
        <div className="instrument p-5 flex flex-col gap-3">
          <div className="p-2.5 rounded-lg instrument-inset text-crit w-fit"><Syringe size={22} /></div>
          <div><h3 className="font-bold text-charcoal dark:text-bone">Dosing Log</h3><div className="hud-label mt-0.5">live · CSV</div></div>
          <button onClick={dosingLog} className="focus-ring mt-auto w-full py-2.5 border border-muted/30 rounded-lg font-bold text-sm text-charcoal dark:text-bone hover:bg-muted/10 flex items-center justify-center gap-2"><Download size={15} /> Download CSV</button>
        </div>

        {/* Model Audit — honest "documented" card (no fabricated metrics). */}
        <div className="instrument p-5 flex flex-col gap-3 opacity-80">
          <div className="p-2.5 rounded-lg instrument-inset text-muted w-fit"><ShieldCheck size={22} /></div>
          <div><h3 className="font-bold text-charcoal dark:text-bone">Model Audit Summary</h3><div className="hud-label mt-0.5">heuristic baseline · no metrics yet</div></div>
          <div className="mt-auto text-[11px] text-muted">Proxy-trained model + metrics are the documented next step (see docs/MODEL_CARD). No accuracy is claimed today.</div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
