'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Skeleton } from '@/components/Skeleton';
import { getProject, getChecklistConfig, getIntegrations } from '@/lib/firebase/firestore';
import { Integration } from '@/types';
import { downloadMarkdown, generatePDF } from '@/lib/export/reportExport';
import { Project, ChecklistConfig } from '@/types';

export const dynamic = 'force-dynamic';

export default function HandoverReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [projectData, configData, integrationsData] = await Promise.all([
        getProject(projectId),
        getChecklistConfig(),
        getIntegrations(),
      ]);

      if (!projectData) {
        router.push('/projects');
        return;
      }

      setProject(projectData);
      setConfig(configData);
      setIntegrations(integrationsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValue = (fieldId: string, isSales: boolean, fieldConfig?: any) => {
    if (isSales) {
      // Check if it's a group field
      if (fieldConfig?.type === 'group' && fieldConfig?.id) {
        return project!.checklists.sales[fieldConfig.id] || {};
      }
      return project!.checklists.sales[fieldId] ?? 
        (fieldId === 'brandName' ? project!.brandName :
         fieldId === 'storeUrlMyShopify' ? project!.storeUrlMyShopify :
         fieldId === 'storePublicUrl' ? project!.storePublicUrl :
         fieldId === 'collabCode' ? project!.collabCode :
         fieldId === 'scopeOfWork' ? project!.scopeOfWork :
         fieldId === 'designRefs' ? project!.designRefs :
         fieldId === 'additionalDocs' ? project!.additionalDocs :
         fieldId === 'paymentConfirmation' ? project!.paymentConfirmation :
         fieldId === 'planDetails' ? project!.planDetails :
         fieldId === 'revenueShare' ? project!.revenueShare :
         fieldId === 'gmvInfo' ? project!.gmvInfo :
         fieldId === 'releaseType' ? project!.releaseType :
         fieldId === 'dunsStatus' ? project!.dunsStatus :
         fieldId === 'poc' ? project!.poc : null);
    }
    // Check if it's a group field
    if (fieldConfig?.type === 'group' && fieldConfig?.id) {
      return project!.checklists.launch[fieldConfig.id] || {};
    }
    // Check if field is inside a group (like additionalInformation.devComments)
    const launchChecklist = project!.checklists.launch || {};
    const additionalInfo = launchChecklist.additionalInformation;
    if (additionalInfo && typeof additionalInfo === 'object' && fieldId in additionalInfo) {
      return additionalInfo[fieldId];
    }
    return launchChecklist[fieldId];
  };

  const renderTableCellValue = (value: any, type: string, fieldConfig?: any, isSales: boolean = false) => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400">Not provided</span>;
    }

    switch (type) {
      case 'checkbox':
        return value ? (
          <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Yes
          </span>
        ) : (
          <span className="text-red-700 font-semibold">No</span>
        );
      case 'multi_input':
        return Array.isArray(value) && value.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                  {value.some((item: any) => item.status) && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                  )}
                  {value.some((item: any) => item.remark) && (
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Remark</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {value.map((item: any, idx: number) => {
                  const displayValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
                  const valueStr = String(displayValue);
                  const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                                valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                                valueStr.includes('.net') || valueStr.includes('.org');
                  const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {isUrl ? (
                          <a 
                            href={normalizedUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                          >
                            {valueStr}
                          </a>
                        ) : (
                          valueStr
                        )}
                      </td>
                      {value.some((i: any) => i.status) && (
                        <td className="px-4 py-2 align-middle">
                          {item.status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                              item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                              item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                              (item.status === 'On HOLD' || item.status === 'On Hold') ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">Not Started</span>
                          )}
                        </td>
                      )}
                      {value.some((i: any) => i.remark) && (
                        <td className="px-4 py-2 text-sm text-gray-600">{item.remark || '-'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <span className="text-gray-400">None</span>
        );
      case 'url':
        const urlValue = String(value);
        const normalizedUrl = urlValue.startsWith('http://') || urlValue.startsWith('https://') 
          ? urlValue 
          : `https://${urlValue}`;
        return (
          <a 
            href={normalizedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
          >
            {urlValue}
          </a>
        );
      case 'group':
        if (typeof value === 'object' && value !== null) {
          // Check if any sub-field is an array (multi_input, multi_select, or versioned text/textarea) - render as table
          const hasArrayFields = fieldConfig?.fields?.some((subField: any) => {
            const subValue = value[subField.id];
            const isIntegrationsField = subField.type === 'multi_select' && subField.optionsSource === 'integrations';
            // For integrations fields, always render the table (even if empty)
            if (isIntegrationsField) {
              return true;
            }
            return Array.isArray(subValue) && subValue.length > 0 && 
                   (subField.type === 'multi_input' || 
                    subField.type === 'multi_select' ||
                    (subField.hasVersion && (subField.type === 'text' || subField.type === 'textarea')));
          });

          if (hasArrayFields) {
            // Render as nested tables for array fields
            return (
              <div className="space-y-4">
                {fieldConfig?.fields?.map((subField: any) => {
                  const subValue = value[subField.id];
                  
                  // Render arrays as tables
                  // Check for integrations field specifically - always render if it exists, even if empty
                  const isIntegrationsField = subField.type === 'multi_select' && subField.optionsSource === 'integrations';
                  // For integrations field, ensure subValue is an array (default to empty array if not)
                  const safeSubValue = isIntegrationsField && !Array.isArray(subValue) ? [] : subValue;
                  if (isIntegrationsField || (Array.isArray(subValue) && subValue.length > 0)) {
                    if (subField.type === 'multi_input') {
                      return (
                        <div key={subField.id} className="mt-3">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">{subField.label}</h4>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Item</th>
                                  {subField.hasStatus && (
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                  )}
                                  {subValue.some((item: any) => item.remark) && (
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Remark</th>
                                  )}
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {subValue.map((item: any, idx: number) => {
                                  const displayValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
                                  const valueStr = String(displayValue);
                                  const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                                                valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                                                valueStr.includes('.net') || valueStr.includes('.org');
                                  const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                                  
                                  return (
                                    <tr key={idx}>
                                      <td className="px-4 py-2 text-sm text-gray-900">
                                        {isUrl ? (
                                          <a 
                                            href={normalizedUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                                          >
                                            {valueStr}
                                          </a>
                                        ) : (
                                          valueStr
                                        )}
                                      </td>
                                      {subField.hasStatus && (
                                        <td className="px-4 py-2 align-middle">
                                          {item.status ? (
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                                              item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                              item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                              (item.status === 'On HOLD' || item.status === 'On Hold') ? 'bg-amber-100 text-amber-700' :
                                              'bg-gray-100 text-gray-700'
                                            }`}>
                                              {item.status}
                                            </span>
                                          ) : (
                                            <span className="text-xs text-gray-400">Not Started</span>
                                          )}
                                        </td>
                                      )}
                                      {subValue.some((i: any) => i.remark) && (
                                        <td className="px-4 py-2 text-sm text-gray-600">{item.remark || '-'}</td>
                                      )}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    } else if (subField.type === 'multi_select') {
                      // Check if this is integrations field with status/version data
                      const isIntegrationsField = subField.optionsSource === 'integrations';
                      const integrationStatuses = isIntegrationsField && value.integrations_statuses ? value.integrations_statuses : {};
                      const integrationVersions = isIntegrationsField && value.integrations_versions ? value.integrations_versions : {};
                      
                      if (isIntegrationsField) {
                        // Integrations - show status only for launch checklist, not sales
                        const showStatus = !isSales;
                        const integrationsArray = Array.isArray(safeSubValue) ? safeSubValue : [];
                        return (
                          <div key={subField.id} className="mt-3">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">{subField.label}</h4>
                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Integration</th>
                                    {showStatus && (
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                                    )}
                                    {Object.keys(integrationVersions).length > 0 && (
                                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Version</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {integrationsArray.length > 0 ? (
                                    integrationsArray.map((item: any, idx: number) => {
                                      const itemId = String(item);
                                      const integration = integrations.find((i: any) => i.id === itemId);
                                      const integrationName = integration?.name || itemId;
                                      return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-4 py-2 text-sm font-medium text-gray-900">{integrationName}</td>
                                          {showStatus && (
                                            <td className="px-4 py-2 align-middle">
                                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                                                integrationStatuses[itemId] === 'Integrated' ? 'bg-green-100 text-green-700' :
                                                integrationStatuses[itemId] === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                                                integrationStatuses[itemId] === 'Awaiting Information' ? 'bg-blue-100 text-blue-700' :
                                                'bg-gray-100 text-gray-700'
                                              }`}>
                                                {integrationStatuses[itemId] || 'Pending'}
                                              </span>
                                            </td>
                                          )}
                                          {Object.keys(integrationVersions).length > 0 && (
                                            <td className="px-4 py-2 align-middle">
                                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                                                Version {integrationVersions[itemId] || 1}
                                              </span>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })
                                  ) : (
                                    <tr>
                                      <td colSpan={showStatus ? (Object.keys(integrationVersions).length > 0 ? 3 : 2) : 1} className="px-4 py-4 text-sm text-gray-400 text-center">
                                        No integrations selected
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      }
                      
                      // Regular multi_select
                      return (
                        <div key={subField.id} className="mt-3">
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">{subField.label}</h4>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Selected Items</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {subValue.map((item: any, idx: number) => {
                                  const itemStr = String(item);
                                  const itemIsUrl = itemStr.startsWith('http://') || itemStr.startsWith('https://') || 
                                                    itemStr.includes('www.') || itemStr.includes('.com') || itemStr.includes('.io') ||
                                                    itemStr.includes('.net') || itemStr.includes('.org');
                                  const itemNormalizedUrl = itemIsUrl && !itemStr.startsWith('http') ? `https://${itemStr}` : itemStr;
                                  return (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 text-sm text-gray-900">
                                        {itemIsUrl ? (
                                          <a 
                                            href={itemNormalizedUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                                          >
                                            {itemStr}
                                          </a>
                                        ) : (
                                          itemStr
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    }
                  }
                  
                  // Handle non-array sub-fields
                  // Check if it's a versioned field (array of {value, version} objects)
                  if (Array.isArray(subValue) && subValue.length > 0 && 
                      subField.hasVersion && 
                      (subField.type === 'text' || subField.type === 'textarea')) {
                    // Render versioned fields as a list/table
                    return (
                      <div key={subField.id} className="mt-3">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">{subField.label}</h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Content</th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Version</th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {subValue.map((item: any, idx: number) => {
                                const itemValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
                                const valueStr = String(itemValue);
                                const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                                              valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                                              valueStr.includes('.net') || valueStr.includes('.org');
                                const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                                const version = typeof item === 'object' && item !== null ? (item.version || 1) : 1;
                                
                                return (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 text-sm text-gray-900">
                                      {subField.type === 'textarea' ? (
                                        <div className="whitespace-pre-wrap">{isUrl ? (
                                          <a 
                                            href={normalizedUrl} 
                                            target="_blank" 
                                            rel="noopener noreferrer" 
                                            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                                          >
                                            {valueStr}
                                          </a>
                                        ) : (
                                          valueStr
                                        )}</div>
                                      ) : isUrl ? (
                                        <a 
                                          href={normalizedUrl} 
                                          target="_blank" 
                                          rel="noopener noreferrer" 
                                          className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                                        >
                                          {valueStr}
                                        </a>
                                      ) : (
                                        valueStr
                                      )}
                                    </td>
                                    <td className="px-4 py-2 align-middle">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                                        Version {version}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }
                  
                  let displayValue = subValue;
                  if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
                    displayValue = subValue.value || subValue;
                  }
                  
                  if (displayValue === null || displayValue === undefined || displayValue === '') {
                    return null;
                  }
                  
                  const valueStr = String(displayValue);
                  const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                                valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                                valueStr.includes('.net') || valueStr.includes('.org');
                  const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                  
                  return (
                    <div key={subField.id} className="text-sm py-1">
                      <span className="font-semibold text-gray-700">{subField.label}:</span>{' '}
                      {isUrl ? (
                        <a 
                          href={normalizedUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                        >
                          {valueStr}
                        </a>
                      ) : subField.type === 'checkbox' ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          subValue ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {subValue ? 'Yes' : 'No'}
                        </span>
                      ) : (
                        <span className="text-gray-900">{valueStr}</span>
                      )}
                      {typeof subValue === 'object' && subValue !== null && subValue.status && (
                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                          subValue.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          subValue.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                          (subValue.status === 'On HOLD' || subValue.status === 'On Hold') ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {subValue.status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
          
          // Fallback: render as simple list for non-array group fields
          // But also check for versioned fields that might have been missed
          return (
            <div className="space-y-1">
              {fieldConfig?.fields?.map((subField: any) => {
                const subValue = value[subField.id];
                
                // Check if it's a versioned field (array of {value, version} objects)
                if (Array.isArray(subValue) && subValue.length > 0 && 
                    subField.hasVersion && 
                    (subField.type === 'text' || subField.type === 'textarea')) {
                  // Render versioned fields as a list
                  return (
                    <div key={subField.id} className="text-sm mb-3">
                      <span className="font-semibold text-gray-700">{subField.label}:</span>
                      <div className="mt-1 space-y-1 ml-4">
                        {subValue.map((item: any, idx: number) => {
                          const itemValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
                          const valueStr = String(itemValue);
                          const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                                        valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                                        valueStr.includes('.net') || valueStr.includes('.org');
                          const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                          const version = typeof item === 'object' && item !== null ? (item.version || 1) : 1;
                          
                          return (
                            <div key={idx} className="text-xs text-gray-600">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 mr-2 whitespace-nowrap">
                                v{version}
                              </span>
                              {isUrl ? (
                                <a 
                                  href={normalizedUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                                >
                                  {valueStr}
                                </a>
                              ) : (
                                <span className={subField.type === 'textarea' ? 'whitespace-pre-wrap' : ''}>{valueStr}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                
                let displayValue = subValue;
                if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
                  displayValue = subValue.value || subValue;
                }
                
                const valueStr = String(displayValue);
                const isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                              valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                              valueStr.includes('.net') || valueStr.includes('.org');
                const normalizedUrl = isUrl && !valueStr.startsWith('http') ? `https://${valueStr}` : valueStr;
                
                return (
                  <div key={subField.id} className="text-sm">
                    <span className="font-semibold text-gray-700">{subField.label}:</span>{' '}
                    {isUrl ? (
                      <a 
                        href={normalizedUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                      >
                        {valueStr}
                      </a>
                    ) : (
                      <span className="text-gray-900">
                        {displayValue === null || displayValue === undefined || displayValue === '' 
                          ? 'N/A' 
                          : valueStr}
                      </span>
                    )}
                    {typeof subValue === 'object' && subValue !== null && subValue.status && (
                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${
                        subValue.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        subValue.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        (subValue.status === 'On HOLD' || subValue.status === 'On Hold') ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {subValue.status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        return <span className="text-gray-400">Not provided</span>;
      case 'textarea':
        const textareaValue = String(value);
        const textareaIsUrl = textareaValue.startsWith('http://') || textareaValue.startsWith('https://') || 
                              textareaValue.includes('www.') || textareaValue.includes('.com') || textareaValue.includes('.io') ||
                              textareaValue.includes('.net') || textareaValue.includes('.org');
        const textareaNormalizedUrl = textareaIsUrl && !textareaValue.startsWith('http') ? `https://${textareaValue}` : textareaValue;
        return textareaIsUrl ? (
          <a 
            href={textareaNormalizedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all whitespace-pre-wrap"
          >
            {textareaValue}
          </a>
        ) : (
          <p className="text-gray-900 whitespace-pre-wrap text-sm">{textareaValue}</p>
        );
      case 'multi_select':
        return Array.isArray(value) && value.length > 0 ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Selected Items</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {value.map((item: any, idx: number) => {
                  const itemStr = String(item);
                  const itemIsUrl = itemStr.startsWith('http://') || itemStr.startsWith('https://') || 
                                    itemStr.includes('www.') || itemStr.includes('.com') || itemStr.includes('.io') ||
                                    itemStr.includes('.net') || itemStr.includes('.org');
                  const itemNormalizedUrl = itemIsUrl && !itemStr.startsWith('http') ? `https://${itemStr}` : itemStr;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {itemIsUrl ? (
                          <a 
                            href={itemNormalizedUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
                          >
                            {itemStr}
                          </a>
                        ) : (
                          itemStr
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <span className="text-gray-400">None</span>
        );
      case 'text':
        const textValue = String(value);
        const textIsUrl = textValue.startsWith('http://') || textValue.startsWith('https://') || 
                          textValue.includes('www.') || textValue.includes('.com') || textValue.includes('.io') ||
                          textValue.includes('.net') || textValue.includes('.org');
        const textNormalizedUrl = textIsUrl && !textValue.startsWith('http') ? `https://${textValue}` : textValue;
        return textIsUrl ? (
          <a 
            href={textNormalizedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
          >
            {textValue}
          </a>
        ) : (
          <span className="text-gray-900">{textValue}</span>
        );
      default:
        // Handle objects that might be accidentally passed
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // If it's an object with a value property, use that
          if ('value' in value) {
            const objValue = String(value.value);
            const objIsUrl = objValue.startsWith('http://') || objValue.startsWith('https://') || 
                             objValue.includes('www.') || objValue.includes('.com') || objValue.includes('.io') ||
                             objValue.includes('.net') || objValue.includes('.org');
            const objNormalizedUrl = objIsUrl && !objValue.startsWith('http') ? `https://${objValue}` : objValue;
            return objIsUrl ? (
              <a 
                href={objNormalizedUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
              >
                {objValue}
              </a>
            ) : (
              <span className="text-gray-900">{objValue}</span>
            );
          }
          // Otherwise, stringify the object
          return <span className="text-gray-900">{JSON.stringify(value)}</span>;
        }
        const defaultValue = String(value);
        const defaultIsUrl = defaultValue.startsWith('http://') || defaultValue.startsWith('https://') || 
                             defaultValue.includes('www.') || defaultValue.includes('.com') || defaultValue.includes('.io') ||
                             defaultValue.includes('.net') || defaultValue.includes('.org');
        const defaultNormalizedUrl = defaultIsUrl && !defaultValue.startsWith('http') ? `https://${defaultValue}` : defaultValue;
        return defaultIsUrl ? (
          <a 
            href={defaultNormalizedUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="font-mono text-sm text-blue-600 hover:text-blue-700 underline break-all"
          >
            {defaultValue}
          </a>
        ) : (
          <span className="text-gray-900">{defaultValue}</span>
        );
    }
  };

  const handleExportPDF = async () => {
    if (!project || !config) return;
    setExportingPDF(true);
    try {
      await generatePDF(project, config, integrations);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportMD = () => {
    if (!project || !config) return;
    downloadMarkdown(project, config);
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="mb-8">
              <Skeleton variant="rectangular" width="150px" height="16px" className="mb-4" />
              <Skeleton variant="rectangular" width="300px" height="48px" className="mb-2" />
              <Skeleton variant="rectangular" width="200px" height="20px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6">
                  <Skeleton variant="circular" width="40px" height="40px" className="mb-3" />
                  <Skeleton variant="text" width="100px" height="12px" className="mb-2" />
                  <Skeleton variant="text" width="60px" height="32px" />
                </div>
              ))}
            </div>
            <div className="card p-8 mb-6">
              <Skeleton variant="rectangular" width="250px" height="28px" className="mb-6" />
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-5 rounded-xl border-2 border-gray-200">
                    <Skeleton variant="text" width="150px" height="14px" className="mb-3" />
                    <Skeleton variant="rectangular" width="100%" height="20px" />
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-8">
              <Skeleton variant="rectangular" width="200px" height="28px" className="mb-6" />
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="p-5 rounded-xl border-2 border-gray-200">
                    <Skeleton variant="text" width="150px" height="14px" className="mb-3" />
                    <Skeleton variant="rectangular" width="100%" height="20px" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!project) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="text-center py-12 text-red-600">Project not found</div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  // Use default config if none exists
  if (!config) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="text-center py-12 text-yellow-600">
              Checklist configuration not found. Please configure it in Settings.
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64 overflow-y-auto h-screen">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-gray-50">
            <div className="px-8 pt-8 pb-4">
              <Link
                href={`/projects/${projectId}`}
                className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4 transition-colors duration-150 group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Project
              </Link>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Handover Report</h1>
                  <p className="text-gray-600 text-lg">{project.brandName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                    project.progress.overall === 100 
                      ? 'bg-green-100 text-green-700' 
                      : project.progress.overall >= 50 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {project.progress.overall}% Complete
                  </div>
                  <button
                    onClick={handleExportMD}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export MD
                  </button>
                  <button
                    onClick={handleExportPDF}
                    disabled={exportingPDF}
                    className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportingPDF ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                        Export PDF
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Sales Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{project.progress.salesCompletion}%</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Launch Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{project.progress.launchCompletion}%</p>
                </div>
              </div>
            </div>
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Overall Progress</p>
                  <p className="text-2xl font-bold text-gray-900">{project.progress.overall}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sales Handover Section */}
          <div className="card p-8 mb-6">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Sales Handover Information</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/5">
                      Field
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {config.sales.map((field) => {
                    const fieldConfig = config.sales.find((f) => f.id === field.id);
                    const value = getValue(field.id, true, field);
                    const isEmpty = value === null || value === undefined || value === '' || 
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

                    return (
                      <tr key={field.id} className={isEmpty ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{field.label}</span>
                            {!isEmpty && (
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {renderTableCellValue(value, field.type, field, true)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Launch Checklist Section */}
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Launch Checklist</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/5">
                      Field
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {config.launch.map((field) => {
                    const value = getValue(field.id, false, field);
                    // For group fields, check if any sub-field has data
                    let isEmpty = value === null || value === undefined || value === '' || 
                      (Array.isArray(value) && value.length === 0);
                    
                    if (field.type === 'group' && typeof value === 'object' && value !== null) {
                      // Check if any sub-field has data
                      const hasData = field.fields?.some((subField: any) => {
                        const subValue = value[subField.id];
                        if (Array.isArray(subValue)) {
                          return subValue.length > 0;
                        }
                        return subValue !== null && subValue !== undefined && subValue !== '';
                      });
                      isEmpty = !hasData;
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                      isEmpty = Object.keys(value).length === 0;
                    }

                    return (
                      <tr key={field.id} className={isEmpty ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4 align-top whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{field.label}</span>
                            {!isEmpty && (
                              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 align-top">
                          {renderTableCellValue(value, field.type, field, false)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

