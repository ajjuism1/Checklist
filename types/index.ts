// User and Authentication Types
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'team_member';
}

// Field Configuration Types
export type FieldType = 'checkbox' | 'text' | 'textarea' | 'multi_input' | 'url' | 'group' | 'select';

export interface FieldConfig {
  id: string; // slug
  label: string;
  type: FieldType;
  optional?: boolean;
  fields?: FieldConfig[]; // For group type
  options?: string[]; // For select/dropdown type
}

export interface ChecklistConfig {
  version: string;
  launch: FieldConfig[];
  sales: FieldConfig[];
}

// Project Types
export interface POC {
  name: string;
  email: string;
  phone: string;
}

export type ReleaseType = 'fresh' | 'migration';
export type ProjectStatus = 'Not Started' | 'In Progress' | 'On HOLD' | 'Completed' | 'Live';

export interface Project {
  id: string;
  brandName: string;
  storeUrlMyShopify: string;
  storePublicUrl: string;
  collabCode: string;
  scopeOfWork: string;
  designRefs: string[];
  additionalDocs: string[]; // URLs to docs
  paymentConfirmation: boolean;
  planDetails: string;
  revenueShare: number;
  gmvInfo: string;
  releaseType: ReleaseType;
  dunsStatus: string;
  poc: POC;
  status?: ProjectStatus; // Project status
  checklists: {
    sales: Record<string, any>; // Dynamic based on FieldConfig
    launch: Record<string, any>; // Dynamic based on FieldConfig
  };
  progress: {
    salesCompletion: number;
    launchCompletion: number;
    overall: number;
  };
  createdAt: any; // Firestore Timestamp
  updatedAt: any; // Firestore Timestamp
}

// Form Data Types
export interface SalesChecklistData {
  brandName: string;
  storeUrlMyShopify: string;
  storePublicUrl: string;
  collabCode: string;
  scopeOfWork: string;
  designRefs: string[];
  additionalDocs: string[];
  paymentConfirmation: boolean;
  planDetails: string;
  revenueShare: number;
  gmvInfo: string;
  releaseType: ReleaseType;
  dunsStatus: string;
  poc: POC;
}

export interface LaunchChecklistData {
  androidDeveloperAccount: boolean;
  iosDeveloperAccount: boolean;
  firebaseAccess: boolean;
  metaDeveloperAccess: boolean;
  dataClarityProvided: boolean;
  integrationsCredentials: string[];
  storeListingDetails: string;
  keystoreFiles: string;
  otpTestCredentials?: string;
  customFeatures: string[];
  changeRequests: string[];
  bugReports: string;
  testCases: string;
}

