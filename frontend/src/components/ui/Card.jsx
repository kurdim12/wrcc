export const Card = ({ children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-900 rounded-[2rem] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] dark:shadow-sm border border-gray-100 dark:border-gray-800 transition-all duration-300 hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] dark:hover:border-gray-700 ${className}`}>
    {children}
  </div>
);

export default Card;
