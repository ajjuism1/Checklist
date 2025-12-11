'use client';

import React, { useState, useRef, useEffect } from 'react';

interface VersionDropdownProps {
  version: number;
  onVersionChange: (version: number) => void;
  onVersionDelete?: (versionToDelete: number) => void;
  projectId: string;
  publishingStatus?: string;
  availableVersions: number[]; // Available versions for this project
  canDelete?: boolean; // Whether version deletion is allowed
}

export const VersionDropdown: React.FC<VersionDropdownProps> = ({
  version,
  onVersionChange,
  onVersionDelete,
  projectId,
  publishingStatus,
  availableVersions,
  canDelete = false,
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

  // Determine if we can increment version (only when publishingStatus is 'Live')
  const canIncrement = publishingStatus === 'Live';
  
  // Get the max version from available versions or current version
  const maxVersion = availableVersions.length > 0 ? Math.max(...availableVersions) : version;
  
  // Only show increment option if next version doesn't exist yet
  const nextVersionExists = availableVersions.includes(maxVersion + 1);
  const shouldShowIncrement = canIncrement && !nextVersionExists;
  
  // Generate version options (only show existing versions, not future ones)
  const versionOptions = availableVersions.length > 0 ? availableVersions : [version];

  const handleVersionSelect = (newVersion: number) => {
    onVersionChange(newVersion);
    setIsOpen(false);
  };

  const handleIncrement = () => {
    if (canIncrement) {
      const nextVersion = maxVersion + 1;
      handleVersionSelect(nextVersion);
    }
  };

  const handleDeleteVersion = (versionToDelete: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onVersionDelete && versionToDelete !== version) {
      if (confirm(`Are you sure you want to remove Version ${versionToDelete} from the dropdown? This will not delete any data associated with this version, but you won't be able to filter by it anymore.`)) {
        onVersionDelete(versionToDelete);
        setIsOpen(false);
      }
    } else if (versionToDelete === version) {
      alert('Cannot delete the currently selected version. Please select a different version first.');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all duration-150 hover:shadow-sm bg-gray-50 text-gray-700 border-gray-200"
      >
        <span>Version {version}</span>
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
          <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
            {versionOptions.map((versionOption) => (
              <div
                key={versionOption}
                className={`group flex items-center ${
                  version === versionOption ? 'bg-gray-50' : ''
                }`}
              >
                <button
                  onClick={() => handleVersionSelect(versionOption)}
                  className={`flex-1 px-4 py-2.5 text-left text-sm font-semibold transition-colors duration-150 flex items-center gap-2 ${
                    version === versionOption
                      ? 'text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>Version {versionOption}</span>
                  {version === versionOption && (
                    <svg className="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                {canDelete && onVersionDelete && versionOption !== version && versionOptions.length > 1 && (
                  <button
                    onClick={(e) => handleDeleteVersion(versionOption, e)}
                    className="px-2 py-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={`Delete Version ${versionOption}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {shouldShowIncrement && (
              <>
                <div className="border-t border-gray-200 my-1"></div>
                <button
                  onClick={handleIncrement}
                  className="w-full px-4 py-2.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Increment to Version {maxVersion + 1}</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
