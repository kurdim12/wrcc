import {
  LayoutDashboard, Trees, AlertTriangle, Network, FileText,
  Activity, LogOut, X, Sparkles, Syringe,
} from 'lucide-react';

const ITEMS = [
  { id: 'overview',    icon: LayoutDashboard, label: 'Overview' },
  { id: 'palms',       icon: Trees,           label: 'Palms Management' },
  { id: 'alerts',      icon: AlertTriangle,   label: 'Alerts' },
  { id: 'doses',       icon: Syringe,         label: 'Dosing' },
  { id: 'network',     icon: Network,         label: 'Mesh Network' },
  { id: 'spectrogram', icon: Activity,        label: 'Live Spectrogram' },
  { id: 'reports',     icon: FileText,        label: 'Reports' },
];

export const Sidebar = ({ currentPage, setPage, user, onLogout, isOpen, setIsOpen, alertCount = 0, onViewLanding }) => (
  <>
    {isOpen && (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
           onClick={() => setIsOpen(false)} />
    )}

    <aside className={`
      fixed lg:static inset-y-0 left-0 z-50 w-64 bg-green-950 dark:bg-[#070b14] text-white flex flex-col
      transition-transform duration-300 shadow-2xl border-r border-green-900 dark:border-gray-800
      ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="p-6 flex items-center gap-3 cursor-pointer mb-4" onClick={() => setPage('overview')}>
        <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-green-900/50">
          <img src="/logo.png" className="w-6 h-6 brightness-200 grayscale" alt="" />
        </div>
        <span className="font-bold text-xl tracking-wide text-white">PalmGuard</span>
        <button className="ml-auto lg:hidden" onClick={() => setIsOpen(false)}>
          <X size={20} className="text-gray-400" />
        </button>
      </div>

      <nav className="flex-1 px-4 space-y-1.5 overflow-y-auto">
        {ITEMS.map((item) => {
          const active = currentPage === item.id;
          const showBadge = item.id === 'alerts' && alertCount > 0;
          return (
            <button
              key={item.id}
              onClick={() => { setPage(item.id); setIsOpen(false); }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${
                active ? 'bg-white/10 text-white shadow-inner' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 rounded-l-full" />}
              <item.icon size={20} className={`transition-transform group-hover:scale-110 ${active ? 'text-green-400' : ''}`} />
              <span className="font-medium tracking-wide text-sm">{item.label}</span>
              {showBadge && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        {onViewLanding && (
          <button
            onClick={onViewLanding}
            className="w-full flex items-center gap-3 px-4 py-2.5 mb-2 text-gray-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors text-xs font-medium"
          >
            <Sparkles size={16} className="text-green-400" />
            View landing page
          </button>
        )}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 mb-3 border border-white/5">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-white flex items-center justify-center font-bold shadow-sm">
            {user.initials}
          </div>
          <div className="hidden lg:block overflow-hidden">
            <div className="text-sm font-semibold truncate text-white">{user.name}</div>
            <div className="text-xs text-gray-400 truncate">{user.role}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-400 hover:text-white hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium group"
        >
          <LogOut size={18} className="group-hover:text-red-400 transition-colors" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  </>
);

export default Sidebar;
