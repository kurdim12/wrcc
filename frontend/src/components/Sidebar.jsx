import {
  Map, Cpu, Trees, AlertTriangle, ShieldCheck, Network, AudioLines,
  FileText, LogOut, X, Sparkles, Droplets,
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
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(160deg,#1A5236,#0B281B)', border: '1px solid rgba(201,162,75,0.45)', boxShadow: '0 6px 16px -8px rgba(0,0,0,0.7)' }}>
          <img src="/logo.png" className="w-5 h-5 brightness-0 invert" alt="" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="cm-display font-bold tracking-[0.02em] text-[14px] cm-ink">PALM GUARD</div>
          <div className="cm-mono text-[10px]" style={{ color: 'var(--cm-gold)', letterSpacing: '0.22em' }}>CASEMAP</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setIsOpen(false)}><X size={18} className="cm-muted" /></button>
      </div>

      <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto custom-scrollbar">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const badge = item.id === 'alerts' && alertCount > 0 ? alertCount : null;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setIsOpen(false); }}
              className="focus-ring w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors relative text-[13px] font-medium"
              style={active
                ? { background: 'var(--cm-green-soft)', color: 'var(--cm-forest)' }
                : { color: 'var(--cm-muted)' }}>
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r" style={{ background: 'var(--cm-forest)' }} />}
              <item.icon size={17} className="shrink-0" />
              <span className="flex-1 text-left truncate">{item.label}</span>
              {badge != null && (
                <span className="text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-white" style={{ background: '#EE5A48' }}>{badge > 99 ? '99+' : badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-2.5 border-t cm-divide">
        {/* operational status + demo guardrail (matches field-ops chrome) */}
        <div className="px-1 pb-2.5 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#43C76E' }} />
              <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#43C76E' }} />
            </span>
            <span className="text-[11px] font-semibold cm-ink">System Operational</span>
          </div>
          <div className="rounded-xl px-3 py-2.5" style={{ background: 'rgba(224,161,46,0.10)', border: '1px solid rgba(224,161,46,0.28)' }}>
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em]" style={{ color: '#F0B040' }}>
              <Droplets size={12} /> Demo Mode
            </div>
            <div className="text-[10.5px] cm-muted mt-1 leading-snug">Clear water only · per WRCC rule 5.8</div>
          </div>
        </div>
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
          className="focus-ring w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[12px] font-medium cm-muted hover:text-[#EE5A48]">
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  </>
);

export default Sidebar;
