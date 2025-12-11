'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Loading } from '@/components/Loading';
import { Skeleton } from '@/components/Skeleton';
import { getAllProjects } from '@/lib/firebase/firestore';
import { Project, ProjectStatus, PublishingStatus } from '@/types';
import { getStatusBadgeClasses } from '@/lib/utils/colors';

interface LaunchPipelineReport {
  projectId: string;
  brandName: string;
  mrr: number;
  percentageRevenue: number;
  fixedPricing: string;
  status: ProjectStatus;
  publishingStatus?: PublishingStatus;
  themeType: string;
  gmv: number;
  iarPercentage: number;
  annualAppRevenue: number;
  monthlyAppRevenue: number;
  transactional: number;
  fixedPrice: number;
  handoverDate: string | null;
  completionDate: string | null;
  currentVersion: number;
  liveVersion: number | null;
}

export const dynamic = 'force-dynamic';

export default function ReportsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<LaunchPipelineReport[]>([]);
  const [filteredReportData, setFilteredReportData] = useState<LaunchPipelineReport[]>([]);
  const [iarPercentages, setIarPercentages] = useState<Record<string, number>>({});
  const [filters, setFilters] = useState({
    status: 'all' as string,
    themeType: 'all' as string,
    handoverMonth: 'all' as string,
  });
  const [summary, setSummary] = useState({
    totalProjects: 0,
    mrrPendingRealisation: 0,
    realisedMRR: 0,
    projectsByStatus: {} as Record<ProjectStatus, number>,
    projectsByTheme: {} as Record<string, number>,
    liveProjectsCount: 0,
  });

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      generateReport();
    }
  }, [projects, iarPercentages]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Apply filters to report data
    let filtered = [...reportData];
    
    if (filters.status !== 'all') {
      filtered = filtered.filter(report => report.status === filters.status);
    }
    
    if (filters.themeType !== 'all') {
      filtered = filtered.filter(report => report.themeType === filters.themeType);
    }
    
    if (filters.handoverMonth !== 'all') {
      filtered = filtered.filter(report => {
        if (!report.handoverDate) return false;
        const handoverDate = new Date(report.handoverDate);
        const monthYear = `${handoverDate.getFullYear()}-${String(handoverDate.getMonth() + 1).padStart(2, '0')}`;
        return monthYear === filters.handoverMonth;
      });
    }
    
    setFilteredReportData(filtered);
  }, [reportData, filters]);

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

  // Helper function to extract numeric value from text (handles currency, commas, etc.)
  const extractNumericValue = (text: string | undefined | null): number => {
    if (!text) return 0;
    
    // Remove currency symbols, commas, and whitespace, then extract numbers
    const cleaned = text.toString().replace(/[$,£€¥₹\s,]/g, '');
    const match = cleaned.match(/[\d.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Helper function to extract fixed monthly rate from planDetails
  const extractFixedMonthlyRate = (planDetails: string | undefined | null): number => {
    if (!planDetails) return 0;
    
    // Try to find monthly rate patterns like "$500/month", "500/month", "500/mo", etc.
    const monthlyPatterns = [
      /\$?([\d,]+\.?\d*)\s*\/\s*(?:month|mo|monthly)/i,
      /\$?([\d,]+\.?\d*)\s*per\s*(?:month|mo)/i,
      /monthly[:\s]*\$?([\d,]+\.?\d*)/i,
    ];
    
    for (const pattern of monthlyPatterns) {
      const match = planDetails.match(pattern);
      if (match) {
        return extractNumericValue(match[1]);
      }
    }
    
    // If no monthly pattern found, try to extract any number (might be annual, so divide by 12)
    const anyNumber = extractNumericValue(planDetails);
    // Only use if it's a reasonable monthly amount (less than 100k)
    if (anyNumber > 0 && anyNumber < 100000) {
      return anyNumber;
    }
    
    return 0;
  };

  // Calculate MRR components based on new formula
  const calculateMRRComponents = (
    project: Project,
    iarPercentage: number
  ): {
    fixedPrice: number;
    annualAppRevenue: number;
    monthlyAppRevenue: number;
    transactional: number;
    mrr: number;
  } => {
    // Get fixed monthly rate from planDetails
    const fixedPrice = extractFixedMonthlyRate(
      project.checklists?.sales?.financialInformation?.planDetails || 
      project.planDetails
    );
    
    // Get GMV from gmvInfo
    const gmvText = project.checklists?.sales?.financialInformation?.gmvInfo || 
                    project.gmvInfo || 
                    '';
    const gmv = extractNumericValue(gmvText);
    
    // Get revenue share percentage
    const revenueShareText = 
      project.checklists?.sales?.financialInformation?.revenueShare ||
      project.checklists?.sales?.revenueShare ||
      project.revenueShare ||
      '0';
    const revenueSharePercentage = extractNumericValue(revenueShareText.toString());
    
    // Annual App Revenue = GMV * IAR%
    const annualAppRevenue = gmv * (iarPercentage / 100);
    
    // Monthly App Revenue = Annual App Revenue / 12
    const monthlyAppRevenue = annualAppRevenue / 12;
    
    // Transactional = Monthly App Revenue * Revenue Share %
    const transactional = monthlyAppRevenue * (revenueSharePercentage / 100);
    
    // Total MRR = Transactional + Fixed Price
    const mrr = transactional + fixedPrice;
    
    return {
      fixedPrice: Math.round(fixedPrice * 100) / 100,
      annualAppRevenue: Math.round(annualAppRevenue * 100) / 100,
      monthlyAppRevenue: Math.round(monthlyAppRevenue * 100) / 100,
      transactional: Math.round(transactional * 100) / 100,
      mrr: Math.round(mrr * 100) / 100,
    };
  };

  const generateReport = () => {
    const reports: LaunchPipelineReport[] = projects.map((project) => {
      // Extract brand name
      const brandName = 
        project.checklists?.sales?.projectBasicInfo?.brandName ||
        project.checklists?.sales?.brandName ||
        project.brandName ||
        'Unknown';

      // Extract percentage revenue (revenue share)
      const revenueShareText = 
        project.checklists?.sales?.financialInformation?.revenueShare ||
        project.checklists?.sales?.revenueShare ||
        project.revenueShare ||
        '0';
      const percentageRevenue = extractNumericValue(revenueShareText.toString());

      // Extract fixed pricing (planDetails)
      const fixedPricing = 
        project.checklists?.sales?.financialInformation?.planDetails ||
        project.planDetails ||
        'Not specified';

      // Extract status - migrate old 'Live' status
      let status: ProjectStatus = (project.status as ProjectStatus) || 'Not Started';
      let publishingStatus = project.publishingStatus;
      
      // Handle migration of old 'Live' status
      if ((project.status as string) === 'Live') {
        status = 'Completed';
        if (!publishingStatus) {
          publishingStatus = 'Live';
        }
      }

      // Extract theme type
      const themeType = 
        project.checklists?.sales?.projectBasicInfo?.themeType ||
        project.checklists?.sales?.themeType ||
        'Not specified';

      // Extract GMV
      const gmvText = 
        project.checklists?.sales?.financialInformation?.gmvInfo || 
        project.gmvInfo || 
        '';
      const gmv = extractNumericValue(gmvText);

      // Get IAR% (default to 15% if not set)
      const iarPercentage = iarPercentages[project.id] ?? 15;

      // Calculate MRR components
      const mrrComponents = calculateMRRComponents(project, iarPercentage);

      // Get current version (version selected on project detail page dropdown)
      const currentVersion = project.version || 1;
      
      // Calculate live version (version before current version)
      // If current version is 1, there's no live version (null)
      // Otherwise, live version is currentVersion - 1
      const liveVersion = currentVersion > 1 ? currentVersion - 1 : null;

      return {
        projectId: project.id,
        brandName,
        mrr: mrrComponents.mrr,
        percentageRevenue,
        fixedPricing,
        status,
        publishingStatus,
        themeType,
        gmv,
        iarPercentage,
        annualAppRevenue: mrrComponents.annualAppRevenue,
        monthlyAppRevenue: mrrComponents.monthlyAppRevenue,
        transactional: mrrComponents.transactional,
        fixedPrice: mrrComponents.fixedPrice,
        handoverDate: project.handoverDate || null,
        completionDate: project.completionDate || null,
        currentVersion,
        liveVersion,
      };
    });

    // Calculate summary statistics
    // MRR Pending Realisation: Sum of MRR for projects that are NOT "Live"
    const mrrPendingRealisation = reports
      .filter(r => r.publishingStatus !== 'Live')
      .reduce((sum, r) => sum + r.mrr, 0);
    
    // Realised MRR: Sum of MRR for projects with publishingStatus "Live"
    const realisedMRR = reports
      .filter(r => r.publishingStatus === 'Live')
      .reduce((sum, r) => sum + r.mrr, 0);
    
    const projectsByStatus = reports.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {} as Record<ProjectStatus, number>);

    // Count Live projects by publishingStatus
    const liveProjectsCount = reports.filter(r => r.publishingStatus === 'Live').length;

    const projectsByTheme = reports.reduce((acc, r) => {
      acc[r.themeType] = (acc[r.themeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    setReportData(reports);
    setFilteredReportData(reports); // Initialize filtered data with all reports
    setSummary({
      totalProjects: projects.length,
      mrrPendingRealisation: Math.round(mrrPendingRealisation * 100) / 100,
      realisedMRR: Math.round(realisedMRR * 100) / 100,
      projectsByStatus,
      projectsByTheme,
      liveProjectsCount,
    });
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Get unique months from handover dates
  const getAvailableMonths = (): Array<{ value: string; label: string }> => {
    const months = new Set<string>();
    reportData.forEach(report => {
      if (report.handoverDate) {
        const date = new Date(report.handoverDate);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.add(monthYear);
      }
    });
    
    return Array.from(months)
      .sort()
      .reverse() // Most recent first
      .map(monthYear => {
        const [year, month] = monthYear.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        return {
          value: monthYear,
          label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
        };
      });
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="mb-8">
              <Skeleton variant="rectangular" width="200px" height="48px" className="mb-2" />
              <Skeleton variant="rectangular" width="400px" height="20px" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="card p-6">
                  <Skeleton variant="rectangular" width="100%" height="60px" />
                </div>
              ))}
            </div>
            <div className="card p-6">
              <Skeleton variant="rectangular" width="100%" height="400px" />
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
              <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-2">Reports</h1>
                <p className="text-gray-600 text-lg">Overall summary and launch pipeline reports</p>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">
            {/* Summary Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Total Projects</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.totalProjects}</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">MRR Pending Realisation</h3>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.mrrPendingRealisation)}</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Realised MRR</h3>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(summary.realisedMRR)}</p>
              </div>

              <div className="metric-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Projects</h3>
                <p className="text-3xl font-bold text-gray-900">{summary.liveProjectsCount || 0}</p>
              </div>
            </div>

            {/* Launch Pipeline Report */}
            <div className="card mb-6">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Launch Pipeline Report</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      MRR calculation breakdown with editable IAR% values
                    </p>
                  </div>
                </div>
                
                {/* Filters */}
                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Status:</label>
                    <select
                      value={filters.status}
                      onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="all">All Statuses</option>
                      {Object.keys(summary.projectsByStatus).map((status) => (
                        <option key={status} value={status}>
                          {status} ({summary.projectsByStatus[status as ProjectStatus]})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Theme Type:</label>
                    <select
                      value={filters.themeType}
                      onChange={(e) => setFilters({ ...filters, themeType: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="all">All Themes</option>
                      {Object.keys(summary.projectsByTheme).map((theme) => (
                        <option key={theme} value={theme}>
                          {theme} ({summary.projectsByTheme[theme]})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Handover Month:</label>
                    <select
                      value={filters.handoverMonth}
                      onChange={(e) => setFilters({ ...filters, handoverMonth: e.target.value })}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                    >
                      <option value="all">All Months</option>
                      {getAvailableMonths().map((month) => (
                        <option key={month.value} value={month.value}>
                          {month.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {(filters.status !== 'all' || filters.themeType !== 'all' || filters.handoverMonth !== 'all') && (
                    <button
                      onClick={() => setFilters({ status: 'all', themeType: 'all', handoverMonth: 'all' })}
                      className="ml-auto px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-semibold hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                  
                  <div className="ml-auto text-sm text-gray-600">
                    Showing <span className="font-bold text-gray-900">{filteredReportData.length}</span> of {reportData.length} projects
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Brand Name
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        GMV
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        IAR%
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Annual App Revenue
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Monthly App Revenue
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Revenue Share %
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Transactional
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Fixed Price
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Total MRR
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Development Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Publishing Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Theme Type
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Handover Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Completion Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Current Version
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Live Version
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredReportData.length === 0 ? (
                      <tr>
                        <td colSpan={16} className="px-6 py-12 text-center text-gray-500">
                          {reportData.length === 0 ? 'No projects found' : 'No projects match the selected filters'}
                        </td>
                      </tr>
                    ) : (
                      filteredReportData.map((report, index) => (
                        <tr key={report.projectId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">{report.brandName}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{formatCurrency(report.gmv)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={report.iarPercentage || 15}
                              onChange={(e) => {
                                const inputValue = e.target.value;
                                if (inputValue === '' || inputValue === null) {
                                  // If cleared, set back to default 15
                                  setIarPercentages({
                                    ...iarPercentages,
                                    [report.projectId]: 15,
                                  });
                                } else {
                                  const newValue = parseFloat(inputValue);
                                  if (!isNaN(newValue) && newValue >= 0 && newValue <= 100) {
                                    setIarPercentages({
                                      ...iarPercentages,
                                      [report.projectId]: newValue,
                                    });
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                // Ensure value is always set, default to 15 if empty
                                const value = parseFloat(e.target.value);
                                if (isNaN(value) || value === 0) {
                                  setIarPercentages({
                                    ...iarPercentages,
                                    [report.projectId]: 15,
                                  });
                                }
                              }}
                              className="w-20 px-2 py-1 text-sm font-semibold text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <span className="ml-1 text-sm text-gray-600">%</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{formatCurrency(report.annualAppRevenue)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{formatCurrency(report.monthlyAppRevenue)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{report.percentageRevenue}%</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{formatCurrency(report.transactional)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-gray-900">{formatCurrency(report.fixedPrice)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-bold text-blue-600">{formatCurrency(report.mrr)}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusBadgeClasses(report.status)}`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusBadgeClasses(report.publishingStatus || 'Pending')}`}>
                              {report.publishingStatus || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{report.themeType}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {report.handoverDate 
                                ? new Date(report.handoverDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : <span className="text-gray-400">—</span>
                              }
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {report.completionDate 
                                ? new Date(report.completionDate).toLocaleDateString('en-US', { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                  })
                                : <span className="text-gray-400">—</span>
                              }
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              Version {report.currentVersion}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {report.liveVersion !== null 
                                ? <span className="font-semibold">Version {report.liveVersion}</span>
                                : <span className="text-gray-400">—</span>
                              }
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Additional Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Projects by Status */}
              <div className="card">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Projects by Status</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(summary.projectsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{status}</span>
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getStatusBadgeClasses(status as ProjectStatus)}`}>
                          {count}
                        </span>
                      </div>
                    ))}
                    {Object.keys(summary.projectsByStatus).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No status data available</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Projects by Theme */}
              <div className="card">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900">Projects by Theme Type</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {Object.entries(summary.projectsByTheme).map(([theme, count]) => (
                      <div key={theme} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">{theme}</span>
                        <span className="px-3 py-1 rounded-lg text-sm font-bold bg-gray-100 text-gray-900">
                          {count}
                        </span>
                      </div>
                    ))}
                    {Object.keys(summary.projectsByTheme).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No theme data available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

