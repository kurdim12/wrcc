export const Badge = ({ type = 'neutral', text }) => {
  const colors = {
    success:  'bg-green-50  text-green-700   border-green-200  dark:bg-green-500/10  dark:text-green-400  dark:border-green-500/20',
    warning:  'bg-orange-50 text-orange-700  border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
    critical: 'bg-red-50    text-red-700     border-red-200    dark:bg-red-500/10    dark:text-red-400    dark:border-red-500/20',
    low:      'bg-blue-50   text-blue-700    border-blue-200   dark:bg-blue-500/10   dark:text-blue-400   dark:border-blue-500/20',
    neutral:  'bg-gray-50   text-gray-600    border-gray-200   dark:bg-gray-500/10   dark:text-gray-400   dark:border-gray-500/20',
  };
  return (
    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${colors[type] || colors.neutral}`}>
      {text}
    </span>
  );
};

// Helper that maps risk classification or severity strings to a badge type.
export const severityType = (s) => {
  switch ((s || '').toLowerCase()) {
    case 'critical':
    case 'high':     return 'critical';
    case 'warning':
    case 'medium':
    case 'risk':     return 'warning';
    case 'low':      return 'low';
    case 'healthy':  return 'success';
    default:         return 'neutral';
  }
};

export default Badge;
