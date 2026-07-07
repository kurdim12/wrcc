import {
  LayoutDashboard, Map as MapIcon, Trees, AlertTriangle, Droplets, Cpu, Network,
  AudioLines, FileText, LogOut, X, Sparkles,
} from 'lucide-react';

// NavRail — ids map to the existing routed pages; labels/order follow the
// approved design. "AI Decision" surfaces the multi-sensor agent layer.
const ITEMS = [
  { id: 'overview',     icon: LayoutDashboard, label: 'Overview' },
  { id: 'map',          icon: MapIcon,         label: 'Map' },
  { id: 'palms',        icon: Trees,           label: 'Palms' },
  { id: 'alerts',       icon: AlertTriangle,   label: 'Alerts' },
  { id: 'doses',        icon: Droplets,        label: 'Dosing' },
  { id: 'intelligence', icon: Cpu,             label: 'AI Decision' },
  { id: 'network',      icon: Network,         label: 'Mesh Network' },
  { id: 'spectrogram',  icon: AudioLines,      label: 'Live Spectrogram' },
  { id: 'reports',      icon: FileText,        label: 'Reports' },
];

export const Sidebar = ({ currentPage, setPage, user, onLogout, isOpen, setIsOpen, alertCount = 0, onViewLanding, systemStatus = { ok: true, label: 'All systems operational' } }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

    <aside className={`cm-app fixed lg:static inset-y-0 left-0 z-50 w-[248px] flex flex-col transition-transform duration-300 border-r
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ background: 'var(--cm-surface)', borderColor: 'var(--cm-border)' }}>

      {/* brand */}
      <div className="px-5 py-5 flex items-center gap-3 cursor-pointer" onClick={() => setPage('overview')}>
        <img src="/logo.png" className="w-10 h-10 object-contain shrink-0" alt="Palm Guard" />
        <div className="font-display font-bold cm-ink leading-[0.92] text-[19px] tracking-tight">
          <div>Palm</div><div>Guard</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}><X size={18} className="cm-muted" /></button>
      </div>

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const badge = item.id === 'alerts' && alertCount > 0 ? alertCount : null;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setIsOpen(false); }}
              className="pg-focus w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors relative text-[13.5px] font-medium"
              style={active ? { background: 'var(--cm-green-soft)', color: 'var(--cm-forest)' } : { color: 'var(--cm-muted)' }}>
              {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full" style={{ background: 'var(--cm-forest)' }} />}
              <item.icon size={18} className="shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {badge != null && (
                <span className="text-[10px] font-bold min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center text-white" style={{ background: '#C94A3A' }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 space-y-2 border-t cm-divide">
        {/* system status */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'var(--cm-green-soft)' }}>
          <span className="w-2 h-2 rounded-full animate-heartbeat" style={{ background: systemStatus.ok ? 'var(--cm-healthy)' : 'var(--cm-watch)' }} />
          <div className="leading-tight">
            <div className="text-[12px] font-semibold cm-ink">System Status</div>
            <div className="text-[10.5px]" style={{ color: systemStatus.ok ? 'var(--cm-healthy)' : 'var(--cm-watch)' }}>{systemStatus.label}</div>
          </div>
        </div>
        {/* user */}
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[12px] text-white shrink-0 bg-forest-600">{user.initials}</div>
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-semibold truncate cm-ink">{user.name}</div>
            <div className="text-[10.5px] cm-muted truncate">{user.role}</div>
          </div>
          <button onClick={onLogout} title="Sign out" className="pg-focus p-1.5 rounded-lg cm-muted hover:text-[var(--cm-critical)]"><LogOut size={15} /></button>
        </div>
        {onViewLanding && (
          <button onClick={onViewLanding} className="pg-focus w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-[11.5px] font-medium cm-muted hover:text-[var(--cm-forest)]">
            <Sparkles size={13} style={{ color: 'var(--cm-forest)' }} /> Landing page
          </button>
        )}
      </div>
    </aside>
  </>
);

export default Sidebar;
