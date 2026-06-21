import { useConnectivity } from '../hooks/useConnectivity.js';

// Thin always-on mission status strip. Compact by default; only the color +
// short message change. Priority: backend down → socket down → demo → nominal.
export const SystemStatusStrip = ({ mode = 'unknown' }) => {
  const { socketUp, backendUp } = useConnectivity();

  let tone, dot, text;
  if (!backendUp)      { tone = 'bg-crit/15 text-crit';        dot = 'bg-crit';        text = 'BACKEND UNREACHABLE — retrying, showing last-known state'; }
  else if (!socketUp)  { tone = 'bg-caution/15 text-caution';  dot = 'bg-caution';     text = 'LIVE LINK RECONNECTING — data may be a few seconds stale'; }
  else if (mode === 'demo')    { tone = 'bg-muted/12 text-muted';     dot = 'bg-muted';   text = 'DEMO MODE ACTIVE — simulated readings · clear-water dosing'; }
  else if (mode === 'live')    { tone = 'bg-forest-400/12 text-forest-400'; dot = 'bg-forest-400'; text = 'ALL SYSTEMS NOMINAL — live device stream'; }
  else                 { tone = 'bg-muted/12 text-muted';      dot = 'bg-muted';       text = 'CONNECTING…'; }

  return (
    <div className={`w-full px-4 py-1 flex items-center gap-2 border-b border-muted/10 ${tone}`}>
      <span className={`w-2 h-2 rounded-full ${dot} ${backendUp && socketUp && mode === 'live' ? 'animate-heartbeat' : ''}`} />
      <span className="hud-label text-current">{text}</span>
    </div>
  );
};

export default SystemStatusStrip;
