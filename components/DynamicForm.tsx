'use client';

import React, { useState, useEffect } from 'react';
import { FieldConfig, FieldType } from '@/types';

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

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
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

  const renderField = (field: FieldConfig) => {
    const value = formData[field.id] ?? getDefaultValue(field.type);
    const isFullWidth = field.type === 'group' || field.type === 'multi_input' || field.type === 'textarea';
    const isCheckbox = field.type === 'checkbox';

    switch (field.type) {
      case 'checkbox':
        return (
          <div key={field.id} className="flex items-start space-x-3 py-3 px-4 rounded-xl bg-gray-50 border border-gray-200 md:col-span-2 hover:bg-gray-100 hover:border-gray-300 transition-all duration-150">
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
                    ? 'bg-blue-600 border-blue-600 shadow-sm'
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
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
          </div>
        );

      case 'text':
        return (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={field.id} className="block text-sm font-bold text-gray-900">
              {field.label}
              {!field.optional && <span className="text-red-500 ml-1">*</span>}
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
            <input
              type="text"
              id={field.id}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="input-field"
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-1.5 md:col-span-2">
            <label htmlFor={field.id} className="block text-sm font-bold text-gray-900">
              {field.label}
              {!field.optional && <span className="text-red-500 ml-1">*</span>}
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
            <textarea
              id={field.id}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              rows={4}
              className="input-field resize-y"
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          </div>
        );

      case 'multi_input':
        return (
          <div key={field.id} className="space-y-1.5 md:col-span-2">
            <label className="block text-sm font-bold text-gray-900">
              {field.label}
              {!field.optional && <span className="text-red-500 ml-1">*</span>}
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
            <div className="space-y-3">
              {(value as string[]).map((item, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const newArray = [...(value as string[])];
                      newArray[index] = e.target.value;
                      handleChange(field.id, newArray);
                    }}
                    className="flex-1 input-field"
                    placeholder={`Item ${index + 1}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newArray = (value as string[]).filter((_, i) => i !== index);
                      handleChange(field.id, newArray);
                    }}
                    className="px-4 py-2.5 bg-red-50 text-red-700 font-semibold rounded-lg border border-red-200 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all duration-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  handleChange(field.id, [...(value as string[]), '']);
                }}
                className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 font-semibold rounded-lg border border-gray-200 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Item
              </button>
            </div>
          </div>
        );

      case 'url':
        return (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={field.id} className="block text-sm font-bold text-gray-900">
              {field.label}
              {!field.optional && <span className="text-red-500 ml-1">*</span>}
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
            <input
              type="url"
              id={field.id}
              value={value}
              onChange={(e) => handleChange(field.id, e.target.value)}
              className="input-field"
              placeholder="https://example.com"
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-1.5">
            <label htmlFor={field.id} className="block text-sm font-bold text-gray-900">
              {field.label}
              {!field.optional && <span className="text-red-500 ml-1">*</span>}
              {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
            </label>
            <div className="relative group">
              <select
                id={field.id}
                value={value || ''}
                onChange={(e) => handleChange(field.id, e.target.value)}
                className="input-field appearance-none cursor-pointer pr-11 font-medium"
              >
                <option value="" disabled className="text-gray-400">
                  Select {field.label.toLowerCase()}
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
        );

      case 'group':
        const groupFields = field.fields || [];
        const hasFullWidthFields = groupFields.some(f => f.type === 'textarea' || f.type === 'multi_input');
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
                {!field.optional && <span className="text-red-500 ml-1">*</span>}
                {field.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
              </h3>
            </div>
            <div className={`${hasFullWidthFields ? 'space-y-4' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}`}>
              {groupFields.map((subField) => {
                const subValue = value?.[subField.id] ?? getDefaultValue(subField.type);
                const isSubFieldFullWidth = subField.type === 'textarea' || subField.type === 'multi_input';
                return (
                  <div key={subField.id} className={`space-y-1.5 ${isSubFieldFullWidth ? 'md:col-span-2' : ''}`}>
                    <label htmlFor={`${field.id}.${subField.id}`} className="block text-sm font-bold text-gray-900">
                      {subField.label}
                      {!subField.optional && <span className="text-red-500 ml-1">*</span>}
                      {subField.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
                    </label>
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
                        placeholder={`Enter ${subField.label.toLowerCase()}`}
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
                                ? 'bg-blue-600 border-blue-600 shadow-sm'
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
                          {subField.optional && <span className="text-gray-500 ml-2 font-normal text-xs">(optional)</span>}
                        </label>
                      </div>
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
                        placeholder={`Enter ${subField.label.toLowerCase()}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getDefaultValue = (type: FieldType): any => {
    switch (type) {
      case 'checkbox':
        return false;
      case 'multi_input':
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
    </div>
  );
};

