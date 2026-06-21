// Palm Guard — landing page, rebuilt on the "Living Telemetry Interface"
// design system (instrument surfaces, HUD labels, JetBrains-mono numerals,
// forest/gold/bone/ink palette) so the front door matches the dashboard.
//
// Honesty is load-bearing here (§2): the model is described as proxy/heuristic
// and shown as a probability — never "X% accurate"; dosing is always armed +
// human-confirmed with hard caps. The hero monitor is explicitly illustrative.
//
// Public contract is unchanged: <LandingPage onLogin dark toggleTheme />.
import { useState } from 'react';
import {
  ArrowRight, Activity, Radio, Waves, Thermometer, Wind, Cpu,
  ShieldCheck, Syringe, Sun, WifiOff, Stethoscope, Gauge, FlaskConical,
  X, Menu, ChevronRight,
} from 'lucide-react';
import DarkModeToggle from '../components/ui/DarkModeToggle.jsx';
import BugSwarm from '../components/BugSwarm.jsx';

const ASSETS = {
  logo:    '/logo.png',
  product: '/product.png',
  damaged: '/7-1.png',
  healthy: '/7-2.png',
  xray:    '/2.jpg',
};

const NAV = [['threat', 'The threat'], ['how', 'How it listens'], ['honesty', 'Honest by design'], ['mission-control', 'Mission control']];
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

// ─── HUD primitives ──────────────────────────────────────────────────
const Kicker = ({ children }) => (
  <span className="inline-flex items-center gap-2 hud-label instrument-inset px-3 py-1.5">
    <span className="relative flex h-1.5 w-1.5">
      <span className="animate-heartbeat absolute inline-flex h-full w-full rounded-full bg-forest-400" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-forest-400" />
    </span>
    {children}
  </span>
);

const SectionHead = ({ tag, title, sub }) => (
  <div className="max-w-2xl mb-12">
    <div className="hud-label text-forest-400 mb-3">{tag}</div>
    <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-charcoal dark:text-bone mb-4">{title}</h2>
    {sub && <p className="text-base md:text-lg text-muted leading-relaxed">{sub}</p>}
  </div>
);

// ─── Nav ─────────────────────────────────────────────────────────────
const LandingNav = ({ onLogin, dark, toggleTheme }) => {
  const [open, setOpen] = useState(false);
  return (
    <nav className="fixed top-0 inset-x-0 z-50 bg-bone/80 dark:bg-ink-900/80 backdrop-blur-xl border-b border-charcoal/10 dark:border-muted/10">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <button className="flex items-center gap-2.5" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src={ASSETS.logo} alt="" className="h-8 w-auto" />
          <span className="font-bold text-lg tracking-tight text-charcoal dark:text-bone">Palm Guard</span>
          <span className="hidden sm:inline hud-label text-forest-400">· LTI</span>
        </button>
        <div className="hidden md:flex items-center gap-8">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="hud-label hover:text-charcoal dark:hover:text-bone transition-colors">{label}</button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <DarkModeToggle dark={dark} toggle={toggleTheme} />
          <button onClick={onLogin} className="focus-ring text-sm font-bold px-5 py-2 rounded-full bg-forest text-bone hover:bg-forest-600 transition-colors flex items-center gap-2">
            Open Dashboard <ArrowRight size={15} />
          </button>
        </div>
        <div className="flex md:hidden items-center gap-2">
          <DarkModeToggle dark={dark} toggle={toggleTheme} />
          <button onClick={() => setOpen(!open)} className="focus-ring p-2 text-charcoal dark:text-bone">{open ? <X size={22} /> : <Menu size={22} />}</button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-charcoal/10 dark:border-muted/10 bg-panel dark:bg-ink-800 p-4 space-y-1">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => { scrollTo(id); setOpen(false); }} className="block w-full text-left hud-label py-2.5">{label}</button>
          ))}
          <button onClick={onLogin} className="w-full mt-2 py-3 rounded-xl bg-forest text-bone font-bold">Open Dashboard</button>
        </div>
      )}
    </nav>
  );
};

