import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

import LandingPage         from './pages/LandingPage.jsx';
import Overview            from './pages/Overview.jsx';
import Palms               from './pages/Palms.jsx';
import Alerts              from './pages/Alerts.jsx';
import Network             from './pages/Network.jsx';
import Reports             from './pages/Reports.jsx';
import LiveSpectrogram     from './pages/LiveSpectrogram.jsx';
import Doses               from './pages/Doses.jsx';

import Sidebar             from './components/Sidebar.jsx';
import Header              from './components/Header.jsx';
import PalmDetailDrawer    from './components/PalmDetailDrawer.jsx';
import AIAssistant         from './components/AIAssistant.jsx';
import ToastContainer      from './components/ToastContainer.jsx';
import LiveBadge           from './components/LiveBadge.jsx';
import DoseConfirmModal    from './components/DoseConfirmModal.jsx';

import { useTheme }        from './hooks/useTheme.js';
import { useToast }        from './hooks/useToast.js';
import { useAlerts }       from './hooks/useAlerts.js';
import { useSystemMode }   from './hooks/useSystemMode.js';
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
  const [page, setPage]               = useState('overview');
  const [selectedPalm, setSelected]   = useState(null);
  const [palms, setPalms]             = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { dark, toggle: toggleTheme } = useTheme();
  const { toasts, addToast }          = useToast();
  const { alerts: activeAlerts }      = useAlerts('active');
  const sysMode                       = useSystemMode();

  // Establish socket once the app mounts so backend events stream early
  useEffect(() => { socket(); }, []);

  // Refresh palms list whenever a live reading or alert changes their classification
  const refreshPalms = async () => {
    try { setPalms(await api.palms()); } catch {}
  };

  useEffect(() => {
    if (view !== 'dashboard') return;
    refreshPalms();
    const interval = setInterval(refreshPalms, 15000);
    const off1 = onEvent('live:reading', refreshPalms);
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
    addToast('Welcome back, Abdalrahman!', 'success');
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
      <div className="min-h-screen font-sans bg-[#FAFAFA] dark:bg-[#0a0e1a] text-gray-900 dark:text-gray-100 transition-colors duration-500 relative">
        <div className="absolute inset-0 opacity-[0.3] dark:opacity-0 pointer-events-none z-0"
             style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        {view === 'landing' ? (
          <div className="relative z-10">
            <LandingPage onLogin={handleLogin} dark={dark} toggleTheme={toggleTheme} />
          </div>
        ) : (
          <div className="flex h-screen overflow-hidden text-gray-900 dark:text-gray-100 bg-[#FAFAFA] dark:bg-[#0a0e1a] relative z-10">
            <Sidebar
              currentPage={page}
              setPage={setPage}
              user={{ name: 'Abdalrahman Alhaymouni', role: 'Farm Manager', initials: 'AA' }}
              onLogout={handleLogout}
              isOpen={sidebarOpen}
              setIsOpen={setSidebarOpen}
              alertCount={activeAlerts.length}
              onViewLanding={handleViewLanding}
            />

            <div className="flex-1 flex flex-col min-w-0">
              <Header
                pageTitle={page === 'spectrogram' ? 'Live Spectrogram' : page}
                onOpenSidebar={() => setSidebarOpen(true)}
                dark={dark}
                toggleTheme={toggleTheme}
                alertCount={activeAlerts.length}
                onBellClick={() => setPage('alerts')}
                rightExtras={<LiveBadge mode={sysMode.mode} size="md" />}
              />

              <main className="flex-1 overflow-y-auto p-4 md:p-6 xl:p-8 max-w-[1800px] mx-auto w-full">
                {page === 'overview'    && <Overview palms={palms} onSelectPalm={setSelected} selectedPalm={selectedPalm} onAlertClick={handleAlertClick} onGotoAlerts={() => setPage('alerts')} sysMode={sysMode} />}
                {page === 'palms'       && <Palms palms={palms} onSelectPalm={setSelected} />}
                {page === 'alerts'      && <Alerts onAlertClick={handleAlertClick} showToast={addToast} />}
                {page === 'doses'       && <Doses showToast={addToast} />}
                {page === 'network'     && <Network palms={palms} onSelectPalm={setSelected} selectedPalm={selectedPalm} />}
                {page === 'reports'     && <Reports showToast={addToast} />}
                {page === 'spectrogram' && <LiveSpectrogram />}
              </main>
            </div>

            {selectedPalm && (
              <div className="fixed inset-0 bg-black/20 dark:bg-[#04060c]/80 backdrop-blur-sm z-40"
                   onClick={() => setSelected(null)} />
            )}
            <PalmDetailDrawer palm={selectedPalm} onClose={() => setSelected(null)} showToast={addToast} />
            <AIAssistant deviceId={selectedPalm?.device_id} />
            {/* Human-in-the-loop dose gate — global so a pending dose surfaces on any page */}
            <DoseConfirmModal showToast={addToast} />
          </div>
        )}

        <ToastContainer toasts={toasts} />
      </div>
    </div>
  );
}
