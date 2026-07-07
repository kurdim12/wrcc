export const Badge = ({ type = 'neutral', text }) => {
  const colors = {
    success:  'bg-[#43C76E]/12 text-[#43C76E] border-[#43C76E]/30',
    warning:  'bg-[#F0B040]/12 text-[#F0B040] border-[#F0B040]/30',
    critical: 'bg-[#EE5A48]/12 text-[#EE5A48] border-[#EE5A48]/30',
    low:      'bg-[#4D9BE6]/12 text-[#4D9BE6] border-[#4D9BE6]/30',
    neutral:  'bg-[#98A69D]/12 text-[#98A69D] border-[#98A69D]/25',
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
