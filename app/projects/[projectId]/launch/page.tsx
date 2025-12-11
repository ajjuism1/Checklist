'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { DynamicForm } from '@/components/DynamicForm';
import { Toast } from '@/components/Toast';
import { Skeleton, SkeletonFormField } from '@/components/Skeleton';
import { getProject, getChecklistConfig, updateProject, calculateProgress } from '@/lib/firebase/firestore';
import { Project, ChecklistConfig } from '@/types';

export const dynamic = 'force-dynamic';

export default function LaunchChecklistPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [project, setProject] = useState<Project | null>(null);
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

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
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: Record<string, any>) => {
    if (!project || !config) return;

    // Calculate progress (launch checklist requires requirement checks)
    const launchCompletion = await calculateProgress(data, config.launch, true);
    const overall = Math.round((project.progress.salesCompletion + launchCompletion) / 2);

    await updateProject(projectId, {
      checklists: {
        ...project.checklists,
        launch: data,
      },
      progress: {
        ...project.progress,
        launchCompletion,
        overall,
      },
    });

    await loadData();
    setToastMessage('Launch checklist saved successfully!');
    setToastType('success');
    setShowToast(true);
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
            <div className="card p-8">
              <div className="mb-8 pb-6 border-b border-gray-100">
                <Skeleton variant="rectangular" width="250px" height="28px" className="mb-2" />
                <Skeleton variant="rectangular" width="400px" height="16px" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonFormField key={i} />
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

  // Auto-populate integrations from sales checklist if they exist
  const getInitialData = () => {
    const launchData = { ...project.checklists.launch };
    
    // Check if sales checklist has integrations
    // Sales structure: sales.integrations.integrations (group.field)
    const salesIntegrationsGroup = project.checklists.sales?.integrations;
    const salesIntegrationsArray = salesIntegrationsGroup?.integrations && Array.isArray(salesIntegrationsGroup.integrations)
      ? salesIntegrationsGroup.integrations
      : [];
    
    // If sales has integrations and launch doesn't have any yet, copy them
    if (salesIntegrationsArray.length > 0) {
      // Launch structure: launch.integrations.integrations (group.field) - updated after config change
      const launchIntegrationsGroup = launchData.integrations || {};
      const currentLaunchIntegrations = launchIntegrationsGroup.integrations || [];
      const hasLaunchIntegrations = Array.isArray(currentLaunchIntegrations) && currentLaunchIntegrations.length > 0;
      
      if (!hasLaunchIntegrations) {
        // Copy sales integrations to launch
        launchData.integrations = {
          ...launchIntegrationsGroup,
          integrations: [...salesIntegrationsArray], // Copy array to avoid reference issues
        };
      }
    }
    
    return launchData;
  };

  const initialData = getInitialData();

  // Calculate available versions - use versionHistory if available, otherwise calculate from data
  const getAvailableVersions = (): number[] => {
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
    
    // Check nested group fields
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
    
    // Always include version 1 and current version
    const currentVersion = project.version || 1;
    const finalVersions = new Set([1, currentVersion, ...calculatedVersions]);
    
    return Array.from(finalVersions).sort((a, b) => a - b);
  };

  const availableVersions = getAvailableVersions();

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
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Launch Checklist</h1>
                <p className="text-gray-600 text-lg">{project.brandName}</p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {/* Form */}
          <DynamicForm
            fields={config.launch}
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel="Save Launch Checklist"
            projectVersion={project.version || 1}
            availableVersions={availableVersions}
          />
          </div>
        </div>
        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

