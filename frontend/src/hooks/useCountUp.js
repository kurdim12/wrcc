// Smooth animated number transitions. When `value` changes the displayed value
// eases from the previous number to the new one over ~600ms.
import { useEffect, useRef, useState } from 'react';

export const useCountUp = (value, { duration = 600, decimals = 0 } = {}) => {
  const [display, setDisplay] = useState(value ?? 0);
  const fromRef = useRef(value ?? 0);
  const startRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (value == null) return;
    const target = Number(value);
    if (!Number.isFinite(target)) return;
    if (target === display) return;

    fromRef.current = display;
    startRef.current = null;

    const ease = (t) => 1 - Math.pow(1 - t, 3);

    const step = (t) => {
      if (startRef.current == null) startRef.current = t;
      const elapsed = t - startRef.current;
      const k = Math.min(1, elapsed / duration);
      const v = fromRef.current + (target - fromRef.current) * ease(k);
      setDisplay(decimals > 0 ? +v.toFixed(decimals) : Math.round(v));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, decimals]);

  return display;
};
