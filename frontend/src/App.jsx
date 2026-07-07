import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import LandingPage         from './pages/LandingPage.jsx';
import CaseMap             from './pages/CaseMap.jsx';
import Overview            from './pages/Overview.jsx';
import Palms               from './pages/Palms.jsx';
import Alerts              from './pages/Alerts.jsx';
import Network             from './pages/Network.jsx';
import Reports             from './pages/Reports.jsx';
import LiveSpectrogram     from './pages/LiveSpectrogram.jsx';
import Doses               from './pages/Doses.jsx';
import Intelligence        from './pages/Intelligence.jsx';

import Sidebar             from './components/Sidebar.jsx';
import Header              from './components/Header.jsx';
import PalmDetailDrawer    from './components/PalmDetailDrawer.jsx';
import ToastContainer      from './components/ToastContainer.jsx';
import LiveBadge           from './components/LiveBadge.jsx';
import DoseConfirmModal    from './components/DoseConfirmModal.jsx';
import SystemStatusStrip   from './components/SystemStatusStrip.jsx';
import ErrorBoundary       from './components/ErrorBoundary.jsx';

// Clear, judge-friendly page titles + plain-English subtitles. Creative names
// kept as subtitles. (ids unchanged so routing/contracts stay intact.)
const PAGE_META = {
  overview:     { title: 'Overview',         subtitle: 'Real-time monitoring and protection overview' },
  map:          { title: 'Map',              subtitle: 'Field-ops orchard map — every palm is a case file' },
  intelligence: { title: 'AI Decision',      subtitle: 'Why the system flagged a palm — multi-sensor agents' },
  palms:        { title: 'Palms',            subtitle: 'Fleet of monitored palms' },
  alerts:       { title: 'Alerts',           subtitle: 'What needs attention' },
  doses:        { title: 'Dosing',           subtitle: 'Human-confirmed, clear-water treatment control' },
  network:      { title: 'Mesh Network',     subtitle: 'Device & link health' },
  spectrogram:  { title: 'Live Spectrogram', subtitle: 'Listening inside the trunk' },
  reports:      { title: 'Reports',          subtitle: 'Judge-ready evidence & exports' },
};

import { useTheme }        from './hooks/useTheme.js';
import { useToast }        from './hooks/useToast.js';
import { useAlerts }       from './hooks/useAlerts.js';
import { useSystemMode }   from './hooks/useSystemMode.js';
import { useFarmStats }    from './hooks/useFarmStats.js';
import { api }             from './api.js';
import { socket, onEvent } from './socket.js';

// Default lands directly on the dashboard. The About/Landing page is still
// reachable from the sidebar footer or via ?landing in the URL.
const initialView = () => {
  if (typeof window !== 'undefined' && window.location.search.includes('landing')) {
    return 'landing';
  }
  return 'dashboard';
};

