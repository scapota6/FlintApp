import { LucideIcon } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";
import { ProgressBar } from "./progress-bar";

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
  prefix?: string;
  suffix?: string;
  showProgress?: boolean;
  progressMax?: number;
  className?: string;
}

export function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  iconColor = "text-purple-400",
  prefix = "",
  suffix = "",
  showProgress = false,
  progressMax = 100,
  className = ""
}: MetricCardProps) {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getChangeIcon = () => {
    if (change === undefined) return null;
    return change >= 0 ? '↗' : '↘';
  };

  return (
    <div className={`group bg-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6 
      hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 
      transform hover:scale-[1.02] transition-all duration-300 ${className}`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg bg-gray-800 group-hover:bg-gray-700 transition-colors duration-200`}>
          <Icon className={`h-5 w-5 ${iconColor} group-hover:scale-110 transition-transform duration-200`} />
        </div>
        {change !== undefined && (
          <div className={`text-sm font-medium ${getChangeColor()} flex items-center gap-1`}>
            <span>{getChangeIcon()}</span>
            <AnimatedCounter 
              value={Math.abs(change)} 
              suffix="%" 
              decimals={1}
              duration={600}
            />
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-gray-400 mb-2 group-hover:text-gray-300 transition-colors">
        {title}
      </h3>

      {/* Value */}
      <div className="text-2xl font-bold text-white mb-3">
        <AnimatedCounter 
          value={value} 
          prefix={prefix} 
          suffix={suffix}
          decimals={prefix === '$' ? 2 : 0}
          duration={800}
        />
      </div>

      {/* Progress Bar */}
      {showProgress && (
        <ProgressBar 
          value={value} 
          max={progressMax} 
          color="bg-gradient-to-r from-purple-500 to-purple-400"
          height="h-1.5"
          animated={true}
        />
      )}

      {/* Micro-interaction sparkles */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute top-2 right-2 w-1 h-1 bg-purple-400 rounded-full animate-ping" 
             style={{ animationDelay: '0.2s' }} />
        <div className="absolute bottom-3 left-3 w-0.5 h-0.5 bg-purple-300 rounded-full animate-ping" 
             style={{ animationDelay: '0.5s' }} />
      </div>
    </div>
  );
}