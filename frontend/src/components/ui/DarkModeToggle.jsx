import { Sun, Moon } from 'lucide-react';

export const DarkModeToggle = ({ dark, toggle }) => (
  <button
    onClick={toggle}
    className="focus-ring p-2 rounded-lg cm-muted hover:bg-black/5 dark:hover:bg-white/5 transition-all active:scale-95 hover:text-[var(--cm-forest)]"
    title={dark ? 'Switch to light' : 'Switch to dark'}
  >
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>
);

export default DarkModeToggle;
