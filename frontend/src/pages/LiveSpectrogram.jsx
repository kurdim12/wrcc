import { SpectrogramConsole } from '../components/SpectrogramConsole.jsx';
import { PageHeader } from '../components/ui/Primitives.jsx';

// Acoustic Lab — the technical-proof page. All instrument logic lives in the
// reusable SpectrogramConsole (scrolling spectrogram, feeding-band guide, VU,
// 16-band bars, P(activity), honest caveats).
export const LiveSpectrogram = () => (
  <div className="space-y-4 stagger">
    <PageHeader
      title={<span className="text-gradient-forest">Acoustic Lab</span>}
      subtitle="Tree stethoscope — Palm Guard listens for internal acoustic patterns that may indicate abnormal trunk activity. The score is a proxy activity estimate, not confirmed RPW." />
    <SpectrogramConsole />
  </div>
);

export default LiveSpectrogram;