// ─── Signature visual: a single field-node monitor (illustrative) ─────
const MEL = [22, 41, 30, 64, 48, 88, 70, 52, 33, 58, 80, 47, 66, 38, 92, 55, 74, 42, 60, 28, 50, 72];
const NodeMonitor = () => (
  <div className="instrument p-5 scanlines relative overflow-hidden">
    <div className="flex items-center justify-between mb-4">
      <span className="hud-label">node PG-07 · live monitor</span>
      <span className="hud-label text-forest-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-forest-400 animate-heartbeat" /> streaming</span>
    </div>

    {/* risk halo + readout */}
    <div className="flex items-center gap-5 mb-5">
      <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90">
        <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" className="text-muted/15" strokeWidth="9" />
        <circle cx="60" cy="60" r="52" fill="none" stroke="#C2A14D" strokeWidth="9" strokeLinecap="round"
                strokeDasharray="326.7" strokeDashoffset="120" />
      </svg>
      <div className="-ml-[88px] w-28 text-center">
        <div className="telemetry-num text-4xl font-bold text-gold">63</div>
        <div className="hud-label">risk · watch</div>
      </div>
      <div className="ml-auto space-y-2 text-right">
        <div><div className="hud-label">P(activity)</div><div className="telemetry-num text-xl font-bold text-charcoal dark:text-bone">0.61</div></div>
        <div className="hud-label text-caution">proxy model</div>
      </div>
    </div>

    {/* mel bars */}
    <div className="instrument-inset px-3 py-3">
      <div className="hud-label mb-2">acoustic patch · 40×32 log-mel</div>
      <div className="h-16 flex items-end gap-1">
        {MEL.map((h, i) => (
          <div key={i} style={{ height: `${h}%`, animationDelay: `${i * 0.06}s`, animationDuration: `${1 + (i % 4) * 0.15}s` }}
               className="flex-1 rounded-sm bg-gradient-to-t from-forest-400/70 via-gold/70 to-crit/70 animate-music-bar origin-bottom" />
        ))}
      </div>
    </div>

    {/* evidence chips */}
    <div className="grid grid-cols-3 gap-2 mt-3">
      {[['acoustic', 'feeding band'], ['vibration', 'elevated'], ['trunk Δ', '+0.4°C']].map(([k, v]) => (
        <div key={k} className="instrument-inset px-2.5 py-2">
          <div className="hud-label">{k}</div>
          <div className="text-xs font-bold text-charcoal dark:text-bone telemetry-num">{v}</div>
        </div>
      ))}
    </div>

    <div className="hud-label mt-3 text-muted/80">illustrative readout · live values in dashboard</div>
  </div>
);

// ─── Hero ────────────────────────────────────────────────────────────
const Hero = ({ onLogin }) => (
  <section className="relative pt-28 pb-20 px-6 overflow-hidden">
    <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />
    <BugSwarm />
    <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center relative z-10">
      <div className="animate-fade-in-up">
        <Kicker>Living Telemetry Interface</Kicker>
        <h1 className="mt-6 text-4xl md:text-6xl font-bold tracking-tight leading-[1.05] text-charcoal dark:text-bone">
          Hear the weevil
          <span className="block text-forest-400">before the palm falls.</span>
        </h1>
        <p className="mt-6 text-lg text-muted leading-relaxed max-w-xl">
          A solar, per-tree node listens inside the trunk for Red Palm Weevil feeding, scores
          infestation risk from a <span className="text-charcoal dark:text-bone font-semibold">proxy-trained acoustic model</span>, and gates
          treatment through a <span className="text-charcoal dark:text-bone font-semibold">human-confirmed, hard-capped</span> dosing workflow.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <button onClick={onLogin} className="focus-ring group px-7 py-3.5 rounded-full bg-forest text-bone font-bold flex items-center justify-center gap-2 hover:bg-forest-600 transition-colors">
            Open Dashboard <ArrowRight size={17} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => scrollTo('how')} className="focus-ring px-7 py-3.5 rounded-full instrument font-bold text-charcoal dark:text-bone flex items-center justify-center gap-2">
            <Activity size={17} className="text-forest-400" /> How it listens
          </button>
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {['Acoustic + vibration + thermal + VOC', 'Solar · duty-cycled', 'Offline-resilient', 'WRCC 2026'].map((t) => (
            <span key={t} className="hud-label instrument-inset px-2.5 py-1">{t}</span>
          ))}
        </div>
      </div>
      <div className="animate-fade-in-up delay-200">
        <NodeMonitor />
      </div>
    </div>
  </section>
);

