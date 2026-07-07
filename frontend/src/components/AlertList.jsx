import { ChevronRight, AlertTriangle, Activity, Battery, ThermometerSun, Wind, Wifi } from 'lucide-react';
import { Badge, severityType } from './ui/Badge.jsx';

const TYPE_ICON = {
  HIGH_RISK:        AlertTriangle,
  MEDIUM_SUSTAINED: Activity,
  ANOMALY_SPIKE:    Activity,
  THERMAL_STRESS:   ThermometerSun,
  VOC_SURGE:        Wind,
  LOW_BATTERY:      Battery,
  OFFLINE:          Wifi,
};

const formatRelative = (ts) => {
  if (!ts) return '';
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const AlertList = ({ alerts, onSelect, compact = false }) => {
  if (!alerts?.length) {
    return (
      <div className="p-8 text-center text-muted text-sm">
        No active alerts. All trees nominal.
      </div>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {alerts.map((alert) => {
        const Icon = TYPE_ICON[alert.type] || AlertTriangle;
        return (
          <div
            key={alert.id}
            onClick={() => onSelect?.(alert)}
            className={`${compact ? 'p-4' : 'p-5'} instrument rounded-2xl hover:border-forest-400/40 hover:shadow-md transition-all cursor-pointer group`}
          >
            <div className="flex justify-between items-start mb-2">
              <Badge type={severityType(alert.severity)} text={alert.severity} />
              <span className="hud-label text-muted">{formatRelative(alert.ts)}</span>
            </div>
            <div className="flex items-start gap-3">
              <Icon size={compact ? 16 : 18} className="mt-0.5 text-muted shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-sm text-bone mb-1 flex items-center gap-2 telemetry-num">
                  {alert.device_id}
                  <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity text-forest-400 -ml-1" />
                </div>
                <p className="text-xs text-muted leading-relaxed line-clamp-2 font-medium">
                  {alert.message}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlertList;
