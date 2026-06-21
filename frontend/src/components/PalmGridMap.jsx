// 2D / 3D / Satellite map view. Adapted from code.txt:734-1067 to consume real
// `palms` and `devices` props (plus their joined classification).
//
// Map mode:
//   - Cursor-anchored scroll-zoom (zooms toward where the mouse is)
//   - Pan clamped so the satellite image always fills the viewport
//   - Markers projected from real lat/lng so they sit on top of the palms
//     visible in /public/palmfarm.jpg.
import { useState, useRef, useMemo, useEffect } from 'react';
import { MapPin, Network as NetworkIcon, Box, Globe, Plus, Minus } from 'lucide-react';
import Card from './ui/Card.jsx';

// Calibrated for /public/palmfarm.jpg so the seed_palms.py grid (centered on
// 31.917632 / 35.589378) lands in the middle of the image (around 35-65%).
const MAP_BOUNDS = {
  minLat: 31.916057, maxLat: 31.919057,
  minLng: 35.587303, maxLng: 35.591303,
};

const project = (lat, lng) => ({
  x: ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * 100,
  y: ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * 100,
});

const statusColor = (cls) => {
  if (cls === 'high')   return 'bg-red-500    ring-red-500/30    animate-pulse';
  if (cls === 'medium') return 'bg-orange-500 ring-orange-500/30';
  return 'bg-emerald-500';
};

const MIN_SCALE = 1;
const MAX_SCALE = 6;

// Clamps pan so the scaled image fills the viewport exactly (no white edges).
const clampPan = (x, y, scale, viewW, viewH) => {
  const minX = viewW * (1 - scale);
  const minY = viewH * (1 - scale);
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  };
};

const DEFAULT_MAP_SCALE = 1.5;

