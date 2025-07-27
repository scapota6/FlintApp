import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface ChartPlaceholderProps {
  data?: number[];
  height?: number;
  color?: string;
  animated?: boolean;
  className?: string;
}

export function ChartPlaceholder({
  data = [65, 68, 72, 70, 75, 78, 82, 79, 85, 88, 92, 90],
  height = 60,
  color = "#8e44ad",
  animated = true,
  className = ""
}: ChartPlaceholderProps) {
  const [animatedData, setAnimatedData] = useState<number[]>(data.map(() => 0));
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!animated) {
      setAnimatedData(data);
      return;
    }

    const duration = 1200;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Staggered animation for each point
      const newData = data.map((value, index) => {
        const delay = (index / data.length) * 0.5;
        const adjustedProgress = Math.max(0, Math.min(1, (progress - delay) / (1 - delay)));
        const eased = 1 - Math.pow(1 - adjustedProgress, 3);
        return value * eased;
      });

      setAnimatedData(newData);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    const timeout = setTimeout(() => {
      requestAnimationFrame(animate);
    }, 100);

    return () => clearTimeout(timeout);
  }, [data, animated]);

  const maxValue = Math.max(...data);
  const minValue = Math.min(...data);
  const range = maxValue - minValue;

  const points = animatedData.map((value, index) => {
    const x = (index / (animatedData.length - 1)) * 100;
    const y = ((maxValue - value) / range) * height;
    return { x, y };
  });

  const pathData = points.reduce((acc, point, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${acc} ${command} ${point.x} ${point.y}`;
  }, '');

  const trend = data[data.length - 1] > data[0] ? 'up' : 'down';
  const TrendIcon = trend === 'up' ? TrendingUp : TrendingDown;
  const trendColor = trend === 'up' ? 'text-green-400' : 'text-red-400';

  return (
    <div 
      className={`relative group cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <svg 
        width="100%" 
        height={height} 
        viewBox={`0 0 100 ${height}`}
        className="overflow-visible"
      >
        {/* Gradient definition */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
          </linearGradient>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color} stopOpacity="0.8"/>
            <stop offset="50%" stopColor={color} stopOpacity="1"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.8"/>
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d={`${pathData} L 100 ${height} L 0 ${height} Z`}
          fill="url(#chartGradient)"
          className="transition-all duration-300"
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={isHovered ? "2" : "1.5"}
          className="transition-all duration-300 drop-shadow-sm"
        />

        {/* Data points */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={isHovered ? "2.5" : "0"}
            fill={color}
            className="transition-all duration-300"
            style={{
              animationDelay: `${index * 50}ms`
            }}
          >
            <animate
              attributeName="r"
              values={isHovered ? "0;2.5;2" : "2;0;0"}
              dur="0.3s"
              fill="freeze"
            />
          </circle>
        ))}

        {/* Hover effects */}
        {isHovered && (
          <>
            {/* Glow effect */}
            <path
              d={pathData}
              fill="none"
              stroke={color}
              strokeWidth="3"
              opacity="0.4"
              className="animate-pulse"
            />
            
            {/* Moving dot */}
            <circle r="3" fill={color} opacity="0.8">
              <animateMotion
                dur="2s"
                repeatCount="indefinite"
                path={pathData}
              />
            </circle>
          </>
        )}
      </svg>

      {/* Trend indicator */}
      <div className={`absolute top-1 right-1 ${trendColor} transition-all duration-300 ${
        isHovered ? 'scale-110' : 'scale-100'
      }`}>
        <TrendIcon className="h-3 w-3" />
      </div>

      {/* Interactive overlay */}
      <div className={`absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/5 to-transparent 
        opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded`} />
    </div>
  );
}