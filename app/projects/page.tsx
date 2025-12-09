'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { ProgressBadge } from '@/components/ProgressBadge';
import { SkeletonCard } from '@/components/Skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Toast } from '@/components/Toast';
import { getAllProjects, createProject, deleteProject, updateProject } from '@/lib/firebase/firestore';
import { getProgressColor, getProgressBgColor, getStatusBadgeClasses } from '@/lib/utils/colors';
import { Project } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ projectId: string; projectName: string } | null>(null);
  const [editingProject, setEditingProject] = useState<{ id: string; name: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
      setFilteredProjects(allProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProjects(projects);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = projects.filter((project) =>
        project.brandName.toLowerCase().includes(query) ||
        project.collabCode?.toLowerCase().includes(query)
      );
      setFilteredProjects(filtered);
    }
  }, [searchQuery, projects]);

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return;

    try {
      await deleteProject(deleteConfirm.projectId);
      setDeleteConfirm(null);
      await loadProjects();
      setToastMessage('Project deleted successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('Error deleting project:', error);
      setToastMessage('Failed to delete project. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

  const handleEditProject = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingProject({ id: project.id, name: project.brandName });
  };

  const handleDeleteClick = (project: Project, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm({ projectId: project.id, projectName: project.brandName });
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editingProject.name.trim()) return;

    try {
      await updateProject(editingProject.id, { brandName: editingProject.name.trim() });
      setEditingProject(null);
      await loadProjects();
      setToastMessage('Project updated successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (error) {
      console.error('Error updating project:', error);
      setToastMessage('Failed to update project. Please try again.');
      setToastType('error');
      setShowToast(true);
    }
  };

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
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Projects</h1>
                  <p className="text-gray-600">Manage and track all projects</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Project
                </button>
              </div>

              {/* Sticky Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects by name or collab code..."
                  className="input-field pl-12"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  >
                    <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="card p-16 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="text-gray-900 text-lg font-semibold mb-2">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {searchQuery ? 'Try adjusting your search query' : 'Create your first project to get started'}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary inline-flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Project
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                return (
                  <div
                    key={project.id}
                    className="card p-5 hover:shadow-md transition-all duration-150 group relative"
                  >
                    {/* Actions Menu */}
                    <div className="absolute top-3 right-3">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === project.id ? null : project.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                          </svg>
                        </button>
                        {openMenuId === project.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpenMenuId(null);
                              }}
                            />
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              <button
                                onClick={(e) => {
                                  handleEditProject(project, e);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  handleDeleteClick(project, e);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/projects/${project.id}`}
                      className="block"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3 pr-8">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors truncate">
                            {project.brandName}
                          </h3>
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

                    {/* Overall Progress */}
                      <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Overall Progress</span>
                        <span className="text-sm font-bold text-gray-900">{project.progress.overall}%</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="block h-2.5 transition-all duration-500 rounded-full"
                          style={{ 
                            width: `${Math.min(100, Math.max(0, Number(project.progress.overall) || 0))}%`, 
                            backgroundColor: getProgressBgColor(Number(project.progress.overall) || 0),
                            minWidth: (Number(project.progress.overall) || 0) > 0 ? '2px' : '0' 
                          }}
                        />
                      </div>
                    </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">View details</span>
                        <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  </div>
                );
              })}
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

        {/* Edit Project Modal */}
        {editingProject && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="card p-6 max-w-md w-full shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Project</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                    Brand Name
                  </label>
                  <input
                    type="text"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                    placeholder="Enter brand name"
                    className="input-field"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && editingProject.name.trim()) {
                        handleUpdateProject();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="flex gap-3 justify-end pt-2">
                  <button
                    onClick={() => setEditingProject(null)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateProject}
                    disabled={!editingProject.name.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={!!deleteConfirm}
          title="Delete Project"
          message={`Are you sure you want to delete "${deleteConfirm?.projectName}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
          onConfirm={handleDeleteProject}
          onCancel={() => setDeleteConfirm(null)}
        />

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

