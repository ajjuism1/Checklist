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

export const generatePDF = async (project: Project, config: ChecklistConfig, integrations: any[] = []) => {
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
    blue500: [59, 130, 246] as [number, number, number], // blue-500 for links and status
    purple500: [168, 85, 247] as [number, number, number], // purple-500 for versions
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
                let displayValue = String(item.value || item);
                // Don't truncate - keep full URLs/text for proper link handling
                const statusText = item.status ? ` [${item.status}]` : '';
                return `• ${displayValue}${statusText}`;
              }
              // Handle string format
              let itemStr = String(item);
              // Don't truncate - keep full URLs/text
              return `• ${itemStr}`;
            }).join('\n')
          : 'None';
      case 'url':
      case 'text':
        // Don't truncate - return full text/URL for proper link handling
        const textStr = String(value);
        return textStr;
      case 'group':
        if (typeof value === 'object' && value !== null) {
          return fieldConfig?.fields?.map((subField: any) => {
            const subValue = value[subField.id];
            // Handle versioned text/textarea fields (arrays of {value, version} objects)
            if (Array.isArray(subValue) && subValue.length > 0 && 
                subField.hasVersion && 
                (subField.type === 'text' || subField.type === 'textarea')) {
              const items = subValue.map((item: any) => {
                const itemValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
                let displayValue = String(itemValue);
                // Don't truncate - keep full URLs/text for proper link handling
                const version = typeof item === 'object' && item !== null ? (item.version || 1) : 1;
                return `• ${displayValue} (v${version})`;
              }).join('\n');
              return `${subField.label}:\n${items}`;
            }
            // Handle arrays (multi_input, multi_select)
            if (Array.isArray(subValue) && subValue.length > 0) {
              if (subField.type === 'multi_input') {
                const items = subValue.map((item: any) => {
                  if (typeof item === 'object' && item !== null) {
                    let displayValue = String(item.value || item);
                    // Don't truncate - keep full URLs/text for proper link handling
                    const statusText = item.status ? ` [${item.status}]` : '';
                    return `• ${displayValue}${statusText}`;
                  }
                  let itemStr = String(item);
                  // Don't truncate - keep full URLs/text
                  return `• ${itemStr}`;
                }).join('\n');
                return `${subField.label}:\n${items}`;
              } else if (subField.type === 'multi_select') {
                // For integrations, include status if available and map IDs to names
                if (subField.optionsSource === 'integrations') {
                  const statuses = value.integrations_statuses || {};
                  const items = subValue.map((item: any) => {
                    const itemId = String(item);
                    const integration = integrations.find((i: any) => i.id === itemId);
                    const integrationName = integration?.name || itemId;
                    const status = statuses[itemId] ? ` [${statuses[itemId]}]` : '';
                    return `• ${integrationName}${status}`;
                  }).join('\n');
                  return `${subField.label}:\n${items}`;
                }
                const items = subValue.map((item: any) => `• ${item}`).join('\n');
                return `${subField.label}:\n${items}`;
              } else {
                const items = subValue.map((item: any) => `• ${String(item)}`).join('\n');
                return `${subField.label}:\n${items}`;
              }
            }
            // Handle object format {value, status, checked, remark}
            let displayValue = subValue;
            if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
              displayValue = subValue.value || subValue;
              if (subValue.status) {
                displayValue = `${displayValue} [${subValue.status}]`;
              }
            }
            const valueStr = String(displayValue);
            // Don't truncate - let PDF handle wrapping with proper column widths
            // Handle null/undefined/empty values properly
            const finalValue = (valueStr === 'null' || valueStr === 'undefined' || valueStr === '') ? 'N/A' : valueStr;
            return `${subField.label}: ${finalValue}`;
          }).join('\n\n') || 'Not provided';
        }
        return 'Not provided';
      case 'textarea':
        // Truncate very long textarea content to prevent clutter
        const textareaStr = String(value);
        if (textareaStr.length > 200) {
          return textareaStr.substring(0, 197) + '...';
        }
        return textareaStr;
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
      font: 'courier', // Monospace font for all body cells as fallback
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
        cellWidth: pageWidth - (margin * 2) - 85, // Explicit width for proper wrapping
        valign: 'top',
        textColor: colors.gray900, // Matching app's text color
        overflow: 'linebreak',
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
        font: 'courier', // Monospace font for all values
      },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: colors.gray100, // Matching app's border color
      lineWidth: 0.5,
      overflow: 'linebreak',
      cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
    },
    didParseCell: (data: any) => {
      // Apply monospace font to all value columns
      if (data.row.index > 0 && data.column.index === 1) {
        data.cell.styles.font = 'courier';
        const fieldIndex = data.row.index - 1;
        const field = config.sales[fieldIndex];
        const value = getValue(field.id, true);
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

  // Process launch checklist fields - separate group fields with arrays for nested tables
  const groupFieldsWithArrays: Array<{field: any, value: any}> = [];
  const simpleFields: any[][] = [];
  
  config.launch.forEach((field) => {
    const value = getValue(field.id, false);
    
    // Check if this is a group field with array sub-fields
    if (field.type === 'group' && typeof value === 'object' && value !== null) {
      const hasArrayFields = field.fields?.some((subField: any) => {
        const subValue = value[subField.id];
        return Array.isArray(subValue) && subValue.length > 0 && 
               (subField.type === 'multi_input' || 
                subField.type === 'multi_select' ||
                (subField.hasVersion && (subField.type === 'text' || subField.type === 'textarea')));
      });
      
      if (hasArrayFields) {
        // Store for separate table rendering
        groupFieldsWithArrays.push({ field, value });
        // Add a placeholder row indicating details are below
        simpleFields.push([field.label, 'See detailed tables below']);
      } else {
        // Regular group field formatting
        const formattedValue = formatTableCellValue(value, field.type, field);
        simpleFields.push([field.label, formattedValue]);
      }
    } else {
      // Non-group fields
      const formattedValue = formatTableCellValue(value, field.type, field);
      simpleFields.push([field.label, formattedValue]);
    }
  });

  // Render main table
  autoTable(doc, {
    startY: finalY,
    head: [['Field', 'Value']],
    body: simpleFields,
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
      font: 'courier', // Monospace font for all body cells as fallback
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
        cellWidth: pageWidth - (margin * 2) - 85, // Explicit width for proper wrapping
        valign: 'top',
        textColor: colors.gray900, // Matching app's text color
        overflow: 'linebreak',
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
        font: 'courier', // Monospace font for all values
      },
    },
    margin: { left: margin, right: margin },
    styles: {
      lineColor: colors.gray100, // Matching app's border color
      lineWidth: 0.5,
      overflow: 'linebreak',
      cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
    },
    didParseCell: (data: any) => {
      // Apply monospace font to all value columns
      if (data.row.index > 0 && data.column.index === 1) {
        data.cell.styles.font = 'courier';
        const rowData = simpleFields[data.row.index - 1];
        if (rowData && (rowData[1] === 'Not provided' || rowData[1] === 'None' || rowData[1] === 'See detailed tables below')) {
          // Don't highlight "See detailed tables below" as empty
          if (rowData[1] !== 'See detailed tables below') {
            data.cell.styles.fillColor = colors.gray50; // Matching app's background
            data.cell.styles.textColor = colors.gray500; // Matching app's gray-500
            data.cell.styles.fontStyle = 'italic';
          }
        }
      }
    },
  });

  finalY = (doc as any).lastAutoTable.finalY + 25;
  
  // Render separate tables for group fields with arrays
  groupFieldsWithArrays.forEach(({ field, value }) => {
    checkNewPage(60);
    
    // Group header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text(field.label, margin, finalY);
    finalY += 12;
    
    // Process each sub-field with arrays
    field.fields?.forEach((subField: any) => {
      const subValue = value[subField.id];
      
      // Check if it's a versioned text/textarea field (array of {value, version} objects)
      const isVersionedField = Array.isArray(subValue) && subValue.length > 0 && 
                                subField.hasVersion && 
                                (subField.type === 'text' || subField.type === 'textarea');
      
      if (isVersionedField) {
        checkNewPage(60);
        
        // Sub-field header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.gray700);
        doc.text(subField.label, margin + 5, finalY);
        finalY += 8;
        
        // Create table data for versioned fields
        const tableData = subValue.map((item: any) => {
          const itemValue = typeof item === 'object' && item !== null ? (item.value || item) : item;
          const valueStr = String(itemValue);
          // Improved URL detection
          const trimmedStr = valueStr.trim();
          const isUrl = trimmedStr.startsWith('http://') || trimmedStr.startsWith('https://') || 
                        (trimmedStr.includes('www.') && (trimmedStr.includes('.com') || trimmedStr.includes('.io') || trimmedStr.includes('.net') || trimmedStr.includes('.org'))) ||
                        /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedStr);
          // Don't truncate - let PDF handle wrapping
          const version = typeof item === 'object' && item !== null ? (item.version || 1) : 1;
          return { row: [valueStr, `v${version}`], isUrl, url: isUrl ? (trimmedStr.startsWith('http') ? trimmedStr : `https://${trimmedStr}`) : null };
        });
        
        autoTable(doc, {
          startY: finalY,
          head: [['Content', 'Version']],
          body: tableData.map(item => item.row),
          theme: 'striped',
          headStyles: {
            fillColor: colors.gray800,
            textColor: colors.white,
            fontStyle: 'bold',
            fontSize: 9,
          },
            bodyStyles: {
              fontSize: 9,
              cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
              overflow: 'linebreak',
              font: 'courier', // Monospace font for all body cells
            },
          alternateRowStyles: {
            fillColor: colors.gray50,
          },
          columnStyles: {
            0: { 
              cellWidth: pageWidth - (margin * 2) - 50, // Explicit width for proper wrapping (leave space for version column)
              overflow: 'linebreak',
              cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
            },
            1: {
              cellWidth: 30,
              cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
            },
          },
          margin: { left: margin + 10, right: margin },
          styles: {
            lineColor: colors.gray200,
            lineWidth: 0.3,
            overflow: 'linebreak',
          },
          didParseCell: (data: any) => {
            // Apply monospace font to all data cells
            if (data.row.index > 0) {
              data.cell.styles.font = 'courier';
            }
          },
        });
        
        finalY = (doc as any).lastAutoTable.finalY + 15;
      } else if (Array.isArray(subValue) && subValue.length > 0) {
        checkNewPage(60);
        
        // Sub-field header
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.gray700);
        doc.text(subField.label, margin + 5, finalY);
        finalY += 8;
        
        if (subField.type === 'multi_input') {
          // Create table data for multi_input
          const tableData = subValue.map((item: any) => {
            let itemValue: any = 'N/A';
            if (typeof item === 'string') {
              itemValue = item || 'N/A';
            } else if (item && typeof item === 'object') {
              itemValue = (item.value !== undefined && item.value !== null && item.value !== '') ? item.value : (item || 'N/A');
            }
            const valueStr = String(itemValue === 'N/A' ? 'N/A' : itemValue);
            // Improved URL detection - same as handover-report page
            const trimmedStr = valueStr.trim();
            const isUrl = trimmedStr.startsWith('http://') || trimmedStr.startsWith('https://') || 
                          (trimmedStr.includes('www.') && (trimmedStr.includes('.com') || trimmedStr.includes('.io') || trimmedStr.includes('.net') || trimmedStr.includes('.org'))) ||
                          /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedStr);
            // Don't truncate - let PDF handle wrapping with proper cell widths
            const row: any[] = [valueStr];
            if (subField.hasStatus) {
              row.push(item.status || 'Not Started');
            }
            if (item.remark) {
              let remark = String(item.remark);
              // Don't truncate remarks either - let them wrap
              row.push(remark);
            }
            // Store original URL for linking
            const originalUrl = isUrl ? (trimmedStr.startsWith('http') ? trimmedStr : `https://${trimmedStr}`) : null;
            return { row, isUrl, url: originalUrl };
          });
          
          const headers: string[] = ['Item'];
          if (subField.hasStatus) headers.push('Status');
          if (subValue.some((item: any) => item.remark)) headers.push('Remark');
          
          // Calculate column widths dynamically based on number of columns
          const availableWidth = pageWidth - (margin * 2) - 20; // Subtract extra margin for nested tables
          const numColumns = headers.length;
          const columnWidths: any = {};
          if (numColumns === 1) {
            columnWidths[0] = { cellWidth: availableWidth, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          } else if (numColumns === 2) {
            columnWidths[0] = { cellWidth: availableWidth * 0.7, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            columnWidths[1] = { cellWidth: availableWidth * 0.3, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          } else {
            columnWidths[0] = { cellWidth: availableWidth * 0.5, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            columnWidths[1] = { cellWidth: availableWidth * 0.25, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            columnWidths[2] = { cellWidth: availableWidth * 0.25, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          }
          
          autoTable(doc, {
            startY: finalY,
            head: [headers],
            body: tableData.map(item => item.row),
            theme: 'striped',
            headStyles: {
              fillColor: colors.gray800,
              textColor: colors.white,
              fontStyle: 'bold',
              fontSize: 9,
            },
            bodyStyles: {
              fontSize: 9,
              cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
              overflow: 'linebreak',
              font: 'courier', // Monospace font for all body cells
            },
            alternateRowStyles: {
              fillColor: colors.gray50,
            },
            columnStyles: columnWidths,
            margin: { left: margin + 10, right: margin },
            styles: {
              lineColor: colors.gray200,
              lineWidth: 0.3,
              overflow: 'linebreak',
            },
            didParseCell: (data: any) => {
              // Ensure monospace font is applied to all data cells (redundant but ensures consistency)
              if (data.row.index > 0) {
                data.cell.styles.font = 'courier';
              }
            },
          });
          
          finalY = (doc as any).lastAutoTable.finalY + 15;
        } else if (subField.type === 'multi_select') {
          // Check if this is integrations field with status/version data
          const isIntegrationsField = subField.optionsSource === 'integrations';
          const integrationStatuses = isIntegrationsField && value.integrations_statuses ? value.integrations_statuses : {};
          const integrationVersions = isIntegrationsField && value.integrations_versions ? value.integrations_versions : {};
          
          // Create table data for multi_select
          let tableData: any[][];
          let headers: string[];
          
          if (isIntegrationsField) {
            // Integrations - always show status, include version if available
            headers = ['Integration', 'Status'];
            if (Object.keys(integrationVersions).length > 0) {
              headers.push('Version');
            }
            
            tableData = subValue.map((item: any) => {
              const itemId = String(item);
              const integration = integrations.find((i: any) => i.id === itemId);
              const integrationName = integration?.name || itemId;
              // Don't truncate - let PDF handle wrapping with proper column widths
              const row: any[] = [integrationName];
              // Always include status (default to 'Pending' if not set)
              row.push(integrationStatuses[itemId] || 'Pending');
              if (Object.keys(integrationVersions).length > 0) {
                row.push(`v${integrationVersions[itemId] || 1}`);
              }
              return row;
            });
          } else {
            // Regular multi_select
            headers = ['Selected Items'];
            tableData = subValue.map((item: any) => [String(item)]);
          }
          
          // Calculate column widths for multi_select tables
          const availableWidth = pageWidth - (margin * 2) - 20;
          const numCols = headers.length;
          const multiSelectColumnWidths: any = {};
          if (numCols === 1) {
            multiSelectColumnWidths[0] = { cellWidth: availableWidth, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          } else if (numCols === 2) {
            multiSelectColumnWidths[0] = { cellWidth: availableWidth * 0.6, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            multiSelectColumnWidths[1] = { cellWidth: availableWidth * 0.4, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          } else {
            multiSelectColumnWidths[0] = { cellWidth: availableWidth * 0.5, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            multiSelectColumnWidths[1] = { cellWidth: availableWidth * 0.25, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
            multiSelectColumnWidths[2] = { cellWidth: availableWidth * 0.25, overflow: 'linebreak', cellPadding: { top: 5, bottom: 5, left: 8, right: 8 } };
          }
          
          autoTable(doc, {
            startY: finalY,
            head: [headers],
            body: tableData,
            theme: 'striped',
            headStyles: {
              fillColor: colors.gray800,
              textColor: colors.white,
              fontStyle: 'bold',
              fontSize: 9,
            },
            bodyStyles: {
              fontSize: 9,
              cellPadding: { top: 5, bottom: 5, left: 8, right: 8 },
              overflow: 'linebreak',
              font: 'courier', // Monospace font for all body cells
            },
            alternateRowStyles: {
              fillColor: colors.gray50,
            },
            columnStyles: multiSelectColumnWidths,
            margin: { left: margin + 10, right: margin },
            styles: {
              lineColor: colors.gray200,
              lineWidth: 0.3,
              overflow: 'linebreak',
            },
            didParseCell: (data: any) => {
              // Ensure monospace font is applied to all data cells (redundant but ensures consistency)
              if (data.row.index > 0) {
                data.cell.styles.font = 'courier';
              }
              // Color-code status cells for integrations
              if (isIntegrationsField && headers.includes('Status') && data.column.index === headers.indexOf('Status')) {
                const status = data.cell.text[0];
                if (status === 'Integrated') {
                  data.cell.styles.fillColor = colors.green500;
                  data.cell.styles.textColor = colors.white;
                } else if (status === 'Pending') {
                  data.cell.styles.fillColor = colors.yellow500;
                  data.cell.styles.textColor = colors.gray900;
                } else if (status === 'Awaiting Information') {
                  data.cell.styles.fillColor = colors.blue500;
                  data.cell.styles.textColor = colors.white;
                }
              }
            },
          });
          
          finalY = (doc as any).lastAutoTable.finalY + 15;
        }
      } else if (subValue !== null && subValue !== undefined && subValue !== '') {
        // Non-array sub-field - render in a cleaner format
        checkNewPage(20);
        
        let displayValue = subValue;
        let isUrl = false;
        let urlValue = '';
        
        if (typeof subValue === 'object' && subValue !== null && !Array.isArray(subValue)) {
          displayValue = subValue.value || subValue;
        }
        
        const valueStr = String(displayValue);
        // Check if it's a URL
        isUrl = valueStr.startsWith('http://') || valueStr.startsWith('https://') || 
                valueStr.includes('www.') || valueStr.includes('.com') || valueStr.includes('.io') ||
                valueStr.includes('.net') || valueStr.includes('.org');
        
        if (isUrl) {
          urlValue = valueStr;
          // Truncate long URLs for display but keep full URL for link
          if (urlValue.length > 60) {
            displayValue = urlValue.substring(0, 57) + '...';
          }
        } else if (subField.type === 'checkbox') {
          displayValue = subValue ? 'Yes' : 'No';
        }
        
        // Render in a cleaner table-like format for better alignment
        const labelText = `${subField.label}:`;
        const valueText = isUrl && urlValue 
          ? (urlValue.length > 60 ? urlValue.substring(0, 57) + '...' : urlValue)
          : String(displayValue);
        
        // Use a simple two-column layout
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...colors.gray700);
        doc.text(labelText, margin + 5, finalY);
        
        const labelWidth = doc.getTextWidth(labelText + ' ');
        doc.setFont('helvetica', 'normal');
        
        if (isUrl && urlValue) {
          // Use monospace font for URLs (no color change, no clickable links)
          doc.setFont('courier', 'normal');
          doc.setTextColor(...colors.gray900);
          doc.text(valueText, margin + 5 + labelWidth, finalY);
          doc.setFont('helvetica', 'normal');
        } else if (subField.type === 'checkbox') {
          // Format checkbox values nicely
          doc.setTextColor(subValue ? colors.green500[0] : colors.gray600[0], 
                          subValue ? colors.green500[1] : colors.gray600[1], 
                          subValue ? colors.green500[2] : colors.gray600[2]);
          doc.setFont('helvetica', 'bold');
          doc.text(valueText, margin + 5 + labelWidth, finalY);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...colors.gray900);
        } else {
          doc.setTextColor(...colors.gray900);
          doc.text(valueText, margin + 5 + labelWidth, finalY);
        }
        
        finalY += 12; // Slightly more spacing for readability
      }
    });
    
    finalY += 10; // Extra space after group
  });

  // Add footer to all pages
  addFooter();

  // Save PDF
  doc.save(`${project.brandName.replace(/\s+/g, '_')}_Handover_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

// Generate version-specific summary PDF
export const generateVersionSummaryPDF = async (project: Project, config: ChecklistConfig, version: number, integrations: any[] = []) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const headerHeight = 50;
  const footerHeight = 20;
  let finalY = headerHeight + 10;

  // App theme color scheme - matching Tailwind CSS colors
  const colors = {
    gray900: [17, 24, 39] as [number, number, number],
    gray800: [31, 41, 55] as [number, number, number],
    gray700: [55, 65, 81] as [number, number, number],
    gray600: [75, 85, 99] as [number, number, number],
    gray500: [107, 114, 128] as [number, number, number],
    gray400: [156, 163, 175] as [number, number, number],
    gray300: [209, 213, 219] as [number, number, number],
    gray200: [229, 231, 235] as [number, number, number],
    gray100: [243, 244, 246] as [number, number, number],
    gray50: [249, 250, 251] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    green500: [16, 185, 129] as [number, number, number],
    yellow500: [234, 179, 8] as [number, number, number],
    red500: [239, 68, 68] as [number, number, number],
    blue500: [59, 130, 246] as [number, number, number],
    purple500: [168, 85, 247] as [number, number, number],
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

  // Helper to format multi_input items
  const formatMultiInputItems = (items: any[]): string => {
    if (!Array.isArray(items) || items.length === 0) {
      return 'None';
    }
    return items.map((item: any) => {
      if (typeof item === 'string') {
        return `• ${item}`;
      }
      const value = item.value || item.name || 'N/A';
      const status = item.status ? ` [${item.status}]` : '';
      return `• ${value}${status}`;
    }).join('\n');
  };

  // Header
  doc.setFillColor(...colors.gray900);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');
  
  const centerY = headerHeight / 2;
  
  doc.setTextColor(...colors.white);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  const titleText = `Version ${version} Summary`;
  const titleWidth = doc.getTextWidth(titleText);
  doc.text(titleText, (pageWidth - titleWidth) / 2, centerY - 8);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(235, 235, 235);
  const brandNameWidth = doc.getTextWidth(project.brandName);
  doc.text(project.brandName, (pageWidth - brandNameWidth) / 2, centerY + 4);

  doc.setFontSize(8);
  doc.setTextColor(...colors.gray500);
  const generatedDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric'
  });
  const dateWidth = doc.getTextWidth(generatedDate);
  doc.text(generatedDate, (pageWidth - dateWidth) / 2, centerY + 12);
  
  doc.setTextColor(...colors.gray900);
  finalY = headerHeight + 25;

  // Get filtered data for the version
  const launchChecklist = project.checklists?.launch || {};
  
  // Filter integrations
  const integrationsGroup = launchChecklist.integrations || {};
  const integrationIds = Array.isArray(integrationsGroup.integrations) ? integrationsGroup.integrations : [];
  const integrationVersions = integrationsGroup.integrations_versions || {};
  const filteredIntegrationIds = integrationIds.filter((id: string) => {
    const itemVersion = integrationVersions[id] || 1;
    return itemVersion === version;
  });
  const filteredIntegrations = integrations.filter(integ => filteredIntegrationIds.includes(integ.id));

  // Filter custom features
  const customFeatures = launchChecklist.customFeatures || 
    (launchChecklist.developmentItems && launchChecklist.developmentItems.customFeatures) || [];
  const filteredCustomFeatures = Array.isArray(customFeatures) ? customFeatures.filter((item: any) => {
    if (typeof item === 'string') return version === 1;
    return (item.version || 1) === version;
  }) : [];

  // Filter change requests
  const changeRequests = launchChecklist.changeRequests || 
    (launchChecklist.developmentItems && launchChecklist.developmentItems.changeRequests) || [];
  const filteredChangeRequests = Array.isArray(changeRequests) ? changeRequests.filter((item: any) => {
    if (typeof item === 'string') return version === 1;
    return (item.version || 1) === version;
  }) : [];

  // Filter integrations credentials
  const integrationsCredentials = launchChecklist.integrationsCredentials || [];
  const filteredIntegrationsCredentials = Array.isArray(integrationsCredentials) ? integrationsCredentials.filter((item: any) => {
    if (typeof item === 'string') return version === 1;
    return (item.version || 1) === version;
  }) : [];

  // Filter Additional Information fields
  const additionalInformation = launchChecklist.additionalInformation || {};
  const devComments = additionalInformation.devComments || [];
  const externalCommunications = additionalInformation.externalCommunications || [];
  const remarks = additionalInformation.remarks || [];
  
  const filterVersionedArray = (items: any[]): any[] => {
    if (!Array.isArray(items)) return [];
    return items.filter((item: any) => {
      if (typeof item === 'string') return version === 1;
      if (typeof item === 'object' && item !== null) {
        return (item.version || 1) === version;
      }
      return false;
    });
  };
  
  const filteredDevComments = filterVersionedArray(Array.isArray(devComments) ? devComments : []);
  const filteredExternalCommunications = filterVersionedArray(Array.isArray(externalCommunications) ? externalCommunications : []);
  const filteredRemarks = filterVersionedArray(Array.isArray(remarks) ? remarks : []);

  // Integrations Section
  if (filteredIntegrations.length > 0 || filteredIntegrationsCredentials.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('Integrations', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const integrationsTableData: any[][] = [];
    
    // Add integrations from accessCredentials
    filteredIntegrations.forEach((integ) => {
      integrationsTableData.push([
        integ.name || integ.id,
        'Active'
      ]);
    });

    // Add integrations credentials
    filteredIntegrationsCredentials.forEach((item: any) => {
      let name = 'N/A';
      if (typeof item === 'string') {
        name = item || 'N/A';
      } else if (item && typeof item === 'object') {
        name = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const status = (item && typeof item === 'object' && item.status) ? item.status : 'N/A';
      integrationsTableData.push([name, status]);
    });

    if (integrationsTableData.length > 0) {
      autoTable(doc, {
        startY: finalY,
        head: [['Integration', 'Status']],
        body: integrationsTableData,
        theme: 'striped',
        headStyles: {
          fillColor: colors.gray900,
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
          fillColor: colors.gray50,
        },
        columnStyles: {
          0: { 
            cellWidth: 120, 
            fontStyle: 'bold', 
            valign: 'top',
            textColor: colors.gray700,
            font: 'courier',
          },
          1: { 
            cellWidth: 'auto', 
            valign: 'top',
            textColor: colors.gray900,
            font: 'courier',
          },
        },
        margin: { left: margin, right: margin },
        styles: {
          lineColor: colors.gray100,
          lineWidth: 0.5,
        },
      });

      finalY = (doc as any).lastAutoTable.finalY + 25;
    }
  }

  // Custom Features Section
  if (filteredCustomFeatures.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('Custom Features', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const customFeaturesTableData = filteredCustomFeatures.map((item: any) => {
      let value = 'N/A';
      if (typeof item === 'string') {
        value = item || 'N/A';
      } else if (item && typeof item === 'object') {
        value = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const status = (item && typeof item === 'object' && item.status) ? item.status : 'Not Started';
      return [value, status];
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Feature', 'Status']],
      body: customFeaturesTableData,
      theme: 'striped',
      headStyles: {
        fillColor: colors.gray900,
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
        fillColor: colors.gray50,
      },
      columnStyles: {
        0: { 
          cellWidth: 120, 
          fontStyle: 'bold', 
          valign: 'top',
          textColor: colors.gray700,
          font: 'courier',
        },
        1: { 
          cellWidth: 'auto', 
          valign: 'top',
          textColor: colors.gray900,
          font: 'courier',
        },
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: colors.gray100,
        lineWidth: 0.5,
      },
    });

    finalY = (doc as any).lastAutoTable.finalY + 25;
  }

  // Change Requests Section
  if (filteredChangeRequests.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('Change Requests', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const changeRequestsTableData = filteredChangeRequests.map((item: any) => {
      let value = 'N/A';
      if (typeof item === 'string') {
        value = item || 'N/A';
      } else if (item && typeof item === 'object') {
        value = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const status = (item && typeof item === 'object' && item.status) ? item.status : 'Not Started';
      return [value, status];
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Change Request', 'Status']],
      body: changeRequestsTableData,
      theme: 'striped',
      headStyles: {
        fillColor: colors.gray900,
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
        fillColor: colors.gray50,
      },
      columnStyles: {
        0: { 
          cellWidth: 120, 
          fontStyle: 'bold', 
          valign: 'top',
          textColor: colors.gray700,
          font: 'courier',
        },
        1: { 
          cellWidth: 'auto', 
          valign: 'top',
          textColor: colors.gray900,
          font: 'courier',
        },
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: colors.gray100,
        lineWidth: 0.5,
      },
    });

    finalY = (doc as any).lastAutoTable.finalY + 25;
  }

  // Dev Comments Section
  if (filteredDevComments.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('Dev Comments and Feedback', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const devCommentsTableData = filteredDevComments.map((item: any) => {
      let itemValue = 'N/A';
      if (typeof item === 'string') {
        itemValue = item || 'N/A';
      } else if (item && typeof item === 'object') {
        itemValue = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const valueStr = String(itemValue);
      // Improved URL detection - check for URL patterns more accurately
      const trimmedStr = valueStr.trim();
      const isUrl = trimmedStr.startsWith('http://') || trimmedStr.startsWith('https://') || 
                    (trimmedStr.includes('www.') && (trimmedStr.includes('.com') || trimmedStr.includes('.io') || trimmedStr.includes('.net') || trimmedStr.includes('.org'))) ||
                    /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedStr);
      // Don't truncate - let PDF handle wrapping, but store original URL for linking
      return { row: [valueStr], isUrl, url: isUrl ? (trimmedStr.startsWith('http') ? trimmedStr : `https://${trimmedStr}`) : null };
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Comment']],
      body: devCommentsTableData.map(item => item.row),
      theme: 'striped',
      headStyles: {
        fillColor: colors.gray900,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
        font: 'courier', // Monospace font for all body cells
      },
      alternateRowStyles: {
        fillColor: colors.gray50,
      },
      columnStyles: {
        0: { 
          cellWidth: pageWidth - (margin * 2), // Explicit width for proper wrapping
          valign: 'top',
          textColor: colors.gray900,
          overflow: 'linebreak',
          cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
          font: 'courier',
        },
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: colors.gray100,
        lineWidth: 0.5,
        overflow: 'linebreak',
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
      },
      didParseCell: (data: any) => {
        // Apply monospace font to all data cells (redundant but ensures consistency)
        if (data.row.index > 0) {
          data.cell.styles.font = 'courier';
        }
      },
    });

    finalY = (doc as any).lastAutoTable.finalY + 25;
  }

  // External Communications Section
  if (filteredExternalCommunications.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('External Communications Summary', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const externalCommunicationsTableData = filteredExternalCommunications.map((item: any) => {
      let itemValue = 'N/A';
      if (typeof item === 'string') {
        itemValue = item || 'N/A';
      } else if (item && typeof item === 'object') {
        itemValue = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const valueStr = String(itemValue);
      // Improved URL detection
      const trimmedStr = valueStr.trim();
      const isUrl = trimmedStr.startsWith('http://') || trimmedStr.startsWith('https://') || 
                    (trimmedStr.includes('www.') && (trimmedStr.includes('.com') || trimmedStr.includes('.io') || trimmedStr.includes('.net') || trimmedStr.includes('.org'))) ||
                    /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedStr);
      // Don't truncate - let PDF handle wrapping
      return { row: [valueStr], isUrl, url: isUrl ? (trimmedStr.startsWith('http') ? trimmedStr : `https://${trimmedStr}`) : null };
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Summary']],
      body: externalCommunicationsTableData.map(item => item.row),
      theme: 'striped',
      headStyles: {
        fillColor: colors.gray900,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
        font: 'courier', // Monospace font for all body cells
      },
      alternateRowStyles: {
        fillColor: colors.gray50,
      },
      columnStyles: {
        0: { 
          cellWidth: pageWidth - (margin * 2), // Explicit width for proper wrapping
          valign: 'top',
          textColor: colors.gray900,
          overflow: 'linebreak',
          cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
          font: 'courier',
        },
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: colors.gray100,
        lineWidth: 0.5,
        overflow: 'linebreak',
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
      },
      didParseCell: (data: any) => {
        // Apply monospace font to all data cells (redundant but ensures consistency)
        if (data.row.index > 0) {
          data.cell.styles.font = 'courier';
        }
      },
    });
    
    finalY = (doc as any).lastAutoTable.finalY + 25;
  }

  // Remarks Section
  if (filteredRemarks.length > 0) {
    checkNewPage(60);
    
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.gray900);
    doc.text('Remarks', margin, finalY);
    finalY += 18;

    doc.setDrawColor(...colors.gray100);
    doc.setLineWidth(1);
    doc.line(margin, finalY - 3, pageWidth - margin, finalY - 3);
    finalY += 15;

    const remarksTableData = filteredRemarks.map((item: any) => {
      let itemValue = 'N/A';
      if (typeof item === 'string') {
        itemValue = item || 'N/A';
      } else if (item && typeof item === 'object') {
        itemValue = (item.value !== undefined && item.value !== null && item.value !== '') ? String(item.value) : 'N/A';
      }
      const valueStr = String(itemValue);
      // Improved URL detection
      const trimmedStr = valueStr.trim();
      const isUrl = trimmedStr.startsWith('http://') || trimmedStr.startsWith('https://') || 
                    (trimmedStr.includes('www.') && (trimmedStr.includes('.com') || trimmedStr.includes('.io') || trimmedStr.includes('.net') || trimmedStr.includes('.org'))) ||
                    /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}/.test(trimmedStr);
      // Don't truncate - let PDF handle wrapping
      return { row: [valueStr], isUrl, url: isUrl ? (trimmedStr.startsWith('http') ? trimmedStr : `https://${trimmedStr}`) : null };
    });

    autoTable(doc, {
      startY: finalY,
      head: [['Remark']],
      body: remarksTableData.map(item => item.row),
      theme: 'striped',
      headStyles: {
        fillColor: colors.gray900,
        textColor: colors.white,
        fontStyle: 'bold',
        fontSize: 11,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 10,
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
        font: 'courier', // Monospace font for all body cells
      },
      alternateRowStyles: {
        fillColor: colors.gray50,
      },
      columnStyles: {
        0: { 
          cellWidth: pageWidth - (margin * 2), // Explicit width for proper wrapping
          valign: 'top',
          textColor: colors.gray900,
          overflow: 'linebreak',
          cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
          font: 'courier',
        },
      },
      margin: { left: margin, right: margin },
      styles: {
        lineColor: colors.gray100,
        lineWidth: 0.5,
        overflow: 'linebreak',
        cellPadding: { top: 8, bottom: 8, left: 12, right: 12 },
      },
      didParseCell: (data: any) => {
        // Apply monospace font to all data cells (redundant but ensures consistency)
        if (data.row.index > 0) {
          data.cell.styles.font = 'courier';
        }
      },
    });

    finalY = (doc as any).lastAutoTable.finalY + 25;
  }

  // Add footer
  addFooter();

  // Save PDF
  doc.save(`${project.brandName.replace(/\s+/g, '_')}_Version_${version}_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
};

