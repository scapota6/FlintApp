import { useEffect, useState } from "react";

interface ProgressBarProps {
  value: number;
  max: number;
  color?: string;
  backgroundColor?: string;
  height?: string;
  animated?: boolean;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max,
  color = "bg-purple-500",
  backgroundColor = "bg-gray-700",
  height = "h-2",
  animated = true,
  showPercentage = false,
  className = ""
}: ProgressBarProps) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const percentage = Math.min((value / max) * 100, 100);

  useEffect(() => {
    if (!animated) {
      setAnimatedValue(percentage);
      return;
    }

    const startTime = Date.now();
    const duration = 800;
    const startValue = animatedValue;
    const targetValue = percentage;
    const difference = targetValue - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (difference * easeOutCubic);
      setAnimatedValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [percentage, animated]);

  return (
    <div className={`relative ${className}`}>
      <div className={`w-full ${height} ${backgroundColor} rounded-full overflow-hidden`}>
        <div 
          className={`${height} ${color} rounded-full transition-all duration-300 relative overflow-hidden`}
          style={{ width: `${animatedValue}%` }}
        >
          {animated && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          )}
        </div>
      </div>
      {showPercentage && (
        <div className="absolute right-0 top-0 text-xs text-gray-400 mt-1">
          {Math.round(animatedValue)}%
        </div>
      )}
    </div>
  );
}