import { CheckCircle, Activity, AlertTriangle } from 'lucide-react';

const icon = (type) => {
  if (type === 'success') return <CheckCircle size={18} className="text-green-500" />;
  if (type === 'warning' || type === 'critical') return <AlertTriangle size={18} className="text-orange-500" />;
  return <Activity size={18} />;
};

export const ToastContainer = ({ toasts }) => (
  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-3 pointer-events-none w-full max-w-md px-4">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-in-up border
          ${toast.type === 'success'
            ? 'bg-white/90 dark:bg-gray-800/90 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300'
            : 'bg-white/90 dark:bg-gray-800/90 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200'}`}
      >
        {icon(toast.type)}
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>
    ))}
  </div>
);

export default ToastContainer;
