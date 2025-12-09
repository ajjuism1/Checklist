import { Project, ChecklistConfig, FieldConfig, Integration } from '@/types';
import { getIntegrations } from '@/lib/firebase/firestore';

export interface EmailSection {
  id: string;
  title?: string;
  body: string;
  htmlBody?: string;
}

export interface GeneratedEmail {
  to: string;
  subject: string;
  sections: EmailSection[];
  fullBody: string;
  htmlBody?: string;
}

// Helper to get field value from project, handling both direct fields and nested group fields
const getFieldValue = (project: Project, fieldId: string, isSales: boolean, config?: ChecklistConfig): any => {
  const checklist = isSales ? project.checklists.sales : project.checklists.launch;
  
  // First, try direct access
  let value = checklist[fieldId];
  
  // If not found and we have config, check if it's in a group
  if (value === undefined && config) {
    const fields = isSales ? config.sales : config.launch;
    for (const field of fields) {
      if (field.type === 'group' && field.fields) {
        // Check if the fieldId is a sub-field of this group
        const subField = field.fields.find(f => f.id === fieldId);
        if (subField) {
          // Access via groupId.subFieldId
          const groupValue = checklist[field.id];
          if (groupValue && typeof groupValue === 'object') {
            value = groupValue[fieldId];
            break;
          }
        }
      }
    }
  }
  
  // Fallback to project-level fields for sales
  if (isSales && value === undefined) {
    value = fieldId === 'brandName' ? project.brandName :
            fieldId === 'collabCode' ? project.collabCode :
            fieldId === 'storeUrlMyShopify' ? project.storeUrlMyShopify :
            fieldId === 'storePublicUrl' ? project.storePublicUrl :
            fieldId === 'scopeOfWork' ? project.scopeOfWork :
            fieldId === 'designRefs' ? project.designRefs :
            fieldId === 'additionalDocs' ? project.additionalDocs :
            fieldId === 'paymentConfirmation' ? project.paymentConfirmation :
            fieldId === 'planDetails' ? project.planDetails :
            fieldId === 'revenueShare' ? project.revenueShare :
            fieldId === 'gmvInfo' ? project.gmvInfo :
            fieldId === 'releaseType' ? project.releaseType :
            fieldId === 'dunsStatus' ? project.dunsStatus :
            fieldId === 'poc' ? project.poc : null;
  }
  
  return value;
};

// Helper to check if a field is empty
const isFieldEmpty = (value: any, fieldConfig: FieldConfig): boolean => {
  if (fieldConfig.optional) return false;
  
  if (fieldConfig.type === 'checkbox') {
    return value !== true;
  }
  
  if (fieldConfig.type === 'multi_input') {
    return !Array.isArray(value) || value.length === 0;
  }
  
  if (fieldConfig.type === 'group') {
    if (!fieldConfig.fields) return false;
    return fieldConfig.fields.some((subField) => {
      const subValue = value?.[subField.id];
      return isFieldEmpty(subValue, subField);
    });
  }
  
  return !value || value.toString().trim() === '';
};

// Helper to get nested field value from group
const getNestedFieldValue = (value: any, fieldId: string, subFieldId: string): any => {
  if (value && typeof value === 'object' && value[fieldId]) {
    return value[fieldId][subFieldId];
  }
  return null;
};

