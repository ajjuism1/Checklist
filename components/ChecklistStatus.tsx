'use client';

import React from 'react';
import { FieldConfig } from '@/types';
import { FlattenedField } from '@/lib/firebase/firestore';

interface ChecklistStatusProps {
  field: FieldConfig | FlattenedField;
  value: any;
  showValue?: boolean;
}

export const ChecklistStatus: React.FC<ChecklistStatusProps> = ({
  field,
  value,
  showValue = false,
}) => {
  const flattenedField = field as FlattenedField;
  const isSubField = flattenedField.isSubField || false;
  const groupLabel = flattenedField.groupLabel;

  const isCompleted = () => {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    switch (field.type) {
      case 'checkbox':
        return value === true;
      case 'multi_input':
        return Array.isArray(value) && value.length > 0;
      case 'group':
        if (typeof value === 'object' && value !== null) {
          return field.fields?.every((subField) => {
            const subValue = value[subField.id];
            return subValue && subValue.toString().trim() !== '';
          }) ?? false;
        }
        return false;
      default:
        return value && value.toString().trim() !== '';
    }
  };

  const completed = isCompleted();

  if (completed) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-100 border-2 border-green-500 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {isSubField && groupLabel && (
            <div className="text-xs text-gray-500 font-medium mb-0.5">{groupLabel}</div>
          )}
          <span className="text-sm font-semibold text-gray-900">{field.label}</span>
        </div>
        {showValue && value && (
          <span className="text-sm text-gray-600">
            {field.type === 'checkbox' ? '' : 
             field.type === 'group' ? '(Details provided)' :
             typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 border-2 border-gray-300 flex-shrink-0">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-400"></div>
      </div>
      <div className="flex-1 min-w-0">
        {isSubField && groupLabel && (
          <div className="text-xs text-gray-500 font-medium mb-0.5">{groupLabel}</div>
        )}
        <span className="text-sm font-medium text-gray-600">{field.label}</span>
      </div>
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">Pending</span>
    </div>
  );
};

