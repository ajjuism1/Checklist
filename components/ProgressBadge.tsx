'use client';

import React from 'react';
import { getProgressColor } from '@/lib/utils/colors';

interface ProgressBadgeProps {
  percentage: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBadge: React.FC<ProgressBadgeProps> = ({
  percentage,
  label,
  size = 'md',
}) => {

  const sizeClasses = {
    sm: 'h-2 text-xs',
    md: 'h-3 text-sm',
    lg: 'h-4 text-base',
  };

  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm font-semibold text-gray-700 min-w-[80px]">{label}:</span>}
      <div className="flex-1 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div
          className={`${getProgressColor(percentage)} ${sizeClasses[size]} transition-all duration-500 flex items-center justify-center text-white font-bold`}
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        >
          {percentage > 0 && percentage < 100 && `${percentage}%`}
          {percentage === 100 && '✓'}
          {percentage === 0 && ''}
        </div>
      </div>
      {percentage > 0 && percentage < 100 && (
        <span className="text-xs font-semibold text-gray-600 min-w-[35px]">{percentage}%</span>
      )}
    </div>
  );
};

