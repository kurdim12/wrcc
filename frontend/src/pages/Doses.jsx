import { useState } from 'react';
import { ShieldCheck, ShieldOff, Syringe, Droplets } from 'lucide-react';
import { api } from '../api.js';
import { useDevices } from '../hooks/useDevices.js';
import { useDoses } from '../hooks/useDoses.js';

const fmtTime = (ts) => (ts ? new Date(ts * 1000).toLocaleString() : '—');

const STATUS_STYLE = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300',
  sent:      'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300',
  done:      'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300',
  failed:    'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function Doses({ showToast }) {
  const { devices, refresh } = useDevices();
  const { doses } = useDoses();
  const [busy, setBusy] = useState(null);

  const arm = async (d, armed) => {
    setBusy(d.id);
    try { await api.armDevice(d.id, armed); showToast?.(`${d.id} ${armed ? 'armed' : 'disarmed'}`, armed ? 'warning' : 'success'); refresh(); }
    catch (e) { showToast?.(`Arm failed: ${e.message}`, 'warning'); }
    finally { setBusy(null); }
  };

  const requestDose = async (d) => {
    setBusy(d.id);
    try {
      const r = await api.requestDose(d.id, 'operator');
      if (r?.error) showToast?.(`Dose request rejected: ${r.reason}`, 'warning');
      else showToast?.(`Manual dose requested on ${d.id} — confirm to release`, 'warning');
    } catch (e) { showToast?.(`Request failed: ${e.message}`, 'warning'); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Syringe size={20} className="text-red-500" /> Targeted micro-dosing
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          Dosing is <strong>human-armed and human-confirmed</strong>. A node only doses when it is armed
          here, a confirmed command is sent, and both server and device failsafes pass
          (max doses/day, cooldown, max pump duration). No autonomous spraying.
        </p>
      </div>

      {/* Device arm controls */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {devices.map((d) => (
          <div key={d.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-bold text-gray-900 dark:text-white">{d.id}</div>
                <div className="text-xs text-gray-400">{d.variety || 'unassigned'} · {d.computed_status || d.status}</div>
              </div>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
                d.armed ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
                {d.armed ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                {d.armed ? 'ARMED' : 'disarmed'}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 mb-3">
              caps: {d.max_doses_day}/day · {Math.round((d.cooldown_s || 0) / 60)} min cooldown · {d.pump_ms} ms
            </div>
            <div className="flex gap-2">
              <button
                disabled={busy === d.id}
                onClick={() => arm(d, !d.armed)}
                className={`flex-1 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${
                  d.armed ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {d.armed ? 'Disarm' : 'Arm'}
              </button>
              <button
                disabled={busy === d.id || !d.armed}
                onClick={() => requestDose(d)}
                title={d.armed ? 'Request a manual dose (still needs confirmation)' : 'Arm first'}
                className="flex-1 py-2 rounded-xl text-sm font-bold bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 flex items-center justify-center gap-1">
                <Droplets size={15} /> Dose
              </button>
            </div>
          </div>
        ))}
        {devices.length === 0 && <div className="text-sm text-gray-400">No devices yet.</div>}
      </div>

      {/* Dose history */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">Dose history</h3>
        <div className="overflow-x-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3">Time</th><th className="px-4 py-3">Device</th>
                <th className="px-4 py-3">Trigger risk</th><th className="px-4 py-3">Volume</th>
                <th className="px-4 py-3">Source</th><th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {doses.map((d) => (
                <tr key={d.id} className="border-b border-gray-50 dark:border-gray-800/50">
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{fmtTime(d.done_ts || d.sent_ts || d.ts)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{d.device_id}</td>
                  <td className="px-4 py-3 tabular-nums">{d.trigger_risk != null ? Math.round(d.trigger_risk) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{d.volume_ml_est ?? '—'} ml</td>
                  <td className="px-4 py-3 capitalize">{d.source}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[d.status] || ''}`}>{d.status}</span>
                  </td>
                </tr>
              ))}
              {doses.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No doses yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
