import { Menu, Bell, Signal, Clock, MapPin } from 'lucide-react';
import DarkModeToggle from './ui/DarkModeToggle.jsx';

// CaseMap TopOperationalHeader — thin field-ops status strip.
export const Header = ({
  pageTitle, pageSubtitle, onOpenSidebar, dark, toggleTheme, alertCount,
  onBellClick, devicesOnline, lastUpdate, mode = 'demo', farm = 'Ain Farm', block = 'Block B',
}) => {
  const isLive = String(mode).toLowerCase() === 'live';
  return (
    <header className="cm-app cc-blur min-h-14 border-b flex items-center justify-between gap-3 px-3 lg:px-5 sticky top-0 z-30"
      style={{ background: 'var(--cm-surface)', borderColor: 'var(--cm-border)' }}>
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onOpenSidebar} className="lg:hidden p-2 -ml-1 cm-muted"><Menu size={20} /></button>
        <div className="hidden sm:flex items-center gap-1.5 text-[13px] font-semibold cm-ink">
          <MapPin size={14} style={{ color: 'var(--cm-forest)' }} />
          {farm} <span className="cm-muted font-normal">•</span> {block}
        </div>
        <div className="hidden md:block h-6 w-px" style={{ background: 'var(--cm-border)' }} />
        <div className="min-w-0">
          <div className="text-[13px] font-semibold cm-ink truncate leading-tight">{pageTitle}</div>
          {pageSubtitle && <div className="hidden lg:block text-[11px] cm-muted truncate leading-tight">{pageSubtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {/* mode badge — never hide the demo/live distinction */}
        <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold"
          style={isLive
            ? { color: '#2F7D46', background: '#2F7D461A', border: '1px solid #2F7D4640' }
            : { color: '#B7791F', background: '#B7791F1A', border: '1px solid #B7791F40' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: isLive ? '#2F7D46' : '#B7791F' }} />
          {isLive ? 'LIVE' : 'DEMO — Clear Water Only'}
        </span>
        {devicesOnline && (
          <span className="hidden md:flex items-center gap-1.5 text-[12px] cm-muted" title="Devices online">
            <Signal size={13} style={{ color: 'var(--cm-forest)' }} />
            <span className="cm-mono font-semibold cm-ink">{devicesOnline}</span> online
          </span>
        )}
        {lastUpdate && (
          <span className="hidden lg:flex items-center gap-1.5 text-[12px] cm-muted" title="Last sync">
            <Clock size={12} /> <span className="cm-mono">{lastUpdate}</span>
          </span>
        )}
        <DarkModeToggle dark={dark} toggle={toggleTheme} />
        <button onClick={onBellClick} className="focus-ring relative p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
          aria-label={`Incidents${alertCount > 0 ? ` (${alertCount})` : ''}`}>
          <Bell size={18} className="cm-muted" />
          {alertCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: '#B42318' }} />}
        </button>
      </div>
    </header>
  );
};

export default Header;
