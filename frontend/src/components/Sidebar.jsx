import {
  Map, Cpu, Trees, AlertTriangle, ShieldCheck, Network, AudioLines,
  FileText, LogOut, X, Sparkles,
} from 'lucide-react';

// CaseMap NavRail — compact field-ops navigation. Labels are CaseMap; ids map to
// the existing routed pages (no unrouted Tasks/Settings pages are invented).
const ITEMS = [
  { id: 'overview',     icon: Map,           label: 'Map' },
  { id: 'intelligence', icon: Cpu,           label: 'AI Decision' },
  { id: 'palms',        icon: Trees,         label: 'Trees' },
  { id: 'alerts',       icon: AlertTriangle, label: 'Incidents' },
  { id: 'doses',        icon: ShieldCheck,   label: 'Safety Gate' },
  { id: 'network',      icon: Network,       label: 'Network' },
  { id: 'spectrogram',  icon: AudioLines,    label: 'Acoustic Lab' },
  { id: 'reports',      icon: FileText,      label: 'Reports' },
];

export const Sidebar = ({ currentPage, setPage, user, onLogout, isOpen, setIsOpen, alertCount = 0, onViewLanding }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

    <aside className={`cm-app fixed lg:static inset-y-0 left-0 z-50 w-[212px] flex flex-col
      transition-transform duration-300 border-r
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{ background: 'var(--cm-surface)', borderColor: 'var(--cm-border)' }}>

      {/* brand */}
      <div className="px-4 py-4 flex items-center gap-2.5 cursor-pointer border-b cm-divide" onClick={() => setPage('overview')}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--cm-forest)' }}>
          <img src="/logo.png" className="w-5 h-5 brightness-0 invert" alt="" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-display font-bold tracking-wide text-[13px] cm-ink">PALM GUARD</div>
          <div className="cm-mono text-[10px]" style={{ color: 'var(--cm-forest)', letterSpacing: '0.12em' }}>CASEMAP</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setIsOpen(false)}><X size={18} className="cm-muted" /></button>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const badge = item.id === 'alerts' && alertCount > 0 ? alertCount : null;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setIsOpen(false); }}
              className="focus-ring w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 relative text-[13px] font-medium hover:translate-x-0.5"
              style={active
                ? { background: 'var(--cm-green-soft)', color: 'var(--cm-forest)' }
                : { color: 'var(--cm-muted)' }}>
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ background: 'var(--cm-forest)' }} />}
              <item.icon size={17} className="shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {badge != null && (
                <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-white" style={{ background: '#B42318' }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2.5 border-t cm-divide">
        {onViewLanding && (
          <button onClick={onViewLanding}
            className="focus-ring w-full flex items-center gap-2 px-2.5 py-1.5 mb-1.5 rounded-lg text-[12px] font-medium cm-muted hover:text-[var(--cm-forest)]">
            <Sparkles size={14} style={{ color: 'var(--cm-forest)' }} /> Landing page
          </button>
        )}
        <div className="flex items-center gap-2.5 p-2 rounded-lg cm-surface mb-1.5">
          <div className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-[12px] text-white shrink-0" style={{ background: 'var(--cm-forest)' }}>{user.initials}</div>
          <div className="hidden lg:block overflow-hidden">
            <div className="text-[12px] font-semibold truncate cm-ink">{user.name}</div>
            <div className="text-[10px] cm-muted truncate">{user.role}</div>
          </div>
        </div>
        <button onClick={onLogout}
          className="focus-ring w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cm-muted hover:text-[#B42318]">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  </>
);

export default Sidebar;
