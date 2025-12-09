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

// Simple in-memory cache for frequently accessed data
const cache = {
  checklistConfig: null as ChecklistConfig | null,
  integrations: null as Integration[] | null,
  configTimestamp: 0,
  integrationsTimestamp: 0,
  cacheTTL: 5 * 60 * 1000, // 5 minutes cache TTL
  // Promise cache to prevent race conditions when multiple calls happen simultaneously
  configPromise: null as Promise<ChecklistConfig> | null,
  integrationsPromise: null as Promise<Integration[]> | null,
};

// Helper to check if cache is still valid
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < cache.cacheTTL;
};

// Clear cache (useful for testing or manual invalidation)
export const clearCache = () => {
  cache.checklistConfig = null;
  cache.integrations = null;
  cache.configTimestamp = 0;
  cache.integrationsTimestamp = 0;
  cache.configPromise = null;
  cache.integrationsPromise = null;
};

// Projects Collection - lazy loaded to avoid build-time errors
const getProjectsCollection = () => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  return collection(db, 'projects');
};

export const getProject = async (projectId: string): Promise<Project | null> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  const docRef = doc(db, 'projects', projectId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    const project = { id: docSnap.id, ...docSnap.data() } as Project;
    
    // Load config and integrations in parallel, then calculate progress
    const [config, integrations] = await Promise.all([
      getChecklistConfig(true),
      getIntegrations(true),
    ]);
    
    const [salesCompletion, launchCompletion] = await Promise.all([
      calculateProgress(project.checklists?.sales || {}, config.sales, false, undefined),
      calculateProgress(project.checklists?.launch || {}, config.launch, true, integrations),
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
  const q = query(getProjectsCollection(), orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  
  // Load config and integrations once, in parallel (will use cache if available)
  const [config, integrations] = await Promise.all([
    getChecklistConfig(true),
    getIntegrations(true),
  ]);
  
  // Calculate progress for all projects in parallel, reusing the same config and integrations
  const projectsWithProgress = await Promise.all(
    querySnapshot.docs.map(async (doc) => {
      const project = { id: doc.id, ...doc.data() } as Project;
      
      // Recalculate progress based on current config, reusing integrations
      const [salesCompletion, launchCompletion] = await Promise.all([
        calculateProgress(project.checklists?.sales || {}, config.sales, false, undefined),
        calculateProgress(project.checklists?.launch || {}, config.launch, true, integrations),
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
  
  const docRef = await addDoc(getProjectsCollection(), newProject);
  return docRef.id;
};

export const updateProject = async (
  projectId: string,
  updates: Partial<Project>
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  const docRef = doc(db, 'projects', projectId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
};

export const deleteProject = async (projectId: string): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  const docRef = doc(db, 'projects', projectId);
  await deleteDoc(docRef);
};

// Settings Collection - lazy loaded to avoid build-time errors
const getSettingsCollection = () => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  return collection(db, 'settings');
};

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

export const getChecklistConfig = async (useCache: boolean = true): Promise<ChecklistConfig> => {
  // Return cached config if valid
  if (useCache && cache.checklistConfig && isCacheValid(cache.configTimestamp)) {
    return cache.checklistConfig;
  }

  // If there's already a pending request, return that promise to avoid duplicate fetches
  if (cache.configPromise) {
    return cache.configPromise;
  }

  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }

  // Create and cache the promise
  cache.configPromise = (async () => {
    try {
  const docRef = doc(db, 'settings', 'checklist');
  const docSnap = await getDoc(docRef);
  
      let config: ChecklistConfig;
  if (docSnap.exists()) {
        config = docSnap.data() as ChecklistConfig;
      } else {
  // Return default config if none exists
        config = getDefaultChecklistConfig();
      }
      
      // Update cache
      cache.checklistConfig = config;
      cache.configTimestamp = Date.now();
      
      return config;
    } finally {
      // Clear the promise cache after completion
      cache.configPromise = null;
    }
  })();

  return cache.configPromise;
};

export const updateChecklistConfig = async (config: ChecklistConfig): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  const docRef = doc(db, 'settings', 'checklist');
  await setDoc(docRef, config, { merge: true });
  
  // Update cache immediately
  cache.checklistConfig = config;
  cache.configTimestamp = Date.now();
};

// Integrations management
export const getIntegrations = async (useCache: boolean = true): Promise<Integration[]> => {
  // Return cached integrations if valid
  if (useCache && cache.integrations && isCacheValid(cache.integrationsTimestamp)) {
    return cache.integrations;
  }

  // If there's already a pending request, return that promise to avoid duplicate fetches
  if (cache.integrationsPromise) {
    return cache.integrationsPromise;
  }

  if (!db) {
    // During build, return empty array instead of throwing
    return [];
  }

  // Create and cache the promise
  cache.integrationsPromise = (async () => {
    try {
  const docRef = doc(db, 'settings', 'integrations');
  const docSnap = await getDoc(docRef);
      
      let integrations: Integration[] = [];
  
  if (docSnap.exists()) {
    const data = docSnap.data();
        const integrationsData = data.integrations;
        if (Array.isArray(integrationsData) && integrationsData.length > 0) {
          console.log(`Loaded ${integrationsData.length} integrations from Firestore`);
          integrations = integrationsData as Integration[];
    } else {
      console.warn('Integrations document exists but integrations array is empty or invalid');
    }
  } else {
    console.log('No integrations document in Firestore, loading from JSON file');
  }
  
      // If no integrations from Firestore, try loading from JSON file
      if (integrations.length === 0) {
  try {
    // For server-side, use require
    if (typeof window === 'undefined') {
      const integrationsData = require('../integrations.json');
      console.log(`Loaded ${integrationsData.length} integrations from JSON file (server)`);
            integrations = integrationsData as Integration[];
    } else {
      // For client-side, use fetch from public folder
      const response = await fetch('/integrations.json');
      if (response.ok) {
        const data = await response.json();
        console.log(`Loaded ${data.length} integrations from JSON file (client)`);
              integrations = data as Integration[];
      } else {
        console.error('Failed to fetch integrations.json:', response.status, response.statusText);
      }
    }
  } catch (error) {
    console.error('Error loading default integrations:', error);
  }
      }
      
      // Update cache
      cache.integrations = integrations;
      cache.integrationsTimestamp = Date.now();
      
  // Fallback to empty array if all else fails
      if (integrations.length === 0) {
  console.warn('No integrations loaded, returning empty array');
      }
      
      return integrations;
    } finally {
      // Clear the promise cache after completion
      cache.integrationsPromise = null;
    }
  })();

  return cache.integrationsPromise;
};

export const updateIntegrations = async (integrations: Integration[]): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized. Make sure Firebase config is set.');
  }
  if (!Array.isArray(integrations)) {
    throw new Error('Integrations must be an array');
  }
  
  const docRef = doc(db, 'settings', 'integrations');
  try {
    console.log(`Attempting to save ${integrations.length} integrations to Firestore...`);
    await setDoc(docRef, { integrations }, { merge: true });
    console.log(`Successfully saved ${integrations.length} integrations to Firestore at settings/integrations`);
    
    // Update cache immediately
    cache.integrations = integrations;
    cache.integrationsTimestamp = Date.now();
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
  isLaunch: boolean = false,
  integrations?: Integration[] // Allow passing integrations to avoid redundant fetches
): Promise<number> => {
  if (config.length === 0) return 0;
  
  let completed = 0;
  let total = 0;
  
  // Load integrations if needed for launch checklist and not provided
  let integrationsToUse: Integration[] = integrations || [];
  if (isLaunch && integrationsToUse.length === 0) {
    try {
      // Use cached integrations if available
      integrationsToUse = await getIntegrations(true);
    } catch (error) {
      console.error('Error loading integrations for progress calculation:', error);
    }
  }
  
  const checkIntegrationRequirements = (
    selectedIntegrationIds: string[],
    requirementStatus: Record<string, Record<string, boolean>>,
    integrations: Integration[]
  ): boolean => {
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
                const allRequirementsMet = checkIntegrationRequirements(
                  selectedIds,
                  requirementStatus,
                  integrationsToUse
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
            const allRequirementsMet = checkIntegrationRequirements(
              selectedIds,
              requirementStatus,
              integrationsToUse
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

