import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOCUMENTS } from '../config/documents';
import { dataUrlToBase64 } from '../utils/imageAnalysis';
import { submitPackage } from '../utils/api';
import type { FormData } from '../types';

const BASE_REQUIRED: Array<keyof FormData> = [
  'firstName', 'lastName',
  'passportNumber', 'passportIssuingCountry', 'passportIssueDate', 'passportExpiry',
  'dateOfBirth', 'cityOfBirth', 'countryOfBirth', 'citizenship',
  'currentAddress', 'countryOfResidence',
  'phone', 'email', 'maritalStatus',
];

export default function SubmitSection() {
  const { state, setSubmitting, setStep, setSubmitError, travelers, setSubmitAttempted } = useApp();
  const [localError, setLocalError] = useState<string | null>(null);

  const requiredKeys = useMemo<Set<keyof FormData>>(() => {
    const s = new Set<keyof FormData>(BASE_REQUIRED);
    if (travelers.hasSpouse) {
      (['spouseLastName', 'spouseFirstName', 'spouseDateOfBirth', 'spousePassportNumber'] as Array<keyof FormData>).forEach((k) => s.add(k));
    }
    for (let i = 1; i <= travelers.childCount; i++) {
      ([`child${i}LastName`, `child${i}FirstName`, `child${i}DateOfBirth`, `child${i}PassportNumber`] as Array<keyof FormData>).forEach((k) => s.add(k));
    }
    return s;
  }, [travelers]);

  const missingFields = [...requiredKeys].filter((id) => !state.formData[id]?.trim());

  const handleSubmit = async () => {
    setLocalError(null);

    if (missingFields.length > 0) {
      setSubmitAttempted(true);
      setLocalError(`Please complete highlighted fields in the form above before submitting. ${missingFields.length} field${missingFields.length !== 1 ? 's' : ''} missing.`);
      return;
    }

    const docsWithPages = DOCUMENTS
      .filter((d) => state.documents[d.id].pages.length > 0)
      .map((d) => ({
        id: d.id,
        name: d.name,
        pages: state.documents[d.id].pages.map((p) => dataUrlToBase64(p.dataUrl)),
      }));

    if (docsWithPages.length === 0) {
      setLocalError('Please scan at least one document before submitting.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitPackage({
        submissionId: state.submissionId,
        formData: state.formData,
        documents: docsWithPages,
      });

      if (result.success) {
        setStep('complete');
      } else {
        setLocalError(result.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      const msg = (err as Error).message ?? '';
      if (msg.includes('Network') || msg.includes('timeout')) {
        setLocalError('Connection error. Please check your internet connection and try again.');
      } else {
        setLocalError('Submission failed. Please try again in a few moments.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const scannedCount = DOCUMENTS.filter((d) => state.documents[d.id].pages.length > 0).length;

  return (
    <section className="card p-5 sm:p-6 fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Submit Your Package</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Your documents will be converted to PDF and securely emailed to the immigration agency.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-xs text-gray-500">Documents scanned</p>
          <p className="text-lg font-bold text-gray-900">{scannedCount}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">AI-filled fields</p>
          <p className="text-lg font-bold text-green-600">
            {Object.values(state.fieldMeta).filter((m) => m?.aiPopulated).length}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Submission ID</p>
          <p className="text-sm font-mono text-gray-700">{state.submissionId.slice(0, 8).toUpperCase()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-sm font-medium text-brand-600">
            {missingFields.length === 0 ? 'Ready to submit' : `${missingFields.length} field${missingFields.length !== 1 ? 's' : ''} missing`}
          </p>
        </div>
      </div>

      {/* Errors */}
      {(localError || state.submitError) && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {localError ?? state.submitError}
        </div>
      )}

      {/* What happens next */}
      <div className="text-sm text-gray-600 mb-5 space-y-1.5">
        <p className="font-medium text-gray-700">What happens when you submit:</p>
        <ul className="list-disc list-inside space-y-1 text-gray-500">
          <li>Your scanned pages will be combined into a single PDF</li>
          <li>Your completed form will be converted to a PDF</li>
          <li>Both PDFs will be securely emailed to the immigration agency</li>
          <li>All temporary files will be deleted immediately after sending</li>
        </ul>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleSubmit}
          disabled={state.submitting}
          className="btn-primary text-base py-3.5 flex-1 sm:flex-none sm:px-8"
        >
          {state.submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Submit to Immigration Agency
            </>
          )}
        </button>

        {state.submitting && (
          <p className="text-sm text-gray-500 self-center">
            This may take 20–30 seconds while we generate your PDFs…
          </p>
        )}
      </div>
    </section>
  );
}
