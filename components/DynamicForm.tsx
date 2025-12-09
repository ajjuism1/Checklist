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

// Integration Selector Component with Search and Table View
interface IntegrationSelectorProps {
  field: FieldConfig;
  value: any;
  integrations: Integration[];
  onChange: (selectedIds: string[]) => void;
  onRequirementStatusChange?: (status: Record<string, Record<string, boolean>>) => void;
  initialRequirementStatus?: Record<string, Record<string, boolean>>;
  onRemoveRequest?: (integrationId: string, integrationName: string, onConfirm: () => void) => void;
}

const IntegrationSelector: React.FC<IntegrationSelectorProps> = ({
  field,
  value,
  integrations,
  onChange,
  onRequirementStatusChange,
  initialRequirementStatus = {},
  onRemoveRequest,
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(Array.isArray(value) ? value : []);
  const [requirementStatus, setRequirementStatus] = useState<Record<string, Record<string, boolean>>>(initialRequirementStatus);

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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
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
                    <td className="px-4 py-3">
                      {integ.requirements && integ.requirements.length > 0 ? (
                        (() => {
                          const checkedCount = Object.values(requirementStatus[integ.id] || {}).filter(Boolean).length;
                          const totalCount = integ.requirements.length;
                          const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
                          return (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[100px]">
                                <div
                                  className={`h-2 rounded-full transition-all ${
                                    percentage === 100 ? 'bg-green-500' : percentage > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                  }`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 font-medium">{checkedCount}/{totalCount}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-xs text-gray-400">N/A</span>
                      )}
                    </td>
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
          <p className="text-sm text-gray-500">No integrations selected. Click "Select Integrations" to add them.</p>
        </div>
      )}

      {/* Search Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setIsDialogOpen(false)} />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
              <div className="bg-white px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Select Integrations</h3>
                  <button
                    type="button"
                    onClick={() => setIsDialogOpen(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search integrations by name, category, or requirements..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900"
                    />
                    <svg
                      className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>
              </div>
              <div className="bg-white px-6 py-4 max-h-[60vh] overflow-y-auto">
                {filteredIntegrations.length > 0 ? (
                  <div className="space-y-4">
                    {categories.map((category) => {
                      const categoryIntegrations = filteredIntegrations.filter(i => i.category === category);
                      if (categoryIntegrations.length === 0) return null;
                      return (
                        <div key={category}>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">{category}</h4>
                          <div className="space-y-2">
                            {categoryIntegrations.map((integ) => {
                              const isSelected = selectedIds.includes(integ.id);
                              return (
                                <div
                                  key={integ.id}
                                  className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all ${
                                    isSelected
                                      ? 'border-gray-400 bg-gray-50'
                                      : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <div className="relative flex items-center mt-0.5">
                                    <input
                                      type="checkbox"
                                      id={`dialog-${integ.id}`}
                                      checked={isSelected}
                                      onChange={() => handleToggleIntegration(integ.id)}
                                      className="sr-only"
                                    />
                                    <label
                                      htmlFor={`dialog-${integ.id}`}
                                      className={`relative flex items-center justify-center w-5 h-5 rounded border-2 cursor-pointer transition-all ${
                                        isSelected
                                          ? 'bg-gray-900 border-gray-900'
                                          : 'bg-white border-gray-300'
                                      }`}
                                    >
                                      {isSelected && (
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </label>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <label
                                      htmlFor={`dialog-${integ.id}`}
                                      className="text-sm font-semibold text-gray-900 cursor-pointer block"
                                    >
                                      {integ.name}
                                    </label>
                                    {integ.requirements && integ.requirements.length > 0 && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Requires: {integ.requirements.join(', ')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500">No integrations found matching "{searchQuery}"</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="font-semibold">{selectedIds.length}</span> integration{selectedIds.length !== 1 ? 's' : ''} selected
                </div>
                <button
                  type="button"
                  onClick={() => setIsDialogOpen(false)}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
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
}

export const DynamicForm: React.FC<DynamicFormProps> = ({
  fields,
  initialData = {},
  onSubmit,
  submitLabel = 'Save',
}) => {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [loading, setLoading] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'multi_input' | 'integration';
    fieldId: string;
    index?: number;
    itemName?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

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

      case 'text':
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
              <input
                type="text"
                id={field.id}
                value={value}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="input-field"
                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              />
            </div>
          </div>
        );

      case 'textarea':
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
              <textarea
                id={field.id}
                value={value}
                onChange={(e) => handleChange(field.id, e.target.value)}
                rows={4}
                className="input-field resize-y"
                placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
              />
            </div>
          </div>
        );

      case 'multi_input': {
        // Handle multi_input with status dropdowns (for Custom Features and Change Requests)
        const hasStatus = field.hasStatus === true;
        const statusOptions = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
        
        // Normalize value: convert string[] to {value, status, checked, remark}[] handle both formats
        const normalizeValue = (val: any): Array<{ value: string; status: string; checked: boolean; remark: string }> => {
          if (!Array.isArray(val)) return [];
          return val.map((item: any) => {
            if (typeof item === 'string') {
              return { value: item, status: 'Not Started', checked: false, remark: '' };
            }
            return { 
              value: item.value || '', 
              status: item.status || 'Not Started',
              checked: item.checked || false,
              remark: item.remark || ''
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
                          const newItem = { 
                            value: newValue, 
                            status: 'Not Started', 
                            checked: false, 
                            remark: '' 
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
              <input
                type="url"
                id={field.id}
                value={value}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="input-field"
                placeholder={field.placeholder || "https://example.com"}
              />
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
                      <textarea
                        id={`${field.id}.${subField.id}`}
                        value={subValue}
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
                        const statusOptions = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
                        
                        // Normalize value: convert string[] to {value, status, checked, remark}[]
                        const normalizeValue = (val: any): Array<{ value: string; status: string; checked: boolean; remark: string }> => {
                          if (!Array.isArray(val)) return [];
                          return val.map((item: any) => {
                            if (typeof item === 'string') {
                              return { value: item, status: 'Not Started', checked: false, remark: '' };
                            }
                            return { 
                              value: item.value || '', 
                              status: item.status || 'Not Started',
                              checked: item.checked || false,
                              remark: item.remark || ''
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
          <div className="text-sm text-gray-600">
            <span className="font-semibold">Don't forget to save your changes</span>
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
            className="btn-primary min-w-[200px] disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
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
    </div>
  );
};