export default function App() {
  const [view, setView]               = useState(initialView);
  const [page, setPageRaw]            = useState(() => {
    const p = new URLSearchParams(window.location.search).get('page');
    return p && PAGE_META[p] ? p : 'overview';
  });
  // Deep-linkable pages: keep ?page=<id> in the URL so any page is reloadable.
  const setPage = (p) => {
    setPageRaw(p);
    const url = new URL(window.location.href);
    url.searchParams.set('page', p);
    window.history.replaceState({}, '', url);
  };
  const [selectedPalm, setSelected]   = useState(null);
  const [palms, setPalms]             = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { dark, toggle: toggleTheme } = useTheme();
  const { toasts, addToast }          = useToast();
  const { alerts: activeAlerts }      = useAlerts('active');
  const sysMode                       = useSystemMode();
  const { stats }                     = useFarmStats();
  const [lastUpdate, setLastUpdate]   = useState(null);

  // System status derives from live fleet data so it can never contradict the
  // Mesh Network page (no hardcoded "All Operational").
  const offlineCount = stats ? Math.max(0, (stats.totalDevices ?? 0) - (stats.onlineDevices ?? 0)) : 0;
  const systemStatus = offlineCount > 0
    ? { ok: false, label: `${offlineCount} device${offlineCount > 1 ? 's' : ''} offline` }
    : { ok: true, label: 'All systems operational' };

  // Establish socket once the app mounts so backend events stream early
  useEffect(() => { socket(); }, []);

  // Refresh palms list whenever a live reading or alert changes their classification
  const refreshPalms = async () => {
    try { setPalms(await api.palms()); } catch {}
  };

  useEffect(() => {
    if (view !== 'dashboard') return;
    refreshPalms();
    const stamp = () => setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    stamp();
    const interval = setInterval(refreshPalms, 15000);
    const off1 = onEvent('live:reading', () => { refreshPalms(); stamp(); });
    const off2 = onEvent('live:alert',   refreshPalms);
    return () => { clearInterval(interval); off1(); off2(); };
  }, [view]);

  // System mode toasts (when a real device shows up or drops off)
  const [prevMode, setPrevMode] = useState(null);
  useEffect(() => {
    if (sysMode.mode === 'unknown') return;
    if (prevMode && prevMode !== sysMode.mode) {
      if (sysMode.mode === 'live') addToast(`Live device connected — switched to real data`, 'success');
      else                          addToast(`No device connected — running demo data`, 'warning');
    }
    setPrevMode(sysMode.mode);
  }, [sysMode.mode]);

  const handleAlertClick = (deviceId) => {
    const palm = palms.find(p => p.device_id === deviceId);
    if (palm) setSelected(palm);
    else addToast(`Device ${deviceId} not assigned to a palm`, 'warning');
  };

  const handleLogin = () => {
    addToast('Signed in to Palm Guard', 'success');
    setView('dashboard');
    window.scrollTo(0, 0);
  };

  const handleViewLanding = () => {
    setView('landing');
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setView('landing');
    setPage('overview');
    setSelected(null);
    setSidebarOpen(false);
    window.scrollTo(0, 0);
  };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className={dark ? 'dark' : ''}>
      <div className="min-h-screen font-sans bg-bone dark:bg-ink-900 text-charcoal dark:text-bone transition-colors duration-500 relative">
        <div className="absolute inset-0 opacity-[0.25] dark:opacity-0 pointer-events-none z-0"
             style={{ backgroundImage: 'radial-gradient(#c9c2ac 1px, transparent 1px)', backgroundSize: '22px 22px' }} />

        {view === 'landing' ? (
          <div className="relative z-10">
            <LandingPage onLogin={handleLogin} dark={dark} toggleTheme={toggleTheme} />
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden cm-app relative z-10">
            <Sidebar
              currentPage={page}
              setPage={setPage}
              user={{ name: 'Field Operator', role: 'Orchard Ops', initials: 'PG' }}
              onLogout={handleLogout}
              isOpen={sidebarOpen}
              setIsOpen={setSidebarOpen}
              alertCount={activeAlerts.length}
              onViewLanding={handleViewLanding}
              systemStatus={systemStatus}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <SystemStatusStrip mode={sysMode.mode} />
              <Header
                pageTitle={PAGE_META[page]?.title || page}
                pageSubtitle={PAGE_META[page]?.subtitle}
                onOpenSidebar={() => setSidebarOpen(true)}
                dark={dark}
                toggleTheme={toggleTheme}
                alertCount={activeAlerts.length}
                onBellClick={() => setPage('alerts')}
                devicesOnline={stats ? `${stats.onlineDevices ?? 0}/${stats.totalDevices ?? 0}` : null}
                lastUpdate={lastUpdate}
                mode={sysMode.mode}
                onExport={() => setPage('reports')}
              />

              <main className="flex-1 overflow-y-auto p-4 md:p-5 xl:p-6 max-w-[1800px] mx-auto w-full">
                <ErrorBoundary>
                  {page === 'overview'    && <Overview palms={palms} onSelectPalm={setSelected} onGotoPalms={() => setPage('palms')} onGotoAlerts={() => setPage('alerts')} onGotoSafety={() => setPage('doses')} onGotoReports={() => setPage('reports')} />}
                  {page === 'map'         && <CaseMap palms={palms} onSelectPalm={setSelected} selectedPalm={selectedPalm} onGotoSafety={() => setPage('doses')} sysMode={sysMode} />}
                  {page === 'palms'       && <Palms palms={palms} onSelectPalm={setSelected} />}
                  {page === 'alerts'      && <Alerts onAlertClick={handleAlertClick} showToast={addToast} />}
                  {page === 'doses'       && <Doses showToast={addToast} />}
                  {page === 'network'     && <Network palms={palms} onSelectPalm={setSelected} selectedPalm={selectedPalm} />}
                  {page === 'reports'     && <Reports showToast={addToast} />}
                  {page === 'spectrogram' && <LiveSpectrogram />}
                  {page === 'intelligence' && <Intelligence deviceId={selectedPalm?.device_id} />}
                </ErrorBoundary>
              </main>
            </div>

            {selectedPalm && (
              <div className="fixed inset-0 bg-black/20 dark:bg-[#04060c]/80 backdrop-blur-sm z-40"
                   onClick={() => setSelected(null)} />
            )}
            <PalmDetailDrawer palm={selectedPalm} onClose={() => setSelected(null)} showToast={addToast} />
            {/* Human-in-the-loop dose gate — global so a pending dose surfaces on any page */}
            <DoseConfirmModal showToast={addToast} />
          </div>
        )}

        <ToastContainer toasts={toasts} />
      </div>
    </div>
  );
}
