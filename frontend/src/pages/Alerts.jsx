import { useState } from 'react';
import { AlertTriangle, Activity, ChevronRight, Check } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import { Badge, severityType } from '../components/ui/Badge.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { api } from '../api.js';

const fmtAgo = (ts) => {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const Alerts = ({ onAlertClick, showToast }) => {
  const [statusTab, setStatusTab] = useState('active');
  const { alerts, refresh } = useAlerts(statusTab);

  const ack = async (e, id) => {
    e.stopPropagation();
    try { await api.ackAlert(id); showToast?.('Alert acknowledged', 'success'); refresh(); }
    catch (err) { showToast?.(err.message, 'critical'); }
  };
  const resolve = async (e, id) => {
    e.stopPropagation();
    try { await api.resolveAlert(id); showToast?.('Alert resolved', 'success'); refresh(); }
    catch (err) { showToast?.(err.message, 'critical'); }
  };

  return (
    <Card className="p-6 md:p-8 animate-fade-in-up border border-gray-100 dark:border-gray-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Alert Center</h2>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700">
          {['active', 'acknowledged', 'resolved'].map(t => (
            <button key={t}
              onClick={() => setStatusTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-colors ${
                statusTab === t
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow border border-gray-200 dark:border-gray-700'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}>{t}</button>
          ))}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="p-12 text-center text-gray-400 dark:text-gray-500 text-sm">
          No {statusTab} alerts.
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map(alert => (
            <div key={alert.id}
                 onClick={() => onAlertClick?.(alert.device_id)}
                 className="flex flex-col md:flex-row md:items-center justify-between p-5 border border-gray-100 dark:border-gray-800 rounded-2xl hover:bg-gray-50 dark:hover:bg-gray-900/50 cursor-pointer transition-colors group">
              <div className="flex items-start gap-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  alert.severity === 'critical'
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                    : alert.severity === 'warning'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                }`}>
                  {alert.severity === 'critical' ? <AlertTriangle size={24} /> : <Activity size={24} />}
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-3 text-lg flex-wrap">
                    {alert.device_id}
                    <span className="text-xs font-mono uppercase tracking-wider text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{alert.type}</span>
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">{fmtAgo(alert.ts)}</span>
                  </div>
                  <div className="text-gray-600 dark:text-gray-300 mt-1">{alert.message}</div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 flex items-center gap-2 self-end md:self-auto">
                <Badge type={severityType(alert.severity)} text={alert.severity} />
                {alert.status === 'active' && (
                  <>
                    <button onClick={(e) => ack(e, alert.id)} title="Acknowledge"
                            className="p-2 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 transition-colors">
                      <Check size={18} />
                    </button>
                    <button onClick={(e) => resolve(e, alert.id)} title="Resolve"
                            className="p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 transition-colors">
                      <Check size={18} className="stroke-[3]" />
                    </button>
                  </>
                )}
                <ChevronRight className="text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default Alerts;
