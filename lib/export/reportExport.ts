import { Project, ChecklistConfig } from '@/types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const formatFieldValue = (value: any, type: string, fieldConfig?: any): string => {
  if (value === null || value === undefined || value === '') {
    return 'Not provided';
  }

  switch (type) {
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'multi_input':
      return Array.isArray(value) && value.length > 0
        ? value.map((item: any) => {
            // Handle object format {value, status, checked, remark}
            if (typeof item === 'object' && item !== null) {
              const displayValue = item.value || item;
              const statusText = item.status ? ` [${item.status}]` : '';
              return `• ${displayValue}${statusText}`;
            }
            // Handle string format
            return `• ${item}`;
          }).join('\n')
        : 'None';
    case 'url':
      return value;
    case 'group':
      if (typeof value === 'object' && value !== null) {
        return fieldConfig?.fields?.map((subField: any) => {
          const subValue = value[subField.id];
          // Handle object format {value, status, checked, remark}
          let displayValue = subValue;
          if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
            displayValue = subValue.value || subValue;
            if (subValue.status) {
              displayValue = `${displayValue} [${subValue.status}]`;
            }
          }
          return `${subField.label}: ${displayValue || 'N/A'}`;
        }).join('\n') || 'Not provided';
      }
      return 'Not provided';
    case 'textarea':
      return String(value);
    default:
      return String(value);
  }
};

export const generateMarkdown = (project: Project, config: ChecklistConfig): string => {
  const getValue = (fieldId: string, isSales: boolean) => {
    if (isSales) {
      return project.checklists.sales[fieldId] ?? 
        (fieldId === 'brandName' ? project.brandName :
         fieldId === 'storeUrlMyShopify' ? project.storeUrlMyShopify :
         fieldId === 'storePublicUrl' ? project.storePublicUrl :
         fieldId === 'collabCode' ? project.collabCode :
         fieldId === 'scopeOfWork' ? project.scopeOfWork :
         fieldId === 'designRefs' ? project.designRefs :
         fieldId === 'additionalDocs' ? project.additionalDocs :
         fieldId === 'paymentConfirmation' ? project.paymentConfirmation :
         fieldId === 'planDetails' ? project.planDetails :
         fieldId === 'revenueShare' ? project.revenueShare :
         fieldId === 'gmvInfo' ? project.gmvInfo :
         fieldId === 'releaseType' ? project.releaseType :
         fieldId === 'dunsStatus' ? project.dunsStatus :
         fieldId === 'poc' ? project.poc : null);
    }
    return project.checklists.launch[fieldId];
  };

  let md = `# Handover Report\n\n`;
  md += `**Project:** ${project.brandName}\n`;
  md += `**Generated:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n`;
  md += `---\n\n`;
  
  md += `## Progress Summary\n\n`;
  md += `| Metric | Completion |\n`;
  md += `|--------|------------|\n`;
  md += `| Sales Progress | ${project.progress.salesCompletion}% |\n`;
  md += `| Launch Progress | ${project.progress.launchCompletion}% |\n`;
  md += `| Overall Progress | ${project.progress.overall}% |\n\n`;
  
  md += `## Sales Handover Information\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  
  config.sales.forEach((field) => {
    const value = getValue(field.id, true);
    const formattedValue = formatFieldValue(value, field.type, field);
    const displayValue = formattedValue.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
    md += `| ${field.label} | ${displayValue} |\n`;
  });
  
  md += `\n## Launch Checklist\n\n`;
  md += `| Field | Value |\n`;
  md += `|-------|-------|\n`;
  
  config.launch.forEach((field) => {
    const value = getValue(field.id, false);
    const formattedValue = formatFieldValue(value, field.type, field);
    const displayValue = formattedValue.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
    md += `| ${field.label} | ${displayValue} |\n`;
  });
  
  return md;
};

