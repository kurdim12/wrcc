import { Menu, ChevronDown, Bell, User } from 'lucide-react';
import DarkModeToggle from './ui/DarkModeToggle.jsx';

export const Header = ({ pageTitle, onOpenSidebar, dark, toggleTheme, alertCount, onBellClick, rightExtras }) => (
  <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl h-20 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 lg:px-8 sticky top-0 z-30 transition-colors duration-300 animate-fade-in-up">
    <div className="flex items-center gap-4 lg:gap-5">
      <button onClick={onOpenSidebar} className="lg:hidden p-2 -ml-2 text-gray-600 dark:text-gray-300">
        <Menu size={24} />
      </button>
      <h1 className="font-bold text-xl md:text-2xl capitalize text-gray-900 dark:text-white tracking-tight">
        {pageTitle}
      </h1>
      <div className="hidden md:flex h-8 w-px bg-gray-200 dark:bg-gray-800 mx-2"></div>
      <div className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-xl">
        <span>Al-Qassim Block A</span>
        <ChevronDown size={16} />
      </div>
      {rightExtras && <div className="hidden md:block ml-2">{rightExtras}</div>}
    </div>

    <div className="flex items-center gap-3 md:gap-5">
      <DarkModeToggle dark={dark} toggle={toggleTheme} />
      <button
        onClick={onBellClick}
        className="relative group cursor-pointer p-2 md:p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell size={20} className="text-gray-500 dark:text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors" />
        {alertCount > 0 && (
          <span className="absolute top-1.5 right-1.5 md:top-2 md:right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
        )}
      </button>
      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-800 overflow-hidden border border-gray-200 dark:border-gray-600 cursor-pointer shadow-sm">
        <User className="w-full h-full p-1.5 md:p-2 text-gray-600 dark:text-gray-300" />
      </div>
    </div>
  </header>
);

export default Header;
