// User and Authentication Types
export interface User {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: 'admin' | 'team_member';
}

// Field Configuration Types
export type FieldType = 'checkbox' | 'text' | 'textarea' | 'multi_input' | 'url' | 'group' | 'select' | 'multi_select';

export interface FieldConfig {
  id: string; // slug
  label: string;
  type: FieldType;
  optional?: boolean; // If true, field is optional. If not set or false, field is required/mandatory
  required?: boolean; // Explicitly mark field as mandatory/required. Takes precedence over optional
  fields?: FieldConfig[]; // For group type
  options?: string[]; // For select/dropdown type
  optionsSource?: 'integrations' | 'static'; // For multi_select - where to get options from
  requirementsFieldId?: string; // Field ID to auto-populate with requirements when integration is selected
  hasStatus?: boolean; // For multi_input fields - whether to show status dropdown
  hasVersion?: boolean; // For multi_input fields - whether to show version dropdown
  placeholder?: string; // Placeholder text for input fields
  subtext?: string; // Helper text/subtext to explain what the field means
}

// Integration types
export interface Integration {
  id: string;
  name: string;
  category: string;
  scope: string;
  limitations: string;
  requirements: string[];
  documentationLink: string;
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
export type ProjectStatus = 'Not Started' | 'In Progress' | 'On HOLD' | 'Completed';
export type PublishingStatus = 'Pending' | 'Subscribed' | 'Under Review' | 'Live';

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
  status?: ProjectStatus; // Development status
  publishingStatus?: PublishingStatus; // Publishing status
  version?: number; // Current version number (default: 1)
  versionHistory?: number[]; // Array of all versions that have been created (e.g., [1, 2, 3])
  handoverDate?: string | null; // Handover date (ISO string)
  completionDate?: string | null; // Date of completion (ISO string), auto-set when publishingStatus is Live
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

