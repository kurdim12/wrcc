export const Card = ({ children, className = '' }) => (
  <div className={`bg-panel dark:bg-ink-800 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-instrument border border-black/5 dark:border-white/8 transition-all duration-300 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] dark:hover:border-white/12 ${className}`}>
    {children}
  </div>
);

export default Card;
