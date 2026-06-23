import { Menu, ChevronDown, Bell, Signal, Clock } from 'lucide-react';
import DarkModeToggle from './ui/DarkModeToggle.jsx';

export const Header = ({
  pageTitle, pageSubtitle, onOpenSidebar, dark, toggleTheme, alertCount,
  onBellClick, rightExtras, devicesOnline, lastUpdate,
}) => (
  <header className="bg-panel/85 dark:bg-ink-800/85 backdrop-blur-xl min-h-16 border-b border-muted/15 flex items-center justify-between gap-3 px-4 lg:px-7 sticky top-0 z-30">
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={onOpenSidebar} className="lg:hidden p-2 -ml-2 text-muted"><Menu size={22} /></button>
      <div className="min-w-0">
        <h1 className="font-bold text-lg md:text-xl text-charcoal dark:text-bone tracking-tight leading-tight truncate">{pageTitle}</h1>
        {pageSubtitle && <p className="hidden sm:block text-[11px] text-muted leading-tight truncate">{pageSubtitle}</p>}
      </div>
      <div className="hidden lg:block h-8 w-px bg-muted/20 mx-1" />
      <div className="hidden lg:flex items-center gap-2 instrument-inset px-3 py-1.5">
        <span className="hud-label">orchard</span>
        <span className="text-sm font-medium text-charcoal dark:text-bone">Al-Qassim Block A</span>
        <ChevronDown size={14} className="text-muted" />
      </div>
    </div>

    <div className="flex items-center gap-2 md:gap-3 shrink-0">
      {devicesOnline && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-muted" title="Devices reporting">
          <Signal size={14} className="text-forest-400" />
          <span className="telemetry-num font-semibold text-charcoal dark:text-bone">{devicesOnline}</span>
          <span className="hidden lg:inline">online</span>
        </div>
      )}
      {lastUpdate && (
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted" title="Last telemetry update">
          <Clock size={13} />
          <span className="telemetry-num">{lastUpdate}</span>
        </div>
      )}
      {rightExtras && <div className="hidden sm:block">{rightExtras}</div>}
      <DarkModeToggle dark={dark} toggle={toggleTheme} />
      <button onClick={onBellClick}
        className="focus-ring relative p-2 rounded-lg hover:bg-muted/10 transition-colors"
        aria-label={`Incidents${alertCount > 0 ? ` (${alertCount} active)` : ''}`}>
        <Bell size={19} className="text-muted" />
        {alertCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-crit rounded-full border-2 border-panel dark:border-ink-800 animate-pulse" />}
      </button>
    </div>
  </header>
);

export default Header;
