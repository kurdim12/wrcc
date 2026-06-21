import { SpectrogramConsole } from '../components/SpectrogramConsole.jsx';

// Tree Stethoscope — the acoustic lab. All instrument logic lives in the
// reusable SpectrogramConsole (scrolling spectrogram, feeding-band guide, VU,
// 16-band bars, P(activity), honest caveats).
export const LiveSpectrogram = () => (
  <div className="space-y-4">
    <SpectrogramConsole />
  </div>
);

export default LiveSpectrogram;
