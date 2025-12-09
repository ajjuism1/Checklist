import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';
import { db } from './config';
import { Project, ChecklistConfig, FieldConfig, Integration } from '@/types';

export interface FlattenedField extends FieldConfig {
  groupId?: string;
  groupLabel?: string;
  isSubField?: boolean;
}

// Projects Collection
export const projectsCollection = collection(db, 'projects');

export const getProject = async (projectId: string): Promise<Project | null> => {
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const project = { id: docSnap.id, ...docSnap.data() } as Project;
    
    // Recalculate progress based on current config
    const config = await getChecklistConfig();
    const [salesCompletion, launchCompletion] = await Promise.all([
      calculateProgress(project.checklists?.sales || {}, config.sales, false),
      calculateProgress(project.checklists?.launch || {}, config.launch, true),
    ]);
    const overall = Math.round((salesCompletion + launchCompletion) / 2);
    
    return {
      ...project,
      progress: {
        salesCompletion,
        launchCompletion,
        overall,
      },
    };
  }
  return null;
};

export const getAllProjects = async (): Promise<Project[]> => {
  const q = query(projectsCollection, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  // Get current config to recalculate progress
  const config = await getChecklistConfig();
  
  // Calculate progress for all projects in parallel
  const projectsWithProgress = await Promise.all(
    querySnapshot.docs.map(async (doc) => {
      const project = { id: doc.id, ...doc.data() } as Project;
      
      // Recalculate progress based on current config
      const [salesCompletion, launchCompletion] = await Promise.all([
        calculateProgress(project.checklists?.sales || {}, config.sales, false),
        calculateProgress(project.checklists?.launch || {}, config.launch, true),
      ]);
      const overall = Math.round((salesCompletion + launchCompletion) / 2);
      
      return {
        ...project,
        progress: {
          salesCompletion,
          launchCompletion,
          overall,
        },
      };
    })
  );
  
  return projectsWithProgress;
};

export const createProject = async (projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'progress'>): Promise<string> => {
  const now = Timestamp.now();
  const newProject = {
    ...projectData,
    status: projectData.status || 'Not Started',
    progress: {
      salesCompletion: 0,
      launchCompletion: 0,
      overall: 0,
    },
    createdAt: now,
    updatedAt: now,
  };
  
  const docRef = await addDoc(projectsCollection, newProject);
  return docRef.id;
};

export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<void> => {
  const docRef = doc(db, 'projects', projectId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteProject = async (projectId: string): Promise<void> => {
  const docRef = doc(db, 'projects', projectId);
  await deleteDoc(docRef);
};

// Settings Collection
export const settingsCollection = collection(db, 'settings');

// Default checklist configuration
const getDefaultChecklistConfig = (): ChecklistConfig => ({
  version: '1.0.0',
  sales: [
    { id: 'brandName', label: 'Brand name', type: 'text' },
    { id: 'storeUrlMyShopify', label: 'Shopify store URL (myshopify)', type: 'text' },
    { id: 'storePublicUrl', label: 'Shopify store URL (public)', type: 'text' },
    { id: 'collabCode', label: 'Collab request code', type: 'text' },
    { id: 'scopeOfWork', label: 'Scope of work', type: 'textarea' },
    { id: 'designRefs', label: 'Design references', type: 'multi_input' },
    { id: 'additionalDocs', label: 'Additional PRD/References', type: 'multi_input' },
    { id: 'paymentConfirmation', label: 'One-time payment confirmation', type: 'checkbox' },
    { id: 'planDetails', label: 'Plan + Revenue Share %', type: 'text' },
    { id: 'revenueShare', label: 'Revenue Share', type: 'text' },
    { id: 'gmvInfo', label: 'GMV details', type: 'textarea' },
    { id: 'releaseType', label: 'Fresh release or migration', type: 'select', options: ['Fresh', 'Migration'] },
    { id: 'dunsStatus', label: 'DUNS / Developer Account Status', type: 'select', options: ['Pending', 'In Progress', 'Completed', 'Not Required'] },
    { id: 'themeType', label: 'Theme Type', type: 'select', options: ['P1', 'mWeb Parity', 'Custom'] },
    {
      id: 'poc',
      label: 'POC Details',
      type: 'group',
      fields: [
        { id: 'name', label: 'Name', type: 'text' },
        { id: 'email', label: 'Email', type: 'text' },
        { id: 'phone', label: 'Phone', type: 'text' },
      ],
    },
  ],
  launch: [
    { id: 'androidDeveloperAccount', label: 'Android Developer Account', type: 'checkbox' },
    { id: 'iosDeveloperAccount', label: 'iOS Developer Account', type: 'checkbox' },
    { id: 'firebaseAccess', label: 'Firebase Access (Admin)', type: 'checkbox' },
    { id: 'metaDeveloperAccess', label: 'Meta Developer Access', type: 'checkbox' },
    { id: 'dataClarityProvided', label: 'Data Clarity Provided', type: 'checkbox' },
    { id: 'integrationsCredentials', label: 'Integrations – Credentials & Keys', type: 'multi_input' },
    { id: 'storeListingDetails', label: 'Store Listing Details', type: 'textarea' },
    { id: 'keystoreFiles', label: 'Keystore Files', type: 'url' },
    { id: 'otpTestCredentials', label: 'OTP Test Credentials', type: 'text', optional: true },
    { id: 'customFeatures', label: 'Custom Features', type: 'multi_input' },
    { id: 'changeRequests', label: 'Change Requests', type: 'multi_input' },
    { id: 'bugReports', label: 'Bug Reports (link / notes)', type: 'textarea' },
    { id: 'testCases', label: 'Test Cases (Google Sheet link)', type: 'url' },
  ],
});

export const getChecklistConfig = async (): Promise<ChecklistConfig> => {
  const docRef = doc(db, 'settings', 'checklist');
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as ChecklistConfig;
  }
  // Return default config if none exists
  return getDefaultChecklistConfig();
};

export const updateChecklistConfig = async (config: ChecklistConfig): Promise<void> => {
  const docRef = doc(db, 'settings', 'checklist');
  await setDoc(docRef, config, { merge: true });
};

// Integrations management
export const getIntegrations = async (): Promise<Integration[]> => {
  const docRef = doc(db, 'settings', 'integrations');
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const integrations = data.integrations;
    if (Array.isArray(integrations) && integrations.length > 0) {
      console.log(`Loaded ${integrations.length} integrations from Firestore`);
      return integrations as Integration[];
    } else {
      console.warn('Integrations document exists but integrations array is empty or invalid');
    }
  } else {
    console.log('No integrations document in Firestore, loading from JSON file');
  }
  
  // Return default integrations from JSON file
  // Try to load from JSON file (works in both server and client contexts)
  try {
    // For server-side, use require
    if (typeof window === 'undefined') {
      const integrationsData = require('../integrations.json');
      console.log(`Loaded ${integrationsData.length} integrations from JSON file (server)`);
      return integrationsData as Integration[];
    } else {
      // For client-side, use fetch from public folder
      const response = await fetch('/integrations.json');
      if (response.ok) {
        const data = await response.json();
        console.log(`Loaded ${data.length} integrations from JSON file (client)`);
        return data as Integration[];
      } else {
        console.error('Failed to fetch integrations.json:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('Error loading default integrations:', error);
  }
  // Fallback to empty array if all else fails
  console.warn('No integrations loaded, returning empty array');
  return [];
};

export const updateIntegrations = async (integrations: Integration[]): Promise<void> => {
  if (!Array.isArray(integrations)) {
    throw new Error('Integrations must be an array');
  }
  
  const docRef = doc(db, 'settings', 'integrations');
  try {
    console.log(`Attempting to save ${integrations.length} integrations to Firestore...`);
    await setDoc(docRef, { integrations }, { merge: true });
    console.log(`Successfully saved ${integrations.length} integrations to Firestore at settings/integrations`);
  } catch (error: any) {
    console.error('Error saving integrations to Firestore:', error);
    if (error.code === 'permission-denied') {
      throw new Error('Permission denied. Please check Firestore rules and ensure you have admin access.');
    }
    throw error;
  }
};

// Flatten fields - expand groups into individual fields for display
export const flattenFields = (config: FieldConfig[]): FlattenedField[] => {
  const flattened: FlattenedField[] = [];
  
  config.forEach((field) => {
    if (field.type === 'group' && field.fields) {
      // Add each sub-field individually
      field.fields.forEach((subField) => {
        flattened.push({
          ...subField,
          groupId: field.id,
          groupLabel: field.label,
          isSubField: true,
        });
      });
    } else {
      // Add regular field as-is
      flattened.push(field);
    }
  });
  
  return flattened;
};

// Helper function to determine if a field is required/mandatory
const isFieldRequired = (field: FieldConfig): boolean => {
  // If explicitly marked as required, it's mandatory
  if (field.required === true) return true;
  // If explicitly marked as optional, it's not required
  if (field.optional === true) return false;
  // Default: if neither is set, field is required
  return true;
};

// Calculate progress for a checklist
export const calculateProgress = async (
  checklist: Record<string, any>,
  config: FieldConfig[],
  isLaunch: boolean = false
): Promise<number> => {
  if (config.length === 0) return 0;
  
  let completed = 0;
  let total = 0;
  
  // Load integrations if needed for launch checklist
  let integrations: Integration[] = [];
  if (isLaunch) {
    try {
      // Load integrations directly (inline to avoid circular dependency)
      const docRef = doc(db, 'settings', 'integrations');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const integrationsData = data.integrations;
        if (Array.isArray(integrationsData) && integrationsData.length > 0) {
          integrations = integrationsData as Integration[];
        }
      } else {
        // Fallback to JSON file
        if (typeof window === 'undefined') {
          const integrationsData = require('../integrations.json');
          integrations = integrationsData as Integration[];
        } else {
          const response = await fetch('/integrations.json');
          if (response.ok) {
            const data = await response.json();
            integrations = data as Integration[];
          }
        }
      }
    } catch (error) {
      console.error('Error loading integrations for progress calculation:', error);
    }
  }
  
  const checkIntegrationRequirements = async (
    selectedIntegrationIds: string[],
    requirementStatus: Record<string, Record<string, boolean>>,
    integrations: Integration[]
  ): Promise<boolean> => {
    if (!Array.isArray(selectedIntegrationIds) || selectedIntegrationIds.length === 0) {
      return false;
    }
    
    // Check each selected integration
    for (const integrationId of selectedIntegrationIds) {
      const integration = integrations.find(integ => integ.id === integrationId);
      if (!integration) continue;
      
      // If integration has requirements, all must be checked
      if (integration.requirements && integration.requirements.length > 0) {
        const status = requirementStatus[integrationId] || {};
        const allChecked = integration.requirements.every(req => status[req] === true);
        if (!allChecked) {
          return false;
        }
      }
    }
    
    return true;
  };
  
  for (const field of config) {
    // Skip if field is marked as not relevant
    if (checklist[`${field.id}_notRelevant`] === true) {
      continue;
    }
    
    if (field.type === 'group') {
      // Handle group fields - check each sub-field individually
      if (field.fields) {
        for (const subField of field.fields) {
          // Skip if subfield is marked as not relevant
          const subFieldNotRelevant = checklist[field.id]?.[`${subField.id}_notRelevant`] === true;
          if (isFieldRequired(subField) && !subFieldNotRelevant) {
            total++;
            const value = checklist[field.id]?.[subField.id];
            
            if (subField.type === 'checkbox') {
              if (value === true) completed++;
            } else if (subField.type === 'multi_input') {
              // Handle multi_input with status (objects) or without (strings)
              if (Array.isArray(value) && value.length > 0) {
                const allFilled = value.every((item: any) => {
                  if (typeof item === 'string') {
                    return item.trim() !== '';
                  }
                  // Handle object format {value, status}
                  return item.value && item.value.toString().trim() !== '';
                });
                if (allFilled) completed++;
              }
            } else if (subField.type === 'multi_select') {
              // For launch checklist, check integration requirements
              if (isLaunch && subField.optionsSource === 'integrations') {
                const selectedIds = Array.isArray(value) ? value : [];
                const requirementStatus = checklist[field.id]?.[`${subField.id}_requirementStatus`] || {};
                const allRequirementsMet = await checkIntegrationRequirements(
                  selectedIds,
                  requirementStatus,
                  integrations
                );
                if (allRequirementsMet) completed++;
              } else {
                // For sales or non-integration multi_select, just check if items are selected
                if (Array.isArray(value) && value.length > 0) completed++;
              }
            } else if (subField.type === 'select') {
              if (value && value.toString().trim() !== '') completed++;
            } else {
              if (value && value.toString().trim() !== '') completed++;
            }
          }
        }
      }
    } else {
      // Handle regular fields
      // Skip if field is marked as not relevant (already checked above, but keeping for clarity)
      if (isFieldRequired(field)) {
        total++;
        const value = checklist[field.id];
        
        if (field.type === 'checkbox') {
          if (value === true) completed++;
        } else if (field.type === 'multi_input') {
          // Handle multi_input with status (objects) or without (strings)
          if (Array.isArray(value) && value.length > 0) {
            const allFilled = value.every((item: any) => {
              if (typeof item === 'string') {
                return item.trim() !== '';
              }
              // Handle object format {value, status}
              return item.value && item.value.toString().trim() !== '';
            });
            if (allFilled) completed++;
          }
        } else if (field.type === 'multi_select') {
          // For launch checklist, check integration requirements
          if (isLaunch && field.optionsSource === 'integrations') {
            const selectedIds = Array.isArray(value) ? value : [];
            const requirementStatus = checklist[`${field.id}_requirementStatus`] || {};
            const allRequirementsMet = await checkIntegrationRequirements(
              selectedIds,
              requirementStatus,
              integrations
            );
            if (allRequirementsMet) completed++;
          } else {
            // For sales or non-integration multi_select, just check if items are selected
            if (Array.isArray(value) && value.length > 0) completed++;
          }
        } else if (field.type === 'select') {
          if (value && value.toString().trim() !== '') completed++;
        } else {
          if (value && value.toString().trim() !== '') completed++;
        }
      }
    }
  }
  
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

