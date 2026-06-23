import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import PalmGridMap from './PalmGridMap.jsx';

// Real geographic orchard map (MapLibre GL + free CARTO/OSM dark tiles, no API key).
// Palms are plotted by their actual lat/lng with risk-colored glow markers. If WebGL
// is unavailable, it gracefully falls back to the stylized PalmGridMap.
const band = (s) => (s >= 80 ? 'critical' : s >= 55 ? 'high' : s >= 30 ? 'watch' : 'normal');
const COLOR = { normal: '#20C07E', watch: '#E0A93B', high: '#E2683A', critical: '#FF5A4D', treated: '#3B8FE0' };
const colorFor = (p) => (p.treated ? COLOR.treated : COLOR[band(Math.round(p.risk_score ?? 0))]);

// Free ESRI World Imagery — real satellite/aerial tiles, no API key required.
// Slightly darkened (raster-opacity over a near-black canvas) so it sits inside
// the command-center theme and the glow markers stay legible.
const DARK_STYLE = {
  version: 8,
  sources: {
    sat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#06090B' } },
    { id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-opacity': 0.82, 'raster-saturation': -0.15, 'raster-contrast': 0.05 } },
  ],
};

export default function OrchardMap({ palms = [], onSelectPalm, selectedPalm, height = 'h-[440px]' }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [failed, setFailed] = useState(false);
  const withCoords = palms.filter((p) => p.lat != null && p.lng != null);

  // init the map once
  useEffect(() => {
    if (!ref.current || mapRef.current || failed) return;
    let map;
    try {
      map = new maplibregl.Map({
        container: ref.current,
        style: DARK_STYLE,
        center: [35.5892, 31.9173],
        zoom: 17,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.addControl(new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right');
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      map.on('error', () => {}); // tile/network errors must not crash the page
      map.on('load', () => map.resize());
      mapRef.current = map;
    } catch {
      setFailed(true);
    }
    return () => { try { map?.remove(); } catch { /* noop */ } mapRef.current = null; };
  }, [failed]);

  // (re)draw markers + fit bounds whenever the palm set or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const draw = () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      const bounds = new maplibregl.LngLatBounds();
      withCoords.forEach((p) => {
        const sel = selectedPalm?.device_id && p.device_id === selectedPalm.device_id;
        const crit = band(Math.round(p.risk_score ?? 0)) === 'critical';
        const el = document.createElement('button');
        el.className = `orchard-marker${sel ? ' is-selected' : ''}${crit ? ' is-crit' : ''}`;
        el.style.setProperty('--c', colorFor(p));
        el.setAttribute('aria-label', `${p.id} — risk ${Math.round(p.risk_score ?? 0)}`);
        el.innerHTML = '<span class="om-dot"></span>';
        el.addEventListener('click', (ev) => { ev.stopPropagation(); onSelectPalm?.(p); });
        markersRef.current.push(new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map));
        bounds.extend([p.lng, p.lat]);
      });
      if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 90, maxZoom: 17, duration: 600 });
    };
    if (map.loaded()) draw(); else map.once('load', draw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palms, selectedPalm]);

  if (failed) {
    return <PalmGridMap palms={palms} onSelectPalm={onSelectPalm} selectedPalm={selectedPalm} height={height} />;
  }
  return (
    <div className={`relative w-full ${height}`}>
      <div ref={ref} className="om-canvas absolute inset-0" />
      <div className="om-veil absolute inset-0 pointer-events-none" />
    </div>
  );
}
