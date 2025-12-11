'use client';

import React, { useState, useRef, useEffect } from 'react';
import { PublishingStatus } from '@/types';

interface PublishingStatusDropdownProps {
  status: PublishingStatus;
  onStatusChange: (status: PublishingStatus) => void;
  projectId: string;
}

const statusConfig: Record<PublishingStatus, { bg: string; text: string; border: string; dot: string }> = {
  'Pending': {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
  },
  'Subscribed': {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    dot: 'bg-blue-500',
  },
  'Under Review': {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  'Live': {
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
  },
};

export const PublishingStatusDropdown: React.FC<PublishingStatusDropdownProps> = ({
  status,
  onStatusChange,
  projectId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentConfig = statusConfig[status];
  const allStatuses: PublishingStatus[] = ['Pending', 'Subscribed', 'Under Review', 'Live'];

  const handleStatusSelect = (newStatus: PublishingStatus) => {
    onStatusChange(newStatus);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all duration-150 hover:shadow-sm ${currentConfig.bg} ${currentConfig.text} ${currentConfig.border}`}
      >
        <span>{status}</span>
        <svg
          className={`w-4 h-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {allStatuses.map((statusOption) => {
              const config = statusConfig[statusOption];
              return (
                <button
                  key={statusOption}
                  onClick={() => handleStatusSelect(statusOption)}
                  className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors duration-150 flex items-center gap-2 ${
                    status === statusOption
                      ? `${config.bg} ${config.text}`
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                  <span>{statusOption}</span>
                  {status === statusOption && (
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
