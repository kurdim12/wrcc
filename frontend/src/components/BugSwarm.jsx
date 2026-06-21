// Animated Bug Swarm landing-page hero element. Adapted verbatim from
// code.txt:91-202 - bugs spawn at the edges, fly toward the product center,
// and zap on contact.
import { useEffect, useRef, useState } from 'react';
import { Bug, Zap } from 'lucide-react';

const createBug = (id) => {
  const edge = Math.floor(Math.random() * 4);
  let x, y;
  switch (edge) {
    case 0: x = Math.random() * 100; y = -20; break;
    case 1: x = 120; y = Math.random() * 100; break;
    case 2: x = Math.random() * 100; y = 120; break;
    case 3: x = -20; y = Math.random() * 100; break;
    default: x = 0; y = 0;
  }
  return { id, x, y, dead: false, deathTimer: 0, angle: 0 };
};

export const BugSwarm = () => {
  const [bugs, setBugs] = useState([]);
  const [zaps, setZaps] = useState([]);
  const containerRef = useRef(null);

  const triggerZap = (x, y) => {
    const id = Date.now() + Math.random();
    setZaps(prev => [...prev, { id, x, y }]);
    setTimeout(() => setZaps(prev => prev.filter(z => z.id !== id)), 500);
  };

  useEffect(() => {
    const initial = Array.from({ length: 15 }).map((_, i) => createBug(i));
    setBugs(initial);

    const interval = setInterval(() => {
      setBugs(prevBugs => prevBugs.map(bug => {
        if (bug.dead) {
          if (bug.deathTimer > 30) return createBug(bug.id);
          return { ...bug, deathTimer: bug.deathTimer + 1 };
        }
        const targetX = 50, targetY = 30;
        const dx = targetX - bug.x, dy = targetY - bug.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 12) {
          triggerZap(bug.x, bug.y);
          return { ...bug, dead: true, deathTimer: 0 };
        }
        const speed = 0.2 + (Math.random() * 0.2);
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.3;
        return {
          ...bug,
          x: bug.x + Math.cos(angle) * speed,
          y: bug.y + Math.sin(angle) * speed,
          angle: angle * (180 / Math.PI) + 90,
        };
      }));
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {bugs.map(bug => (
        <div
          key={bug.id}
          style={{
            left: `${bug.x}%`, top: `${bug.y}%`,
            transform: `translate(-50%, -50%) rotate(${bug.angle}deg) scale(${bug.dead ? 0 : 1})`,
            opacity: bug.dead ? 0 : 0.8,
            transition: 'transform 0.2s linear, opacity 0.1s',
          }}
          className="absolute w-4 h-4 flex items-center justify-center text-gray-400 dark:text-gray-600"
        >
          <Bug size={16} strokeWidth={1.5} />
        </div>
      ))}
      {zaps.map(zap => (
        <div key={zap.id} style={{ left: `${zap.x}%`, top: `${zap.y}%` }}
             className="absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="absolute inset-0 bg-green-400/50 rounded-full animate-ping opacity-75" />
          <div className="absolute inset-0 border-2 border-white rounded-full animate-ping delay-75 opacity-100" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap size={10} className="text-yellow-300 animate-pulse" fill="currentColor" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default BugSwarm;
