// Marketing landing page. Adapted from code.txt:263-642 - same structure
// (Hero → Comparison → How It Works → X-Ray → Stats → Dashboard preview → CTA)
// using local /public assets. Click any "Get protected" / "Book Demo" button
// to enter the dashboard.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, Zap, Activity, Network, Cpu, X, Menu, ShieldCheck,
  CheckCircle, XCircle,
} from 'lucide-react';
import DarkModeToggle from '../components/ui/DarkModeToggle.jsx';
import BugSwarm from '../components/BugSwarm.jsx';

const ASSETS = {
  logo:           '/logo.png',
  product:        '/product.png',
  beforeAfter:    '/7.jpg',
  xray:           '/2.jpg',
  xrayAlt:        '/3.jpg',
  aiSpectrogram:  '/1.jpg',
  satelliteMap:   '/palmfarm.jpg',
  damaged:        '/7-1.png',
  healthy:        '/7-2.png',
};

// ─── Header ────────────────────────────────────────────────────────────
const LandingHeader = ({ onLogin, dark, toggleTheme }) => {
  const [isOpen, setIsOpen] = useState(false);
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  return (
    <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-[#0a0e1a]/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo(0, 0)}>
          <img src={ASSETS.logo} alt="" className="h-10 w-auto" />
          <span className="font-bold text-xl tracking-tight text-green-900 dark:text-white">Palm Guard</span>
        </div>
        <div className="hidden md:flex items-center gap-10 text-sm font-medium text-gray-600 dark:text-gray-300">
          {['features', 'how-it-works', 'dashboard-preview'].map(id => (
            <button key={id} onClick={() => scrollTo(id)} className="hover:text-green-700 dark:hover:text-white capitalize">
              {id.replace('-', ' ')}
            </button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <DarkModeToggle dark={dark} toggle={toggleTheme} />
          <button onClick={onLogin} className="text-sm font-semibold text-gray-700 dark:text-gray-200 hover:text-green-700 dark:hover:text-white px-3">
            Log in
          </button>
          <button onClick={onLogin} className="bg-gray-900 dark:bg-white text-white dark:text-black px-6 py-2.5 rounded-full text-sm font-bold shadow-xl hover:scale-105 active:scale-95 transition">
            Open Dashboard
          </button>
        </div>
        <div className="flex md:hidden items-center gap-3">
          <DarkModeToggle dark={dark} toggle={toggleTheme} />
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-gray-600 dark:text-gray-300">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="md:hidden absolute top-20 left-0 w-full bg-white dark:bg-[#0f1422] border-b border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col p-6 animate-fade-in-up">
          <button onClick={onLogin} className="w-full py-3 rounded-xl bg-green-600 text-white font-bold shadow-lg">
            Open Dashboard
          </button>
        </div>
      )}
    </nav>
  );
};

// ─── Hero ────────────────────────────────────────────────────────────
const HeroSection = ({ onLogin }) => (
  <section className="pt-32 pb-20 px-6 min-h-[92vh] flex flex-col items-center justify-center bg-[#FAFAFA] dark:bg-[#0a0e1a] overflow-hidden relative">
    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-green-100/40 via-transparent to-transparent dark:opacity-0" />
    <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-100/40 via-transparent to-transparent dark:opacity-0" />
    <BugSwarm />

    <div className="text-center max-w-5xl mx-auto z-20 relative px-4">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md text-green-700 dark:text-green-400 text-xs font-bold mb-8 border border-green-100 dark:border-gray-800 shadow-sm animate-fade-in-up">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
        </span>
        <span className="tracking-wide uppercase">Living Telemetry Interface</span>
      </div>
      <h1 className="text-5xl md:text-8xl font-bold text-gray-900 dark:text-white tracking-tighter leading-[1] mb-8 animate-fade-in-up delay-100">
        Protect your palms.
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 via-emerald-500 to-green-400 dark:from-green-400 dark:via-emerald-300 dark:to-green-200">
          Stop the silent killer.
        </span>
      </h1>
      <p className="text-lg md:text-2xl text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed font-medium animate-fade-in-up delay-200">
        Palm Guard listens inside the palm, scores infestation risk from a proxy-trained acoustic model, and{' '}
        <span className="text-gray-900 dark:text-white">gates treatment through a safe, human-confirmed workflow.</span>
      </p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300 relative z-40">
        <button onClick={onLogin} className="group w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-full font-bold text-lg hover:bg-black dark:hover:bg-gray-100 shadow-2xl active:scale-95 flex items-center justify-center gap-2 transition">
          Open Dashboard
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <button
          onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full sm:w-auto px-8 py-4 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-800 rounded-full font-bold text-lg hover:bg-white dark:hover:bg-gray-800 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Zap size={18} className="text-yellow-500" fill="currentColor" />
          See Technology
        </button>
      </div>
    </div>

    <div className="mt-16 md:-mt-12 relative z-10 w-full max-w-[400px] md:max-w-[650px] mx-auto animate-float cursor-pointer group" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[400px] h-[300px] md:h-[400px] bg-gradient-to-tr from-green-400/20 to-emerald-300/20 blur-[80px] rounded-full pointer-events-none" />
      <img src={ASSETS.product} alt="Palm Guard Sensor" className="w-full h-auto drop-shadow-2xl transform rotate-[165deg] hover:rotate-[180deg] transition-transform duration-1000" />
    </div>
  </section>
);

// ─── Comparison ──────────────────────────────────────────────────────
const ComparisonSection = () => (
  <section id="features" className="py-24 bg-black text-white overflow-hidden relative">
    <div className="max-w-7xl mx-auto px-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 rounded-[3rem] overflow-hidden shadow-2xl border border-white/10 relative h-auto md:h-[650px]">
        <div className="relative h-[400px] md:h-full group overflow-hidden">
          <div className="absolute inset-0 bg-red-900/40 z-10 mix-blend-multiply" />
          <img src={ASSETS.damaged} alt="Damaged" className="absolute inset-0 w-[200%] h-full object-cover object-left filter grayscale contrast-125" />
          <div className="absolute inset-0 flex flex-col justify-center items-center p-8 md:p-12 z-20 bg-black/40 backdrop-blur-[2px]">
            <div className="bg-red-500/10 border border-red-500/50 px-4 py-1.5 rounded-full mb-6 backdrop-blur-md">
              <span className="text-red-400 font-mono tracking-widest text-xs font-bold uppercase">Without Detection</span>
            </div>
            <h3 className="text-3xl md:text-5xl font-bold text-center mb-6 text-white tracking-tight">Silent Infestation</h3>
            <p className="text-gray-200 text-center max-w-sm text-base md:text-lg leading-relaxed font-medium">
              By the time visual symptoms appear, internal damage is{' '}
              <span className="text-red-400 font-bold">irreversible</span>.
            </p>
            <div className="mt-10 w-16 h-16 md:w-20 md:h-20 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
              <XCircle className="text-red-500 w-8 h-8 md:w-10 md:h-10" />
            </div>
          </div>
        </div>
        <div className="relative h-[400px] md:h-full group overflow-hidden border-t md:border-t-0 md:border-l border-white/10">
          <div className="absolute inset-0 bg-green-900/30 z-10 mix-blend-multiply" />
          <img src={ASSETS.healthy} alt="Healthy" className="absolute inset-0 w-[200%] h-full object-cover object-right saturate-150" />
          <div className="absolute inset-0 flex flex-col justify-center items-center p-8 md:p-12 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent">
            <div className="bg-green-500/10 border border-green-500/50 px-4 py-1.5 rounded-full mb-6 backdrop-blur-md">
              <span className="text-green-400 font-mono tracking-widest text-xs font-bold uppercase">With Palm Guard</span>
            </div>
            <h3 className="text-3xl md:text-5xl font-bold text-center mb-6 text-white tracking-tight">Protect the Yield</h3>
            <p className="text-gray-100 text-center max-w-sm text-base md:text-lg leading-relaxed font-medium">
              Acoustic + multi-sensor early warning flags activity{' '}
              <span className="text-green-400 font-bold">before crown symptoms show</span> — so treatment is targeted, not farm-wide.
            </p>
            <div className="mt-10 w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-500/20 flex items-center justify-center border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <CheckCircle className="text-green-400 w-8 h-8 md:w-10 md:h-10" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── How It Works ────────────────────────────────────────────────────
const HowItWorksSection = () => (
  <section id="how-it-works" className="py-32 bg-[#FAFAFA] dark:bg-[#0a0e1a] relative">
    <div className="max-w-7xl mx-auto px-6 relative z-10">
      <div className="text-center mb-24">
        <h2 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 tracking-tighter">
          Science, not Guesswork.
        </h2>
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-medium">
          Multi-sensor fusion: acoustic, vibration, thermal, and VOC signatures merged by an adaptive risk-score engine.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div className="relative rounded-[2.5rem] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 group bg-gray-100 dark:bg-gray-900 aspect-square">
          <img src={ASSETS.aiSpectrogram} alt="AI" className="w-full h-full object-cover mix-blend-overlay opacity-90" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 md:bottom-10 md:left-10 md:right-10 bg-white/10 backdrop-blur-xl p-6 rounded-3xl border border-white/10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-white uppercase tracking-widest">Live Spectrogram</span>
            </div>
            <div className="h-16 flex items-end gap-1.5">
              {[30, 50, 25, 85, 40, 95, 55, 35, 15, 45, 80, 40, 60, 20, 90, 40, 70, 30, 60, 20].map((h, i) => (
                <div key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.05}s` }}
                     className="flex-1 bg-gradient-to-t from-green-400 to-red-500 rounded-full opacity-90 animate-music-bar" />
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-12">
          {[
            { title: 'Internal Acoustic Probe', desc: 'INMP441 MEMS microphone captures larval feeding micro-vibrations (2–8 kHz). On-device FFT extracts spectral features and click rate.', icon: <Activity className="text-white" /> },
            { title: 'Multi-Sensor Fusion', desc: 'MPU6050 vibration + DS18B20 trunk temperature + BME680 VOC are merged with adaptive weighting that adjusts to wind and chemical events.', icon: <Network className="text-white" /> },
            { title: 'Risk Score 0–100', desc: 'Cloud risk-score engine outputs Low/Medium/High classification with sustained-event and anomaly-spike alerting.', icon: <Cpu className="text-white" /> },
          ].map((item, i) => (
            <div key={i} className="flex gap-8 group">
              <div className="w-16 h-16 rounded-2xl bg-green-600 flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition">
                {item.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 group-hover:text-green-700 dark:group-hover:text-green-400 transition">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-lg">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

// ─── Stats ───────────────────────────────────────────────────────────
const StatsSection = () => (
  <section className="py-32 bg-green-900 dark:bg-[#0a0e1a] text-white relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
    <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-16 text-center relative z-10">
      {/* Honest, defensible stats only — no fabricated accuracy (§2). */}
      {[
        { val: '4-in-1', label: 'Sensor fusion', sub: 'Acoustic + vibration + thermal + VOC' },
        { val: 'Proxy',  label: 'Model status',  sub: 'Validated on boring-sound proxies' },
        { val: 'Human',  label: 'Confirmed dosing', sub: 'Armed + confirmed · hard caps' },
        { val: 'Solar',  label: 'Self-powered',  sub: 'Duty-cycled per-tree node' },
      ].map((stat, i) => (
        <div key={i}>
          <div className="text-5xl md:text-8xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-green-300">
            {stat.val}
          </div>
          <div className="text-sm md:text-lg font-bold uppercase tracking-[0.2em] text-green-100 mb-1">{stat.label}</div>
          <div className="text-xs md:text-sm text-green-300/60 font-medium">{stat.sub}</div>
        </div>
      ))}
    </div>
  </section>
);

// ─── Footer ──────────────────────────────────────────────────────────
const LandingFooter = () => (
  <footer className="bg-gray-50 dark:bg-[#0a0e1a] pt-32 pb-16 border-t border-gray-200 dark:border-gray-800">
    <div className="max-w-7xl mx-auto px-6 flex flex-col items-center text-center">
      <img src={ASSETS.logo} alt="" className="h-14 mb-8 opacity-80" />
      <h3 className="text-2xl md:text-4xl font-bold text-gray-900 dark:text-white mb-8 tracking-tight">
        Protect Every Palm. Increase Yield.
      </h3>
      <p className="max-w-md text-gray-500 dark:text-gray-400 mb-12 text-lg">
        Khalifa International Award for Date Palm submission · University of Petra, Jordan.
      </p>
      <p className="text-gray-400 dark:text-gray-600 text-sm font-medium">
        © 2026 Palm Guard Technologies.
      </p>
    </div>
  </footer>
);

// ─── Page composition ────────────────────────────────────────────────
export const LandingPage = ({ onLogin, dark, toggleTheme }) => (
  <div>
    <LandingHeader onLogin={onLogin} dark={dark} toggleTheme={toggleTheme} />
    <main>
      <HeroSection onLogin={onLogin} />
      <ComparisonSection />
      <HowItWorksSection />
      <StatsSection />

      <section id="dashboard-preview" className="py-32 bg-white dark:bg-gray-900 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white tracking-tight">
            Powerful Insights. Simple Dashboard.
          </h2>
          <p className="text-xl text-gray-500 dark:text-gray-400 mb-16 max-w-2xl mx-auto font-medium">
            Manage thousands of trees from a single pane of glass — live KPIs, risk-trend charts, and a real-time spectrogram.
          </p>
          <button onClick={onLogin} className="px-12 py-6 bg-green-600 text-white rounded-full font-bold text-xl hover:bg-green-700 shadow-xl shadow-green-600/20 transition hover:scale-105 active:scale-95">
            Open Live Dashboard
          </button>
        </div>
      </section>
    </main>
    <LandingFooter />
  </div>
);

export default LandingPage;