// ─── 1) The threat (before / after) ──────────────────────────────────
const ThreatSection = () => (
  <section id="threat" className="py-20 px-6">
    <div className="max-w-7xl mx-auto">
      <SectionHead
        tag="the problem"
        title="By the time the crown wilts, the trunk is already hollow."
        sub="Red Palm Weevil larvae feed inside the trunk for months. Visual inspection catches it too late — and farm-wide spraying is costly and blunt."
      />
      <div className="grid md:grid-cols-2 gap-4">
        <div className="instrument overflow-hidden">
          <div className="relative h-64">
            <img src={ASSETS.damaged} alt="" className="absolute inset-0 w-full h-full object-cover grayscale contrast-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/30 to-transparent" />
            <span className="absolute top-4 left-4 hud-label text-crit instrument-inset px-2.5 py-1">without detection</span>
          </div>
          <div className="p-5">
            <h3 className="font-bold text-lg text-charcoal dark:text-bone flex items-center gap-2"><X size={16} className="text-crit" /> Silent until it's terminal</h3>
            <p className="text-sm text-muted mt-1.5">Internal damage is irreversible once symptoms surface. A lost palm is years of growth gone.</p>
          </div>
        </div>
        <div className="instrument overflow-hidden">
          <div className="relative h-64">
            <img src={ASSETS.healthy} alt="" className="absolute inset-0 w-full h-full object-cover saturate-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest/90 via-forest/20 to-transparent" />
            <span className="absolute top-4 left-4 hud-label text-bone instrument-inset px-2.5 py-1">with palm guard</span>
          </div>
          <div className="p-5">
            <h3 className="font-bold text-lg text-charcoal dark:text-bone flex items-center gap-2"><ShieldCheck size={16} className="text-forest-400" /> Flagged before the crown shows it</h3>
            <p className="text-sm text-muted mt-1.5">Acoustic + multi-sensor early warning targets one tree — not the whole orchard.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// ─── 2) How it listens (pipeline) ────────────────────────────────────
const SENSORS = [
  { icon: Radio, label: 'Acoustic', desc: 'INMP441 MEMS mic captures feeding micro-sounds; on-device FFT → 40×32 log-mel patch (200 Hz–8 kHz).' },
  { icon: Waves, label: 'Vibration', desc: 'MPU6050 picks up trunk micro-vibration that wind alone does not explain.' },
  { icon: Thermometer, label: 'Trunk Δ', desc: 'DS18B20 tracks trunk-vs-ambient temperature drift around the device.' },
  { icon: Wind, label: 'VOC', desc: 'BME680 watches for chemical signatures, de-weighted during spray events.' },
];
const HowSection = () => (
  <section id="how" className="py-20 px-6 bg-panel dark:bg-ink-800/40 border-y border-charcoal/5 dark:border-muted/10">
    <div className="max-w-7xl mx-auto">
      <SectionHead
        tag="the pipeline"
        title="Four senses, fused into one honest score."
        sub="No single sensor is trusted alone. A weighted fusion engine merges them into a 0–100 risk score — and the acoustic model reports a probability, not a verdict."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {SENSORS.map((s, i) => (
          <div key={s.label} className="instrument p-5 animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="w-11 h-11 rounded-xl bg-forest/10 dark:bg-forest-400/10 flex items-center justify-center mb-3">
              <s.icon size={20} className="text-forest-400" />
            </div>
            <div className="hud-label text-forest-400">sensor {i + 1}</div>
            <h3 className="font-bold text-charcoal dark:text-bone">{s.label}</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="instrument p-5 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {[
          { icon: Cpu, k: 'fusion engine', v: 'weighted multi-sensor merge' },
          { icon: Gauge, k: 'risk score', v: '0–100 · low / watch / critical' },
          { icon: Syringe, k: 'treatment', v: 'armed + human-confirmed' },
        ].map((step, i, arr) => (
          <div key={step.k} className="flex items-center gap-3 flex-1">
            <div className="instrument-inset px-4 py-3 flex items-center gap-3 flex-1">
              <step.icon size={18} className="text-gold shrink-0" />
              <div><div className="hud-label">{step.k}</div><div className="text-sm font-bold text-charcoal dark:text-bone">{step.v}</div></div>
            </div>
            {i < arr.length - 1 && <ChevronRight size={18} className="text-muted shrink-0 hidden md:block" />}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── 3) Honest by design ─────────────────────────────────────────────
const HONESTY = [
  { icon: FlaskConical, tag: 'model status', title: 'A probability, not a promise', body: 'The detector is proxy/heuristic-trained on boring-sound corpora and field-validated against ASPID. The UI shows P(activity) with a "proxy" badge — never a fabricated accuracy number.', chip: 'proxy · heuristic fallback' },
  { icon: ShieldCheck, tag: 'safety', title: 'No autonomous spraying', body: 'Dosing is always armed by an operator and human-confirmed per event. Hard caps mirror on server and device: max doses/day, cooldown, pump-time ceiling, and anti-replay nonces.', chip: 'armed · confirmed · capped' },
  { icon: WifiOff, tag: 'resilience', title: 'Built for a real orchard', body: 'Solar, duty-cycled nodes keep buffering and recover gracefully when the network drops — the dashboard degrades to last-known state instead of lying.', chip: 'offline-resilient' },
];
const HonestySection = () => (
  <section id="honesty" className="py-20 px-6">
    <div className="max-w-7xl mx-auto">
      <SectionHead
        tag="why you can trust the panel"
        title="Honest by design — and it shows on every screen."
        sub="This is a competition prototype that refuses to fake its numbers. What the model doesn't know, it says it doesn't know."
      />
      <div className="grid md:grid-cols-3 gap-4">
        {HONESTY.map((c, i) => (
          <div key={c.title} className="instrument p-6 animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="w-11 h-11 rounded-xl bg-gold/10 flex items-center justify-center mb-4">
              <c.icon size={20} className="text-gold" />
            </div>
            <div className="hud-label text-forest-400">{c.tag}</div>
            <h3 className="font-bold text-lg text-charcoal dark:text-bone mt-1">{c.title}</h3>
            <p className="text-sm text-muted mt-2 leading-relaxed">{c.body}</p>
            <div className="mt-4 hud-label text-caution instrument-inset inline-block px-2.5 py-1">{c.chip}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── 4) Inside mission control (the four workspaces) ─────────────────
const WORKSPACES = [
  { icon: Stethoscope, name: 'Tree ICU', desc: 'Per-palm vitals, risk halo and an evidence trail from each fused sensor.' },
  { icon: Gauge, name: 'Farm Mission Control', desc: 'The living orchard command map, mission counters and live incident feed.' },
  { icon: Activity, name: 'Acoustic Lab', desc: 'A live spectrogram stethoscope with the RPW feeding band highlighted.' },
  { icon: Syringe, name: 'Treatment Control Room', desc: 'Arm, confirm and audit every dose against the hard safety caps.' },
];
const MissionControlSection = ({ onLogin }) => (
  <section id="mission-control" className="py-20 px-6 bg-panel dark:bg-ink-800/40 border-y border-charcoal/5 dark:border-muted/10">
    <div className="max-w-7xl mx-auto">
      <SectionHead
        tag="inside the dashboard"
        title="One mission-control deck for the whole orchard."
        sub="Four instrument workspaces, one shared design language — from a single palm's vitals up to the farm at a glance."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {WORKSPACES.map((w, i) => (
          <button key={w.name} onClick={onLogin}
            className="focus-ring text-left instrument p-5 hover:border-forest-400/40 transition-colors animate-fade-in-up" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="w-11 h-11 rounded-xl bg-forest/10 dark:bg-forest-400/10 flex items-center justify-center mb-3">
              <w.icon size={20} className="text-forest-400" />
            </div>
            <h3 className="font-bold text-charcoal dark:text-bone">{w.name}</h3>
            <p className="text-sm text-muted mt-1.5 leading-relaxed">{w.desc}</p>
          </button>
        ))}
      </div>
      <div className="instrument overflow-hidden relative">
        <img src={ASSETS.xray} alt="" className="w-full h-56 md:h-80 object-cover opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900/85 to-transparent" />
        <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="hud-label text-bone/70">tree stethoscope</div>
            <div className="text-bone font-bold text-lg">Listen inside the trunk in real time</div>
          </div>
          <button onClick={onLogin} className="focus-ring px-5 py-2.5 rounded-full bg-bone text-charcoal font-bold text-sm flex items-center gap-2 hover:bg-panel transition-colors">
            Open Dashboard <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  </section>
);

// ─── 5) CTA ──────────────────────────────────────────────────────────
const CtaSection = ({ onLogin }) => (
  <section className="py-24 px-6">
    <div className="max-w-4xl mx-auto instrument p-10 md:p-14 text-center scanlines relative overflow-hidden">
      <img src={ASSETS.product} alt="" className="absolute -right-10 -bottom-10 w-48 opacity-20 rotate-[200deg] pointer-events-none" />
      <div className="relative z-10">
        <Kicker>ready when you are</Kicker>
        <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight text-charcoal dark:text-bone">Protect every palm. Target every dose.</h2>
        <p className="mt-4 text-muted max-w-xl mx-auto">Step into the live mission-control deck — seeded demo orchard, real safety workflow, zero fabricated metrics.</p>
        <button onClick={onLogin} className="focus-ring mt-8 px-9 py-4 rounded-full bg-forest text-bone font-bold text-lg inline-flex items-center gap-2 hover:bg-forest-600 transition-colors">
          Open Live Dashboard <ArrowRight size={18} />
        </button>
      </div>
    </div>
  </section>
);

// ─── 6) Footer ───────────────────────────────────────────────────────
const Footer = () => (
  <footer className="px-6 pb-12 pt-4 border-t border-charcoal/10 dark:border-muted/10">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        <img src={ASSETS.logo} alt="" className="h-7 w-auto opacity-80" />
        <span className="font-bold text-charcoal dark:text-bone">Palm Guard</span>
        <span className="hud-label">· Living Telemetry Interface</span>
      </div>
      <div className="hud-label text-center md:text-right">
        World Robot Caspian Cup 2026 · University of Petra, Jordan<br className="hidden md:block" />
        <span className="text-muted/70">© 2026 Palm Guard — prototype, honest metrics only.</span>
      </div>
    </div>
  </footer>
);

// ─── Page ────────────────────────────────────────────────────────────
export const LandingPage = ({ onLogin, dark, toggleTheme }) => (
  <div className="bg-bone dark:bg-ink-900 text-charcoal dark:text-bone min-h-screen">
    <LandingNav onLogin={onLogin} dark={dark} toggleTheme={toggleTheme} />
    <main>
      <Hero onLogin={onLogin} />
      <ThreatSection />
      <HowSection />
      <HonestySection />
      <MissionControlSection onLogin={onLogin} />
      <CtaSection onLogin={onLogin} />
    </main>
    <Footer />
  </div>
);

export default LandingPage;
