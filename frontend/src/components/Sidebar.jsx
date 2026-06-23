import {
  LayoutDashboard, Trees, AlertTriangle, Network, FileText,
  AudioLines, LogOut, X, Sparkles, ShieldCheck, Cpu,
} from 'lucide-react';

// Clear, judge-friendly labels up front; the creative "mission-control" names
// live as small subtitles. (ids unchanged so routing/contracts stay intact.)
const ITEMS = [
  { id: 'overview',     icon: LayoutDashboard, label: 'Command Center', sub: 'Mission Overview' },
  { id: 'intelligence', icon: Cpu,             label: 'AI Decision',    sub: 'Intelligence Layer' },
  { id: 'palms',        icon: Trees,           label: 'Trees',          sub: 'Palm Roster' },
  { id: 'alerts',       icon: AlertTriangle,   label: 'Incidents',      sub: 'Alerts & Events' },
  { id: 'doses',        icon: ShieldCheck,     label: 'Safety Gate',    sub: 'Treatment Control' },
  { id: 'network',      icon: Network,         label: 'Network',        sub: 'Orchard Nervous System' },
  { id: 'spectrogram',  icon: AudioLines,      label: 'Acoustic Lab',   sub: 'Tree Stethoscope' },
  { id: 'reports',      icon: FileText,        label: 'Reports',        sub: 'Evidence Locker' },
];

export const Sidebar = ({ currentPage, setPage, user, onLogout, isOpen, setIsOpen, alertCount = 0, onViewLanding }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

    <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-forest dark:bg-ink-800 text-bone flex flex-col
      transition-transform duration-300 border-r border-forest-600/40 dark:border-muted/10
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

      {/* brand */}
      <div className="px-5 py-5 flex items-center gap-3 cursor-pointer border-b border-bone/10" onClick={() => setPage('overview')}>
        <div className="w-10 h-10 bg-forest-400/15 border border-forest-400/40 rounded-xl flex items-center justify-center shrink-0">
          <img src="/logo.png" className="w-5 h-5 brightness-200 grayscale" alt="" />
        </div>
        <div className="leading-tight min-w-0">
          <div className="font-bold tracking-wide text-[15px]">Palm&nbsp;Guard</div>
          <div className="text-[10px] text-forest-400/90 font-medium tracking-wide">It listens. It detects. It acts.</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setIsOpen(false)}><X size={18} className="text-bone/60" /></button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto custom-scrollbar">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const showBadge = item.id === 'alerts' && alertCount > 0;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setIsOpen(false); }}
              className={`focus-ring w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative group ${
                active ? 'bg-bone/12 text-bone' : 'text-bone/60 hover:bg-bone/6 hover:text-bone'}`}>
              {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-forest-400 rounded-r" />}
              <item.icon size={18} className={active ? 'text-forest-400 shrink-0' : 'shrink-0'} />
              <span className="flex-1 text-left leading-tight min-w-0">
                <span className="block text-sm font-semibold tracking-wide truncate">{item.label}</span>
                <span className={`block text-[10px] truncate ${active ? 'text-bone/55' : 'text-bone/35 group-hover:text-bone/50'}`}>{item.sub}</span>
              </span>
              {showBadge && (
                <span className="bg-crit text-bone text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center shrink-0">{alertCount > 9 ? '9+' : alertCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-bone/10">
        {onViewLanding && (
          <button onClick={onViewLanding}
            className="focus-ring w-full flex items-center gap-2 px-3 py-2 mb-2 text-bone/55 hover:text-forest-400 hover:bg-forest-400/10 rounded-lg text-xs font-medium">
            <Sparkles size={15} className="text-forest-400" /> Landing page
          </button>
        )}
        <div className="flex items-center gap-3 p-2.5 rounded-xl bg-bone/5 mb-2 border border-bone/5">
          <div className="w-8 h-8 rounded-lg bg-forest-400/20 text-forest-400 flex items-center justify-center font-bold text-sm shrink-0">{user.initials}</div>
          <div className="hidden lg:block overflow-hidden">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="text-[10px] text-bone/45 truncate">{user.role}</div>
          </div>
        </div>
        <button onClick={onLogout}
          className="focus-ring w-full flex items-center gap-2 px-3 py-2 text-bone/55 hover:text-crit hover:bg-crit/10 rounded-lg text-sm font-medium">
          <LogOut size={16} /> Sign out
        </button>
      </div>
    </aside>
  </>
);

export default Sidebar;
