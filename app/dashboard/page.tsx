'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { ProgressBadge } from '@/components/ProgressBadge';
import { Loading } from '@/components/Loading';
import { Skeleton, SkeletonMetricCard, SkeletonTableRow } from '@/components/Skeleton';
import { Toast } from '@/components/Toast';
import { getAllProjects, createProject } from '@/lib/firebase/firestore';
import { getProgressColor, getProgressBgColor, getStatusBadgeClasses } from '@/lib/utils/colors';
import { Project } from '@/types';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const router = useRouter();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const allProjects = await getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    if (filter === 'completed') return project.progress.overall === 100;
    if (filter === 'active') return project.progress.overall < 100;
    return true;
  });

  const activeProjects = projects.filter((p) => p.progress.overall < 100).length;
  const avgProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + p.progress.overall, 0) / projects.length
        )
      : 0;

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      setToastMessage('Please enter a brand name');
      setToastType('error');
      setShowToast(true);
      return;
    }

    try {
      const projectId = await createProject({
        brandName: newProjectName,
        storeUrlMyShopify: '',
        storePublicUrl: '',
        collabCode: '',
        scopeOfWork: '',
        designRefs: [],
        additionalDocs: [],
        paymentConfirmation: false,
        planDetails: '',
        revenueShare: 0,
        gmvInfo: '',
        releaseType: 'fresh',
        dunsStatus: '',
        poc: { name: '', email: '', phone: '' },
        status: 'Not Started',
        checklists: {
          sales: {},
          launch: {},
        },
      });

      setShowCreateModal(false);
      setNewProjectName('');
      await loadProjects();
      setToastMessage('Project created successfully!');
      setToastType('success');
      setShowToast(true);
      router.push(`/projects/${projectId}`);
    } catch (error) {
      console.error('Error creating project:', error);
      setToastMessage('Failed to create project. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64 overflow-y-auto h-screen">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-gray-50">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
                  <p className="text-gray-600 text-lg">Overview of all projects and progress</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Project
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {loading ? (
                <>
                  <SkeletonMetricCard />
                  <SkeletonMetricCard />
                  <SkeletonMetricCard />
                </>
              ) : (
                <>
                  <div className="metric-card group transition-all duration-150">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-150">
                        <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Total Projects</h3>
                    <p className="text-5xl font-bold text-gray-900 mb-1">{projects.length}</p>
                    <p className="text-sm text-gray-500">All projects in system</p>
                  </div>
                  <div className="metric-card group transition-all duration-150">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center group-hover:bg-green-200 transition-colors duration-150">
                        <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Active Projects</h3>
                    <p className="text-5xl font-bold text-gray-900 mb-1">{activeProjects}</p>
                    <p className="text-sm text-gray-500">In progress</p>
                  </div>
                  <div className="metric-card group transition-all duration-150">
                    <div className="flex items-center justify-between mb-6">
                      <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:bg-purple-200 transition-colors duration-150">
                        <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Average Progress</h3>
                    <p className="text-5xl font-bold text-gray-900 mb-1">{avgProgress}%</p>
                    <p className="text-sm text-gray-500">Across all projects</p>
                  </div>
                </>
              )}
            </div>

            {/* Filters */}
            <div className="mb-6 flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-150 ${
                  filter === 'all'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('active')}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-150 ${
                  filter === 'active'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilter('completed')}
                className={`px-5 py-2.5 rounded-xl font-semibold transition-all duration-150 ${
                  filter === 'completed'
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-sm'
                }`}
              >
                Completed
              </button>
            </div>

            {/* Projects Table */}
            {loading ? (
              <div className="card overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <Skeleton variant="rectangular" width="100px" height="20px" />
                    <Skeleton variant="rectangular" width="80px" height="24px" className="rounded-lg" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Brand Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Sales Progress
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Launch Progress
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Overall
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <SkeletonTableRow key={i} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="card p-16 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-gray-900 text-lg font-semibold mb-2">No projects found</p>
                <p className="text-gray-500 text-sm mb-6">Try adjusting your filters or create a new project</p>
                <Link href="/projects" className="btn-primary inline-flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </Link>
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-gray-900">Projects</h2>
                    <span className="text-sm font-semibold text-gray-500 bg-white px-3 py-1 rounded-lg">
                      {filteredProjects.length} {filteredProjects.length === 1 ? 'project' : 'projects'}
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Brand Name
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Sales Progress
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Launch Progress
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Overall
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {filteredProjects.map((project) => {
                        return (
                          <tr key={project.id} className="hover:bg-gray-50 transition-colors duration-150 group">
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="text-sm font-bold text-gray-900 group-hover:text-gray-700 transition-colors mb-1">
                                    {project.brandName}
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                  {project.collabCode && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 text-xs font-semibold">
                                        {project.collabCode}
                                      </span>
                                  )}
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${getStatusBadgeClasses(project.status || 'Not Started')}`}>
                                      {project.status || 'Not Started'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                                  <div
                                    className="block h-2.5 transition-all duration-500 rounded-full"
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, Number(project.progress.salesCompletion) || 0))}%`, 
                                      backgroundColor: getProgressBgColor(Number(project.progress.salesCompletion) || 0),
                                      minWidth: (Number(project.progress.salesCompletion) || 0) > 0 ? '2px' : '0' 
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-gray-900 min-w-[45px]">{project.progress.salesCompletion}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                                  <div
                                    className="block h-2.5 transition-all duration-500 rounded-full"
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, Number(project.progress.launchCompletion) || 0))}%`, 
                                      backgroundColor: getProgressBgColor(Number(project.progress.launchCompletion) || 0),
                                      minWidth: (Number(project.progress.launchCompletion) || 0) > 0 ? '2px' : '0' 
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-gray-900 min-w-[45px]">{project.progress.launchCompletion}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden min-w-[100px]">
                                  <div
                                    className="block h-2.5 transition-all duration-500 rounded-full"
                                    style={{ 
                                      width: `${Math.min(100, Math.max(0, Number(project.progress.overall) || 0))}%`, 
                                      backgroundColor: getProgressBgColor(Number(project.progress.overall) || 0),
                                      minWidth: (Number(project.progress.overall) || 0) > 0 ? '2px' : '0' 
                                    }}
                                  />
                                </div>
                                <span className="text-sm font-bold text-gray-900 min-w-[45px]">{project.progress.overall}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <Link
                                href={`/projects/${project.id}`}
                                className="text-sm font-semibold text-gray-900 hover:text-gray-700 transition-colors duration-150 inline-flex items-center gap-2 group/link"
                              >
                                View
                                <svg className="w-4 h-4 group-hover/link:translate-x-0.5 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Project</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter brand name"
                    className="input-field"
                    onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewProjectName('');
                    }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateProject}
                    className="btn-primary"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

