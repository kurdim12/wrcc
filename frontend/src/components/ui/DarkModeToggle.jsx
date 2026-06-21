import { Sun, Moon } from 'lucide-react';

export const DarkModeToggle = ({ dark, toggle }) => (
  <button
    onClick={toggle}
    className="p-2.5 rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-all active:scale-95 border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
    title={dark ? 'Switch to light' : 'Switch to dark'}
  >
    {dark ? <Sun size={18} /> : <Moon size={18} />}
  </button>
);

export default DarkModeToggle;
