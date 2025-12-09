import { Project, ChecklistConfig, FieldConfig } from '@/types';

export interface EmailSection {
  id: string;
  title?: string;
  body: string;
}

export interface GeneratedEmail {
  to: string;
  subject: string;
  sections: EmailSection[];
  fullBody: string;
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

export const generateMissingInfoEmail = (
  project: Project,
  config: ChecklistConfig,
  userName?: string
): GeneratedEmail => {
  // Helper to get field value with config support
  const getValue = (fieldId: string, isSales: boolean) => getFieldValue(project, fieldId, isSales, config);
  const sections: EmailSection[] = [];
  const pocName = project.poc?.name || 'there';
  const brandName = project.brandName || 'your app';
  const internalUserName = userName || 'Appmaker Team';
  
  // 1. Greeting Section (always included)
  sections.push({
    id: 'greeting',
    body: `Hi ${pocName},\n\nHope you're doing well. We're currently preparing the mobile app setup for **${brandName}**, and we need a few additional details to proceed smoothly.\n`,
  });

  // 2. Migration / Fresh-specific section
  const releaseTypeValue = getValue('releaseType', true) || project.releaseType || '';
  const releaseType = (releaseTypeValue.toString()).toLowerCase();
  if (releaseType === 'migration') {
    sections.push({
      id: 'migration',
      title: 'Migration-Specific Requirements',
      body: `Since this is a migration from your existing app, we'll need:\n• Existing app store links (Google Play & App Store)\n• Details of your current keystore (whether you own it or your previous partner does)\n• Any constraints around signing / release management\n\n`,
    });
  } else if (releaseType === 'fresh') {
    // For fresh apps, we don't ask about keystore, but we can mention new store assets
    const keystoreValue = getValue('keystoreFiles', false);
    if (isFieldEmpty(keystoreValue, { id: 'keystoreFiles', label: 'Keystore Files', type: 'url' })) {
      sections.push({
        id: 'fresh-keystore',
        title: 'New App Store Assets',
        body: `For this fresh app release, we'll need:\n• New Play Store & App Store assets\n• Confirmation of Developer Account setup\n\n`,
      });
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
  
  if (missingDevAccounts.length > 0) {
    let devAccountBody = 'We need to confirm the status of your developer accounts:\n';
    
    if (androidDevAccount !== true) {
      devAccountBody += '• **Android Developer Account**: Please confirm status & share access invitation email or Play Console organization details.\n';
    }
    
    if (iosDevAccount !== true || (dunsStatus && dunsStatus.toLowerCase() !== 'completed' && dunsStatus.toLowerCase() !== 'not required')) {
      devAccountBody += '• **iOS Developer Account**: Please provide:\n';
      devAccountBody += '  - Your Apple Developer account email\n';
      devAccountBody += '  - Company legal name as registered with Apple\n';
      devAccountBody += '  - Status of DUNS/Enrollment\n';
    }
    
    devAccountBody += '\n';
    
    sections.push({
      id: 'developer-accounts',
      title: 'Developer Account Status',
      body: devAccountBody,
    });
  }

  // 4. Integrations & Credentials Section
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
  
  // Check if integrationsCredentials is empty or incomplete
  const hasIntegrations = Array.isArray(integrationsCredentials) && integrationsCredentials.length > 0;
  
  if (missingIntegrations.length > 0 || !hasIntegrations) {
    let integrationsBody = 'We still need access and credentials for the following:\n';
    
    if (firebaseAccess !== true) {
      integrationsBody += '• Firebase Admin access\n';
    }
    if (metaDeveloperAccess !== true) {
      integrationsBody += '• Meta Developer Access (Admin/Developer access required)\n';
    }
    if (!hasIntegrations) {
      integrationsBody += '• Integration credentials and API keys (e.g., Razorpay, payment gateways, etc.)\n';
    } else {
      // List what's missing - this is a simplified check
      integrationsBody += '• Additional integration credentials as needed\n';
    }
    
    integrationsBody += '\n';
    
    sections.push({
      id: 'integrations',
      title: 'Integrations & Credentials',
      body: integrationsBody,
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
  
  if (missingSalesFields.length > 0) {
    let salesBody = 'We\'re missing some information from the sales handover:\n';
    missingSalesFields.forEach((field) => {
      salesBody += `• ${field}\n`;
    });
    salesBody += '\n';
    
    sections.push({
      id: 'sales-fields',
      title: 'Missing Sales Information',
      body: salesBody,
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
  
  if (missingLaunchItems.length > 0) {
    let launchBody = 'We also need:\n';
    missingLaunchItems.forEach((item) => {
      launchBody += `• ${item}\n`;
    });
    launchBody += '\n';
    
    sections.push({
      id: 'launch-items',
      title: 'Additional Launch Requirements',
      body: launchBody,
    });
  }

  // 7. Closing Section (always included)
  sections.push({
    id: 'closing',
    body: `Once we have these details, we'll be able to proceed with development without delays.\n\nIf you have any questions, feel free to reply to this email or reach out to your Appmaker POC directly.\n\nBest,\n${internalUserName}\nAppmaker Team`,
  });

  // Build full body from sections
  const fullBody = sections.map((section) => {
    let text = '';
    if (section.title) {
      text += `${section.title}\n${'='.repeat(section.title.length)}\n\n`;
    }
    text += section.body;
    return text;
  }).join('\n\n');

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
  };
};

