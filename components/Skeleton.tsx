'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

export const SkeletonCard: React.FC = () => {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant="rectangular" width="120px" height="16px" />
        <Skeleton variant="circular" width="48px" height="48px" />
      </div>
      <Skeleton variant="text" width="60px" height="12px" className="mb-2" />
      <Skeleton variant="text" width="80px" height="48px" className="mb-1" />
      <Skeleton variant="text" width="100px" height="12px" />
    </div>
  );
};

export const SkeletonMetricCard: React.FC = () => {
  return (
    <div className="metric-card">
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant="circular" width="56px" height="56px" />
      </div>
      <Skeleton variant="text" width="100px" height="12px" className="mb-2" />
      <Skeleton variant="text" width="80px" height="48px" className="mb-1" />
      <Skeleton variant="text" width="120px" height="14px" />
    </div>
  );
};

export const SkeletonTableRow: React.FC = () => {
  return (
    <tr>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width="8px" height="8px" />
          <div className="flex-1">
            <Skeleton variant="text" width="150px" height="16px" className="mb-2" />
            <Skeleton variant="text" width="100px" height="12px" />
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" width="100px" height="8px" className="flex-1" />
          <Skeleton variant="text" width="40px" height="12px" />
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" width="100px" height="8px" className="flex-1" />
          <Skeleton variant="text" width="40px" height="12px" />
        </div>
      </td>
      <td className="px-6 py-5">
        <div className="flex items-center gap-3">
          <Skeleton variant="rectangular" width="100px" height="8px" className="flex-1" />
          <Skeleton variant="text" width="40px" height="12px" />
        </div>
      </td>
      <td className="px-6 py-5">
        <Skeleton variant="text" width="60px" height="16px" />
      </td>
    </tr>
  );
};

export const SkeletonFormField: React.FC = () => {
  return (
    <div className="space-y-2">
      <Skeleton variant="text" width="120px" height="14px" />
      <Skeleton variant="rectangular" width="100%" height="40px" />
    </div>
  );
};