// Helper to create HTML table for Gmail (Gmail-compatible HTML)
const createHTMLTable = (headers: string[], rows: string[][]): string => {
  if (rows.length === 0) return '';
  
  const headerRow = headers.map(h => `<th style="border: 1px solid #ddd; padding: 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;">${h}</th>`).join('');
  const dataRows = rows.map(row => 
    `<tr>${row.map(cell => `<td style="border: 1px solid #ddd; padding: 12px;">${cell || ''}</td>`).join('')}</tr>`
  ).join('');
  
  return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-family: Arial, sans-serif;">
    <thead>
      <tr>${headerRow}</tr>
    </thead>
    <tbody>
      ${dataRows}
    </tbody>
  </table>`;
};

// Helper to create a formatted list with clear structure (plain text)
const createFormattedList = (items: Array<{ label: string; details?: string[] }>): string => {
  if (items.length === 0) return '';
  
  return items.map((item, idx) => {
    let text = `• ${item.label}`;
    if (item.details && item.details.length > 0) {
      text += '\n' + item.details.map(detail => `  - ${detail}`).join('\n');
    }
    return text;
  }).join('\n\n');
};

// Helper to create HTML list table (for Gmail)
const createHTMLListTable = (items: Array<{ label: string; details?: string[] }>): string => {
  if (items.length === 0) return '';
  
  const rows = items.map(item => {
    const details = item.details && item.details.length > 0 
      ? `<ul style="margin: 4px 0; padding-left: 20px;">${item.details.map(d => `<li style="margin: 2px 0;">${d}</li>`).join('')}</ul>`
      : '';
    return `<tr><td style="border: 1px solid #ddd; padding: 12px; font-weight: 600;">${item.label}</td><td style="border: 1px solid #ddd; padding: 12px;">${details}</td></tr>`;
  }).join('');
  
  return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-family: Arial, sans-serif;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;">Item</th>
        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;">Details</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
};

// Helper to create a structured information block (plain text)
const createInfoBlock = (items: Array<{ name: string; status?: string; details: string }>): string => {
  if (items.length === 0) return '';
  
  return items.map(item => {
    let text = `• ${item.name}`;
    if (item.status) {
      text += ` (${item.status})`;
    }
    text += `\n  ${item.details}`;
    return text;
  }).join('\n\n');
};

// Helper to create HTML info block table (for Gmail)
const createHTMLInfoBlock = (items: Array<{ name: string; status?: string; details: string }>): string => {
  if (items.length === 0) return '';
  
  const rows = items.map(item => {
    const nameCell = item.status 
      ? `${item.name}<br><span style="color: #666; font-size: 0.9em;">(${item.status})</span>`
      : item.name;
    return `<tr>
      <td style="border: 1px solid #ddd; padding: 12px; font-weight: 600; width: 30%;">${nameCell}</td>
      <td style="border: 1px solid #ddd; padding: 12px;">${item.details}</td>
    </tr>`;
  }).join('');
  
  return `<table style="border-collapse: collapse; width: 100%; margin: 16px 0; font-family: Arial, sans-serif;">
    <thead>
      <tr>
        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;">Item</th>
        <th style="border: 1px solid #ddd; padding: 12px; text-align: left; background-color: #f5f5f5; font-weight: 600;">Details</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>`;
};

export const generateMissingInfoEmail = async (
  project: Project,
  config: ChecklistConfig,
  userName?: string,
  selectedSections?: Set<string>
): Promise<GeneratedEmail> => {
  // Helper to get field value with config support
  const getValue = (fieldId: string, isSales: boolean) => getFieldValue(project, fieldId, isSales, config);
  const sections: EmailSection[] = [];
  const pocName = project.poc?.name || 'there';
  const brandName = project.brandName || 'your app';
  const internalUserName = userName || 'Appmaker Team';
  
  // 1. Greeting Section (always included)
  sections.push({
    id: 'greeting',
    body: `Hi ${pocName},\n\nHope you're doing well. We're currently preparing the mobile app setup for "${brandName}", and we need a few additional details to proceed smoothly.\n`,
    htmlBody: `<p>Hi ${pocName},</p><p>Hope you're doing well. We're currently preparing the mobile app setup for <strong>"${brandName}"</strong>, and we need a few additional details to proceed smoothly.</p>`,
  });

  // 2. Migration / Fresh-specific section
  const releaseTypeValue = getValue('releaseType', true) || project.releaseType || '';
  const releaseType = (releaseTypeValue.toString()).toLowerCase();
  if (releaseType === 'migration') {
    if (!selectedSections || selectedSections.has('migration')) {
      const migrationItems = [
        { label: 'Existing app store links', details: ['Google Play Store URL', 'Apple App Store URL'] },
        { label: 'Keystore details', details: ['Current keystore ownership status', 'Previous partner information (if applicable)'] },
        { label: 'Signing & release constraints', details: ['Any specific requirements or limitations'] }
      ];
      
    sections.push({
      id: 'migration',
      title: 'Migration-Specific Requirements',
        body: `Since this is a migration from your existing app, we'll need the following information:\n\n${createFormattedList(migrationItems)}\n\n`,
        htmlBody: `<p>Since this is a migration from your existing app, we'll need the following information:</p>${createHTMLListTable(migrationItems)}`,
    });
    }
  } else if (releaseType === 'fresh') {
    // For fresh apps, we don't ask about keystore, but we can mention new store assets
    const keystoreValue = getValue('keystoreFiles', false);
    if (isFieldEmpty(keystoreValue, { id: 'keystoreFiles', label: 'Keystore Files', type: 'url' })) {
      if (!selectedSections || selectedSections.has('fresh-keystore')) {
        const freshItems = [
          { label: 'New Play Store assets', details: ['App icons', 'Screenshots', 'Store listing content'] },
          { label: 'New App Store assets', details: ['App icons', 'Screenshots', 'Store listing content'] },
          { label: 'Developer Account setup', details: ['Confirmation of account creation', 'Access permissions'] }
        ];
        
      sections.push({
        id: 'fresh-keystore',
        title: 'New App Store Assets',
          body: `For this fresh app release, we'll need:\n\n${createFormattedList(freshItems)}\n\n`,
          htmlBody: `<p>For this fresh app release, we'll need:</p>${createHTMLListTable(freshItems)}`,
      });
      }
    }
  }

  // 3. Developer Account Section
  const androidDevAccount = getValue('androidDeveloperAccount', false);
  const iosDevAccount = getValue('iosDeveloperAccount', false);
  const dunsStatus = getValue('dunsStatus', true) || project.dunsStatus || '';
  
  const missingDevAccounts: string[] = [];
  if (androidDevAccount !== true) {
    missingDevAccounts.push('Android Developer Account');
  }
  if (iosDevAccount !== true || (dunsStatus && dunsStatus.toLowerCase() !== 'completed' && dunsStatus.toLowerCase() !== 'not required')) {
    missingDevAccounts.push('iOS Developer Account');
  }
  
  if (missingDevAccounts.length > 0 && (!selectedSections || selectedSections.has('developer-accounts'))) {
    const devAccountItems: Array<{ name: string; status?: string; details: string }> = [];
    
    if (androidDevAccount !== true) {
      devAccountItems.push({
        name: 'Android Developer Account',
        status: 'Pending',
        details: 'Please confirm status & share access invitation email or Play Console organization details.'
      });
    }
    
    if (iosDevAccount !== true || (dunsStatus && dunsStatus.toLowerCase() !== 'completed' && dunsStatus.toLowerCase() !== 'not required')) {
      const iosDetails: string[] = [];
      iosDetails.push('Apple Developer account email');
      iosDetails.push('Company legal name as registered with Apple');
      if (dunsStatus && dunsStatus.toLowerCase() !== 'completed' && dunsStatus.toLowerCase() !== 'not required') {
        iosDetails.push('DUNS/Enrollment status');
    }
    
      devAccountItems.push({
        name: 'iOS Developer Account',
        status: 'Pending',
        details: `Please provide: ${iosDetails.join(', ')}.`
      });
    }
    
    sections.push({
      id: 'developer-accounts',
      title: 'Developer Account Status',
      body: `We need to confirm the status of your developer accounts:\n\n${createInfoBlock(devAccountItems)}\n\n`,
      htmlBody: `<p>We need to confirm the status of your developer accounts:</p>${createHTMLInfoBlock(devAccountItems)}`,
    });
  }

  // 4. Integrations & Credentials Section
  const integrationsSelected = getValue('integrations', false);
  const integrationsCredentials = getValue('integrationsCredentials', false);
  const firebaseAccess = getValue('firebaseAccess', false);
  const metaDeveloperAccess = getValue('metaDeveloperAccess', false);
  
  const missingIntegrations: string[] = [];
  if (firebaseAccess !== true) {
    missingIntegrations.push('Firebase Access (Admin)');
  }
  if (metaDeveloperAccess !== true) {
    missingIntegrations.push('Meta Developer Access');
  }
  
  // Get selected integrations and their requirements
  let selectedIntegrationsList: Integration[] = [];
  if (Array.isArray(integrationsSelected) && integrationsSelected.length > 0) {
    try {
      const allIntegrations = await getIntegrations();
      selectedIntegrationsList = allIntegrations.filter(integ => 
        integrationsSelected.includes(integ.id)
      );
    } catch (error) {
      console.error('Error loading integrations:', error);
    }
  }
  
  // Check if integrationsCredentials is empty or incomplete
  const hasIntegrations = Array.isArray(integrationsCredentials) && integrationsCredentials.length > 0;
  const hasSelectedIntegrations = selectedIntegrationsList.length > 0;
  
  if ((missingIntegrations.length > 0 || !hasIntegrations || hasSelectedIntegrations) && 
      (!selectedSections || selectedSections.has('integrations'))) {
    const integrationItems: Array<{ name: string; status?: string; details: string }> = [];
    
    // Add platform access requirements
    if (firebaseAccess !== true) {
      integrationItems.push({
        name: 'Firebase',
        status: 'Platform Access',
        details: 'Admin access required for Firebase project management.'
      });
    }
    if (metaDeveloperAccess !== true) {
      integrationItems.push({
        name: 'Meta (Facebook)',
        status: 'Platform Access',
        details: 'Admin/Developer access required for Meta Developer Console.'
      });
    }
    
    // Add selected integrations and their requirements
    if (hasSelectedIntegrations) {
      selectedIntegrationsList.forEach(integ => {
        const requirements = integ.requirements && integ.requirements.length > 0
          ? integ.requirements.join(', ')
          : 'No specific requirements listed';
        
        let details = `Required: ${requirements}`;
        if (integ.documentationLink && 
            integ.documentationLink !== 'N/A' && 
            !integ.documentationLink.includes('Requested')) {
          details += ` | Documentation: ${integ.documentationLink}`;
        }
        
        integrationItems.push({
          name: integ.name,
          status: integ.category || 'Integration',
          details: details
      });
      });
    }
    
    // Add placeholder if no integrations selected
    if (!hasSelectedIntegrations && !hasIntegrations) {
      integrationItems.push({
        name: 'Integration Credentials',
        status: 'General',
        details: 'Please select integrations from the checklist and provide the required API keys and credentials.'
      });
    }
    
    let integrationsBody = `We still need access and credentials for the following:\n\n${createInfoBlock(integrationItems)}\n\n`;
    let integrationsHtmlBody = `<p>We still need access and credentials for the following:</p>${createHTMLInfoBlock(integrationItems)}`;
    
    if (!hasIntegrations && hasSelectedIntegrations) {
      integrationsBody += 'Please provide the credentials listed above for the selected integrations.\n\n';
      integrationsHtmlBody += '<p>Please provide the credentials listed above for the selected integrations.</p>';
    }
    
    sections.push({
      id: 'integrations',
      title: 'Integrations & Credentials',
      body: integrationsBody,
      htmlBody: integrationsHtmlBody,
    });
  }

  // 5. Missing Sales Handover Fields
  const missingSalesFields: string[] = [];
  
  // Check collab code
  const collabCode = getValue('collabCode', true);
  if (isFieldEmpty(collabCode, { id: 'collabCode', label: 'Collab request code', type: 'text' })) {
    missingSalesFields.push('Collab request code');
  }
  
  // Check design references
  const designRefs = getValue('designRefs', true);
  if (isFieldEmpty(designRefs, { id: 'designRefs', label: 'Design references', type: 'multi_input' })) {
    missingSalesFields.push('Design references');
  }
  
  // Check additional docs
  const additionalDocs = getValue('additionalDocs', true);
  if (isFieldEmpty(additionalDocs, { id: 'additionalDocs', label: 'Additional PRD/References', type: 'multi_input' })) {
    missingSalesFields.push('Additional PRD/Reference documents');
  }
  
  // Check payment confirmation
  const paymentConfirmation = getValue('paymentConfirmation', true);
  const planDetails = getValue('planDetails', true);
  if (paymentConfirmation !== true && planDetails) {
    missingSalesFields.push('Payment confirmation');
  }
  
  if (missingSalesFields.length > 0 && (!selectedSections || selectedSections.has('sales-fields'))) {
    const salesItems = missingSalesFields.map(field => ({
      name: field,
      status: 'Missing',
      details: 'Required for project setup and handover.'
    }));
    
    sections.push({
      id: 'sales-fields',
      title: 'Missing Sales Information',
      body: `We're missing some information from the sales handover:\n\n${createInfoBlock(salesItems)}\n\n`,
      htmlBody: `<p>We're missing some information from the sales handover:</p>${createHTMLInfoBlock(salesItems)}`,
    });
  }

  // 6. Launch Checklist Dependencies
  const dataClarityProvided = getValue('dataClarityProvided', false);
  const storeListingDetails = getValue('storeListingDetails', false);
  
  const missingLaunchItems: string[] = [];
  if (dataClarityProvided !== true) {
    missingLaunchItems.push('Data Clarity documentation');
  }
  if (isFieldEmpty(storeListingDetails, { id: 'storeListingDetails', label: 'Store Listing Details', type: 'textarea' })) {
    missingLaunchItems.push('Store Listing Details');
  }
  
  if (missingLaunchItems.length > 0 && (!selectedSections || selectedSections.has('launch-items'))) {
    const launchItems = missingLaunchItems.map(item => ({
      name: item,
      status: 'Pending',
      details: 'Required before launch.'
    }));
    
    sections.push({
      id: 'launch-items',
      title: 'Additional Launch Requirements',
      body: `We also need the following items:\n\n${createInfoBlock(launchItems)}\n\n`,
      htmlBody: `<p>We also need the following items:</p>${createHTMLInfoBlock(launchItems)}`,
    });
  }

  // 7. Closing Section (always included)
  sections.push({
    id: 'closing',
    body: `Once we have these details, we'll be able to proceed with development without delays.\n\nIf you have any questions, feel free to reply to this email or reach out to your Appmaker POC directly.\n\nBest,\n${internalUserName}\nAppmaker Team`,
    htmlBody: `<p>Once we have these details, we'll be able to proceed with development without delays.</p><p>If you have any questions, feel free to reply to this email or reach out to your Appmaker POC directly.</p><p>Best,<br>${internalUserName}<br>Appmaker Team</p>`,
  });

  // Build full body from sections with better formatting
  const fullBody = sections.map((section) => {
    let text = '';
    if (section.title) {
      // Use a cleaner header format
      text += `${section.title}\n${'─'.repeat(section.title.length)}\n\n`;
    }
    text += section.body;
    return text;
  }).join('\n\n');

  // Build HTML body from sections
  const htmlBody = sections.map((section) => {
    let html = '';
    if (section.title) {
      html += `<h3 style="margin-top: 24px; margin-bottom: 12px; color: #333; font-size: 18px; font-weight: 600; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">${section.title}</h3>`;
    }
    html += section.htmlBody || section.body.replace(/\n/g, '<br>');
    return html;
  }).join('\n');

  // Generate subject
  const subject = `[Action Required] Missing Info for Your App Launch – ${brandName}`;

  // Get POC email - check both nested group and direct access
  let pocEmail = '';
  const pocValue = getValue('poc', true);
  if (pocValue && typeof pocValue === 'object' && pocValue.email) {
    pocEmail = pocValue.email;
  } else if (project.poc?.email) {
    pocEmail = project.poc.email;
  }

  return {
    to: pocEmail,
    subject,
    sections,
    fullBody,
    htmlBody: `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${htmlBody}</div>`,
  };
};

