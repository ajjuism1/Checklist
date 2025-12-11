/**
 * Get progress bar color based on percentage
 * Red (0-33%) -> Yellow (34-66%) -> Green (67-100%)
 */
export const getProgressColor = (percentage: number): string => {
  if (percentage >= 67) {
    return 'bg-green-500';
  } else if (percentage >= 34) {
    return 'bg-yellow-500';
  } else {
    return 'bg-red-500';
  }
};

/**
 * Get progress bar background color as hex for inline styles
 */
export const getProgressBgColor = (percentage: number): string => {
  if (percentage >= 67) {
    return '#10b981'; // green-500
  } else if (percentage >= 34) {
    return '#eab308'; // yellow-500
  } else {
    return '#ef4444'; // red-500
  }
};

/**
 * Get progress ring color based on percentage
 * Returns hex color for SVG
 */
export const getProgressRingColor = (percentage: number): string => {
  if (percentage >= 67) {
    return '#10b981'; // green-500
  } else if (percentage >= 34) {
    return '#eab308'; // yellow-500
  } else {
    return '#ef4444'; // red-500
  }
};

/**
 * Get status badge color classes based on status
 */
export const getStatusBadgeClasses = (status: string): string => {
  const statusMap: Record<string, { bg: string; text: string }> = {
    // Development statuses
    'Not Started': { bg: 'bg-gray-100', text: 'text-gray-700' },
    'In Progress': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'On HOLD': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'Completed': { bg: 'bg-green-100', text: 'text-green-700' },
    // Publishing statuses
    'Pending': { bg: 'bg-gray-100', text: 'text-gray-700' },
    'Subscribed': { bg: 'bg-blue-100', text: 'text-blue-700' },
    'Under Review': { bg: 'bg-amber-100', text: 'text-amber-700' },
    'Live': { bg: 'bg-purple-100', text: 'text-purple-700' },
  };

  const config = statusMap[status] || statusMap['Not Started'];
  return `${config.bg} ${config.text}`;
};

