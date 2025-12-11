'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { ProgressBadge } from '@/components/ProgressBadge';
import { SkeletonCard } from '@/components/Skeleton';
import { getAllProjects } from '@/lib/firebase/firestore';
import { getProgressColor, getProgressBgColor, getStatusBadgeClasses } from '@/lib/utils/colors';
import { Project } from '@/types';

export const dynamic = 'force-dynamic';

export default function VersionsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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
    let filtered = projects;
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((project) =>
        project.brandName.toLowerCase().includes(query) ||
        project.collabCode?.toLowerCase().includes(query)
      );
    }
    
    setFilteredProjects(filtered);
  }, [searchQuery, projects]);

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
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Versions</h1>
                  <p className="text-gray-600">View and manage project versions</p>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col gap-4">
                {/* Search Bar */}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-900 text-lg font-semibold mb-2">
                {searchQuery ? 'No projects found' : 'No projects yet'}
              </p>
              <p className="text-gray-500 text-sm">
                {searchQuery ? 'Try adjusting your search query' : 'Projects will appear here once created'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project) => {
                const version = project.version || 1;
                return (
                  <div
                    key={project.id}
                    className="card p-6 hover:shadow-sm hover:border-gray-300 transition-all duration-200 group relative border-2 border-gray-100"
                  >
                    <Link
                      href={`/versions/${project.id}`}
                      className="block"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-gray-700 transition-colors truncate">
                            {project.brandName}
                          </h3>
                          <div className="flex items-center gap-2 flex-wrap">
                            {project.collabCode && (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold border border-gray-200">
                                {project.collabCode}
                              </span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold border border-purple-200">
                              Version {version}
                            </span>
                            {project.status && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${getStatusBadgeClasses(project.status)}`}>
                                {project.status}
                              </span>
                            )}
                            {project.publishingStatus && (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                                project.publishingStatus === 'Live' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                                project.publishingStatus === 'Under Review' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                project.publishingStatus === 'Subscribed' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                              }`}>
                                {project.publishingStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Overall Progress */}
                      <div className="mb-4">
                        <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-200">
                          <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
                              <span className="text-base font-bold text-gray-900">{project.progress.overall}%</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Overall Progress</div>
                              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-2.5 transition-all duration-500 rounded-full"
                                  style={{ 
                                    width: `${Math.min(100, Math.max(0, Number(project.progress.overall) || 0))}%`, 
                                    backgroundColor: getProgressBgColor(Number(project.progress.overall) || 0),
                                    minWidth: (Number(project.progress.overall) || 0) > 0 ? '4px' : '0' 
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="pt-3 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">View version details</span>
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
      </div>
    </AuthGuard>
  );
}
