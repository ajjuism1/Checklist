'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Skeleton } from '@/components/Skeleton';
import { getProject, getChecklistConfig } from '@/lib/firebase/firestore';
import { downloadMarkdown, generatePDF } from '@/lib/export/reportExport';
import { Project, ChecklistConfig } from '@/types';

export const dynamic = 'force-dynamic';

export default function HandoverReportPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingPDF, setExportingPDF] = useState(false);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    try {
      const [projectData, configData] = await Promise.all([
        getProject(projectId),
        getChecklistConfig(),
      ]);

      if (!projectData) {
        router.push('/projects');
        return;
      }

      setProject(projectData);
      setConfig(configData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getValue = (fieldId: string, isSales: boolean) => {
    if (isSales) {
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
    return project!.checklists.launch[fieldId];
  };

  const renderTableCellValue = (value: any, type: string, fieldConfig?: any) => {
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
          <ul className="list-disc list-inside space-y-1">
            {value.map((item: any, idx: number) => {
              // Handle object format {value, status, checked, remark}
              if (typeof item === 'object' && item !== null) {
                const displayValue = item.value || item;
                return (
                  <li key={idx} className="text-gray-900">
                    {String(displayValue)}
                    {item.status && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                        item.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        item.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        item.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status}
                      </span>
                    )}
                  </li>
                );
              }
              // Handle string format
              return <li key={idx} className="text-gray-900">{String(item)}</li>;
            })}
          </ul>
        ) : (
          <span className="text-gray-400">None</span>
        );
      case 'url':
        return (
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-blue-600 hover:text-blue-700 underline break-all"
          >
            {value}
          </a>
        );
      case 'group':
        if (typeof value === 'object' && value !== null) {
          return (
            <div className="space-y-1">
              {fieldConfig?.fields?.map((subField: any) => {
                const subValue = value[subField.id];
                // Handle object format {value, status, checked, remark}
                let displayValue = subValue;
                if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
                  displayValue = subValue.value || subValue;
                }
                return (
                  <div key={subField.id} className="text-sm">
                    <span className="font-semibold text-gray-700">{subField.label}:</span>{' '}
                    <span className="text-gray-900">
                      {displayValue === null || displayValue === undefined || displayValue === '' 
                        ? 'N/A' 
                        : String(displayValue)}
                    </span>
                    {typeof subValue === 'object' && subValue !== null && subValue.status && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                        subValue.status === 'Completed' ? 'bg-green-100 text-green-700' :
                        subValue.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                        subValue.status === 'On Hold' ? 'bg-yellow-100 text-yellow-700' :
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
        return <p className="text-gray-900 whitespace-pre-wrap text-sm">{String(value)}</p>;
      case 'multi_select':
        return Array.isArray(value) && value.length > 0 ? (
          <ul className="list-disc list-inside space-y-1">
            {value.map((item: any, idx: number) => (
              <li key={idx} className="text-gray-900">{String(item)}</li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400">None</span>
        );
      default:
        // Handle objects that might be accidentally passed
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // If it's an object with a value property, use that
          if ('value' in value) {
            return <span className="text-gray-900">{String(value.value)}</span>;
          }
          // Otherwise, stringify the object
          return <span className="text-gray-900">{JSON.stringify(value)}</span>;
        }
        return <span className="text-gray-900">{String(value)}</span>;
    }
  };

  const handleExportPDF = async () => {
    if (!project || !config) return;
    setExportingPDF(true);
    try {
      await generatePDF(project, config);
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/3">
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
                    const value = getValue(field.id, true);
                    const isEmpty = value === null || value === undefined || value === '' || 
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

                    return (
                      <tr key={field.id} className={isEmpty ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{field.label}</span>
                            {!isEmpty && (
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {renderTableCellValue(value, field.type, field)}
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
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-1/3">
                      Field
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {config.launch.map((field) => {
                    const value = getValue(field.id, false);
                    const isEmpty = value === null || value === undefined || value === '' || 
                      (Array.isArray(value) && value.length === 0) ||
                      (typeof value === 'object' && value !== null && Object.keys(value).length === 0);

                    return (
                      <tr key={field.id} className={isEmpty ? 'bg-gray-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{field.label}</span>
                            {!isEmpty && (
                              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {renderTableCellValue(value, field.type, field)}
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

