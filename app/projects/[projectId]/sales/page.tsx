'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { DynamicForm } from '@/components/DynamicForm';
import { Toast } from '@/components/Toast';
import { Loading } from '@/components/Loading';
import { Skeleton, SkeletonFormField } from '@/components/Skeleton';
import { getProject, getChecklistConfig, updateProject, calculateProgress } from '@/lib/firebase/firestore';
import { Project, ChecklistConfig, SalesChecklistData } from '@/types';

export default function SalesHandoverPage() {
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
  }, [projectId]);

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

    // Map form data to project structure
    const salesData: Partial<Project> = {
      brandName: data.brandName || project.brandName,
      storeUrlMyShopify: data.storeUrlMyShopify || project.storeUrlMyShopify,
      storePublicUrl: data.storePublicUrl || project.storePublicUrl,
      collabCode: data.collabCode || project.collabCode,
      scopeOfWork: data.scopeOfWork || project.scopeOfWork,
      designRefs: data.designRefs || project.designRefs,
      additionalDocs: data.additionalDocs || project.additionalDocs,
      paymentConfirmation: data.paymentConfirmation ?? project.paymentConfirmation,
      planDetails: data.planDetails || project.planDetails,
      revenueShare: data.revenueShare || project.revenueShare,
      gmvInfo: data.gmvInfo || project.gmvInfo,
      releaseType: data.releaseType || project.releaseType,
      dunsStatus: data.dunsStatus || project.dunsStatus,
      poc: data.poc || project.poc,
      checklists: {
        ...project.checklists,
        sales: data,
      },
    };

    // Calculate progress (sales checklist doesn't require requirement checks)
    const salesCompletion = await calculateProgress(data, config.sales, false);
    const overall = Math.round((salesCompletion + project.progress.launchCompletion) / 2);

    await updateProject(projectId, {
      ...salesData,
      progress: {
        ...project.progress,
        salesCompletion,
        overall,
      },
    });

    await loadData();
    setToastMessage('Sales handover data saved successfully!');
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

  // Map project data to form format
  const initialData = {
    brandName: project.brandName,
    storeUrlMyShopify: project.storeUrlMyShopify,
    storePublicUrl: project.storePublicUrl,
    collabCode: project.collabCode,
    scopeOfWork: project.scopeOfWork,
    designRefs: project.designRefs,
    additionalDocs: project.additionalDocs,
    paymentConfirmation: project.paymentConfirmation,
    planDetails: project.planDetails,
    revenueShare: project.revenueShare,
    gmvInfo: project.gmvInfo,
    releaseType: project.releaseType,
    dunsStatus: project.dunsStatus,
    poc: project.poc,
    ...project.checklists.sales,
  };

  // Helper function to determine if a field is required/mandatory
  const isFieldRequired = (field: any): boolean => {
    // If explicitly marked as required, it's mandatory
    if (field.required === true) return true;
    // If explicitly marked as optional, it's not required
    if (field.optional === true) return false;
    // Default: if neither is set, field is required
    return true;
  };

  // Calculate completion stats - only count non-optional fields
  let completedFields = 0;
  let totalRequiredFields = 0;

  for (const field of config.sales) {
    // Skip if field is marked as not relevant
    if (initialData[`${field.id}_notRelevant`] === true) {
      continue;
    }

    if (field.type === 'group') {
      // Handle group fields - check each sub-field individually
      if (field.fields) {
        for (const subField of field.fields) {
          // Skip if subfield is marked as not relevant or is optional
          const subFieldNotRelevant = initialData[field.id]?.[`${subField.id}_notRelevant`] === true;
          if (isFieldRequired(subField) && !subFieldNotRelevant) {
            totalRequiredFields++;
            const value = initialData[field.id]?.[subField.id];
            
            let isCompleted = false;
            if (subField.type === 'checkbox') {
              isCompleted = value === true;
            } else if (subField.type === 'multi_input') {
              if (Array.isArray(value) && value.length > 0) {
                const allFilled = value.every((item: any) => {
                  if (typeof item === 'string') {
                    return item.trim() !== '';
                  }
                  // Handle object format {value, status}
                  return item.value && item.value.toString().trim() !== '';
                });
                isCompleted = allFilled;
              }
            } else if (subField.type === 'multi_select') {
              isCompleted = Array.isArray(value) && value.length > 0;
            } else if (subField.type === 'select') {
              isCompleted = value && value.toString().trim() !== '';
            } else {
              isCompleted = value && value.toString().trim() !== '';
            }
            
            if (isCompleted) completedFields++;
          }
        }
      }
    } else {
      // Handle regular fields - only count non-optional fields
      if (isFieldRequired(field)) {
        totalRequiredFields++;
        const value = initialData[field.id];
        
        let isCompleted = false;
        if (field.type === 'checkbox') {
          isCompleted = value === true;
        } else if (field.type === 'multi_input') {
          if (Array.isArray(value) && value.length > 0) {
            const allFilled = value.every((item: any) => {
              if (typeof item === 'string') {
                return item.trim() !== '';
              }
              // Handle object format {value, status}
              return item.value && item.value.toString().trim() !== '';
            });
            isCompleted = allFilled;
          }
        } else if (field.type === 'multi_select') {
          isCompleted = Array.isArray(value) && value.length > 0;
        } else if (field.type === 'select') {
          isCompleted = value && value.toString().trim() !== '';
        } else {
          isCompleted = value && value.toString().trim() !== '';
        }
        
        if (isCompleted) completedFields++;
      }
    }
  }

  const completionPercentage = totalRequiredFields > 0 
    ? Math.round((completedFields / totalRequiredFields) * 100) 
    : 0;

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
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Sales Handover</h1>
                  <p className="text-gray-600 text-lg">{project.brandName}</p>
                </div>
                <div className="text-right">
                  <div className={`px-4 py-2 rounded-xl font-semibold text-sm mb-2 ${
                    completionPercentage === 100 
                      ? 'bg-green-100 text-green-700' 
                      : completionPercentage >= 50 
                      ? 'bg-yellow-100 text-yellow-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {completionPercentage}% Complete
                  </div>
                  <p className="text-xs text-gray-500">{completedFields} of {totalRequiredFields} required fields</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {/* Form */}
          <DynamicForm
            fields={config.sales}
            initialData={initialData}
            onSubmit={handleSubmit}
            submitLabel="Save Sales Handover"
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

