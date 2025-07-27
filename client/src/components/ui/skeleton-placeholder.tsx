import React from 'react';

interface SkeletonPlaceholderProps {
  className?: string;
  height?: string;
  width?: string;
  rounded?: boolean;
}

export function SkeletonPlaceholder({ 
  className = "", 
  height = "h-4", 
  width = "w-full",
  rounded = true 
}: SkeletonPlaceholderProps) {
  return (
    <div 
      className={`bg-gray-700 animate-pulse ${height} ${width} ${rounded ? 'rounded' : ''} ${className}`}
    />
  );
}

interface ActivitySkeletonProps {
  count?: number;
}

export function ActivitySkeleton({ count = 5 }: ActivitySkeletonProps) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 bg-gray-800/30 rounded-lg">
          <SkeletonPlaceholder className="w-10 h-10 rounded-full" height="h-10" width="w-10" />
          <div className="flex-1 space-y-2">
            <SkeletonPlaceholder height="h-4" width="w-3/4" />
            <SkeletonPlaceholder height="h-3" width="w-1/2" />
          </div>
          <SkeletonPlaceholder height="h-4" width="w-16" />
        </div>
      ))}
    </div>
  );
}

interface TransferSkeletonProps {
  count?: number;
}

export function TransferSkeleton({ count = 3 }: TransferSkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
          <div className="flex items-center space-x-3">
            <SkeletonPlaceholder className="w-8 h-8 rounded-full" height="h-8" width="w-8" />
            <div className="space-y-1">
              <SkeletonPlaceholder height="h-4" width="w-24" />
              <SkeletonPlaceholder height="h-3" width="w-16" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <SkeletonPlaceholder height="h-4" width="w-20" />
            <SkeletonPlaceholder height="h-3" width="w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface HoldingsSkeletonProps {
  count?: number;
}

export function HoldingsSkeleton({ count = 4 }: HoldingsSkeletonProps) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
          <div className="flex items-center space-x-3">
            <SkeletonPlaceholder className="w-8 h-8 rounded-full" height="h-8" width="w-8" />
            <div className="space-y-1">
              <SkeletonPlaceholder height="h-4" width="w-16" />
              <SkeletonPlaceholder height="h-3" width="w-24" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <SkeletonPlaceholder height="h-4" width="w-20" />
            <SkeletonPlaceholder height="h-3" width="w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}