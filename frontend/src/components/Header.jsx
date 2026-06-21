import { Menu, ChevronDown, Bell, Crosshair } from 'lucide-react';
import DarkModeToggle from './ui/DarkModeToggle.jsx';

export const Header = ({ pageTitle, onOpenSidebar, dark, toggleTheme, alertCount, onBellClick, rightExtras, context }) => (
  <header className="bg-panel/80 dark:bg-ink-800/80 backdrop-blur-xl h-16 border-b border-muted/15 flex items-center justify-between px-5 lg:px-7 sticky top-0 z-30">
    <div className="flex items-center gap-4">
      <button onClick={onOpenSidebar} className="lg:hidden p-2 -ml-2 text-muted"><Menu size={22} /></button>
      <h1 className="font-bold text-lg md:text-xl capitalize text-charcoal dark:text-bone tracking-tight">{pageTitle}</h1>
      <div className="hidden md:block h-7 w-px bg-muted/20 mx-1" />
      <div className="hidden md:flex items-center gap-2 instrument-inset px-3 py-1.5">
        <span className="hud-label">orchard</span>
        <span className="text-sm font-medium text-charcoal dark:text-bone">Al-Qassim Block A</span>
        <ChevronDown size={14} className="text-muted" />
      </div>
      {context && (
        <div className="hidden lg:flex items-center gap-1.5 text-forest-400">
          <Crosshair size={14} />
          <span className="telemetry-num text-sm font-semibold">{context}</span>
        </div>
      )}
      {rightExtras && <div className="hidden md:block ml-1">{rightExtras}</div>}
    </div>

    <div className="flex items-center gap-2 md:gap-3">
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
