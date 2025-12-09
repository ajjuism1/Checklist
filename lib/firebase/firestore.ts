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
import { Project, ChecklistConfig, FieldConfig } from '@/types';

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
    const salesCompletion = calculateProgress(project.checklists?.sales || {}, config.sales);
    const launchCompletion = calculateProgress(project.checklists?.launch || {}, config.launch);
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
  
  return querySnapshot.docs.map((doc) => {
    const project = { id: doc.id, ...doc.data() } as Project;
    
    // Recalculate progress based on current config
    const salesCompletion = calculateProgress(project.checklists?.sales || {}, config.sales);
    const launchCompletion = calculateProgress(project.checklists?.launch || {}, config.launch);
    const overall = Math.round((salesCompletion + launchCompletion) / 2);
    
    return {
      ...project,
      progress: {
        salesCompletion,
        launchCompletion,
        overall,
      },
    };
  });
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

// Calculate progress for a checklist
export const calculateProgress = (
  checklist: Record<string, any>,
  config: FieldConfig[]
): number => {
  if (config.length === 0) return 0;
  
  let completed = 0;
  let total = 0;
  
  config.forEach((field) => {
    if (field.type === 'group') {
      // Handle group fields - check each sub-field individually
      if (field.fields) {
        field.fields.forEach((subField) => {
          if (!subField.optional) {
            total++;
            const value = checklist[field.id]?.[subField.id];
            
            if (subField.type === 'checkbox') {
              if (value === true) completed++;
            } else if (subField.type === 'multi_input') {
              if (Array.isArray(value) && value.length > 0) completed++;
            } else if (subField.type === 'select') {
              if (value && value.toString().trim() !== '') completed++;
            } else {
              if (value && value.toString().trim() !== '') completed++;
            }
          }
        });
      }
    } else {
      // Handle regular fields
      if (!field.optional) {
        total++;
        const value = checklist[field.id];
        
        if (field.type === 'checkbox') {
          if (value === true) completed++;
        } else if (field.type === 'multi_input') {
          if (Array.isArray(value) && value.length > 0) completed++;
        } else if (field.type === 'select') {
          if (value && value.toString().trim() !== '') completed++;
        } else {
          if (value && value.toString().trim() !== '') completed++;
        }
      }
    }
  });
  
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

