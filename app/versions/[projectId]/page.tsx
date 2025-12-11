'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Skeleton } from '@/components/Skeleton';
import { VersionDropdown } from '@/components/VersionDropdown';
import { getProject, getChecklistConfig, getIntegrations } from '@/lib/firebase/firestore';
import { generateVersionSummaryPDF } from '@/lib/export/reportExport';
import { Project, ChecklistConfig, Integration } from '@/types';

export const dynamic = 'force-dynamic';

export default function VersionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [integrationsList, setIntegrationsList] = useState<Integration[]>([]);

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProject = async () => {
    try {
      const [projectData, configData, integrationsData] = await Promise.all([
        getProject(projectId),
        getChecklistConfig(),
        getIntegrations(),
      ]);

      if (!projectData) {
        router.push('/versions');
        return;
      }

      // Initialize versionHistory if it doesn't exist - check all versions in data
      if (!projectData.versionHistory || !Array.isArray(projectData.versionHistory) || projectData.versionHistory.length === 0) {
        const versions = new Set<number>();
        versions.add(projectData.version || 1);
        
        // Extract versions from multi_input fields in launch checklist
        const launchChecklist = projectData.checklists?.launch || {};
        
        // Helper to extract versions from an array
        const extractVersionsFromArray = (arr: any[]) => {
          if (!Array.isArray(arr)) return;
          arr.forEach((item: any) => {
            if (item && typeof item === 'object' && item.version) {
              versions.add(item.version);
            }
          });
        };
        
        // Check direct fields: integrationsCredentials, customFeatures, changeRequests
        const directFields = ['integrationsCredentials', 'customFeatures', 'changeRequests'];
        directFields.forEach(fieldId => {
          const fieldData = launchChecklist[fieldId];
          extractVersionsFromArray(Array.isArray(fieldData) ? fieldData : []);
        });
        
        // Check nested group fields
        const developmentItems = launchChecklist.developmentItems;
        if (developmentItems && typeof developmentItems === 'object') {
          extractVersionsFromArray(Array.isArray(developmentItems.customFeatures) ? developmentItems.customFeatures : []);
          extractVersionsFromArray(Array.isArray(developmentItems.changeRequests) ? developmentItems.changeRequests : []);
        }
        
        // Check nested fields (e.g., integrations.integrations)
        const integrationsGroup = launchChecklist.integrations;
        if (integrationsGroup && typeof integrationsGroup === 'object') {
          extractVersionsFromArray(Array.isArray(integrationsGroup.integrations) ? integrationsGroup.integrations : []);
          if (integrationsGroup.integrations_versions && typeof integrationsGroup.integrations_versions === 'object') {
            Object.values(integrationsGroup.integrations_versions).forEach((version: any) => {
              if (typeof version === 'number') {
                versions.add(version);
              }
            });
          }
        }
        
        // Check Additional Information fields (devComments, externalCommunications, remarks)
        const additionalInformation = launchChecklist.additionalInformation;
        if (additionalInformation && typeof additionalInformation === 'object') {
          const additionalFields = ['devComments', 'externalCommunications', 'remarks'];
          additionalFields.forEach(fieldId => {
            const fieldData = additionalInformation[fieldId];
            if (Array.isArray(fieldData)) {
              fieldData.forEach((item: any) => {
                if (typeof item === 'object' && item !== null && item.version) {
                  versions.add(item.version);
                }
              });
            }
          });
        }
        
        const calculatedVersions = Array.from(versions).sort((a, b) => a - b);
        const currentVersion = projectData.version || 1;
        
        // Always include version 1 and current version, plus any found in data
        const finalVersions = new Set([1, currentVersion, ...calculatedVersions]);
        projectData.versionHistory = Array.from(finalVersions).sort((a, b) => a - b);
        
        // Save it asynchronously (don't block)
        const { updateProject } = await import('@/lib/firebase/firestore');
        updateProject(projectId, { versionHistory: projectData.versionHistory }).catch(err => {
          console.error('Error initializing version history:', err);
        });
      }

      setProject(projectData);
      setConfig(configData);
      setIntegrationsList(integrationsData);
      setSelectedVersion(projectData.version || 1);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate available versions - use versionHistory if available, otherwise calculate from data
  const getAvailableVersions = (): number[] => {
    if (!project) return [1];
    
    // If versionHistory exists, use it (preserves all historical versions)
    if (project.versionHistory && Array.isArray(project.versionHistory) && project.versionHistory.length > 0) {
      const currentVersion = project.version || 1;
      const versionHistory = [...project.versionHistory];
      
      // Ensure all versions from 1 to currentVersion are included
      for (let v = 1; v <= currentVersion; v++) {
        if (!versionHistory.includes(v)) {
          versionHistory.push(v);
        }
      }
      
      return versionHistory.sort((a, b) => a - b);
    }
    
    // Otherwise, calculate from current data (for backward compatibility)
    const versions = new Set<number>();
    versions.add(project.version || 1);
    
    // Extract versions from multi_input fields in launch checklist
    const launchChecklist = project.checklists?.launch || {};
    
    // Helper to extract versions from an array
    const extractVersionsFromArray = (arr: any[]) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item: any) => {
        if (item && typeof item === 'object' && item.version) {
          versions.add(item.version);
        }
      });
    };
    
    // Check direct fields: integrationsCredentials, customFeatures, changeRequests
    const directFields = ['integrationsCredentials', 'customFeatures', 'changeRequests'];
    directFields.forEach(fieldId => {
      const fieldData = launchChecklist[fieldId];
      extractVersionsFromArray(Array.isArray(fieldData) ? fieldData : []);
    });
    
    // Check nested group fields (e.g., developmentItems.customFeatures, developmentItems.changeRequests)
    const developmentItems = launchChecklist.developmentItems;
    if (developmentItems && typeof developmentItems === 'object') {
      extractVersionsFromArray(Array.isArray(developmentItems.customFeatures) ? developmentItems.customFeatures : []);
      extractVersionsFromArray(Array.isArray(developmentItems.changeRequests) ? developmentItems.changeRequests : []);
    }
    
    // Also check nested fields (e.g., integrations.integrations)
    const integrationsGroup = launchChecklist.integrations;
    if (integrationsGroup && typeof integrationsGroup === 'object') {
      extractVersionsFromArray(Array.isArray(integrationsGroup.integrations) ? integrationsGroup.integrations : []);
      // Check integration versions stored separately
      if (integrationsGroup.integrations_versions && typeof integrationsGroup.integrations_versions === 'object') {
        Object.values(integrationsGroup.integrations_versions).forEach((version: any) => {
          if (typeof version === 'number') {
            versions.add(version);
          }
        });
      }
    }
    
    // Check Additional Information fields (devComments, externalCommunications, remarks)
    const additionalInformation = launchChecklist.additionalInformation;
    if (additionalInformation && typeof additionalInformation === 'object') {
      const additionalFields = ['devComments', 'externalCommunications', 'remarks'];
      additionalFields.forEach(fieldId => {
        const fieldData = additionalInformation[fieldId];
        if (Array.isArray(fieldData)) {
          fieldData.forEach((item: any) => {
            if (typeof item === 'object' && item !== null && item.version) {
              versions.add(item.version);
            }
          });
        }
      });
    }
    
    return Array.from(versions).sort((a, b) => a - b);
  };

  const handleVersionDelete = async (versionToDelete: number) => {
    if (!project) return;
    
    // Don't allow deleting the current version
    if (versionToDelete === selectedVersion) {
      alert('Cannot delete the currently selected version. Please select a different version first.');
      return;
    }
    
    try {
      const { updateProject } = await import('@/lib/firebase/firestore');
      const currentVersionHistory = project.versionHistory || getAvailableVersions();
      const updatedVersionHistory = currentVersionHistory.filter(v => v !== versionToDelete).sort((a, b) => a - b);
      
      // Ensure we always have at least version 1
      if (updatedVersionHistory.length === 0) {
        updatedVersionHistory.push(1);
      }
      
      await updateProject(projectId, { versionHistory: updatedVersionHistory });
      await loadProject(); // Reload to refresh
    } catch (error) {
      console.error('Error deleting version:', error);
      alert('Failed to delete version. Please try again.');
    }
  };

  // Filter items by version
  const filterByVersion = (items: any[]): any[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item: any) => {
      if (typeof item === 'string') {
        // Legacy format - assume version 1
        return selectedVersion === 1;
      }
      return (item.version || 1) === selectedVersion;
    });
  };

  // Filter integrations by version using integration versions map
  const filterIntegrationsByVersion = (integrationIds: string[], integrationVersions: Record<string, number>): string[] => {
    if (!Array.isArray(integrationIds)) return [];
    return integrationIds.filter((id: string) => {
      const version = integrationVersions[id] || 1;
      return version === selectedVersion;
    });
  };

  const handleExportPDF = async () => {
    if (!project || !config) return;
    setExportingPDF(true);
    try {
      await generateVersionSummaryPDF(project, config, selectedVersion, integrationsList);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExportingPDF(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="mb-8">
              <Skeleton variant="rectangular" width="200px" height="16px" className="mb-4" />
              <Skeleton variant="rectangular" width="300px" height="48px" className="mb-2" />
              <Skeleton variant="rectangular" width="150px" height="20px" />
            </div>
            <div className="grid grid-cols-1 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6">
                  <Skeleton variant="rectangular" width="200px" height="24px" className="mb-4" />
                  <Skeleton variant="rectangular" width="100%" height="200px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!project || !config) {
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

  const availableVersions = getAvailableVersions();
  const launchChecklist = project.checklists?.launch || {};
  
  // Get filtered data - handle both direct fields and nested group fields
  const integrationsCredentialsData = launchChecklist.integrationsCredentials || [];
  
  // Check for nested group fields (developmentItems)
  const developmentItems = launchChecklist.developmentItems;
  const customFeaturesData = launchChecklist.customFeatures || 
    (developmentItems && typeof developmentItems === 'object' ? developmentItems.customFeatures : []);
  const changeRequestsData = launchChecklist.changeRequests || 
    (developmentItems && typeof developmentItems === 'object' ? developmentItems.changeRequests : []);
  
  const integrationsData = launchChecklist.integrations || {};
  
  // Get integration versions map
  const integrationVersions = (integrationsData && typeof integrationsData === 'object' && integrationsData.integrations_versions)
    ? integrationsData.integrations_versions
    : {};
  
  // Get Additional Information group fields
  const additionalInformation = launchChecklist.additionalInformation || {};
  const devCommentsData = additionalInformation.devComments || [];
  const externalCommunicationsData = additionalInformation.externalCommunications || [];
  const remarksData = additionalInformation.remarks || [];
  
  // Filter Additional Information fields by version (they're stored as arrays of {value, version} objects)
  const filterVersionedArray = (items: any[]): any[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item: any) => {
      if (typeof item === 'string') {
        return selectedVersion === 1;
      }
      if (typeof item === 'object' && item !== null) {
        return (item.version || 1) === selectedVersion;
      }
      return false;
    });
  };
  
  const devComments = filterVersionedArray(Array.isArray(devCommentsData) ? devCommentsData : []);
  const externalCommunications = filterVersionedArray(Array.isArray(externalCommunicationsData) ? externalCommunicationsData : []);
  const remarks = filterVersionedArray(Array.isArray(remarksData) ? remarksData : []);
  
  // Get filtered data
  const integrations = filterByVersion(Array.isArray(integrationsCredentialsData) ? integrationsCredentialsData : []);
  const customFeatures = filterByVersion(Array.isArray(customFeaturesData) ? customFeaturesData : []);
  const changeRequests = filterByVersion(Array.isArray(changeRequestsData) ? changeRequestsData : []);
  
  // Filter integrations by version using the versions map
  const integrationIds = (integrationsData && typeof integrationsData === 'object' && Array.isArray(integrationsData.integrations))
    ? integrationsData.integrations
    : [];
  const filteredIntegrationIds = filterIntegrationsByVersion(integrationIds, integrationVersions);
  
  // Get integration statuses
  const integrationStatuses = (integrationsData && typeof integrationsData === 'object' && integrationsData.integrations_statuses)
    ? integrationsData.integrations_statuses
    : {};
  
  // Map integration IDs to integration objects with version info
  const launchIntegrations = filteredIntegrationIds.map((id: string) => {
    const integration = integrationsList.find((i: any) => i.id === id);
    return {
      id,
      name: integration?.name || id,
      version: integrationVersions[id] || 1,
      status: integrationStatuses[id] || 'Pending',
    };
  });

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64 overflow-y-auto h-screen">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
            <div className="px-8 pt-8 pb-4">
              <Link
                href="/versions"
                className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4 transition-colors duration-150 group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Versions
              </Link>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Version Details</h1>
                  <div className="flex items-center gap-3">
                    <p className="text-gray-600 text-lg">{project.brandName}</p>
                    {project.collabCode && (
                      <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold">
                        {project.collabCode}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <VersionDropdown
                    version={selectedVersion}
                    onVersionChange={setSelectedVersion}
                    onVersionDelete={handleVersionDelete}
                    projectId={projectId}
                    publishingStatus={project.publishingStatus}
                    availableVersions={availableVersions}
                    canDelete={true}
                  />
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
            {/* Version Info Banner */}
            <div className="card mb-8 p-6 bg-gradient-to-r from-purple-50 to-purple-100/50 border-2 border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Current View</p>
                    <p className="text-2xl font-bold text-gray-900">Version {selectedVersion}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Available Versions</p>
                  <p className="text-sm font-semibold text-gray-900">{availableVersions.join(', ')}</p>
                </div>
              </div>
            </div>

            {/* Integrations Table */}
            {(integrations.length > 0 || launchIntegrations.length > 0) && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200">
                    {(integrations.length + launchIntegrations.length)} item{(integrations.length + launchIntegrations.length) !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Integration</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {integrations.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 align-top">
                            {typeof item === 'string' ? item : item.value || item.name || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            {typeof item === 'object' && item.status ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
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
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {launchIntegrations.map((item: any, index: number) => (
                        <tr key={`launch-${item.id || index}`} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.name || item.id || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                              item.status === 'Integrated' ? 'bg-green-100 text-green-700' :
                              item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                              item.status === 'Awaiting Information' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {item.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {item.version || 1}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Custom Features Table */}
            {customFeatures.length > 0 && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Custom Features</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200">
                    {customFeatures.length} item{customFeatures.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Feature</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {customFeatures.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">
                            {typeof item === 'string' ? item : item.value || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            {typeof item === 'object' && item.status ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
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
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 align-top">
                            {typeof item === 'object' ? (item.remark || <span className="text-gray-400">-</span>) : <span className="text-gray-400">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Change Requests Table */}
            {changeRequests.length > 0 && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Change Requests</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200">
                    {changeRequests.length} item{changeRequests.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Request</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Remark</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {changeRequests.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">
                            {typeof item === 'string' ? item : item.value || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            {typeof item === 'object' && item.status ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
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
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 align-top">
                            {typeof item === 'object' ? (item.remark || <span className="text-gray-400">-</span>) : <span className="text-gray-400">-</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Dev Comments Table */}
            {devComments.length > 0 && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Dev Comments and Feedback</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-semibold border border-indigo-200">
                    {devComments.length} item{devComments.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Comment</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {devComments.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-pre-wrap">
                            {typeof item === 'string' ? item : item.value || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* External Communications Table */}
            {externalCommunications.length > 0 && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">External Communications Summary</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 text-xs font-semibold border border-teal-200">
                    {externalCommunications.length} item{externalCommunications.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Summary</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {externalCommunications.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm text-gray-900 whitespace-pre-wrap align-top">
                            {typeof item === 'string' ? item : item.value || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Remarks Table */}
            {remarks.length > 0 && (
              <div className="card mb-8 p-8">
                <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
                  <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h10m-7 4h7" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Remarks</h2>
                  <span className="ml-auto px-3 py-1.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-200">
                    {remarks.length} item{remarks.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Remark</th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Version</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {remarks.map((item: any, index: number) => (
                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">
                            {typeof item === 'string' ? item : item.value || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap align-middle">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200 whitespace-nowrap">
                              Version {typeof item === 'object' ? (item.version || 1) : 1}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty State */}
            {integrations.length === 0 && launchIntegrations.length === 0 && customFeatures.length === 0 && changeRequests.length === 0 && devComments.length === 0 && externalCommunications.length === 0 && remarks.length === 0 && (
              <div className="card p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-900 text-lg font-semibold mb-2">No changes found for Version {selectedVersion}</p>
                <p className="text-gray-500 text-sm">
                  Try selecting a different version from the dropdown above
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
