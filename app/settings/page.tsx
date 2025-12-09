'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';
import { Toast } from '@/components/Toast';
import { Loading } from '@/components/Loading';
import { Skeleton } from '@/components/Skeleton';
import { getChecklistConfig, updateChecklistConfig, getIntegrations, updateIntegrations } from '@/lib/firebase/firestore';
import { ChecklistConfig, Integration } from '@/types';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  const [config, setConfig] = useState<ChecklistConfig | null>(null);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingIntegrations, setSavingIntegrations] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [integrationsError, setIntegrationsError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const [configData, integrationsData] = await Promise.all([
        getChecklistConfig(),
        getIntegrations(),
      ]);
      if (configData) {
        setConfig(configData);
      } else {
        // Default config if none exists
        setConfig({
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
            { id: 'releaseType', label: 'Fresh release or migration', type: 'text' },
            { id: 'dunsStatus', label: 'DUNS / Developer Account Status', type: 'text' },
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
      }
      setIntegrations(integrationsData);
    } catch (error) {
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setJsonError(null);
    setSaving(true);

    try {
      // Validate JSON structure
      const testConfig: ChecklistConfig = JSON.parse(JSON.stringify(config));
      
      if (!testConfig.version || !Array.isArray(testConfig.sales) || !Array.isArray(testConfig.launch)) {
        throw new Error('Invalid config structure');
      }

      await updateChecklistConfig(testConfig);
      setToastMessage('Settings saved successfully!');
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      setJsonError(error.message || 'Invalid JSON structure');
      setToastMessage(error.message || 'Failed to save configuration');
      setToastType('error');
      setShowToast(true);
      console.error('Error saving config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleJsonChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      setConfig(parsed);
      setJsonError(null);
    } catch (error) {
      setJsonError('Invalid JSON');
    }
  };

  const handleIntegrationsJsonChange = (value: string) => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        setIntegrations(parsed);
        setIntegrationsError(null);
      } else {
        setIntegrationsError('Integrations must be an array');
      }
    } catch (error) {
      setIntegrationsError('Invalid JSON');
    }
  };

  const handleSaveIntegrations = async () => {
    if (!integrations || integrations.length === 0) {
      setToastMessage('No integrations to save');
      setToastType('error');
      setShowToast(true);
      return;
    }

    setIntegrationsError(null);
    setSavingIntegrations(true);

    try {
      console.log('Saving integrations:', integrations.length, 'items');
      await updateIntegrations(integrations);
      console.log('Integrations saved successfully');
      setToastMessage(`Successfully saved ${integrations.length} integrations!`);
      setToastType('success');
      setShowToast(true);
    } catch (error: any) {
      console.error('Error saving integrations:', error);
      const errorMessage = error.message || 'Failed to save integrations';
      setIntegrationsError(errorMessage);
      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
    } finally {
      setSavingIntegrations(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard requireAdmin>
        <div className="min-h-screen bg-gray-50 flex">
          <Sidebar />
          <div className="flex-1 ml-64 p-8">
            <div className="mb-8">
              <Skeleton variant="rectangular" width="200px" height="48px" className="mb-2" />
              <Skeleton variant="rectangular" width="300px" height="20px" />
            </div>
            <div className="card p-6 mb-6">
              <Skeleton variant="rectangular" width="300px" height="20px" className="mb-4" />
              <Skeleton variant="rectangular" width="100%" height="16px" className="mb-2" />
            </div>
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <Skeleton variant="rectangular" width="250px" height="24px" />
                <Skeleton variant="rectangular" width="100px" height="28px" className="rounded-lg" />
              </div>
              <Skeleton variant="rectangular" width="100%" height="600px" className="mb-6 rounded-xl" />
              <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                <Skeleton variant="rectangular" width="150px" height="16px" />
                <div className="flex gap-3">
                  <Skeleton variant="rectangular" width="80px" height="40px" className="rounded-lg" />
                  <Skeleton variant="rectangular" width="160px" height="40px" className="rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard requireAdmin>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 ml-64 overflow-y-auto h-screen">
          {/* Sticky Header */}
          <div className="sticky top-0 z-20 bg-gray-50">
            <div className="px-8 pt-8 pb-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900 mb-2">Settings</h1>
                  <p className="text-gray-600 mt-1">Manage checklist configuration</p>
                </div>
              </div>
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="px-8 pb-8 pt-6">

          {/* Info Card */}
          <div className="card p-6 mb-6 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-sm font-bold text-blue-900 mb-1">Configuration Guidelines</h3>
                <p className="text-sm text-blue-700">
                  Edit the JSON configuration below to customize checklist fields. Ensure the structure includes <code className="bg-blue-100 px-1 rounded">version</code>, <code className="bg-blue-100 px-1 rounded">sales</code>, and <code className="bg-blue-100 px-1 rounded">launch</code> arrays.
                </p>
              </div>
            </div>
          </div>

          {/* JSON Editor */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Checklist Configuration</h2>
                <p className="text-sm text-gray-600">Edit the JSON structure to modify checklist fields</p>
              </div>
              {config && (
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Version {config.version}
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="relative">
                <textarea
                  value={JSON.stringify(config, null, 2)}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  rows={35}
                  className={`w-full px-4 py-3 border-2 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 transition-all ${
                    jsonError 
                      ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 bg-gray-50 focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  spellCheck={false}
                />
                {!jsonError && (
                  <div className="absolute top-3 right-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                )}
              </div>
              {jsonError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">Invalid JSON</p>
                    <p className="text-sm text-red-700">{jsonError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                {config && (
                  <span>
                    {config.sales.length} sales fields • {config.launch.length} launch fields
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setConfig(config);
                    setJsonError(null);
                  }}
                  className="btn-secondary"
                  disabled={!jsonError}
                >
                  Reset
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !!jsonError}
                  className="btn-primary min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Configuration
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Integrations JSON Editor */}
          <div className="card p-6 mt-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Integrations Configuration</h2>
                <p className="text-sm text-gray-600">Manage the list of available integrations for the launch checklist</p>
              </div>
              {integrations && (
                <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  {integrations.length} integrations
                </div>
              )}
            </div>

            <div className="mb-6">
              <div className="relative">
                <textarea
                  value={JSON.stringify(integrations, null, 2)}
                  onChange={(e) => handleIntegrationsJsonChange(e.target.value)}
                  rows={30}
                  className={`w-full px-4 py-3 border-2 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 transition-all ${
                    integrationsError 
                      ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-200 bg-gray-50 focus:ring-gray-900 focus:border-gray-900'
                  }`}
                  spellCheck={false}
                />
                {!integrationsError && (
                  <div className="absolute top-3 right-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                )}
              </div>
              {integrationsError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-red-900 mb-1">Invalid JSON</p>
                    <p className="text-sm text-red-700">{integrationsError}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-100">
              <div className="text-sm text-gray-500">
                {integrations && (
                  <span>
                    {integrations.length} integration{integrations.length !== 1 ? 's' : ''} configured
                  </span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    loadConfig();
                    setIntegrationsError(null);
                  }}
                  className="btn-secondary"
                  disabled={!integrationsError}
                >
                  Reset
                </button>
                <button
                  onClick={handleSaveIntegrations}
                  disabled={savingIntegrations || !!integrationsError}
                  className="btn-primary min-w-[160px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingIntegrations ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Save Integrations
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
        {showToast && (
          <Toast
            message={toastMessage}
            type={toastType}
            onClose={() => setShowToast(false)}
          />
        )}
      </div>
    </AuthGuard>
  );
}