export const PalmGridMap = ({ palms = [], onSelectPalm, selectedPalm, height = 'h-[550px]' }) => {
  const [viewMode, setViewMode] = useState('map');                   // satellite by default
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: DEFAULT_MAP_SCALE });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef(null);

  const items = useMemo(() => palms.map(p => ({
    ...p,
    classification: p.classification ?? 'low',
    proj: p.lat != null && p.lng != null ? project(p.lat, p.lng) : { x: 50, y: 50 },
  })), [palms]);

  // Cursor-anchored wheel zoom. Native listener with passive:false so
  // preventDefault() actually stops the page from scrolling.
  useEffect(() => {
    if (viewMode !== 'map') return;
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.0015);     // smooth exponential

      setTransform(prev => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        if (newScale === prev.scale) return prev;
        // Keep the world-point under the cursor in the same screen position.
        const ratio = newScale / prev.scale;
        const nx = mx - ratio * (mx - prev.x);
        const ny = my - ratio * (my - prev.y);
        const clamped = clampPan(nx, ny, newScale, rect.width, rect.height);
        return { scale: newScale, x: clamped.x, y: clamped.y };
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewMode]);

  // When entering map mode, center the satellite at the default 1.5x zoom.
  // When leaving map mode, reset transform so 2D/3D views render at scale 1.
  useEffect(() => {
    if (viewMode === 'map') {
      const apply = () => {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;
        const scale = DEFAULT_MAP_SCALE;
        setTransform({
          scale,
          x: rect.width  * (1 - scale) / 2,
          y: rect.height * (1 - scale) / 2,
        });
      };
      // First run can fire before the viewport has measurable dimensions, so retry on next frame.
      if (viewportRef.current?.clientWidth) apply();
      else requestAnimationFrame(apply);
    } else {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [viewMode]);

  const handleMouseDown = (e) => {
    if (viewMode !== 'map' || transform.scale <= MIN_SCALE) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
  };
  const handleMouseMove = (e) => {
    if (!isDragging || viewMode !== 'map') return;
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    const clamped = clampPan(newX, newY, transform.scale, rect.width, rect.height);
    setTransform(t => ({ ...t, x: clamped.x, y: clamped.y }));
  };
  const handleMouseUp = () => setIsDragging(false);

  const zoomBy = (factor) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.width / 2, cy = rect.height / 2;
    setTransform(prev => {
      const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
      if (newScale === prev.scale) return prev;
      const ratio = newScale / prev.scale;
      const nx = cx - ratio * (cx - prev.x);
      const ny = cy - ratio * (cy - prev.y);
      const clamped = clampPan(nx, ny, newScale, rect.width, rect.height);
      return { scale: newScale, x: clamped.x, y: clamped.y };
    });
  };

  return (
    <Card className={`p-0 ${height} flex flex-col overflow-hidden relative border border-gray-100 dark:border-gray-800 shadow-lg`}>
      {/* Top control bar */}
      <div className="absolute top-5 left-5 right-5 z-30 flex justify-between items-start pointer-events-none">
        <div className="bg-white/90 dark:bg-[#0f1422]/90 backdrop-blur-xl p-3 md:p-4 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 pointer-events-auto flex items-center gap-3 md:gap-4">
          <div className="bg-emerald-100 dark:bg-emerald-500/15 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
            <MapPin size={18} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white text-xs md:text-sm">Farm Digital Twin</h3>
            <div className="text-[10px] md:text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
              {viewMode === 'map' ? 'SATELLITE FEED' : viewMode === '3d' ? 'ISOMETRIC VIEW' : 'GRID TOPOLOGY'}
              {' · ' + items.length + ' palms'}
              {viewMode === 'map' && transform.scale > 1.01 ? ' · ' + transform.scale.toFixed(1) + 'x' : ''}
            </div>
          </div>
        </div>

        <div className="flex gap-2 pointer-events-auto bg-white/90 dark:bg-[#0f1422]/90 backdrop-blur-xl p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          {[
            { id: '2d',  Icon: NetworkIcon, title: '2D grid' },
            { id: '3d',  Icon: Box,         title: 'Isometric' },
            { id: 'map', Icon: Globe,       title: 'Satellite' },
          ].map(({ id, Icon, title }) => (
            <button key={id} onClick={() => setViewMode(id)} title={title}
              className={`p-2.5 rounded-lg transition-all ${
                viewMode === id
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}>
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>

      {/* Zoom controls (map mode) */}
      {viewMode === 'map' && (
        <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-2 pointer-events-auto">
          <button onClick={() => zoomBy(1.4)} title="Zoom in"
            className="p-2 bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-[#161b2b] text-gray-700 dark:text-gray-200">
            <Plus size={18} />
          </button>
          <button onClick={() => zoomBy(1 / 1.4)} title="Zoom out"
            className="p-2 bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-[#161b2b] text-gray-700 dark:text-gray-200">
            <Minus size={18} />
          </button>
          <button onClick={() => {
              const rect = viewportRef.current?.getBoundingClientRect();
              const scale = DEFAULT_MAP_SCALE;
              setTransform({
                scale,
                x: rect ? rect.width  * (1 - scale) / 2 : 0,
                y: rect ? rect.height * (1 - scale) / 2 : 0,
              });
            }}
            title="Reset to default view"
            className="p-2 bg-white dark:bg-[#0f1422] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-[#161b2b] text-[10px] font-bold text-gray-600 dark:text-gray-400">
            ⌂
          </button>
        </div>
      )}

      {/* Viewport */}
      <div
        ref={viewportRef}
        className={`flex-1 relative overflow-hidden transition-colors duration-500 ${
          viewMode === 'map' ? 'bg-[#0a0d14]' : 'bg-gray-50 dark:bg-[#0a0e1a]'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Satellite view */}
        {viewMode === 'map' && (
          <div
            className={`absolute top-0 left-0 w-full h-full origin-top-left ${
              isDragging ? 'cursor-grabbing' : transform.scale > 1.01 ? 'cursor-grab' : 'cursor-default'
            }`}
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transition: isDragging ? 'none' : 'transform 250ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div className="absolute inset-0 w-full h-full" style={{
              backgroundImage: `url('/palmfarm.jpg')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'saturate(1.05) contrast(1.05)',
            }} />
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
              backgroundSize: '100px 100px',
            }} />

            {items.map(p => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer group"
                style={{ left: `${p.proj.x}%`, top: `${p.proj.y}%` }}
                onClick={(e) => { e.stopPropagation(); onSelectPalm?.(p); }}
              >
                {selectedPalm?.id === p.id && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 border-2 border-blue-400 rounded-full animate-ping opacity-75" />
                )}
                {/* Counter-scale so dots stay readable when the map is zoomed in. */}
                <div
                  className="relative"
                  style={{ transform: `scale(${Math.max(1 / transform.scale, 0.45)})` }}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg ring-2 ring-black/40 ${statusColor(p.classification)} ${selectedPalm?.id === p.id ? 'ring-blue-500 ring-4 scale-150 bg-blue-500' : 'group-hover:scale-150'} transition-transform`} />
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-black/60 backdrop-blur text-white text-sm px-4 py-2 rounded-xl">
                  No palms — run <code className="font-mono text-xs">python tools/seed_palms.py</code>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2D / 3D grid view */}
        {(viewMode === '2d' || viewMode === '3d') && (
          <div className="w-full h-full p-4 md:p-12 relative flex items-center justify-center perspective-container">
            <div className="absolute inset-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none" style={{
              backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }} />

            {items.length === 0 ? (
              <div className="text-center text-gray-400 dark:text-gray-500 max-w-sm">
                <div className="text-sm font-bold mb-1">No palms registered yet</div>
                <div className="text-xs">
                  Run <code className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">python tools/seed_palms.py</code> to seed the demo grid.
                </div>
              </div>
            ) : (
              <div className={`relative w-full max-w-3xl aspect-square transition-all duration-700 transform-style-3d ${viewMode === '3d' ? 'rotate-x-60 scale-75' : ''}`}>
                <div className="absolute inset-0 grid grid-cols-10 gap-2 z-10">
                  {items.slice(0, 100).map((palm) => (
                    <button
                      key={palm.id}
                      onClick={() => onSelectPalm?.(palm)}
                      title={`${palm.id} · ${palm.classification}`}
                      className={`
                        w-3 h-3 md:w-3.5 md:h-3.5 rounded-full transition-all duration-300 transform shadow-sm
                        ${palm.classification === 'low'    ? 'bg-emerald-500 hover:scale-150' : ''}
                        ${palm.classification === 'medium' ? 'bg-orange-500 ring-4 ring-orange-500/20 hover:scale-150' : ''}
                        ${palm.classification === 'high'   ? 'bg-red-500    ring-4 ring-red-500/30 animate-pulse scale-125' : ''}
                        ${selectedPalm?.id === palm.id     ? 'ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-[#0a0e1a] scale-150 z-30 bg-blue-500' : ''}
                      `}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default PalmGridMap;
