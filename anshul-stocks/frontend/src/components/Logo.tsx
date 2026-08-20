import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  showTagline = false,
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  };

  const textClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
    xl: 'text-2xl',
  };

  return (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* Minimal Geometric Logo Mark */}
      <div
        className={`${sizeClasses[size]} relative flex items-center justify-center rounded-xl bg-[#0B1424] border border-sky-400/40 p-1.5 shadow-md transition-all duration-300 group-hover:border-sky-300`}
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-sky-400"
        >
          {/* Simple abstract ascending lines */}
          <path
            d="M6 24 L14 14 L20 18 L26 8"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="26" cy="8" r="3" fill="currentColor" />
        </svg>
      </div>

      {/* Typography */}
      {showText && (
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <span
              className={`${textClasses[size]} font-extrabold tracking-tight whitespace-nowrap bg-gradient-to-r from-white via-gray-100 to-sky-400 bg-clip-text text-transparent drop-shadow-sm`}
            >
              Anshul Stocks
            </span>
          </div>
          {showTagline && (
            <span className="text-xs font-semibold text-sky-400 tracking-wide mt-0.5">
              AI Investment Mentor
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default Logo;
