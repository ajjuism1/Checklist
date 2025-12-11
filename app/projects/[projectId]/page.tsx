'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { ProgressRing } from '@/components/ProgressRing';
import { ChecklistStatus } from '@/components/ChecklistStatus';
import { Loading } from '@/components/Loading';
import { Skeleton } from '@/components/Skeleton';
import { StatusDropdown } from '@/components/StatusDropdown';
import { PublishingStatusDropdown } from '@/components/PublishingStatusDropdown';
import { VersionDropdown } from '@/components/VersionDropdown';
import { EmailModal } from '@/components/EmailModal';
import { getProject, getChecklistConfig, updateProject, flattenFields, getIntegrations } from '@/lib/firebase/firestore';
import { Project, ChecklistConfig, ProjectStatus, PublishingStatus, Integration } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

export const dynamic = 'force-dynamic';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [salesExpanded, setSalesExpanded] = useState(false);
  const [launchExpanded, setLaunchExpanded] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const { user } = useAuth();

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
        router.push('/projects');
        return;
      }

      // Migrate old 'Live' status to publishingStatus
      if ((projectData.status as string) === 'Live') {
        const updates: Partial<Project> = {
          status: 'Completed',
          publishingStatus: 'Live',
        };
        
        // Only update if publishingStatus is not already set
        if (!projectData.publishingStatus) {
          try {
            await updateProject(projectId, updates);
            projectData.status = 'Completed' as ProjectStatus;
            projectData.publishingStatus = 'Live';
          } catch (error) {
            console.error('Error migrating status:', error);
          }
        } else {
          // Just update the local state if publishingStatus already exists
          projectData.status = 'Completed' as ProjectStatus;
        }
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
        
        const calculatedVersions = Array.from(versions).sort((a, b) => a - b);
        const currentVersion = projectData.version || 1;
        
        // Always include version 1 and current version, plus any found in data
        const finalVersions = new Set([1, currentVersion, ...calculatedVersions]);
        projectData.versionHistory = Array.from(finalVersions).sort((a, b) => a - b);
        
        // Save it asynchronously (don't block)
        updateProject(projectId, { versionHistory: projectData.versionHistory }).catch(err => {
          console.error('Error initializing version history:', err);
        });
      }

      setProject(projectData);
      setConfig(configData);
      setIntegrations(integrationsData);
    } catch (error) {
      console.error('Error loading project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: ProjectStatus) => {
    if (!project) return;
    
    try {
      const updates: Partial<Project> = { status: newStatus };
      
      await updateProject(projectId, updates);
      setProject({ ...project, ...updates });
    } catch (error) {
      console.error('Error updating project status:', error);
    }
  };

  const handlePublishingStatusChange = async (newPublishingStatus: PublishingStatus) => {
    if (!project) return;
    
    try {
      const updates: Partial<Project> = { publishingStatus: newPublishingStatus };
      
      // Auto-set completion date when publishingStatus changes to Live
      if (newPublishingStatus === 'Live' && !project.completionDate) {
        updates.completionDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      }
      
      await updateProject(projectId, updates);
      setProject({ ...project, ...updates });
    } catch (error) {
      console.error('Error updating publishing status:', error);
    }
  };

  const handleVersionChange = async (newVersion: number) => {
    if (!project) return;
    
    try {
      // Update version history to include the new version
      // Ensure all versions from 1 to newVersion are included
      const currentVersionHistory = project.versionHistory || [project.version || 1];
      const updatedVersionHistorySet = new Set(currentVersionHistory);
      
      // Add all versions from 1 to newVersion to ensure continuity
      for (let v = 1; v <= newVersion; v++) {
        updatedVersionHistorySet.add(v);
      }
      
      // Also add the new version explicitly
      updatedVersionHistorySet.add(newVersion);
      
      const updatedVersionHistory = Array.from(updatedVersionHistorySet).sort((a, b) => a - b);
      
      const updates: Partial<Project> = { 
        version: newVersion,
        versionHistory: updatedVersionHistory,
      };
      
      await updateProject(projectId, updates);
      setProject({ ...project, ...updates });
    } catch (error) {
      console.error('Error updating version:', error);
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
    
    const calculatedVersions = Array.from(versions).sort((a, b) => a - b);
    
    // Initialize versionHistory if it doesn't exist
    if (calculatedVersions.length > 0 && (!project.versionHistory || project.versionHistory.length === 0)) {
      // Save versionHistory for future use (async, don't block)
      updateProject(projectId, { versionHistory: calculatedVersions }).catch(err => {
        console.error('Error saving version history:', err);
      });
    }
    
    return calculatedVersions;
  };

  const handleDateChange = async (field: 'handoverDate' | 'completionDate', value: string) => {
    if (!project) return;
    
    try {
      const updates: Partial<Project> = {
        [field]: value || null,
      };
      
      await updateProject(projectId, updates);
      setProject({ ...project, ...updates });
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
    }
  };

  const handleGenerateEmail = () => {
    if (!project || !config) return;
    setEmailModalOpen(true);
  };

  // Helper to get value for a field (handles both direct and nested group fields)
  const getFieldValue = (field: any, isSales: boolean) => {
    if (!project) return null;
    
    if (field.isSubField && field.groupId) {
      // It's a sub-field in a group
      const groupValue = isSales 
        ? project.checklists.sales[field.groupId]
        : project.checklists.launch[field.groupId];
      return groupValue?.[field.id] ?? null;
    } else {
      // Regular field
      const value = isSales 
        ? project.checklists.sales[field.id]
        : project.checklists.launch[field.id];
      
      // Fallback to project-level fields for sales
      if (isSales && value === undefined) {
        return field.id === 'brandName' ? project.brandName :
               field.id === 'collabCode' ? project.collabCode :
               field.id === 'storeUrlMyShopify' ? project.storeUrlMyShopify :
               field.id === 'storePublicUrl' ? project.storePublicUrl :
               field.id === 'scopeOfWork' ? project.scopeOfWork :
               field.id === 'designRefs' ? project.designRefs :
               field.id === 'additionalDocs' ? project.additionalDocs :
               field.id === 'paymentConfirmation' ? project.paymentConfirmation :
               field.id === 'planDetails' ? project.planDetails :
               field.id === 'revenueShare' ? project.revenueShare :
               field.id === 'gmvInfo' ? project.gmvInfo :
               field.id === 'releaseType' ? project.releaseType :
               field.id === 'dunsStatus' ? project.dunsStatus :
               field.id === 'poc' ? project.poc : null;
      }
      return value;
    }
  };
  
  // Helper to check integration requirements
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

  // Helper to get requirement status for a field
  const getRequirementStatus = (field: any, isSales: boolean) => {
    if (field.isSubField && field.groupId) {
      // It's a sub-field in a group
      const groupValue = isSales 
        ? project?.checklists.sales[field.groupId]
        : project?.checklists.launch[field.groupId];
      return groupValue?.[`${field.id}_requirementStatus`] || {};
    } else {
      // Regular field
      const checklist = isSales ? project?.checklists.sales : project?.checklists.launch;
      return checklist?.[`${field.id}_requirementStatus`] || {};
    }
  };

  // Helper to check if a field is marked as not relevant
  const isFieldNotRelevant = (field: any, isSales: boolean): boolean => {
    const checklist = isSales ? project?.checklists.sales : project?.checklists.launch;
    
    if (field.isSubField && field.groupId) {
      // It's a sub-field in a group
      // First check if the parent group itself is marked as not relevant
      if (checklist?.[`${field.groupId}_notRelevant`] === true) {
        return true;
      }
      // Then check for not relevant flag on the subfield itself: groupId[subFieldId_notRelevant]
      const groupValue = checklist?.[field.groupId];
      if (groupValue && typeof groupValue === 'object') {
        return groupValue[`${field.id}_notRelevant`] === true;
      }
      return false;
    } else {
      // Regular field - check for fieldId_notRelevant
      return checklist?.[`${field.id}_notRelevant`] === true;
    }
  };

  // Helper to check if field is completed
  const isFieldCompleted = (field: any, value: any, isSales: boolean = false) => {
    if (value === null || value === undefined || value === '') return false;
    if (field.type === 'checkbox') return value === true;
    if (field.type === 'multi_input') {
      // For launch checklist, all items must be filled
      if (!isSales) {
        return Array.isArray(value) && value.length > 0 && value.every(item => item && item.toString().trim() !== '');
      }
      return Array.isArray(value) && value.length > 0;
    }
    if (field.type === 'multi_select') {
      // For launch checklist with integrations, check requirement status
      if (!isSales && field.optionsSource === 'integrations') {
        const selectedIds = Array.isArray(value) ? value : [];
        const reqStatus = getRequirementStatus(field, isSales);
        return checkIntegrationRequirements(selectedIds, reqStatus, integrations);
      }
      // For sales or non-integration multi_select, just check if items are selected
      return Array.isArray(value) && value.length > 0;
    }
    return value && value.toString().trim() !== '';
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6">
                  <Skeleton variant="circular" width="100px" height="100px" className="mx-auto mb-4" />
                  <Skeleton variant="text" width="120px" height="16px" className="mx-auto" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-6">
                  <Skeleton variant="rectangular" width="150px" height="20px" className="mb-4" />
                  <Skeleton variant="rectangular" width="100%" height="8px" className="mb-2" />
                  <Skeleton variant="text" width="50px" height="14px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (!project) {
    return null;
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
                href="/projects"
                className="inline-flex items-center text-sm font-semibold text-gray-600 hover:text-gray-900 mb-4 transition-colors duration-150 group"
              >
                <svg className="w-4 h-4 mr-2 group-hover:-translate-x-0.5 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Projects
              </Link>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">{project.brandName}</h1>
                  {project.collabCode && (
                    <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold">
                      {project.collabCode}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateEmail}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Generate Email
                  </button>
                  <StatusDropdown
                    status={(project.status as ProjectStatus) || 'Not Started'}
                    onStatusChange={handleStatusChange}
                    projectId={projectId}
                  />
                  <PublishingStatusDropdown
                    status={project.publishingStatus || 'Pending'}
                    onStatusChange={handlePublishingStatusChange}
                    projectId={projectId}
                  />
                  <VersionDropdown
                    version={project.version || 1}
                    onVersionChange={handleVersionChange}
                    onVersionDelete={async (versionToDelete: number) => {
                      if (!project) return;
                      
                      // Don't allow deleting the current version
                      if (versionToDelete === (project.version || 1)) {
                        alert('Cannot delete the currently selected version. Please select a different version first.');
                        return;
                      }
                      
                      try {
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
                    }}
                    projectId={projectId}
                    publishingStatus={project.publishingStatus}
                    availableVersions={getAvailableVersions()}
                    canDelete={true}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {/* Progress Overview & Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Sales Progress</h3>
                <ProgressRing
                  percentage={project.progress.salesCompletion}
                  label=""
                  size={100}
                />
                <p className="text-center mt-4 text-2xl font-bold text-gray-900">{project.progress.salesCompletion}%</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Launch Progress</h3>
                <ProgressRing
                  percentage={project.progress.launchCompletion}
                  label=""
                  size={100}
                />
                <p className="text-center mt-4 text-2xl font-bold text-gray-900">{project.progress.launchCompletion}%</p>
              </div>
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Overall Progress</h3>
                <ProgressRing
                  percentage={project.progress.overall}
                  label=""
                  size={100}
                />
                <p className="text-center mt-4 text-2xl font-bold text-gray-900">{project.progress.overall}%</p>
              </div>
            <Link
              href={`/projects/${projectId}/handover-report`}
                className="metric-card hover:shadow-md transition-all duration-150 group cursor-pointer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-gray-900 transition-colors duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Handover Report</h3>
                <div className="flex flex-col items-center justify-center mt-8 mb-4">
                  <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mb-3">
                    <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                  </div>
                  <p className="text-sm text-gray-600 text-center">View complete handover report</p>
              </div>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="card mb-6 overflow-hidden">
            <div className="flex items-center border-b border-gray-100">
              {/* Date Selectors */}
              <div className="flex items-center gap-4 px-6 py-4 border-r border-gray-100">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Handover
                    </label>
                  </div>
                  <input
                    type="date"
                    value={project.handoverDate || ''}
                    onChange={(e) => handleDateChange('handoverDate', e.target.value)}
                    className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-150"
                  />
                </div>
                <div className="w-px h-7 bg-gray-200"></div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <label className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                      Completion
                    </label>
                  </div>
                  <input
                    type="date"
                    value={project.completionDate || ''}
                    onChange={(e) => handleDateChange('completionDate', e.target.value)}
                    className="px-3 py-1.5 text-sm text-gray-900 bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-150"
                    title={project.publishingStatus === 'Live' && !project.completionDate ? 'Auto-set when marked as Live' : ''}
                  />
                </div>
              </div>
              <nav className="flex flex-1">
                <Link
                  href={`/projects/${projectId}/sales`}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${
                    pathname === `/projects/${projectId}/sales`
                      ? 'text-gray-900 border-gray-900 bg-gray-50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Sales Handover
                </Link>
                <Link
                  href={`/projects/${projectId}/launch`}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${
                    pathname === `/projects/${projectId}/launch`
                      ? 'text-gray-900 border-gray-900 bg-gray-50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Launch Checklist
                </Link>
                <Link
                  href={`/projects/${projectId}/handover-report`}
                  className={`px-6 py-4 text-sm font-bold border-b-2 transition-all ${
                    pathname === `/projects/${projectId}/handover-report`
                      ? 'text-gray-900 border-gray-900 bg-gray-50'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Handover Report
                </Link>
              </nav>
            </div>
          </div>

          {/* Checklist Status Overview */}
          {config && (() => {
            const flattenedSales = flattenFields(config.sales);
            const flattenedLaunch = flattenFields(config.launch);
            
            const completedSales = flattenedSales.filter(f => !f.optional && isFieldCompleted(f, getFieldValue(f, true), true)).length;
            const totalSales = flattenedSales.filter(f => !f.optional).length;
            const completedLaunch = flattenedLaunch.filter(f => !f.optional && isFieldCompleted(f, getFieldValue(f, false), false)).length;
            const totalLaunch = flattenedLaunch.filter(f => !f.optional).length;
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="card p-6 border-2 border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">Sales Checklist Status</h3>
                    </div>
                    <span className="text-sm font-bold text-gray-900 bg-blue-50 border-2 border-blue-200 px-3 py-1.5 rounded-lg">
                      {completedSales} / {totalSales}
                    </span>
                  </div>
                  <div className={`space-y-2 scrollbar-hide ${salesExpanded ? 'max-h-none' : 'max-h-80 overflow-y-auto'}`}>
                    {(salesExpanded ? flattenedSales : flattenedSales.slice(0, 10)).map((field) => {
                      const value = getFieldValue(field, true);
                      const reqStatus = getRequirementStatus(field, true);
                      const notRelevant = isFieldNotRelevant(field, true);
                      return (
                        <div key={field.isSubField ? `${field.groupId}-${field.id}` : field.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <ChecklistStatus
                            field={field}
                            value={value}
                            requirementStatus={reqStatus}
                            isLaunch={false}
                            integrations={integrations}
                            notRelevant={notRelevant}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 pt-4 border-t-2 border-gray-100 flex items-center justify-between gap-3">
                    {flattenedSales.length > 10 && (
                      <button
                        onClick={() => setSalesExpanded(!salesExpanded)}
                        className="text-sm text-gray-700 hover:text-gray-900 font-semibold inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
                      >
                        {salesExpanded ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Show less
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            View all {flattenedSales.length} items
                          </>
                        )}
                      </button>
                    )}
                    <Link
                      href={`/projects/${projectId}/sales`}
                      className="btn-primary text-sm px-4 py-2.5 inline-flex items-center gap-2 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Checklist
                    </Link>
                  </div>
                </div>

                <div className="card p-6 border-2 border-gray-100 hover:border-gray-200 transition-colors">
                  <div className="flex items-center justify-between mb-6 pb-4 border-b-2 border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">Launch Checklist Status</h3>
                    </div>
                    <span className="text-sm font-bold text-gray-900 bg-green-50 border-2 border-green-200 px-3 py-1.5 rounded-lg">
                      {completedLaunch} / {totalLaunch}
                    </span>
                  </div>
                  <div className={`space-y-2 scrollbar-hide ${launchExpanded ? 'max-h-none' : 'max-h-80 overflow-y-auto'}`}>
                    {(launchExpanded ? flattenedLaunch : flattenedLaunch.slice(0, 10)).map((field) => {
                      const value = getFieldValue(field, false);
                      const reqStatus = getRequirementStatus(field, false);
                      const notRelevant = isFieldNotRelevant(field, false);
                      return (
                        <div key={field.isSubField ? `${field.groupId}-${field.id}` : field.id} className="p-3 rounded-lg hover:bg-gray-50 transition-colors">
                          <ChecklistStatus
                            field={field}
                            value={value}
                            requirementStatus={reqStatus}
                            isLaunch={true}
                            integrations={integrations}
                            notRelevant={notRelevant}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 pt-4 border-t-2 border-gray-100 flex items-center justify-between gap-3">
                    {flattenedLaunch.length > 10 && (
                      <button
                        onClick={() => setLaunchExpanded(!launchExpanded)}
                        className="text-sm text-gray-700 hover:text-gray-900 font-semibold inline-flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all"
                      >
                        {launchExpanded ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Show less
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                            View all {flattenedLaunch.length} items
                          </>
                        )}
                      </button>
                    )}
                    <Link
                      href={`/projects/${projectId}/launch`}
                      className="btn-primary text-sm px-4 py-2.5 inline-flex items-center gap-2 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Checklist
                    </Link>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Emails Panel */}
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">Emails</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 rounded-xl bg-gray-50 border-2 border-gray-100">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Missing Info Email</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Generate an email draft to request missing information from the brand (POC) based on the current checklist status.
                  </p>
                  <button
                    onClick={handleGenerateEmail}
                    className="btn-primary inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Generate Missing Info Email
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Project Info Summary */}
          <div className="card p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6 pb-4 border-b border-gray-100">Project Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Store URL (MyShopify)</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{project.storeUrlMyShopify || <span className="text-gray-400">Not provided</span>}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Store URL (Public)</p>
                <p className="text-sm font-semibold text-gray-900 break-all">{project.storePublicUrl || <span className="text-gray-400">Not provided</span>}</p>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Release Type</p>
                <span className="inline-flex items-center px-3 py-1 rounded-lg bg-gray-200 text-gray-900 text-sm font-semibold capitalize">
                  {project.releaseType}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-gray-50">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">POC Name</p>
                <p className="text-sm font-semibold text-gray-900">{project.poc.name || <span className="text-gray-400">Not provided</span>}</p>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
      <EmailModal
        isOpen={emailModalOpen}
        project={project}
        config={config}
        userName={user?.displayName || user?.email?.split('@')[0] || 'Appmaker Team'}
        onClose={() => setEmailModalOpen(false)}
      />
    </AuthGuard>
  );
}

