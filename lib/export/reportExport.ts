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
        ? value.map((item: string) => `• ${item}`).join('\n')
        : 'None';
    case 'url':
      return value;
    case 'group':
      if (typeof value === 'object' && value !== null) {
        return fieldConfig?.fields?.map((subField: any) => 
          `${subField.label}: ${value[subField.id] || 'N/A'}`
        ).join('\n') || 'Not provided';
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
  const margin = 20;
  let finalY = 20;

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
          ? value.map((item: string) => `• ${item}`).join('\n')
          : 'None';
      case 'url':
        return String(value);
      case 'group':
        if (typeof value === 'object' && value !== null) {
          return fieldConfig?.fields?.map((subField: any) => 
            `${subField.label}: ${value[subField.id] || 'N/A'}`
          ).join('\n') || 'Not provided';
        }
        return 'Not provided';
      case 'textarea':
        return String(value);
      default:
        return String(value);
    }
  };

  // Title Section
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Handover Report', margin, finalY);
  finalY += 12;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.brandName}`, margin, finalY);
  finalY += 8;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, margin, finalY);
  doc.setTextColor(0, 0, 0);
  finalY += 15;

  // Progress Summary Table
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Progress Summary', margin, finalY);
  finalY += 8;

  autoTable(doc, {
    startY: finalY,
    head: [['Metric', 'Completion']],
    body: [
      ['Sales Progress', `${project.progress.salesCompletion}%`],
      ['Launch Progress', `${project.progress.launchCompletion}%`],
      ['Overall Progress', `${project.progress.overall}%`],
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [75, 85, 99], // Neutral grey
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 120, fontStyle: 'bold' },
      1: { halign: 'center' },
    },
    margin: { left: margin, right: margin },
  });

  finalY = (doc as any).lastAutoTable.finalY + 15;

  // Sales Handover Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales Handover Information', margin, finalY);
  finalY += 8;

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
      fillColor: [75, 85, 99], // Neutral grey
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', valign: 'top' },
      1: { cellWidth: 'auto', valign: 'top' },
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    didParseCell: (data: any) => {
      // Highlight empty fields
      if (data.row.index > 0 && data.column.index === 1) {
        const fieldIndex = data.row.index - 1;
        const value = getValue(config.sales[fieldIndex].id, true);
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0)) {
          data.cell.styles.fillColor = [249, 250, 251]; // Light gray
          data.cell.styles.textColor = [156, 163, 175]; // Gray text
        }
      }
    },
  });

  finalY = (doc as any).lastAutoTable.finalY + 15;

  // Launch Checklist Section
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Launch Checklist', margin, finalY);
  finalY += 8;

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
      fillColor: [75, 85, 99], // Neutral grey
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 80, fontStyle: 'bold', valign: 'top' },
      1: { cellWidth: 'auto', valign: 'top' },
    },
    margin: { left: margin, right: margin },
    styles: {
      cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
    },
    didParseCell: (data: any) => {
      // Highlight empty fields
      if (data.row.index > 0 && data.column.index === 1) {
        const fieldIndex = data.row.index - 1;
        const value = getValue(config.launch[fieldIndex].id, false);
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0)) {
          data.cell.styles.fillColor = [249, 250, 251]; // Light gray
          data.cell.styles.textColor = [156, 163, 175]; // Gray text
        }
      }
    },
  });

  // Save PDF
  doc.save(`${project.brandName.replace(/\s+/g, '_')}_Handover_Report_${new Date().toISOString().split('T')[0]}.pdf`);
};

