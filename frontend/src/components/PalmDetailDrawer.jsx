import { useEffect, useState } from 'react';
import { X, MapPin, ShieldCheck, ShieldOff, User, Activity, Thermometer, Wind, Battery, Droplets } from 'lucide-react';
import { Badge, severityType } from './ui/Badge.jsx';
import { ConfidenceBadge } from './ConfidenceBadge.jsx';
import { api } from '../api.js';
import { onEvent } from '../socket.js';

const fmt = (v, d = 1) => v == null ? '-' : Number(v).toFixed(d);

export const PalmDetailDrawer = ({ palm, onClose, showToast }) => {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Keep the local arm toggle in sync with the device's reported state.
  useEffect(() => {
    if (latest?.act && typeof latest.act.armed === 'boolean') setArmed(latest.act.armed);
  }, [latest?.act?.armed]);

  const toggleArm = async () => {
    if (!palm?.device_id) { showToast?.('No device on this palm', 'warning'); return; }
    setBusy(true);
    const next = !armed;
    try { await api.armDevice(palm.device_id, next); setArmed(next); showToast?.(`${palm.device_id} ${next ? 'armed' : 'disarmed'}`, next ? 'warning' : 'success'); }
    catch (e) { showToast?.(`Arm failed: ${e.message}`, 'warning'); }
    finally { setBusy(false); }
  };

  const requestDose = async () => {
    if (!palm?.device_id) return;
    setBusy(true);
    try {
      const r = await api.requestDose(palm.device_id, 'operator');
      if (r?.error) showToast?.(`Dose request rejected: ${r.reason}`, 'warning');
      else showToast?.('Manual dose requested — confirm to release', 'warning');
    } catch (e) { showToast?.(`Request failed: ${e.message}`, 'warning'); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!palm) return;
    let alive = true;

    const load = async () => {
      try {
        const all = await api.readingsLatest();
        const r = all.find(x => x.device_id === palm.device_id) || null;
        if (alive) setLatest(r);

        if (palm.device_id) {
          const rows = await api.readings({ device_id: palm.device_id, limit: 30 });
          if (alive) setHistory(rows.reverse());
        }
      } catch {}
    };
    load();

    const off = onEvent('live:reading', (r) => {
      if (palm.device_id && r.device_id === palm.device_id) {
        setLatest(r);
        setHistory(prev => [...prev.slice(-29), r]);
      }
    });

    return () => { alive = false; off(); };
  }, [palm?.id, palm?.device_id]);

  if (!palm) return null;

  const cls = latest?.classification ?? palm.classification ?? 'low';
  const risk = latest?.risk_score ?? palm.risk_score ?? 0;
  const healthPct = Math.max(0, Math.min(100, 100 - (risk || 0)));

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-gray-900 shadow-2xl z-50 p-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 animate-slide-in-right">
      <div className="sticky top-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md px-6 py-5 border-b border-gray-100 dark:border-gray-800 z-20 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{palm.id}</h2>
            <Badge type={severityType(cls)} text={cls} />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <MapPin size={14} />
            {palm.farm_id || 'Farm'}
            {palm.row_idx != null ? ` · Row ${palm.row_idx + 1}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Health summary */}
        <div className={`p-6 rounded-3xl border ${
          cls === 'high'   ? 'bg-red-50    border-red-100    dark:bg-red-950/30    dark:border-red-900/50' :
          cls === 'medium' ? 'bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900/50' :
                              'bg-green-50  border-green-100  dark:bg-green-950/30  dark:border-green-900/50'
        }`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className={
                cls === 'high'   ? 'text-red-600' :
                cls === 'medium' ? 'text-orange-600' : 'text-green-600'
              } />
              <span className={`text-sm font-bold uppercase tracking-wide ${
                cls === 'high'   ? 'text-red-800    dark:text-red-400' :
                cls === 'medium' ? 'text-orange-800 dark:text-orange-400' :
                                    'text-green-800  dark:text-green-400'
              }`}>Health Score</span>
            </div>
            <span className={`text-3xl font-black ${
              cls === 'high'   ? 'text-red-600    dark:text-red-400' :
              cls === 'medium' ? 'text-orange-600 dark:text-orange-400' :
                                  'text-green-600  dark:text-green-400'
            }`}>
              {Math.round(healthPct)}%
            </span>
          </div>
          <div className="w-full bg-white/60 dark:bg-[#0a0e1a]/60 rounded-full h-3 mb-4 overflow-hidden p-1">
            <div className={`h-full rounded-full transition-all duration-1000 ease-out ${
              cls === 'high'   ? 'bg-gradient-to-r from-red-500    to-orange-500' :
              cls === 'medium' ? 'bg-gradient-to-r from-orange-500 to-yellow-500' :
                                  'bg-gradient-to-r from-green-500  to-emerald-500'
            }`} style={{ width: `${healthPct}%` }} />
          </div>
          <p className="text-sm font-medium leading-relaxed dark:text-gray-300">
            Risk score: <strong>{Math.round(risk || 0)}</strong> / 100. {
              cls === 'high'   ? 'Strong multi-sensor evidence of internal activity. Immediate action advised.' :
              cls === 'medium' ? 'Elevated readings - inspection within 24-48 h.' :
                                  'No abnormal vibrations or temperature fluctuations.'
            }
          </p>
        </div>

        {/* Model confidence (honest: probability + proxy/heuristic badge) */}
        {latest && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <ConfidenceBadge
              pActivity={latest.p_activity}
              modelVersion={latest.model_version}
              modelSource={latest.model_source}
              calibrated={latest.calibrated}
              size="lg"
            />
          </div>
        )}

        {/* Latest sensor values */}
        {latest && (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={<Activity size={16} />}    label="Acoustic clk"  value={fmt(latest.ac_clk, 1) + ' /s'} />
            <Stat icon={<Activity size={16} />}    label="Vib RMS"        value={fmt(latest.vib_rms, 3) + ' g'} />
            <Stat icon={<Thermometer size={16} />} label="Trunk core"     value={fmt(latest.core_c, 1) + '°C'} />
            <Stat icon={<Thermometer size={16} />} label="Ambient"        value={fmt(latest.amb_c, 1) + '°C'} />
            <Stat icon={<Wind size={16} />}        label="Gas (BME680)"   value={fmt(latest.gas_kohm, 0) + ' kΩ'} />
            <Stat icon={<Battery size={16} />}     label="Battery"        value={(latest.battery_pct ?? '-') + '%'} />
          </div>
        )}

        {/* Mini sparkline of last 30 risk scores */}
        {history.length > 1 && (
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">Risk trend (last 30 readings)</div>
            <div className="h-20 flex items-end gap-1">
              {history.map((r, i) => (
                <div key={i} title={`${Math.round(r.risk_score)}`} className="flex-1 rounded-t-md transition-all"
                     style={{
                       height: `${Math.max(2, r.risk_score)}%`,
                       background: r.classification === 'high'   ? 'linear-gradient(to top, #dc2626, #f97316)'
                                   : r.classification === 'medium' ? 'linear-gradient(to top, #f97316, #fbbf24)'
                                   : 'linear-gradient(to top, #16a34a, #22c55e)',
                     }} />
              ))}
            </div>
          </div>
        )}

        {/* Human-in-the-loop dosing controls */}
        <div className="pt-4 sticky bottom-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm pb-2 space-y-2">
          <div className="flex gap-2">
            <button
              disabled={busy || !palm.device_id}
              onClick={toggleArm}
              className={`flex-1 py-3 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-40 ${
                armed ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20'}`}
            >
              {armed ? <ShieldOff size={18} /> : <ShieldCheck size={18} />}
              {armed ? 'Disarm' : 'Arm dosing'}
            </button>
            <button
              disabled={busy || !armed}
              onClick={requestDose}
              title={armed ? 'Request a manual dose (still needs confirmation)' : 'Arm first'}
              className="flex-1 py-3 rounded-2xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95"
            >
              <Droplets size={18} /> Request dose
            </button>
          </div>
          <button
            onClick={() => showToast?.(`Inspector dispatched to ${palm.id}`, 'success')}
            className="w-full py-2.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-2xl font-medium text-sm flex items-center justify-center gap-2"
          >
            <User size={16} /> Dispatch Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-100 dark:border-gray-800">
    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">{icon}<span className="text-[10px] font-bold uppercase tracking-wider">{label}</span></div>
    <div className="text-lg font-bold text-gray-900 dark:text-white">{value}</div>
  </div>
);

export default PalmDetailDrawer;
