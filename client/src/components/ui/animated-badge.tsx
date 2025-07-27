import { useState } from "react";

interface AnimatedBadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  pulse?: boolean;
  glow?: boolean;
  className?: string;
  onClick?: () => void;
}

export function AnimatedBadge({
  children,
  variant = 'default',
  pulse = false,
  glow = false,
  className = "",
  onClick
}: AnimatedBadgeProps) {
  const [isPressed, setIsPressed] = useState(false);

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20';
      case 'error':
        return 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20';
      case 'info':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/30 text-gray-400 hover:bg-gray-500/20';
    }
  };

  const getGlowStyles = () => {
    if (!glow) return '';
    switch (variant) {
      case 'success':
        return 'shadow-lg shadow-green-500/25';
      case 'warning':
        return 'shadow-lg shadow-yellow-500/25';
      case 'error':
        return 'shadow-lg shadow-red-500/25';
      case 'info':
        return 'shadow-lg shadow-blue-500/25';
      default:
        return 'shadow-lg shadow-purple-500/25';
    }
  };

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        border transition-all duration-200 select-none
        ${getVariantStyles()}
        ${glow ? getGlowStyles() : ''}
        ${pulse ? 'animate-pulse' : ''}
        ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}
        ${isPressed ? 'scale-95' : ''}
        ${className}
      `}
      onClick={onClick}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
    >
      {children}
      
      {/* Micro-interaction sparkle */}
      {onClick && (
        <div className="absolute inset-0 pointer-events-none opacity-0 hover:opacity-100 transition-opacity duration-300">
          <div className="absolute top-0 right-0 w-1 h-1 bg-current rounded-full animate-ping" 
               style={{ animationDelay: '0.1s' }} />
        </div>
      )}
    </span>
  );
}