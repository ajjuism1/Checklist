'use client';

import React, { useEffect, useState } from 'react';
import { FieldConfig, Integration } from '@/types';
import { FlattenedField } from '@/lib/firebase/firestore';

interface ChecklistStatusProps {
  field: FieldConfig | FlattenedField;
  value: any;
  showValue?: boolean;
  requirementStatus?: Record<string, Record<string, boolean>>;
  isLaunch?: boolean;
  integrations?: Integration[];
  notRelevant?: boolean;
}

export const ChecklistStatus: React.FC<ChecklistStatusProps> = ({
  field,
  value,
  showValue = false,
  requirementStatus = {},
  isLaunch = false,
  integrations = [],
  notRelevant = false,
}) => {
  const flattenedField = field as FlattenedField;
  const isSubField = flattenedField.isSubField || false;
  const groupLabel = flattenedField.groupLabel;
  const [localIntegrations, setLocalIntegrations] = useState<Integration[]>(integrations);

  // Load integrations if not provided and needed
  useEffect(() => {
    if (integrations.length > 0) {
      setLocalIntegrations(integrations);
    } else if (field.type === 'multi_select' && field.optionsSource === 'integrations' && isLaunch) {
      const loadIntegrations = async () => {
        try {
          const response = await fetch('/integrations.json');
          if (response.ok) {
            const data = await response.json();
            setLocalIntegrations(data as Integration[]);
          }
        } catch (error) {
          console.error('Error loading integrations:', error);
        }
      };
      loadIntegrations();
    }
  }, [field.type, field.optionsSource, isLaunch, integrations]);

  const checkIntegrationRequirements = (
    selectedIntegrationIds: string[],
    reqStatus: Record<string, Record<string, boolean>>,
    integs: Integration[]
  ): boolean => {
    if (!Array.isArray(selectedIntegrationIds) || selectedIntegrationIds.length === 0) {
      return false;
    }
    
    // Check each selected integration
    for (const integrationId of selectedIntegrationIds) {
      const integration = integs.find(integ => integ.id === integrationId);
      if (!integration) continue;
      
      // If integration has requirements, all must be checked
      if (integration.requirements && integration.requirements.length > 0) {
        const status = reqStatus[integrationId] || {};
        const allChecked = integration.requirements.every(req => status[req] === true);
        if (!allChecked) {
          return false;
        }
      }
    }
    
    return true;
  };

  const isCompleted = () => {
    if (value === null || value === undefined || value === '') {
      return false;
    }

    switch (field.type) {
      case 'checkbox':
        return value === true;
      case 'multi_input':
        // For launch checklist, all items must be filled
        if (isLaunch) {
          return Array.isArray(value) && value.length > 0 && value.every(item => item && item.toString().trim() !== '');
        }
        return Array.isArray(value) && value.length > 0;
      case 'multi_select':
        // For launch checklist with integrations, check requirement status
        if (isLaunch && field.optionsSource === 'integrations') {
          const selectedIds = Array.isArray(value) ? value : [];
          return checkIntegrationRequirements(selectedIds, requirementStatus, localIntegrations);
        }
        // For sales or non-integration multi_select, just check if items are selected
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

  if (notRelevant) {
    return (
      <div className="flex items-center gap-3 opacity-60 bg-gray-50 -mx-3 px-3 py-2 rounded-lg border border-gray-200">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-200 border-2 border-gray-400 flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {isSubField && groupLabel && (
            <div className="text-xs text-gray-400 font-medium mb-0.5">{groupLabel}</div>
          )}
          <span className="text-sm font-medium text-gray-500 line-through">{field.label}</span>
        </div>
        <span className="text-xs font-bold text-gray-700 bg-gray-300 px-3 py-1 rounded-md border border-gray-400 whitespace-nowrap">Not relevant</span>
      </div>
    );
  }

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

