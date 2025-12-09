'use client';

import React, { useState, useEffect } from 'react';
import { GeneratedEmail, generateMissingInfoEmail } from '@/lib/email/generateEmail';
import { Project, ChecklistConfig } from '@/types';

interface EmailModalProps {
  isOpen: boolean;
  project: Project | null;
  config: ChecklistConfig | null;
  userName?: string;
  onClose: () => void;
}

interface SectionOption {
  id: string;
  title: string;
  description: string;
  available: boolean;
}

export const EmailModal: React.FC<EmailModalProps> = ({
  isOpen,
  project,
  config,
  userName,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set());
  const [availableSections, setAvailableSections] = useState<SectionOption[]>([]);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyMode, setCopyMode] = useState<'text' | 'html'>('text');
  const [isGenerating, setIsGenerating] = useState(false);

  // Determine available sections when modal opens
  useEffect(() => {
    if (isOpen && project && config && step === 1) {
      const sections: SectionOption[] = [];
      
      // Check for migration/fresh requirements
      const releaseType = project.releaseType?.toLowerCase() || '';
      if (releaseType === 'migration') {
        sections.push({
          id: 'migration',
          title: 'Migration-Specific Requirements',
          description: 'Existing app store links, keystore details, and signing constraints',
          available: true,
        });
      } else if (releaseType === 'fresh') {
        const keystoreValue = project.checklists?.launch?.keystoreFiles;
        if (!keystoreValue) {
          sections.push({
            id: 'fresh-keystore',
            title: 'New App Store Assets',
            description: 'Play Store & App Store assets, Developer Account setup',
            available: true,
          });
        }
      }
      
      // Check developer accounts
      const androidDevAccount = project.checklists?.launch?.androidDeveloperAccount;
      const iosDevAccount = project.checklists?.launch?.iosDeveloperAccount;
      const dunsStatus = project.dunsStatus || project.checklists?.sales?.dunsStatus;
      if (androidDevAccount !== true || 
          iosDevAccount !== true || 
          (dunsStatus && dunsStatus.toLowerCase() !== 'completed' && dunsStatus.toLowerCase() !== 'not required')) {
        sections.push({
          id: 'developer-accounts',
          title: 'Developer Account Status',
          description: 'Android and iOS developer account information',
          available: true,
        });
      }
      
      // Check integrations
      const firebaseAccess = project.checklists?.launch?.firebaseAccess;
      const metaDeveloperAccess = project.checklists?.launch?.metaDeveloperAccess;
      const integrationsSelected = project.checklists?.launch?.integrations;
      const integrationsCredentials = project.checklists?.launch?.integrationsCredentials;
      if (firebaseAccess !== true || 
          metaDeveloperAccess !== true || 
          (Array.isArray(integrationsSelected) && integrationsSelected.length > 0) ||
          !Array.isArray(integrationsCredentials) || integrationsCredentials.length === 0) {
        sections.push({
          id: 'integrations',
          title: 'Integrations & Credentials',
          description: 'Firebase, Meta, and other integration access and credentials',
          available: true,
        });
      }
      
      // Check sales fields
      const collabCode = project.collabCode || project.checklists?.sales?.collabCode;
      const designRefs = project.designRefs || project.checklists?.sales?.designRefs;
      const additionalDocs = project.additionalDocs || project.checklists?.sales?.additionalDocs;
      const paymentConfirmation = project.checklists?.sales?.paymentConfirmation;
      const planDetails = project.planDetails || project.checklists?.sales?.planDetails;
      if (!collabCode || 
          !Array.isArray(designRefs) || designRefs.length === 0 ||
          !Array.isArray(additionalDocs) || additionalDocs.length === 0 ||
          (paymentConfirmation !== true && planDetails)) {
        sections.push({
          id: 'sales-fields',
          title: 'Missing Sales Information',
          description: 'Collab code, design references, additional docs, payment confirmation',
          available: true,
        });
      }
      
      // Check launch items
      const dataClarityProvided = project.checklists?.launch?.dataClarityProvided;
      const storeListingDetails = project.checklists?.launch?.storeListingDetails;
      if (dataClarityProvided !== true || !storeListingDetails) {
        sections.push({
          id: 'launch-items',
          title: 'Additional Launch Requirements',
          description: 'Data Clarity documentation and Store Listing Details',
          available: true,
        });
      }
      
      setAvailableSections(sections);
      // Start with no sections selected - user will choose
      setSelectedSections(new Set());
    }
  }, [isOpen, project, config, step]);

  // Generate email when moving to step 2
  const handleGenerateEmail = async () => {
    if (!project || !config || selectedSections.size === 0) return;
    
    setIsGenerating(true);
    try {
      const email = await generateMissingInfoEmail(project, config, userName, selectedSections);
      setGeneratedEmail(email);
      setTo(email.to);
      setSubject(email.subject);
      setBody(email.fullBody);
      setStep(2);
    } catch (error) {
      console.error('Failed to generate email:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setSelectedSections(new Set());
      setGeneratedEmail(null);
      setCopied(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (generatedEmail && step === 2) {
      setTo(generatedEmail.to);
      setSubject(generatedEmail.subject);
      setBody(generatedEmail.fullBody);
    }
  }, [generatedEmail, step]);

  const handleCopyToClipboard = async (mode: 'text' | 'html' = 'text') => {
    try {
      if (mode === 'html' && generatedEmail?.htmlBody) {
        // Copy HTML for Gmail - Gmail supports pasting HTML tables
        const htmlContent = generatedEmail.htmlBody;
        const plainText = body;
        
        // Try modern Clipboard API first
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
            const textBlob = new Blob([plainText], { type: 'text/plain' });
            const clipboardItem = new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob
            });
            await navigator.clipboard.write([clipboardItem]);
            setCopyMode('html');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            return;
          } catch (err) {
            console.log('ClipboardItem not supported, falling back');
          }
        }
        
        // Fallback: Create temporary element and copy
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        tempDiv.style.position = 'fixed';
        tempDiv.style.left = '-9999px';
        tempDiv.style.top = '0';
        document.body.appendChild(tempDiv);
        
        const range = document.createRange();
        range.selectNodeContents(tempDiv);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        
        const successful = document.execCommand('copy');
        selection?.removeAllRanges();
        document.body.removeChild(tempDiv);
        
        if (successful) {
          setCopyMode('html');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error('Copy failed');
        }
      } else {
        // Copy plain text
        const emailText = `To: ${to}\nSubject: ${subject}\n\n${body}`;
        await navigator.clipboard.writeText(emailText);
        setCopyMode('text');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback to plain text if HTML copy fails
      const emailText = `To: ${to}\nSubject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(emailText);
      setCopyMode('text');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenInEmailClient = () => {
    const subjectEncoded = encodeURIComponent(subject);
    const bodyEncoded = encodeURIComponent(body);
    const mailtoLink = `mailto:${to}?subject=${subjectEncoded}&body=${bodyEncoded}`;
    window.location.href = mailtoLink;
  };

  const bodyLength = body.length;
  const wordCount = body.trim().split(/\s+/).filter(word => word.length > 0).length;

  const toggleSection = (sectionId: string) => {
    const newSelected = new Set(selectedSections);
    if (newSelected.has(sectionId)) {
      newSelected.delete(sectionId);
    } else {
      newSelected.add(sectionId);
    }
    setSelectedSections(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedSections.size === availableSections.length) {
      // Deselect all
      setSelectedSections(new Set());
    } else {
      // Select all
      setSelectedSections(new Set(availableSections.map(s => s.id)));
    }
  };

  if (!isOpen || !project || !config) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card p-0 max-w-5xl w-full max-h-[95vh] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {step === 1 ? 'Select Information to Include' : 'Email Draft'}
                </h2>
                <p className="text-sm text-gray-600 mt-0.5">
                  {step === 1 
                    ? 'Choose which missing information sections to include in the email'
                    : 'Review and edit before sending'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-150"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  Select the sections you want to include in the email.
                </p>
                {availableSections.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150"
                  >
                    {selectedSections.size === availableSections.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {availableSections.map((section) => (
                  <label
                    key={section.id}
                    className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-150 ${
                      selectedSections.has(section.id)
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="relative flex items-center mt-0.5">
                      <input
                        type="checkbox"
                        checked={selectedSections.has(section.id)}
                        onChange={() => toggleSection(section.id)}
                        className="sr-only"
                      />
                      <div
                        className={`relative flex items-center justify-center w-6 h-6 rounded-lg border-2 cursor-pointer transition-all duration-150 ${
                          selectedSections.has(section.id)
                            ? 'bg-gray-900 border-gray-900 shadow-sm'
                            : 'bg-white border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        {selectedSections.has(section.id) && (
                          <svg
                            className="w-4 h-4 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{section.title}</div>
                      <div className="text-sm text-gray-600 mt-1">{section.description}</div>
                    </div>
                  </label>
                ))}
                {availableSections.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No missing information sections available.</p>
                    <p className="text-sm mt-2">All required information appears to be complete.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
          <div className="space-y-5">
            {/* To Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Recipient
              </label>
              <input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-150 placeholder:text-gray-400"
                placeholder="recipient@example.com"
              />
            </div>

            {/* Subject Field */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-150 placeholder:text-gray-400"
                placeholder="Email subject"
              />
            </div>

            {/* Body Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Message
                </label>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{wordCount} words</span>
                  <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                  <span>{bodyLength.toLocaleString()} characters</span>
                </div>
              </div>
              <div className="relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={18}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all duration-150 resize-y text-sm leading-relaxed"
                  placeholder="Email body"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-2 text-xs text-gray-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Editable</span>
                </div>
              </div>
            </div>
          </div>
          )}
        </div>

        {/* Footer - Action Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>This is a draft. No email will be sent automatically.</span>
            </div>
            <div className="flex gap-2">
              {step === 1 ? (
                <>
              <button
                onClick={onClose}
                    className="px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150"
              >
                Cancel
              </button>
              <button
                    onClick={handleGenerateEmail}
                    disabled={selectedSections.size === 0 || isGenerating}
                    className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        Generate Email
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setStep(1)}
                    className="px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150 inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>
                  <button
                    onClick={onClose}
                    className="px-3 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150"
                  >
                    Cancel
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopyToClipboard('text')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 inline-flex items-center gap-2 ${
                        copied && copyMode === 'text'
                    ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400'
                }`}
              >
                      {copied && copyMode === 'text' ? (
                  <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                          Copy Text
                  </>
                )}
              </button>
                    <button
                      onClick={() => handleCopyToClipboard('html')}
                      className={`px-3 py-2 text-sm font-medium rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-150 inline-flex items-center gap-2 ${
                        copied && copyMode === 'html'
                          ? 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500'
                          : 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-900'
                      }`}
                      title="Copy as HTML table for Gmail"
                    >
                      {copied && copyMode === 'html' ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Copied!
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy HTML
                        </>
                      )}
                    </button>
                  </div>
              <button
                onClick={handleOpenInEmailClient}
                    className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-all duration-150 inline-flex items-center gap-2"
              >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                    Open in Email
              </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

