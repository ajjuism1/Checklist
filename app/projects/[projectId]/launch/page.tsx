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
      // Launch structure: launch.accessCredentials.integrations (group.field)
      const launchAccessCredentials = launchData.accessCredentials || {};
      const currentLaunchIntegrations = launchAccessCredentials.integrations || [];
      const hasLaunchIntegrations = Array.isArray(currentLaunchIntegrations) && currentLaunchIntegrations.length > 0;
      
      if (!hasLaunchIntegrations) {
        // Copy sales integrations to launch
        launchData.accessCredentials = {
          ...launchAccessCredentials,
          integrations: [...salesIntegrationsArray], // Copy array to avoid reference issues
        };
      }
    }
    
    return launchData;
  };

  const initialData = getInitialData();

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