export const downloadMarkdown = (project: Project, config: ChecklistConfig) => {
  const markdown = generateMarkdown(project, config);
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.brandName.replace(/\s+/g, '_')}_Handover_Report_${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const generatePDF = async (project: Project, config: ChecklistConfig) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const headerHeight = 50;
  const footerHeight = 20;
  let finalY = headerHeight + 10;

  // App theme color scheme - matching Tailwind CSS colors
  const colors = {
    // Primary colors matching app theme
    gray900: [17, 24, 39] as [number, number, number], // Primary dark - matches app's gray-900
    gray800: [31, 41, 55] as [number, number, number], // Dark gray
    gray700: [55, 65, 81] as [number, number, number], // Medium dark gray
    gray600: [75, 85, 99] as [number, number, number], // Medium gray
    gray500: [107, 114, 128] as [number, number, number], // Medium gray
    gray400: [156, 163, 175] as [number, number, number], // Light gray
    gray300: [209, 213, 219] as [number, number, number], // Lighter gray
    gray200: [229, 231, 235] as [number, number, number], // Very light gray
    gray100: [243, 244, 246] as [number, number, number], // Lightest gray - matches app's gray-100
    gray50: [249, 250, 251] as [number, number, number], // Background - matches app's gray-50
    white: [255, 255, 255] as [number, number, number],
    // Progress colors matching app theme
    green500: [16, 185, 129] as [number, number, number], // green-500 for 67%+
    yellow500: [234, 179, 8] as [number, number, number], // yellow-500 for 34-66%
    red500: [239, 68, 68] as [number, number, number], // red-500 for 0-33%
  };

  // Helper function to add footer
  const addFooter = () => {
    const pageCount = (doc as any).getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...colors.gray600);
      doc.setFont('helvetica', 'normal');
      const footerText = `Page ${i} of ${pageCount}`;
      const footerX = pageWidth / 2;
      const footerY = pageHeight - 10;
      doc.text(footerText, footerX, footerY, { align: 'center' });
      
      // Footer line - very subtle
      doc.setDrawColor(...colors.gray200);
      doc.setLineWidth(0.3);
      doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);
    }
  };

  // Helper function to check if new page is needed
  const checkNewPage = (requiredSpace: number) => {
    if (finalY + requiredSpace > pageHeight - footerHeight) {
      doc.addPage();
      finalY = margin + 10;
      return true;
    }
    return false;
  };

  const getValue = (fieldId: string, isSales: boolean) => {
    if (isSales) {
      return project.checklists.sales[fieldId] ?? 
        (fieldId === 'brandName' ? project.brandName :
         fieldId === 'storeUrlMyShopify' ? project.storeUrlMyShopify :
         fieldId === 'storePublicUrl' ? project.storePublicUrl :
         fieldId === 'collabCode' ? project.collabCode :
         fieldId === 'scopeOfWork' ? project.scopeOfWork :
         fieldId === 'designRefs' ? project.designRefs :
         fieldId === 'additionalDocs' ? project.additionalDocs :
         fieldId === 'paymentConfirmation' ? project.paymentConfirmation :
         fieldId === 'planDetails' ? project.planDetails :
         fieldId === 'revenueShare' ? project.revenueShare :
         fieldId === 'gmvInfo' ? project.gmvInfo :
         fieldId === 'releaseType' ? project.releaseType :
         fieldId === 'dunsStatus' ? project.dunsStatus :
         fieldId === 'poc' ? project.poc : null);
    }
    return project.checklists.launch[fieldId];
  };

  // Helper to format cell values for tables
  const formatTableCellValue = (value: any, type: string, fieldConfig?: any): string => {
    if (value === null || value === undefined || value === '') {
      return 'Not provided';
    }

    switch (type) {
      case 'checkbox':
        return value ? 'Yes' : 'No';
      case 'multi_input':
        return Array.isArray(value) && value.length > 0
          ? value.map((item: any) => {
              // Handle object format {value, status, checked, remark}
              if (typeof item === 'object' && item !== null) {
                const displayValue = item.value || item;
                const statusText = item.status ? ` [${item.status}]` : '';
                return `• ${displayValue}${statusText}`;
              }
              // Handle string format
              return `• ${item}`;
            }).join('\n')
          : 'None';
      case 'url':
        return String(value);
      case 'group':
        if (typeof value === 'object' && value !== null) {
          return fieldConfig?.fields?.map((subField: any) => {
            const subValue = value[subField.id];
            // Handle object format {value, status, checked, remark}
            let displayValue = subValue;
            if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
              displayValue = subValue.value || subValue;
              if (subValue.status) {
                displayValue = `${displayValue} [${subValue.status}]`;
              }
            }
            return `${subField.label}: ${displayValue || 'N/A'}`;
          }).join('\n') || 'Not provided';
        }
        return 'Not provided';
      case 'textarea':
        return String(value);
      default:
        return String(value);
    }
  };

  // Helper to get progress color (matching app theme)
  const getProgressColor = (percentage: number): [number, number, number] => {
    if (percentage >= 67) return colors.green500;
    if (percentage >= 34) return colors.yellow500;
    return colors.red500;
  };

  // Header matching app theme - gray-900 background, clean and minimal
  doc.setFillColor(...colors.gray900);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  // Calculate center Y position for vertical centering
  const centerY = headerHeight / 2;
  
  // Main title - matching app's bold heading style
  doc.setTextColor(...colors.white);
  doc.setFontSize(34);
  doc.setFont('helvetica', 'bold');
  const titleWidth = doc.getTextWidth('Handover Report');
  doc.text('Handover Report', (pageWidth - titleWidth) / 2, centerY - 8);

  // Brand name - matching app's text style
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(235, 235, 235);
  const brandNameWidth = doc.getTextWidth(project.brandName);
  doc.text(project.brandName, (pageWidth - brandNameWidth) / 2, centerY + 4);

  // Date - minimal, matching app's gray-600 text
  doc.setFontSize(8);
  doc.setTextColor(...colors.gray500);
  const generatedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
  const dateText = generatedDate;
  const dateWidth = doc.getTextWidth(dateText);
  doc.text(dateText, (pageWidth - dateWidth) / 2, centerY + 12);
  
  // Reset text color
  doc.setTextColor(...colors.gray900);
  finalY = headerHeight + 25;

  // Progress Summary Section - matching app's section styling
  checkNewPage(60);
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...colors.gray900);
  doc.text('Progress Summary', margin, finalY);
  finalY += 18;

  // Get theme type from project data (may be nested in group field)
  let themeType = getValue('themeType', true);
  if (!themeType) {
    // Check if it's nested in projectBasicInfo group
    const projectBasicInfo = project.checklists.sales?.projectBasicInfo;
    if (projectBasicInfo && typeof projectBasicInfo === 'object') {
      themeType = projectBasicInfo.themeType;
    }
  }
  themeType = themeType || 'Not specified';
  const projectStatus = project.status || 'Not Started';

  // Progress cards with visual bars
  const progressData = [
    { label: 'Project Status', value: projectStatus, isText: true },
    { label: 'Theme Type', value: themeType, isText: true },
    { label: 'Overall Progress', value: project.progress.overall, isText: false },
  ];

  const cardWidth = (pageWidth - 2 * margin - 20) / 3;
  const cardHeight = 45; // Increased to accommodate text values
  let cardX = margin;

  progressData.forEach((item, index) => {
    if (index > 0 && index % 3 === 0) {
      cardX = margin;
      finalY += cardHeight + 10;
      checkNewPage(cardHeight + 10);
    }

    // Card background - matching app's white cards with gray-100 border
    doc.setFillColor(...colors.white);
    doc.roundedRect(cardX, finalY, cardWidth, cardHeight, 8, 8, 'F'); // rounded-xl equivalent
    
    // Border matching app's gray-100
    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.roundedRect(cardX, finalY, cardWidth, cardHeight, 8, 8, 'S');

    // Label - matching app's semibold gray-700 labels
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray700);
    doc.text(item.label.toUpperCase(), cardX + 8, finalY + 9);

    // Value - either text or percentage
    if (item.isText) {
      // Text value (for Status and Theme Type) - matching app's gray-900 text
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray900);
      // Wrap text if too long
      const textLines = doc.splitTextToSize(String(item.value), cardWidth - 16);
      // Center align text vertically in card
      const textStartY = finalY + 23;
      doc.text(textLines, cardX + 8, textStartY);
    } else {
      // Percentage value (for Overall Progress) - matching app's gray-900
      doc.setFontSize(26);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...colors.gray900);
      doc.text(`${item.value}%`, cardX + 8, finalY + 29);

      // Progress bar background - matching app's gray-200 rounded-full style
      const barX = cardX + 8;
      const barY = finalY + 35;
      const barWidth = cardWidth - 16;
      const barHeight = 5;
      doc.setFillColor(...colors.gray200);
      doc.roundedRect(barX, barY, barWidth, barHeight, 2.5, 2.5, 'F');

      // Progress bar fill
      const fillWidth = (item.value / 100) * barWidth;
      doc.setFillColor(...getProgressColor(item.value));
      doc.roundedRect(barX, barY, fillWidth, barHeight, 2.5, 2.5, 'F');
    }

    cardX += cardWidth + 10;
  });

  finalY += cardHeight + 25;
  checkNewPage(30);

  // Sales Handover Section - matching app's section styling
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  (doc as any).setGState((doc as any).GState({ letterSpacing: -0.4 })); // -0.02em equivalent
  doc.setTextColor(...colors.gray900);
  doc.text('Sales Handover Information', margin, finalY);
  (doc as any).setGState((doc as any).GState({ letterSpacing: 0 })); // Reset
  finalY += 12;

  // Section divider line - matching app's gray-100 borders
  doc.setDrawColor(...colors.gray100);
  doc.setLineWidth(1);
  doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
  finalY += 15;

  const salesTableData = config.sales.map((field) => {
    const value = getValue(field.id, true);
    const formattedValue = formatTableCellValue(value, field.type, field);
    return [field.label, formattedValue];
  });

  autoTable(doc, {
    startY: finalY,
    head: [['Field', 'Value']],
    body: salesTableData,
    theme: 'striped',
    headStyles: {
      fillColor: colors.gray900, // Matching app's primary dark
      textColor: colors.white,
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
    },
    alternateRowStyles: {
      fillColor: colors.gray50, // Matching app's background
    },
    columnStyles: {
      0: { 
        cellWidth: 85, 
        fontStyle: 'bold', 
        valign: 'top',
        textColor: colors.gray700, // Matching app's semibold labels
      },
      1: { 
        cellWidth: 'auto', 
        valign: 'top',
        textColor: colors.gray900, // Matching app's text color
      },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: colors.gray100, // Matching app's border color
      lineWidth: 0.5,
    },
    didParseCell: (data: any) => {
      // Highlight empty fields with subtle styling
      if (data.row.index > 0 && data.column.index === 1) {
        const fieldIndex = data.row.index - 1;
        const value = getValue(config.sales[fieldIndex].id, true);
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0)) {
          data.cell.styles.fillColor = colors.gray50; // Matching app's background
          data.cell.styles.textColor = colors.gray500; // Matching app's gray-500
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
  });

  finalY = (doc as any).lastAutoTable.finalY + 25;
  checkNewPage(30);

  // Launch Checklist Section - matching app's section styling
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  (doc as any).setGState((doc as any).GState({ letterSpacing: -0.4 })); // -0.02em equivalent
  doc.setTextColor(...colors.gray900);
  doc.text('Launch Checklist', margin, finalY);
  (doc as any).setGState((doc as any).GState({ letterSpacing: 0 })); // Reset
  finalY += 12;

  // Section divider line - matching app's gray-100 borders
  doc.setDrawColor(...colors.gray100);
  doc.setLineWidth(1);
  doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
  finalY += 12;

  const launchTableData = config.launch.map((field) => {
    const value = getValue(field.id, false);
    const formattedValue = formatTableCellValue(value, field.type, field);
    return [field.label, formattedValue];
  });

  autoTable(doc, {
    startY: finalY,
    head: [['Field', 'Value']],
    body: launchTableData,
    theme: 'striped',
    headStyles: {
      fillColor: colors.gray900, // Matching app's primary dark
      textColor: colors.white,
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
    },
    alternateRowStyles: {
      fillColor: colors.gray50, // Matching app's background
    },
    columnStyles: {
      0: { 
        cellWidth: 85, 
        fontStyle: 'bold', 
        valign: 'top',
        textColor: colors.gray700, // Matching app's semibold labels
      },
      1: { 
        cellWidth: 'auto', 
        valign: 'top',
        textColor: colors.gray900, // Matching app's text color
      },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: colors.gray100, // Matching app's border color
      lineWidth: 0.5,
    },
    didParseCell: (data: any) => {
      // Highlight empty fields with subtle styling
      if (data.row.index > 0 && data.column.index === 1) {
        const fieldIndex = data.row.index - 1;
        const value = getValue(config.launch[fieldIndex].id, false);
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0)) {
          data.cell.styles.fillColor = colors.gray50; // Matching app's background
          data.cell.styles.textColor = colors.gray500; // Matching app's gray-500
          data.cell.styles.fontStyle = 'italic';
        }
      }
    },
  });

  // Add footer to all pages
  addFooter();

  // Save PDF
  doc.save(`${project.brandName.replace(/\s+/g, '_')}_Handover_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

