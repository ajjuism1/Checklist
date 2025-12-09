'use client';

import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
}

export const Loading: React.FC<LoadingProps> = ({ size = 'md', text, fullScreen = false }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-2',
    lg: 'w-12 h-12 border-2',
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className={`${sizeClasses[size]} border-gray-200 border-t-gray-900 rounded-full animate-spin`}></div>
        {size === 'lg' && (
          <div className="absolute inset-0 border-2 border-transparent border-r-gray-900 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
        )}
      </div>
      {text && (
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-900">{text}</p>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-16 h-16 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin"></div>
              <div className="absolute inset-0 border-2 border-transparent border-r-gray-900 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
          </div>
          <div>
            <div className="w-10 h-10 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Appmaker Checklist</h2>
            <p className="text-sm text-gray-500">Loading your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return content;
};

