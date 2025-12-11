'use client';

import React, { useState, useEffect } from 'react';
import { FieldConfig, FieldType, Integration } from '@/types';
import { getIntegrations } from '@/lib/firebase/firestore';
import { ConfirmModal } from './ConfirmModal';

// Helper function to determine if a field is required/mandatory
const isFieldRequired = (field: FieldConfig): boolean => {
  // If explicitly marked as required, it's mandatory
  if (field.required === true) return true;
  // If explicitly marked as optional, it's not required
  if (field.optional === true) return false;
  // Default: if neither is set, field is required
  return true;
};

// Helper function to check if a string is a valid URL
const isValidUrl = (str: string): boolean => {
  if (!str || typeof str !== 'string') return false;
  try {
    // Check if it starts with http:// or https://
    if (str.trim().startsWith('http://') || str.trim().startsWith('https://')) {
      new URL(str.trim());
      return true;
    }
    // Also check for URLs without protocol (common in user input)
    if (str.trim().includes('.') && (str.trim().includes('://') || str.trim().match(/^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Helper function to normalize URL (add https:// if missing)
const normalizeUrl = (url: string): string => {
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

// Integration Selector Component with Search and Table View
interface IntegrationSelectorProps {
  field: FieldConfig;
  value: any;
  integrations: Integration[];
  onChange: (selectedIds: string[]) => void;
  onRequirementStatusChange?: (status: Record<string, Record<string, boolean>>) => void;
  initialRequirementStatus?: Record<string, Record<string, boolean>>;
  onRemoveRequest?: (integrationId: string, integrationName: string, onConfirm: () => void) => void;
  projectVersion?: number;
  availableVersions?: number[];
  onVersionChange?: (integrationId: string, version: number) => void;
  integrationVersions?: Record<string, number>; // Map of integrationId to version
  onIntegrationStatusChange?: (integrationId: string, status: string) => void;
  integrationStatuses?: Record<string, string>; // Map of integrationId to status
  isLaunchChecklist?: boolean; // Whether this is a launch checklist (vs sales checklist)
}

const IntegrationSelector: React.FC<IntegrationSelectorProps> = ({
  field,
  value,
  integrations,
  onChange,
  onRequirementStatusChange,
  initialRequirementStatus = {},
  onRemoveRequest,
  projectVersion = 1,
  availableVersions = [1],
  onVersionChange,
  integrationVersions = {},
  onIntegrationStatusChange,
  integrationStatuses = {},
  isLaunchChecklist = false,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(Array.isArray(value) ? value : []);
  const [requirementStatus, setRequirementStatus] = useState<Record<string, Record<string, boolean>>>(initialRequirementStatus);
  
  const integrationStatusOptions = ['Integrated', 'Pending', 'Awaiting Information'];
  
  // Helper function to get color classes for integration status
  const getIntegrationStatusColor = (status: string) => {
    switch (status) {
      case 'Integrated': return 'bg-green-100 text-green-800 border-green-200';
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Awaiting Information': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  useEffect(() => {
    setSelectedIds(Array.isArray(value) ? value : []);
  }, [value]);

  useEffect(() => {
    if (initialRequirementStatus && Object.keys(initialRequirementStatus).length > 0) {
      setRequirementStatus(initialRequirementStatus);
    }
  }, [initialRequirementStatus]);

  const handleToggleIntegration = (integrationId: string) => {
    const newSelected = selectedIds.includes(integrationId)
      ? selectedIds.filter(id => id !== integrationId)
      : [...selectedIds, integrationId];
    setSelectedIds(newSelected);
    onChange(newSelected);
  };

  const handleRemoveIntegration = (integrationId: string) => {
    const integration = integrations.find(integ => integ.id === integrationId);
    const integrationName = integration?.name || 'this integration';
    
    if (onRemoveRequest) {
      onRemoveRequest(integrationId, integrationName, () => {
        const newSelected = selectedIds.filter(id => id !== integrationId);
        setSelectedIds(newSelected);
        onChange(newSelected);
      });
    } else {
      // Fallback to direct removal if no confirmation handler
      const newSelected = selectedIds.filter(id => id !== integrationId);
      setSelectedIds(newSelected);
      onChange(newSelected);
    }
  };

  const handleRequirementToggle = (integrationId: string, requirement: string) => {
    const newStatus = {
      ...requirementStatus,
      [integrationId]: {
        ...requirementStatus[integrationId],
        [requirement]: !requirementStatus[integrationId]?.[requirement],
      },
    };
    setRequirementStatus(newStatus);
    // Persist requirement status to parent
    if (onRequirementStatusChange) {
      onRequirementStatusChange(newStatus);
    }
  };

  const filteredIntegrations = integrations.filter(integ =>
    integ.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integ.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    integ.requirements.some(req => req.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const selectedIntegrations = integrations.filter(integ => selectedIds.includes(integ.id));

  const categories = Array.from(new Set(integrations.map(i => i.category))).sort();

  return (
    <div className="space-y-4 md:col-span-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-bold text-gray-900">
          {field.label}
          {isFieldRequired(field) && <span className="text-red-500 ml-1">*</span>}
          {!isFieldRequired(field) && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
        </label>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {selectedIds.length > 0 ? `Manage Integrations (${selectedIds.length})` : 'Select Integrations'}
        </button>
      </div>

      {/* Selected Integrations Table */}
      {selectedIntegrations.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Integration</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Requirements</th>
                  {isLaunchChecklist && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  )}
                  {isLaunchChecklist && (field.hasVersion === true || field.id === 'integrations') && (
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider min-w-[120px]">Version</th>
                  )}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedIntegrations.map((integ) => (
                  <tr key={integ.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-semibold text-gray-900">{integ.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {integ.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1.5">
                        {integ.requirements && integ.requirements.length > 0 ? (
                          integ.requirements.map((req, idx) => {
                            const isChecked = requirementStatus[integ.id]?.[req] || false;
                            return (
                              <div key={idx} className="flex items-center gap-2">
                                <div className="relative flex items-center">
                                  <input
                                    type="checkbox"
                                    id={`req-${integ.id}-${idx}`}
                                    checked={isChecked}
                                    onChange={() => handleRequirementToggle(integ.id, req)}
                                    className="sr-only"
                                  />
                                  <label
                                    htmlFor={`req-${integ.id}-${idx}`}
                                    className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                                      isChecked
                                        ? 'bg-gray-900 border-gray-900 shadow-sm'
                                        : 'bg-white border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    {isChecked && (
                                      <svg
                                        className="w-3.5 h-3.5 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </label>
                                </div>
                                <label htmlFor={`req-${integ.id}-${idx}`} className="text-sm text-gray-700 cursor-pointer flex-1">
                                  {req}
                                </label>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-sm text-gray-400 italic">No requirements</span>
                        )}
                      </div>
                    </td>
                    {isLaunchChecklist && (
                      <td className="px-4 py-3">
                        <div className="relative group">
                          <select
                            value={integrationStatuses[integ.id] || 'Pending'}
                            onChange={(e) => {
                              if (onIntegrationStatusChange) {
                                onIntegrationStatusChange(integ.id, e.target.value);
                              }
                            }}
                            className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 transition-all ${getIntegrationStatusColor(integrationStatuses[integ.id] || 'Pending')}`}
                          >
                            {integrationStatusOptions.map((statusOption) => (
                              <option key={statusOption} value={statusOption} className="text-gray-900 py-2 bg-white">
                                {statusOption}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </td>
                    )}
                    {isLaunchChecklist && (field.hasVersion === true || field.id === 'integrations') && (
                      <td className="px-4 py-3">
                        <div className="relative group">
                          <select
                            value={integrationVersions[integ.id] !== undefined ? integrationVersions[integ.id] : (availableVersions.length > 0 ? availableVersions[0] : 1)}
                            onChange={(e) => {
                              if (onVersionChange) {
                                onVersionChange(integ.id, parseInt(e.target.value, 10));
                              }
                            }}
                            className="w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 border-gray-200 bg-white text-gray-900 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 focus:border-gray-900 transition-all"
                          >
                            {availableVersions.map((versionOption) => (
                              <option key={versionOption} value={versionOption} className="text-gray-900 py-2 bg-white">
                                Version {versionOption}
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveIntegration(integ.id)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                        title="Remove integration"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedIntegrations.length === 0 && (
        <div className="border border-gray-200 rounded-lg p-8 text-center bg-gray-50">
          <p className="text-sm text-gray-500">No integrations selected. Click &quot;Select Integrations&quot; to add them.</p>
        </div>
      )}

      {/* Search Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-900 bg-opacity-50 backdrop-blur-sm" onClick={() => setIsDialogOpen(false)} />
            <div className="inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full border border-gray-100">
              {/* Header */}
              <div className="bg-gradient-to-r from-gray-50 to-white px-6 py-5 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Select Integrations</h3>
                    <p className="text-sm text-gray-500 mt-1">Choose the integrations you need for this project</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full p-1.5 transition-colors"
                    aria-label="Close dialog"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search integrations by name, category, or requirements..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 pl-11 pr-4 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all bg-white text-sm"
                  />
                  <svg
                    className="absolute left-3.5 top-3.5 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                      aria-label="Clear search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="bg-white px-6 py-5 max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                {filteredIntegrations.length > 0 ? (
                  <div className="space-y-6">
                    {categories.map((category) => {
                      const categoryIntegrations = filteredIntegrations.filter(i => i.category === category);
                      if (categoryIntegrations.length === 0) return null;
                      const selectedInCategory = categoryIntegrations.filter(i => selectedIds.includes(i.id)).length;
                      return (
                        <div key={category} className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1 h-1 rounded-full bg-gray-400"></span>
                              {category}
                            </h4>
                            {selectedInCategory > 0 && (
                              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                                {selectedInCategory} selected
                              </span>
                            )}
                          </div>
                          <div className="space-y-2.5">
                            {categoryIntegrations.map((integ) => {
                              const isSelected = selectedIds.includes(integ.id);
                              return (
                                <div
                                  key={integ.id}
                                  onClick={() => handleToggleIntegration(integ.id)}
                                  className={`group flex items-start gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
                                    isSelected
                                      ? 'border-gray-900 bg-gray-50 shadow-sm'
                                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                                  }`}
                                >
                                  <div className="relative flex items-center mt-0.5 flex-shrink-0">
                                    <input
                                      type="checkbox"
                                      id={`dialog-${integ.id}`}
                                      checked={isSelected}
                                      onChange={() => handleToggleIntegration(integ.id)}
                                      className="sr-only"
                                    />
                                    <label
                                      htmlFor={`dialog-${integ.id}`}
                                      className={`relative flex items-center justify-center w-6 h-6 rounded-md border-2 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'bg-gray-900 border-gray-900 shadow-sm'
                                          : 'bg-white border-gray-300 group-hover:border-gray-400'
                                      }`}
                                    >
                                      {isSelected && (
                                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </label>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={`dialog-${integ.id}`}
                                      className="text-sm font-bold text-gray-900 cursor-pointer block mb-1.5"
                                    >
                                      {integ.name}
                                    </label>
                                    {integ.requirements && integ.requirements.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5">
                                        {integ.requirements.map((req, idx) => (
                                          <span
                                            key={idx}
                                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600 border border-gray-200"
                                          >
                                            {req}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  {isSelected && (
                                    <div className="flex-shrink-0 mt-0.5">
                                      <div className="w-2 h-2 rounded-full bg-gray-900"></div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg
                      className="w-16 h-16 text-gray-300 mx-auto mb-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm font-medium text-gray-600 mb-1">No integrations found</p>
                    <p className="text-xs text-gray-500">Try adjusting your search terms</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${selectedIds.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  <div className="text-sm text-gray-600">
                    <span className="font-bold text-gray-900">{selectedIds.length}</span>{' '}
                    <span className="text-gray-600">integration{selectedIds.length !== 1 ? 's' : ''} selected</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-6 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all shadow-sm hover:shadow-md"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DynamicFormProps {
  fields: FieldConfig[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitLabel?: string;
  projectVersion?: number; // Current project version
  availableVersions?: number[]; // Available versions for version dropdowns
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  fields,
  initialData = {},
  onSubmit,
  submitLabel = 'Save',
  projectVersion = 1,
  availableVersions = [1],
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [loading, setLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  
  // Determine if this is a launch checklist
  // Sales checklist doesn't pass projectVersion/availableVersions, so they'll be defaults [1] and 1
  // Launch checklist explicitly passes these props, typically with multiple versions
  // If availableVersions has more than 1 version, or if projectVersion > 1, it's launch
  const isLaunchChecklist = availableVersions.length > 1 || projectVersion > 1;
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'multi_input' | 'integration';
    fieldId: string;
    index?: number;
    itemName?: string;
    onConfirm: () => void;
  } | null>(null);
  const [addEntryModal, setAddEntryModal] = useState<{
    isOpen: boolean;
    fieldId: string;
    fieldType: 'text' | 'textarea';
    placeholder: string;
    onAdd: (value: string, version: number) => void;
    isNested?: boolean;
    parentFieldId?: string;
    subFieldId?: string;
  } | null>(null);

  // Deep comparison function to check if form data has changed
  const deepEqual = (obj1: any, obj2: any): boolean => {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      if (Array.isArray(val1) && Array.isArray(val2)) {
        if (val1.length !== val2.length) return false;
        for (let i = 0; i < val1.length; i++) {
          if (!deepEqual(val1[i], val2[i])) return false;
        }
      } else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
        if (!deepEqual(val1, val2)) return false;
      } else if (val1 !== val2) {
        return false;
      }
    }
    
    return true;
  };

  useEffect(() => {
    setFormData(initialData);
    setHasUnsavedChanges(false);
  }, [initialData]);

  // Check for unsaved changes whenever formData changes
  useEffect(() => {
    const hasChanges = !deepEqual(formData, initialData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, initialData]);

  useEffect(() => {
    // Load integrations if any field uses them (check recursively in groups)
    const hasIntegrationField = (fieldList: FieldConfig[]): boolean => {
      return fieldList.some(f => {
        if (f.type === 'multi_select' && f.optionsSource === 'integrations') {
          return true;
        }
        if (f.type === 'group' && f.fields) {
          return hasIntegrationField(f.fields);
        }
        return false;
      });
    };
    
    if (hasIntegrationField(fields)) {
      loadIntegrations();
    }
  }, [fields]);

  const loadIntegrations = async () => {
    try {
      const data = await getIntegrations();
      console.log('Loaded integrations:', data.length);
      setIntegrations(data);
    } catch (error) {
      console.error('Error loading integrations:', error);
      setIntegrations([]);
    }
  };

  const handleChange = (fieldId: string, value: any) => {
    setFormData((prev) => {
      const newData = {
      ...prev,
      [fieldId]: value,
      };

      // Auto-populate requirements if this is an integrations field
      const field = fields.find(f => f.id === fieldId);
      if (field?.type === 'multi_select' && field.requirementsFieldId && Array.isArray(value)) {
        const selectedIntegrations = integrations.filter(integ => value.includes(integ.id));
        const allRequirements = selectedIntegrations.flatMap(integ => integ.requirements);
        // Remove duplicates
        const uniqueRequirements = Array.from(new Set(allRequirements));
        newData[field.requirementsFieldId] = uniqueRequirements;
      }

      return newData;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      // Reset unsaved changes after successful save
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Form submission error:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showDeleteConfirmation = (
    type: 'multi_input' | 'integration',
    fieldId: string,
    itemName: string,
    onConfirm: () => void,
    index?: number
  ) => {
    setDeleteConfirm({
      isOpen: true,
      type,
      fieldId,
      index,
      itemName,
      onConfirm,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      deleteConfirm.onConfirm();
      setDeleteConfirm(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleNotRelevantToggle = (fieldId: string, isNotRelevant: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [`${fieldId}_notRelevant`]: isNotRelevant,
    }));
  };

  const isFieldNotRelevant = (fieldId: string): boolean => {
    return formData[`${fieldId}_notRelevant`] === true;
  };

  const renderFieldLabel = (field: FieldConfig, htmlFor?: string) => {
    const isRequired = isFieldRequired(field);
    return (
      <div className="space-y-0.5">
        <label htmlFor={htmlFor || field.id} className="block text-sm font-bold text-gray-900">
          {field.label}
          {isRequired && <span className="text-red-500 ml-1">*</span>}
          {!isRequired && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
        </label>
        {field.subtext && (
          <p className="text-xs text-gray-500 mt-0.5">{field.subtext}</p>
        )}
      </div>
    );
  };

  const renderField = (field: FieldConfig) => {
    const value = formData[field.id] ?? getDefaultValue(field.type);
    const isFullWidth = field.type === 'group' || field.type === 'multi_input' || field.type === 'textarea';
    const isCheckbox = field.type === 'checkbox';
    const notRelevant = isFieldNotRelevant(field.id);

    switch (field.type) {
      case 'checkbox':
        return (
          <div key={field.id} className="md:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1"></div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              <div className="flex items-start space-x-3 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-150">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id={field.id}
                    checked={value === true}
                    onChange={(e) => handleChange(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <label
                    htmlFor={field.id}
                    className={`relative flex items-center justify-center w-6 h-6 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                      value === true
                        ? 'bg-gray-900 border-gray-900 shadow-sm'
                        : 'bg-white border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {value === true && (
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </label>
                </div>
                <label htmlFor={field.id} className="text-sm font-semibold text-gray-900 cursor-pointer flex-1 pt-0.5">
                  {field.label}
                  {!isFieldRequired(field) && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
                </label>
              </div>
            </div>
          </div>
        );

      case 'text': {
        const hasVersion = field.hasVersion === true || ['devComments', 'externalCommunications', 'remarks'].includes(field.id);
        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
        
        // For versioned fields, store as array of {value, version} objects
        // For non-versioned fields, store as simple string
        const normalizeValue = (val: any): Array<{ value: string; version: number }> | string => {
          if (!hasVersion) {
            return val || '';
          }
          
          // If it's already an array, return it
          if (Array.isArray(val)) {
            return val.map((item: any) => {
              if (typeof item === 'string') {
                return { value: item, version: defaultVersion };
              }
              return { 
                value: item.value || '', 
                version: item.version !== undefined ? item.version : defaultVersion 
              };
            });
          }
          
          // If it's a single object with value/version, convert to array
          if (typeof val === 'object' && val !== null && 'value' in val) {
            return [{ value: val.value || '', version: val.version !== undefined ? val.version : defaultVersion }];
          }
          
          // If it's a string, convert to array
          if (typeof val === 'string' && val) {
            return [{ value: val, version: defaultVersion }];
          }
          
          // Empty array for new fields
          return [];
        };
        
        const normalizedValue = normalizeValue(value);
        const isArray = hasVersion && Array.isArray(normalizedValue);
        const items = isArray ? normalizedValue : [];
        
        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-start justify-between">
              {renderFieldLabel(field)}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              {hasVersion ? (
                <div className="space-y-4">
                  {/* Versioned entries - Card-based layout */}
                  {items.length > 0 && (
                    <div className="space-y-2">
                      {items.map((item: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group">
                          <div className="flex-1 min-w-0 relative">
                            <input
                              type="text"
                              value={item.value || ''}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[index] = { ...item, value: e.target.value };
                                handleChange(field.id, newItems);
                              }}
                              className={`w-full px-2 py-1.5 text-sm bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors ${
                                isValidUrl(item.value || '') 
                                  ? 'pr-8 font-mono text-blue-700 font-medium' 
                                  : 'font-medium text-gray-900'
                              }`}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            />
                            {isValidUrl(item.value || '') && (
                              <a
                                href={normalizeUrl(item.value)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                                title="Open link in new tab"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="relative">
                              <select
                                value={item.version !== undefined ? item.version : defaultVersion}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index] = { ...item, version: parseInt(e.target.value, 10) };
                                  handleChange(field.id, newItems);
                                }}
                                className="px-2 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all hover:border-gray-400"
                              >
                                {availableVersions.map((versionOption) => (
                                  <option key={versionOption} value={versionOption} className="text-gray-900">
                                    v{versionOption}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = items.filter((_, i) => i !== index);
                                handleChange(field.id, newItems);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new item button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddEntryModal({
                        isOpen: true,
                        fieldId: field.id,
                        fieldType: 'text',
                        placeholder: `Add new ${field.label.toLowerCase()}...`,
                        onAdd: (value: string, version: number) => {
                          const newItems = [...items, { value, version }];
                          handleChange(field.id, newItems);
                        },
                      });
                    }}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add {field.label.toLowerCase()}
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    id={field.id}
                    value={value || ''}
                    onChange={(e) => handleChange(field.id, e.target.value)}
                    className={`input-field ${isValidUrl(value || '') ? 'pr-10 font-mono text-sm text-blue-700' : ''}`}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                  />
                  {isValidUrl(value || '') && (
                    <a
                      href={normalizeUrl(value)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                      title="Open link in new tab"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'textarea': {
        const hasVersion = field.hasVersion === true || ['devComments', 'externalCommunications', 'remarks'].includes(field.id);
        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
        
        // For versioned fields, store as array of {value, version} objects
        // For non-versioned fields, store as simple string
        const normalizeValue = (val: any): Array<{ value: string; version: number }> | string => {
          if (!hasVersion) {
            return val || '';
          }
          
          // If it's already an array, return it
          if (Array.isArray(val)) {
            return val.map((item: any) => {
              if (typeof item === 'string') {
                return { value: item, version: defaultVersion };
              }
              return { 
                value: item.value || '', 
                version: item.version !== undefined ? item.version : defaultVersion 
              };
            });
          }
          
          // If it's a single object with value/version, convert to array
          if (typeof val === 'object' && val !== null && 'value' in val) {
            return [{ value: val.value || '', version: val.version !== undefined ? val.version : defaultVersion }];
          }
          
          // If it's a string, convert to array
          if (typeof val === 'string' && val) {
            return [{ value: val, version: defaultVersion }];
          }
          
          // Empty array for new fields
          return [];
        };
        
        const normalizedValue = normalizeValue(value);
        const isArray = hasVersion && Array.isArray(normalizedValue);
        const items = isArray ? normalizedValue : [];
        
        return (
          <div key={field.id} className="space-y-1.5 md:col-span-2">
            <div className="flex items-start justify-between">
              {renderFieldLabel(field)}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              {hasVersion ? (
                <div className="space-y-3">
                  {/* Versioned entries - Card-based layout */}
                  {items.length > 0 && (
                    <div className="space-y-2">
                      {items.map((item: any, index: number) => (
                        <div key={index} className="flex items-start gap-2 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <textarea
                              value={item.value || ''}
                              onChange={(e) => {
                                const newItems = [...items];
                                newItems[index] = { ...item, value: e.target.value };
                                handleChange(field.id, newItems);
                              }}
                              rows={3}
                              className="w-full px-2 py-1.5 text-sm text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors resize-y"
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                            />
                          </div>
                          <div className="flex items-start gap-1.5 flex-shrink-0 pt-1">
                            <div className="relative">
                              <select
                                value={item.version !== undefined ? item.version : defaultVersion}
                                onChange={(e) => {
                                  const newItems = [...items];
                                  newItems[index] = { ...item, version: parseInt(e.target.value, 10) };
                                  handleChange(field.id, newItems);
                                }}
                                className="px-2 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all hover:border-gray-400"
                              >
                                {availableVersions.map((versionOption) => (
                                  <option key={versionOption} value={versionOption} className="text-gray-900">
                                    v{versionOption}
                                  </option>
                                ))}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                                <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = items.filter((_, i) => i !== index);
                                handleChange(field.id, newItems);
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Remove"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add new item button */}
                  <button
                    type="button"
                    onClick={() => {
                      setAddEntryModal({
                        isOpen: true,
                        fieldId: field.id,
                        fieldType: 'textarea',
                        placeholder: `Add new ${field.label.toLowerCase()}...`,
                        onAdd: (value: string, version: number) => {
                          const newItems = [...items, { value, version }];
                          handleChange(field.id, newItems);
                        },
                      });
                    }}
                    className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add {field.label.toLowerCase()}
                  </button>
                </div>
              ) : (
                <textarea
                  id={field.id}
                  value={value || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  rows={4}
                  className="input-field resize-y"
                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                />
              )}
            </div>
          </div>
        );
      }

      case 'multi_input': {
        // Handle multi_input with status dropdowns (for Custom Features and Change Requests)
        const hasStatus = field.hasStatus === true;
        const hasVersion = field.hasVersion === true || ['integrationsCredentials', 'customFeatures', 'changeRequests'].includes(field.id);
        // Use same status options as project status for consistency
        const statusOptions = ['Not Started', 'In Progress', 'On HOLD', 'Completed'];
        
        // Normalize value: convert string[] to {value, status, checked, remark, version}[] handle both formats
        // Use first available version (1) as default, not projectVersion, so items don't change when project version changes
        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
        const normalizeValue = (val: any): Array<{ value: string; status: string; checked: boolean; remark: string; version?: number }> => {
          if (!Array.isArray(val)) return [];
          return val.map((item: any) => {
            if (typeof item === 'string') {
              return { value: item, status: 'Not Started', checked: false, remark: '', version: hasVersion ? defaultVersion : undefined };
            }
            // Preserve existing version if it exists, otherwise use defaultVersion (not projectVersion)
            return { 
              value: item.value || '', 
              status: item.status || 'Not Started',
              checked: item.checked || false,
              remark: item.remark || '',
              version: hasVersion ? (item.version !== undefined ? item.version : defaultVersion) : undefined
            };
          });
        };
        
        const normalizedValue = normalizeValue(value);
        
        return (
          <div key={field.id} className="space-y-1.5 md:col-span-2">
            <div className="flex items-start justify-between mb-2">
              {renderFieldLabel(field)}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              {/* Add Item Input */}
              <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex gap-3">
                  <input
                    type="text"
                    id={`${field.id}-new-item`}
                    placeholder={`Add new ${field.label.toLowerCase()}...`}
                    className="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all placeholder:text-gray-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = e.target as HTMLInputElement;
                        const newValue = input.value.trim();
                        if (newValue) {
                          const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                          const newItem = { 
                            value: newValue, 
                            status: 'Not Started', 
                            checked: false, 
                            remark: '',
                            ...(hasVersion ? { version: defaultVersion } : {})
                          };
                          handleChange(field.id, [...normalizedValue, newItem]);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById(`${field.id}-new-item`) as HTMLInputElement;
                      const newValue = input?.value.trim();
                      if (newValue) {
                        const newItem = { 
                          value: newValue, 
                          status: 'Not Started', 
                          checked: false, 
                          remark: '' 
                        };
                        handleChange(field.id, [...normalizedValue, newItem]);
                        if (input) input.value = '';
                      }
                    }}
                    className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Item
                  </button>
                </div>
              </div>

              {/* Table View */}
              {normalizedValue.length > 0 ? (
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b-2 border-gray-200">
                        <tr>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-16"></th>
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item</th>
                          {hasStatus && (
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[140px]">Status</th>
                          )}
                          {hasVersion && (
                            <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px]">Version</th>
                          )}
                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Remark</th>
                          <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
                        {normalizedValue.map((item, index) => {
                          const getStatusColor = (status: string) => {
                            switch (status) {
                              case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
                              case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
                              case 'On HOLD': return 'bg-amber-100 text-amber-800 border-amber-200';
                              case 'On Hold': return 'bg-amber-100 text-amber-800 border-amber-200'; // Legacy support
                              default: return 'bg-gray-100 text-gray-800 border-gray-200';
                            }
                          };
                          
                          return (
                            <tr 
                              key={index} 
                              className={`transition-colors duration-150 ${
                                item.checked 
                                  ? 'bg-green-50/30 hover:bg-green-50/50' 
                                  : 'hover:bg-gray-50/50'
                              }`}
                            >
                              <td className="px-6 py-4">
                                <div className="relative flex items-center justify-start">
                                  <input
                                    type="checkbox"
                                    id={`${field.id}-checkbox-${index}`}
                                    checked={item.checked}
                                    onChange={(e) => {
                                      const newArray = [...normalizedValue];
                                      newArray[index] = { ...item, checked: e.target.checked };
                                      handleChange(field.id, newArray);
                                    }}
                                    className="sr-only"
                                  />
                                  <label
                                    htmlFor={`${field.id}-checkbox-${index}`}
                                    className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-200 ${
                                      item.checked
                                        ? 'bg-gray-900 border-gray-900 shadow-md scale-105'
                                        : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                    }`}
                                  >
                                    {item.checked && (
                                      <svg
                                        className="w-3.5 h-3.5 text-white"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={3}
                                          d="M5 13l4 4L19 7"
                                        />
                                      </svg>
                                    )}
                                  </label>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <input
                                  type="text"
                                  value={item.value}
                                  onChange={(e) => {
                                    const newArray = [...normalizedValue];
                                    newArray[index] = { ...item, value: e.target.value };
                                    handleChange(field.id, newArray);
                                  }}
                                  className={`w-full px-3 py-2 text-sm font-medium text-gray-900 bg-transparent border-0 border-b-2 rounded-none focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors ${
                                    item.checked ? 'line-through text-gray-500' : ''
                                  }`}
                                  placeholder="Enter item name..."
                                />
                              </td>
                              {hasStatus && (
                                <td className="px-6 py-4">
                                  <div className="relative group">
                                    <select
                                      value={item.status}
                                      onChange={(e) => {
                                        const newArray = [...normalizedValue];
                                        newArray[index] = { ...item, status: e.target.value };
                                        handleChange(field.id, newArray);
                                      }}
                                      className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 transition-all ${getStatusColor(item.status)}`}
                                    >
                                      {statusOptions.map((option) => (
                                        <option key={option} value={option} className="text-gray-900 py-2 bg-white">
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                </td>
                              )}
                              {hasVersion && (
                                <td className="px-6 py-4">
                                  <div className="relative group">
                                    <select
                                      value={item.version !== undefined ? item.version : defaultVersion}
                                      onChange={(e) => {
                                        const newArray = [...normalizedValue];
                                        newArray[index] = { ...item, version: parseInt(e.target.value, 10) };
                                        handleChange(field.id, newArray);
                                      }}
                                      className="w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 border-gray-200 bg-white text-gray-900 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 focus:border-gray-900 transition-all"
                                    >
                                      {availableVersions.map((versionOption) => (
                                        <option key={versionOption} value={versionOption} className="text-gray-900 py-2 bg-white">
                                          Version {versionOption}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                </td>
                              )}
                              <td className="px-6 py-4">
                                <input
                                  type="text"
                                  value={item.remark}
                                  onChange={(e) => {
                                    const newArray = [...normalizedValue];
                                    newArray[index] = { ...item, remark: e.target.value };
                                    handleChange(field.id, newArray);
                                  }}
                                  className="w-full px-3 py-2 text-sm text-gray-600 bg-transparent border-0 border-b-2 border-gray-200 rounded-none focus:outline-none focus:ring-0 focus:border-gray-400 transition-colors placeholder:text-gray-400"
                                  placeholder="Add remark..."
                                />
                              </td>
                              <td className="px-6 py-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const itemName = item.value || `item ${index + 1}`;
                                    showDeleteConfirmation(
                                      'multi_input',
                                      field.id,
                                      itemName,
                                      () => {
                                        const newArray = normalizedValue.filter((_, i) => i !== index);
                                        handleChange(field.id, newArray);
                                      },
                                      index
                                    );
                                  }}
                                  className="inline-flex items-center justify-center w-8 h-8 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 font-semibold text-xl leading-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                  title="Remove item"
                                >
                                  ×
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50/50">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-500">No items added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Use the input above to add your first item</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      case 'url':
        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-start justify-between">
              {renderFieldLabel(field)}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              <div className="relative">
                <input
                  type="url"
                  id={field.id}
                  value={value}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className={`input-field ${isValidUrl(value || '') ? 'pr-10 font-mono text-sm text-blue-700' : ''}`}
                  placeholder={field.placeholder || "https://example.com"}
                />
                {isValidUrl(value || '') && (
                  <a
                    href={normalizeUrl(value)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                    title="Open link in new tab"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-1.5">
            <div className="flex items-start justify-between">
              {renderFieldLabel(field)}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    notRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {notRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={notRelevant ? 'opacity-50 pointer-events-none' : ''}>
              <div className="relative group">
                <select
                  id={field.id}
                  value={value || ''}
                  onChange={(e) => handleChange(field.id, e.target.value)}
                  className="input-field appearance-none cursor-pointer pr-11 font-medium"
                >
                  <option value="" disabled className="text-gray-400">
                    {field.placeholder || `Select ${field.label.toLowerCase()}`}
                  </option>
                  {field.options?.map((option) => (
                    <option key={option} value={option} className="text-gray-900 py-2">
                      {option}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                  <div className="w-6 h-6 rounded-md bg-gray-100 group-hover:bg-gray-200 transition-colors duration-150 flex items-center justify-center">
                    <svg 
                      className="w-4 h-4 text-gray-600" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'multi_select': {
        const multiSelectNotRelevant = isFieldNotRelevant(field.id);
        return field.optionsSource === 'integrations' ? (
          <div key={field.id} className="space-y-4 md:col-span-2">
            <div className="flex items-center justify-between">
              <div className="flex-1"></div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiSelectNotRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    multiSelectNotRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {multiSelectNotRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={multiSelectNotRelevant ? 'opacity-50 pointer-events-none' : ''}>
              <IntegrationSelector
                field={field}
                value={value}
                integrations={integrations}
                onChange={(newValue) => {
                  handleChange(field.id, newValue);
                }}
                onRequirementStatusChange={(status) => {
                  // Store requirement status in form data
                  const statusFieldId = `${field.id}_requirementStatus`;
                  handleChange(statusFieldId, status);
                }}
                initialRequirementStatus={formData[`${field.id}_requirementStatus`] || {}}
                onRemoveRequest={(integrationId, integrationName, onConfirm) => {
                  showDeleteConfirmation('integration', field.id, integrationName, onConfirm);
                }}
                projectVersion={projectVersion}
                availableVersions={availableVersions}
                onVersionChange={(integrationId, version) => {
                  // Store integration versions
                  const versionsFieldId = `${field.id}_versions`;
                  const currentVersions = formData[versionsFieldId] || {};
                  handleChange(versionsFieldId, {
                    ...currentVersions,
                    [integrationId]: version,
                  });
                }}
                integrationVersions={formData[`${field.id}_versions`] || {}}
                onIntegrationStatusChange={(integrationId, status) => {
                  // Store integration statuses
                  const statusFieldId = `${field.id}_statuses`;
                  const currentStatuses = formData[statusFieldId] || {};
                  handleChange(statusFieldId, {
                    ...currentStatuses,
                    [integrationId]: status,
                  });
                }}
                integrationStatuses={formData[`${field.id}_statuses`] || {}}
                isLaunchChecklist={isLaunchChecklist}
              />
            </div>
          </div>
        ) : (
          // Fallback for non-integration multi_select
          <div key={field.id} className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold text-gray-900">
                {field.label}
                {isFieldRequired(field) && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={multiSelectNotRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    multiSelectNotRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {multiSelectNotRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={multiSelectNotRelevant ? 'opacity-50 pointer-events-none' : ''}>
              <p className="text-sm text-gray-500">Multi-select not implemented for static options</p>
            </div>
          </div>
        );
      }

      case 'group': {
        const groupFields = field.fields || [];
        const hasFullWidthFields = groupFields.some(f => f.type === 'textarea' || f.type === 'multi_input' || f.type === 'multi_select');
        const groupNotRelevant = isFieldNotRelevant(field.id);
        return (
          <div key={field.id} className="card p-6 md:col-span-2">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 flex-1">
                {field.label}
                {isFieldRequired(field) && <span className="text-red-500 ml-1">*</span>}
                {!isFieldRequired(field) && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
              </h3>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={groupNotRelevant}
                    onChange={(e) => handleNotRelevantToggle(field.id, e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-150 ${
                    groupNotRelevant
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}>
                    {groupNotRelevant && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className="text-xs font-medium">Not relevant</span>
                </label>
              </div>
            </div>
            <div className={groupNotRelevant ? 'opacity-50 pointer-events-none' : ''}>
            <div className={`${hasFullWidthFields ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}>
              {groupFields.map((subField) => {
                const subValue = value?.[subField.id] ?? getDefaultValue(subField.type);
                const isSubFieldFullWidth = subField.type === 'textarea' || subField.type === 'multi_input' || subField.type === 'multi_select';
                const isIntegrationSelector = subField.type === 'multi_select' && subField.optionsSource === 'integrations';
                return (
                  <div key={subField.id} className={`space-y-1.5 ${isSubFieldFullWidth ? 'md:col-span-2' : ''}`}>
                    {!isIntegrationSelector && renderFieldLabel(subField, `${field.id}.${subField.id}`)}
                    {subField.type === 'textarea' ? (
                      (() => {
                        const hasVersion = subField.hasVersion === true || ['devComments', 'externalCommunications', 'remarks'].includes(subField.id);
                        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                        
                        // Normalize value for versioned fields - store as array
                        const normalizeValue = (val: any): Array<{ value: string; version: number }> | string => {
                          if (!hasVersion) {
                            return val || '';
                          }
                          
                          if (Array.isArray(val)) {
                            return val.map((item: any) => {
                              if (typeof item === 'string') {
                                return { value: item, version: defaultVersion };
                              }
                              return { 
                                value: item.value || '', 
                                version: item.version !== undefined ? item.version : defaultVersion 
                              };
                            });
                          }
                          
                          if (typeof val === 'object' && val !== null && 'value' in val) {
                            return [{ value: val.value || '', version: val.version !== undefined ? val.version : defaultVersion }];
                          }
                          
                          if (typeof val === 'string' && val) {
                            return [{ value: val, version: defaultVersion }];
                          }
                          
                          return [];
                        };
                        
                        const normalizedValue = normalizeValue(subValue);
                        const isArray = hasVersion && Array.isArray(normalizedValue);
                        const items = isArray ? normalizedValue : [];
                        
                        return (
                          <div className="space-y-4">
                            {hasVersion ? (
                              <>
                                {items.length > 0 && (
                                  <div className="space-y-2">
                                    {items.map((item: any, index: number) => (
                                      <div key={index} className="flex items-start gap-2 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group">
                                        <div className="flex-1 min-w-0">
                                          <textarea
                                            value={item.value || ''}
                                            onChange={(e) => {
                                              const currentGroupValue = formData[field.id] || {};
                                              const newItems = [...items];
                                              newItems[index] = { ...item, value: e.target.value };
                                              handleChange(field.id, {
                                                ...currentGroupValue,
                                                [subField.id]: newItems,
                                              });
                                            }}
                                            rows={3}
                                            className="w-full px-2 py-1.5 text-sm text-gray-900 bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors resize-y"
                                            placeholder={subField.placeholder || `Enter ${subField.label.toLowerCase()}`}
                                          />
                                        </div>
                                        <div className="flex items-start gap-1.5 flex-shrink-0 pt-1">
                                          <div className="relative">
                                            <select
                                              value={item.version !== undefined ? item.version : defaultVersion}
                                              onChange={(e) => {
                                                const currentGroupValue = formData[field.id] || {};
                                                const newItems = [...items];
                                                newItems[index] = { ...item, version: parseInt(e.target.value, 10) };
                                                handleChange(field.id, {
                                                  ...currentGroupValue,
                                                  [subField.id]: newItems,
                                                });
                                              }}
                                              className="px-2 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all hover:border-gray-400"
                                            >
                                              {availableVersions.map((versionOption) => (
                                                <option key={versionOption} value={versionOption} className="text-gray-900">
                                                  v{versionOption}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                                              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentGroupValue = formData[field.id] || {};
                                              const newItems = items.filter((_, i) => i !== index);
                                              handleChange(field.id, {
                                                ...currentGroupValue,
                                                [subField.id]: newItems,
                                              });
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddEntryModal({
                                      isOpen: true,
                                      fieldId: `${field.id}.${subField.id}`,
                                      fieldType: 'textarea',
                                      placeholder: `Add new ${subField.label.toLowerCase()}...`,
                                      isNested: true,
                                      parentFieldId: field.id,
                                      subFieldId: subField.id,
                                      onAdd: (newValue: string, version: number) => {
                                        const currentGroupValue = formData[field.id] || {};
                                        const newItems = [...items, { value: newValue, version }];
                                        handleChange(field.id, {
                                          ...currentGroupValue,
                                          [subField.id]: newItems,
                                        });
                                      },
                                    });
                                  }}
                                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {subField.label.toLowerCase()}
                                </button>
                              </>
                            ) : (
                              <textarea
                                id={`${field.id}.${subField.id}`}
                                value={subValue || ''}
                                onChange={(e) => {
                                  handleChange(field.id, {
                                    ...(value || {}),
                                    [subField.id]: e.target.value,
                                  });
                                }}
                                className="input-field resize-y"
                                rows={4}
                                placeholder={subField.placeholder || `Enter ${subField.label.toLowerCase()}`}
                              />
                            )}
                          </div>
                        );
                      })()
                    ) : subField.type === 'text' ? (
                      (() => {
                        const hasVersion = subField.hasVersion === true || ['devComments', 'externalCommunications', 'remarks'].includes(subField.id);
                        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                        
                        // Normalize value for versioned fields - store as array
                        const normalizeValue = (val: any): Array<{ value: string; version: number }> | string => {
                          if (!hasVersion) {
                            return val || '';
                          }
                          
                          if (Array.isArray(val)) {
                            return val.map((item: any) => {
                              if (typeof item === 'string') {
                                return { value: item, version: defaultVersion };
                              }
                              return { 
                                value: item.value || '', 
                                version: item.version !== undefined ? item.version : defaultVersion 
                              };
                            });
                          }
                          
                          if (typeof val === 'object' && val !== null && 'value' in val) {
                            return [{ value: val.value || '', version: val.version !== undefined ? val.version : defaultVersion }];
                          }
                          
                          if (typeof val === 'string' && val) {
                            return [{ value: val, version: defaultVersion }];
                          }
                          
                          return [];
                        };
                        
                        const normalizedValue = normalizeValue(subValue);
                        const isArray = hasVersion && Array.isArray(normalizedValue);
                        const items = isArray ? normalizedValue : [];
                        
                        return (
                          <div className="space-y-4">
                            {hasVersion ? (
                              <>
                                {items.length > 0 && (
                                  <div className="space-y-2">
                                    {items.map((item: any, index: number) => (
                                      <div key={index} className="flex items-center gap-2 p-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors group">
                                        <div className="flex-1 min-w-0 relative">
                                          <input
                                            type="text"
                                            value={item.value || ''}
                                            onChange={(e) => {
                                              const currentGroupValue = formData[field.id] || {};
                                              const newItems = [...items];
                                              newItems[index] = { ...item, value: e.target.value };
                                              handleChange(field.id, {
                                                ...currentGroupValue,
                                                [subField.id]: newItems,
                                              });
                                            }}
                                            className={`w-full px-2 py-1.5 text-sm bg-transparent border-0 border-b border-gray-200 focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors ${
                                              isValidUrl(item.value || '') 
                                                ? 'pr-8 font-mono text-blue-700 font-medium' 
                                                : 'font-medium text-gray-900'
                                            }`}
                                            placeholder={subField.placeholder || `Enter ${subField.label.toLowerCase()}`}
                                          />
                                          {isValidUrl(item.value || '') && (
                                            <a
                                              href={normalizeUrl(item.value)}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="absolute right-1 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                                              title="Open link in new tab"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                              </svg>
                                            </a>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <div className="relative">
                                            <select
                                              value={item.version !== undefined ? item.version : defaultVersion}
                                              onChange={(e) => {
                                                const currentGroupValue = formData[field.id] || {};
                                                const newItems = [...items];
                                                newItems[index] = { ...item, version: parseInt(e.target.value, 10) };
                                                handleChange(field.id, {
                                                  ...currentGroupValue,
                                                  [subField.id]: newItems,
                                                });
                                              }}
                                              className="px-2 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 appearance-none cursor-pointer pr-6 focus:outline-none focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all hover:border-gray-400"
                                            >
                                              {availableVersions.map((versionOption) => (
                                                <option key={versionOption} value={versionOption} className="text-gray-900">
                                                  v{versionOption}
                                                </option>
                                              ))}
                                            </select>
                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-1">
                                              <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                              </svg>
                                            </div>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const currentGroupValue = formData[field.id] || {};
                                              const newItems = items.filter((_, i) => i !== index);
                                              handleChange(field.id, {
                                                ...currentGroupValue,
                                                [subField.id]: newItems,
                                              });
                                            }}
                                            className="p-1 text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove"
                                          >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAddEntryModal({
                                      isOpen: true,
                                      fieldId: `${field.id}.${subField.id}`,
                                      fieldType: 'text',
                                      placeholder: `Add new ${subField.label.toLowerCase()}...`,
                                      isNested: true,
                                      parentFieldId: field.id,
                                      subFieldId: subField.id,
                                      onAdd: (newValue: string, version: number) => {
                                        const currentGroupValue = formData[field.id] || {};
                                        const newItems = [...items, { value: newValue, version }];
                                        handleChange(field.id, {
                                          ...currentGroupValue,
                                          [subField.id]: newItems,
                                        });
                                      },
                                    });
                                  }}
                                  className="w-full px-4 py-2.5 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add {subField.label.toLowerCase()}
                                </button>
                              </>
                            ) : (
                              <div className="relative">
                                <input
                                  type="text"
                                  id={`${field.id}.${subField.id}`}
                                  value={subValue || ''}
                                  onChange={(e) => {
                                    handleChange(field.id, {
                                      ...(value || {}),
                                      [subField.id]: e.target.value,
                                    });
                                  }}
                                  className={`input-field ${isValidUrl(subValue || '') ? 'pr-10 font-mono text-sm text-blue-700' : ''}`}
                                  placeholder={subField.placeholder || `Enter ${subField.label.toLowerCase()}`}
                                />
                                {isValidUrl(subValue || '') && (
                                  <a
                                    href={normalizeUrl(subValue)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors"
                                    title="Open link in new tab"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : subField.type === 'select' ? (
                      <div className="relative group">
                        <select
                          id={`${field.id}.${subField.id}`}
                          value={subValue || ''}
                          onChange={(e) => {
                            handleChange(field.id, {
                              ...(value || {}),
                              [subField.id]: e.target.value,
                            });
                          }}
                          className="input-field appearance-none cursor-pointer pr-11 font-medium"
                        >
                          <option value="" disabled className="text-gray-400">
                            Select {subField.label.toLowerCase()}
                          </option>
                          {subField.options?.map((option) => (
                            <option key={option} value={option} className="text-gray-900 py-2">
                              {option}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                          <div className="w-6 h-6 rounded-md bg-gray-100 group-hover:bg-gray-200 transition-colors duration-150 flex items-center justify-center">
                            <svg 
                              className="w-4 h-4 text-gray-600" 
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : subField.type === 'checkbox' ? (
                      <div className="flex items-start space-x-3 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-all duration-150">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            id={`${field.id}.${subField.id}`}
                            checked={subValue === true}
                            onChange={(e) => {
                              handleChange(field.id, {
                                ...(value || {}),
                                [subField.id]: e.target.checked,
                              });
                            }}
                            className="sr-only"
                          />
                          <label
                            htmlFor={`${field.id}.${subField.id}`}
                            className={`relative flex items-center justify-center w-6 h-6 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                              subValue === true
                                ? 'bg-gray-900 border-gray-900 shadow-sm'
                                : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {subValue === true && (
                              <svg
                                className="w-4 h-4 text-white"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={3}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </label>
                        </div>
                        <label htmlFor={`${field.id}.${subField.id}`} className="text-sm font-semibold text-gray-900 cursor-pointer flex-1 pt-0.5">
                          {subField.label}
                          {!isFieldRequired(subField) && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
                        </label>
                      </div>
                    ) : subField.type === 'multi_input' ? (
                      (() => {
                        const hasStatus = subField.hasStatus === true;
                        const hasVersion = subField.hasVersion === true || ['integrationsCredentials', 'customFeatures', 'changeRequests'].includes(subField.id);
                        // Use same status options as project status for consistency
                        const statusOptions = ['Not Started', 'In Progress', 'On HOLD', 'Completed'];
                        
                        // Normalize value: convert string[] to {value, status, checked, remark, version}[]
                        // Use first available version (1) as default, not projectVersion, so items don't change when project version changes
                        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                        const normalizeValue = (val: any): Array<{ value: string; status: string; checked: boolean; remark: string; version?: number }> => {
                          if (!Array.isArray(val)) return [];
                          return val.map((item: any) => {
                            if (typeof item === 'string') {
                              return { value: item, status: 'Not Started', checked: false, remark: '', version: hasVersion ? defaultVersion : undefined };
                            }
                            // Preserve existing version if it exists, otherwise use defaultVersion (not projectVersion)
                            return { 
                              value: item.value || '', 
                              status: item.status || 'Not Started',
                              checked: item.checked || false,
                              remark: item.remark || '',
                              version: hasVersion ? (item.version !== undefined ? item.version : defaultVersion) : undefined
                            };
                          });
                        };
                        
                        const normalizedValue = normalizeValue(subValue);
                        const fieldKey = `${field.id}.${subField.id}`;
                        
                        return (
                          <div className="space-y-4">
                            {/* Add Item Input */}
                            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                              <div className="flex gap-3">
                                <input
                                  type="text"
                                  id={`${fieldKey}-new-item`}
                                  placeholder={`Add new ${subField.label.toLowerCase()}...`}
                                  className="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all placeholder:text-gray-400"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const input = e.target as HTMLInputElement;
                                      const newValue = input.value.trim();
                                      if (newValue) {
                                        const defaultVersion = availableVersions.length > 0 ? availableVersions[0] : 1;
                                        const newItem = { 
                                          value: newValue, 
                                          status: 'Not Started', 
                                          checked: false, 
                                          remark: '',
                                          ...(hasVersion ? { version: defaultVersion } : {})
                                        };
                                        handleChange(field.id, {
                                          ...(value || {}),
                                          [subField.id]: [...normalizedValue, newItem],
                                        });
                                        input.value = '';
                                      }
                                    }
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const input = document.getElementById(`${fieldKey}-new-item`) as HTMLInputElement;
                                    const newValue = input?.value.trim();
                                    if (newValue) {
                                      const newItem = { 
                                        value: newValue, 
                                        status: 'Not Started', 
                                        checked: false, 
                                        remark: '' 
                                      };
                                      handleChange(field.id, {
                                        ...(value || {}),
                                        [subField.id]: [...normalizedValue, newItem],
                                      });
                                      if (input) input.value = '';
                                    }
                                  }}
                                  className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                  </svg>
                                  Add Item
                                </button>
                              </div>
                            </div>

                            {/* Table View */}
                            {normalizedValue.length > 0 ? (
                              <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b-2 border-gray-200">
                                      <tr>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-16"></th>
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Item</th>
                                        {hasStatus && (
                                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[140px]">Status</th>
                                        )}
                                        {hasVersion && (
                                          <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider min-w-[120px]">Version</th>
                                        )}
                                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Remark</th>
                                        <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider w-24">Actions</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                      {normalizedValue.map((item, index) => {
                                        const getStatusColor = (status: string) => {
                                          switch (status) {
                                            case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
                                            case 'In Progress': return 'bg-blue-100 text-blue-800 border-blue-200';
                                            case 'On Hold': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                                            default: return 'bg-gray-100 text-gray-800 border-gray-200';
                                          }
                                        };
                                        
                                        return (
                                          <tr 
                                            key={index} 
                                            className={`transition-colors duration-150 ${
                                              item.checked 
                                                ? 'bg-green-50/30 hover:bg-green-50/50' 
                                                : 'hover:bg-gray-50/50'
                                            }`}
                                          >
                                            <td className="px-6 py-4">
                                              <div className="relative flex items-center justify-start">
                                                <input
                                                  type="checkbox"
                                                  id={`${fieldKey}-checkbox-${index}`}
                                                  checked={item.checked}
                                                  onChange={(e) => {
                                                    const newArray = [...normalizedValue];
                                                    newArray[index] = { ...item, checked: e.target.checked };
                                                    handleChange(field.id, {
                                                      ...(value || {}),
                                                      [subField.id]: newArray,
                                                    });
                                                  }}
                                                  className="sr-only"
                                                />
                                                <label
                                                  htmlFor={`${fieldKey}-checkbox-${index}`}
                                                  className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all duration-200 ${
                                                    item.checked
                                                      ? 'bg-gray-900 border-gray-900 shadow-md scale-105'
                                                      : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                                                  }`}
                                                >
                                                  {item.checked && (
                                                    <svg
                                                      className="w-3.5 h-3.5 text-white"
                                                      fill="none"
                                                      stroke="currentColor"
                                                      viewBox="0 0 24 24"
                                                    >
                                                      <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={3}
                                                        d="M5 13l4 4L19 7"
                                                      />
                                                    </svg>
                                                  )}
                                                </label>
                                              </div>
                                            </td>
                                            <td className="px-6 py-4">
                                              <input
                                                type="text"
                                                value={item.value}
                                                onChange={(e) => {
                                                  const newArray = [...normalizedValue];
                                                  newArray[index] = { ...item, value: e.target.value };
                                                  handleChange(field.id, {
                                                    ...(value || {}),
                                                    [subField.id]: newArray,
                                                  });
                                                }}
                                                className={`w-full px-3 py-2 text-sm font-medium text-gray-900 bg-transparent border-0 border-b-2 rounded-none focus:outline-none focus:ring-0 focus:border-gray-900 transition-colors ${
                                                  item.checked ? 'line-through text-gray-500' : ''
                                                }`}
                                                placeholder="Enter item name..."
                                              />
                                            </td>
                                            {hasStatus && (
                                              <td className="px-6 py-4">
                                                <div className="relative group">
                                                  <select
                                                    value={item.status}
                                                    onChange={(e) => {
                                                      const newArray = [...normalizedValue];
                                                      newArray[index] = { ...item, status: e.target.value };
                                                      handleChange(field.id, {
                                                        ...(value || {}),
                                                        [subField.id]: newArray,
                                                      });
                                                    }}
                                                    className={`w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 transition-all ${getStatusColor(item.status)}`}
                                                  >
                                                    {statusOptions.map((option) => (
                                                      <option key={option} value={option} className="text-gray-900 py-2 bg-white">
                                                        {option}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                  </div>
                                                </div>
                                              </td>
                                            )}
                                            {hasVersion && (
                                              <td className="px-6 py-4">
                                                <div className="relative group">
                                                  <select
                                                    value={item.version !== undefined ? item.version : defaultVersion}
                                                    onChange={(e) => {
                                                      const newArray = [...normalizedValue];
                                                      newArray[index] = { ...item, version: parseInt(e.target.value, 10) };
                                                      handleChange(field.id, {
                                                        ...(value || {}),
                                                        [subField.id]: newArray,
                                                      });
                                                    }}
                                                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 border-gray-200 bg-white text-gray-900 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1 focus:border-gray-900 transition-all"
                                                  >
                                                    {availableVersions.map((versionOption) => (
                                                      <option key={versionOption} value={versionOption} className="text-gray-900 py-2 bg-white">
                                                        Version {versionOption}
                                                      </option>
                                                    ))}
                                                  </select>
                                                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                                    <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                  </div>
                                                </div>
                                              </td>
                                            )}
                                            <td className="px-6 py-4">
                                              <input
                                                type="text"
                                                value={item.remark}
                                                onChange={(e) => {
                                                  const newArray = [...normalizedValue];
                                                  newArray[index] = { ...item, remark: e.target.value };
                                                  handleChange(field.id, {
                                                    ...(value || {}),
                                                    [subField.id]: newArray,
                                                  });
                                                }}
                                                className="w-full px-3 py-2 text-sm text-gray-600 bg-transparent border-0 border-b-2 border-gray-200 rounded-none focus:outline-none focus:ring-0 focus:border-gray-400 transition-colors placeholder:text-gray-400"
                                                placeholder="Add remark..."
                                              />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const itemName = item.value || `item ${index + 1}`;
                                                  showDeleteConfirmation(
                                                    'multi_input',
                                                    `${field.id}.${subField.id}`,
                                                    itemName,
                                                    () => {
                                                      const newArray = normalizedValue.filter((_, i) => i !== index);
                                                      handleChange(field.id, {
                                                        ...(value || {}),
                                                        [subField.id]: newArray,
                                                      });
                                                    },
                                                    index
                                                  );
                                                }}
                                                className="inline-flex items-center justify-center w-8 h-8 text-red-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 font-semibold text-xl leading-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                                                title="Remove item"
                                              >
                                                ×
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : (
                              <div className="border-2 border-dashed border-gray-200 rounded-xl p-12 text-center bg-gray-50/50">
                                <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-sm font-medium text-gray-500">No items added yet</p>
                                <p className="text-xs text-gray-400 mt-1">Use the input above to add your first item</p>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    ) : subField.type === 'multi_select' && subField.optionsSource === 'integrations' ? (
                      <IntegrationSelector
                        field={subField}
                        value={subValue}
                        integrations={integrations}
                        onChange={(newValue) => {
                          handleChange(field.id, {
                            ...(value || {}),
                            [subField.id]: newValue,
                          });
                        }}
                        onRequirementStatusChange={(status) => {
                          // Store requirement status in form data within the group
                          const statusFieldId = `${subField.id}_requirementStatus`;
                          handleChange(field.id, {
                            ...(value || {}),
                            [statusFieldId]: status,
                          });
                        }}
                        initialRequirementStatus={value?.[`${subField.id}_requirementStatus`] || {}}
                        onRemoveRequest={(integrationId, integrationName, onConfirm) => {
                          showDeleteConfirmation('integration', `${field.id}.${subField.id}`, integrationName, onConfirm);
                        }}
                        projectVersion={projectVersion}
                        availableVersions={availableVersions}
                        onVersionChange={(integrationId, version) => {
                          // Store integration versions within the group
                          const versionsFieldId = `${subField.id}_versions`;
                          const currentVersions = value?.[versionsFieldId] || {};
                          handleChange(field.id, {
                            ...(value || {}),
                            [versionsFieldId]: {
                              ...currentVersions,
                              [integrationId]: version,
                            },
                          });
                        }}
                        integrationVersions={value?.[`${subField.id}_versions`] || {}}
                        onIntegrationStatusChange={(integrationId, status) => {
                          // Store integration statuses within the group
                          const statusesFieldId = `${subField.id}_statuses`;
                          const currentStatuses = value?.[statusesFieldId] || {};
                          handleChange(field.id, {
                            ...(value || {}),
                            [statusesFieldId]: {
                              ...currentStatuses,
                              [integrationId]: status,
                            },
                          });
                        }}
                        integrationStatuses={value?.[`${subField.id}_statuses`] || {}}
                        isLaunchChecklist={isLaunchChecklist}
                      />
                    ) : (
                      <input
                        type="text"
                        id={`${field.id}.${subField.id}`}
                        value={subValue}
                        onChange={(e) => {
                          handleChange(field.id, {
                            ...(value || {}),
                            [subField.id]: e.target.value,
                          });
                        }}
                        className="input-field"
                        placeholder={subField.placeholder || `Enter ${subField.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const getDefaultValue = (type: FieldType): any => {
    switch (type) {
      case 'checkbox':
        return false;
      case 'multi_input':
      case 'multi_select':
        return [];
      case 'group':
        return {};
      case 'select':
        return '';
      default:
        return '';
    }
  };

  return (
    <div className="relative">
      <form id="dynamic-form" onSubmit={handleSubmit} className="space-y-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {fields.map(renderField)}
        </div>
        <div className="text-xs text-gray-500 pt-4">
          <span className="font-semibold">Note:</span> Fields marked as optional can be skipped
        </div>
      </form>
      
      {/* Sticky Save Button */}
      <div className="fixed bottom-0 left-64 right-0 z-30 bg-white border-t-2 border-gray-200 shadow-lg px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Don&apos;t forget to save your changes</span>
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <svg className="w-4 h-4 text-amber-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-semibold text-amber-700">You have unsaved changes</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              const form = document.getElementById('dynamic-form') as HTMLFormElement;
              if (form) {
                form.requestSubmit();
              }
            }}
            disabled={loading}
            className={`btn-primary min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed shadow-md ${hasUnsavedChanges ? 'ring-2 ring-amber-400 ring-offset-2' : ''}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {submitLabel}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm?.isOpen || false}
        title={
          deleteConfirm?.type === 'integration'
            ? 'Remove Integration?'
            : 'Remove Item?'
        }
        message={
          deleteConfirm?.type === 'integration'
            ? `Are you sure you want to remove "${deleteConfirm.itemName}"? This action cannot be undone.`
            : `Are you sure you want to remove "${deleteConfirm?.itemName}"? This action cannot be undone.`
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Add Entry Modal */}
      {addEntryModal && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${addEntryModal.isOpen ? '' : 'hidden'}`}>
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setAddEntryModal(null)}></div>
          <div className="relative bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Add New Entry</h3>
            </div>
            <div className="px-6 py-4 flex-1 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Content</label>
                  {addEntryModal.fieldType === 'textarea' ? (
                    <textarea
                      id="modal-entry-textarea"
                      placeholder={addEntryModal.placeholder}
                      className="w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all placeholder:text-gray-400 resize-y"
                      rows={6}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          e.preventDefault();
                          const textarea = e.target as HTMLTextAreaElement;
                          const newValue = textarea.value.trim();
                          if (newValue) {
                            addEntryModal.onAdd(newValue, availableVersions[0] || 1);
                            setAddEntryModal(null);
                          }
                        }
                      }}
                    />
                  ) : (
                    <input
                      type="text"
                      id="modal-entry-input"
                      placeholder={addEntryModal.placeholder}
                      className="w-full px-4 py-3 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all placeholder:text-gray-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const input = e.target as HTMLInputElement;
                          const newValue = input.value.trim();
                          if (newValue) {
                            addEntryModal.onAdd(newValue, availableVersions[0] || 1);
                            setAddEntryModal(null);
                          }
                        }
                      }}
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Version</label>
                  <div className="relative">
                    <select
                      id="modal-entry-version"
                      defaultValue={availableVersions[0] || 1}
                      className="w-full px-4 py-2.5 text-sm font-medium rounded-lg border border-gray-300 bg-white text-gray-900 appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                    >
                      {availableVersions.map((versionOption) => (
                        <option key={versionOption} value={versionOption} className="text-gray-900">
                          Version {versionOption}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setAddEntryModal(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = addEntryModal.fieldType === 'textarea' 
                    ? document.getElementById('modal-entry-textarea') as HTMLTextAreaElement
                    : document.getElementById('modal-entry-input') as HTMLInputElement;
                  const versionSelect = document.getElementById('modal-entry-version') as HTMLSelectElement;
                  const newValue = input.value.trim();
                  if (newValue) {
                    addEntryModal.onAdd(newValue, parseInt(versionSelect.value, 10));
                    setAddEntryModal(null);
                  }
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-gray-900 rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

