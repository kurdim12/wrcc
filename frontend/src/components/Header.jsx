import { Menu, Bell, Calendar, ChevronDown, Download } from 'lucide-react';
import DarkModeToggle from './ui/DarkModeToggle.jsx';
import { ModeBadge } from './ui/Primitives.jsx';

// Top operational bar — large page title + data-window pill + bell + Export.
// Mode badge stays visible (honesty: DEMO vs LIVE). Works for every page via PAGE_META.
export const Header = ({
  pageTitle, pageSubtitle, onOpenSidebar, dark, toggleTheme, alertCount = 0,
  onBellClick, mode = 'demo', onExport, dateLabel = 'Last 14 days',
}) => (
  <header className="cm-app sticky top-0 z-30 border-b flex items-center justify-between gap-3 px-4 lg:px-7 py-3.5"
    style={{ background: 'var(--cm-surface)', borderColor: 'var(--cm-border)' }}>
    <div className="flex items-center gap-3 min-w-0">
      <button onClick={onOpenSidebar} className="lg:hidden p-2 -ml-1 cm-muted"><Menu size={20} /></button>
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-[28px] font-bold cm-ink leading-none truncate tracking-tightest">{pageTitle}</h1>
        {pageSubtitle && <p className="hidden sm:block text-[12px] sm:text-[13px] cm-muted mt-1 truncate">{pageSubtitle}</p>}
      </div>
    </div>

    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
      <ModeBadge mode={mode} size="sm" />
      <button className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold cm-ink pg-focus"
        style={{ background: 'var(--cm-raised)', border: '1px solid var(--cm-border)' }} title="Data window">
        <Calendar size={14} className="text-forest-400" /> {dateLabel} <ChevronDown size={13} className="cm-muted" />
      </button>
      <DarkModeToggle dark={dark} toggle={toggleTheme} />
      <button onClick={onBellClick}
        className="pg-focus relative p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5"
        style={{ border: '1px solid var(--cm-border)' }}
        aria-label={`Alerts${alertCount > 0 ? ` (${alertCount})` : ''}`}>
        <Bell size={17} className="cm-muted" />
        {alertCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center text-white"
            style={{ background: '#C94A3A' }}>{alertCount > 9 ? '9+' : alertCount}</span>
        )}
      </button>
      <button onClick={onExport}
        className="pg-focus inline-flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-[12px] sm:text-[13px] font-semibold text-white bg-forest-600 hover:bg-forest-700 transition-colors">
        <Download size={15} /> <span className="hidden sm:inline">Export Report</span>
      </button>
    </div>
  </header>
);

export default Header;
