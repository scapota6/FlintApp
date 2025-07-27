import { useState, useRef, createContext, useContext } from "react";

// TooltipProvider for compatibility with existing components
interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
}

const TooltipContext = createContext<{ delay: number }>({ delay: 200 });

export function TooltipProvider({ children, delayDuration = 200 }: TooltipProviderProps) {
  return (
    <TooltipContext.Provider value={{ delay: delayDuration }}>
      {children}
    </TooltipContext.Provider>
  );
}

// Compatibility exports for Radix UI-style components
export function TooltipTrigger({ children, asChild, ...props }: { children: React.ReactNode; asChild?: boolean; [key: string]: any }) {
  return <div {...props}>{children}</div>;
}

export function TooltipContent({ children, ...props }: { children: React.ReactNode; [key: string]: any }) {
  return <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg" {...props}>{children}</div>;
}

// Main component should also be compatible
export { Tooltip as default };

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  delay?: number;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export function Tooltip({ 
  children, 
  content, 
  delay, 
  position = 'top',
  className = ""
}: TooltipProps) {
  const context = useContext(TooltipContext);
  const effectiveDelay = delay ?? context.delay;
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, effectiveDelay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2';
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2';
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2';
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2';
    }
  };

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800';
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-800';
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-800';
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-800';
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-800';
    }
  };

  return (
    <div 
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div className={`absolute z-50 ${getPositionClasses()}`}>
          <div className="bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap tooltip-fade-in shadow-lg border border-gray-700">
            {content}
            <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`} />
          </div>
        </div>
      )}
    </div>
  );
}