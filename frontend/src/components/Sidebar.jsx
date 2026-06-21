import {
  LayoutDashboard, Trees, AlertTriangle, Network, FileText,
  AudioLines, LogOut, X, Sparkles, Syringe,
} from 'lucide-react';

// Instrument rail — renamed to the mission-control / tree-ICU mental model.
// (ids unchanged so routing/contracts stay intact.)
const ITEMS = [
  { id: 'overview',    icon: LayoutDashboard, label: 'Mission Overview',       code: 'OVW' },
  { id: 'palms',       icon: Trees,           label: 'Palm Roster',            code: 'RST' },
  { id: 'alerts',      icon: AlertTriangle,   label: 'Alerts / Incidents',     code: 'INC' },
  { id: 'doses',       icon: Syringe,         label: 'Treatment Control',      code: 'TRT' },
  { id: 'network',     icon: Network,         label: 'Orchard Nervous System', code: 'NET' },
  { id: 'spectrogram', icon: AudioLines,      label: 'Tree Stethoscope',       code: 'STH' },
  { id: 'reports',     icon: FileText,        label: 'Evidence Locker',        code: 'EVD' },
];

export const Sidebar = ({ currentPage, setPage, user, onLogout, isOpen, setIsOpen, alertCount = 0, onViewLanding }) => (
  <>
    {isOpen && <div className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsOpen(false)} />}

    <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-forest dark:bg-ink-800 text-bone flex flex-col
      transition-transform duration-300 border-r border-forest-600/40 dark:border-muted/10
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>

      {/* brand */}
      <div className="px-5 py-5 flex items-center gap-3 cursor-pointer border-b border-bone/10" onClick={() => setPage('overview')}>
        <div className="w-9 h-9 bg-forest-400/15 border border-forest-400/40 rounded-lg flex items-center justify-center shrink-0">
          <img src="/logo.png" className="w-5 h-5 brightness-200 grayscale" alt="" />
        </div>
        <div className="leading-tight">
          <div className="font-bold tracking-wide">Palm&nbsp;Guard</div>
          <div className="hud-label text-forest-400/80">field control</div>
        </div>
        <button className="ml-auto lg:hidden" onClick={() => setIsOpen(false)}><X size={18} className="text-muted" /></button>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto custom-scrollbar">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const showBadge = item.id === 'alerts' && alertCount > 0;
          return (
            <button key={item.id} onClick={() => { setPage(item.id); setIsOpen(false); }}
              className={`focus-ring w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all relative group ${
                active ? 'bg-bone/10 text-bone' : 'text-bone/55 hover:bg-bone/5 hover:text-bone'}`}>
              {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-forest-400 rounded-r" />}
              <item.icon size={18} className={active ? 'text-forest-400' : ''} />
              <span className="text-sm font-medium tracking-wide flex-1 text-left">{item.label}</span>
              {showBadge
                ? <span className="bg-crit text-bone text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{alertCount > 9 ? '9+' : alertCount}</span>
                : <span className="hud-label opacity-40 group-hover:opacity-70">{item.code}</span>}
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
        <div className="flex items-center gap-3 p-2.5 rounded-lg bg-bone/5 mb-2 border border-bone/5">
          <div className="w-8 h-8 rounded-md bg-forest-400/20 text-forest-400 flex items-center justify-center font-bold text-sm">{user.initials}</div>
          <div className="hidden lg:block overflow-hidden">
            <div className="text-sm font-semibold truncate">{user.name}</div>
            <div className="hud-label truncate">{user.role}</div>
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
