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

  // ── Cross-check: proof documents vs. manually entered data ─────────────────

  const highSchoolOnly = ['high school', 'secondary', '10th', '12th', 'hsc', 'ssc', 'matric', 'nil', 'none'];

  const workEntries = (() => {
    try { return JSON.parse(state.formData.workHistory ?? '[]') as unknown[]; }
    catch { return []; }
  })();

  const eduEntries = (() => {
    try { return JSON.parse(state.formData.educationHistory ?? '[]') as Array<{ certificate?: string }>; }
    catch { return []; }
  })();

  const hasHigherEdu = eduEntries.some((e) => {
    const cert = (e.certificate ?? '').toLowerCase();
    return cert.length > 0 && !highSchoolOnly.some((k) => cert.includes(k));
  });

  type CrossWarn = { blocking: boolean; message: string };
  const crossWarnings: CrossWarn[] = [];

  // Spouse passport missing but spouse data filled
  const spouseNameFilled = !!(state.formData.spouseFirstName?.trim() || state.formData.spouseLastName?.trim());
  if (spouseNameFilled && state.documents['spousePassport' as const].pages.length === 0) {
    crossWarnings.push({
      blocking: true,
      message: "You've entered spouse details but haven't scanned/uploaded the spouse's passport. Please go back to Document Scanning and upload it.",
    });
  }

  // Child passports missing when child data filled
  for (let n = 1; n <= 4; n++) {
    const fn = `child${n}FirstName` as keyof typeof state.formData;
    const ln = `child${n}LastName`  as keyof typeof state.formData;
    const passportId = `child${n}Passport` as 'child1Passport' | 'child2Passport' | 'child3Passport' | 'child4Passport';
    const childFilled = !!(state.formData[fn]?.trim() || state.formData[ln]?.trim());
    const childPassportDone = state.documents[passportId].pages.length > 0;
    if (childFilled && !childPassportDone) {
      crossWarnings.push({
        blocking: true,
        message: `You've entered Child ${n} details but haven't scanned/uploaded Child ${n}'s passport. Please go back to Document Scanning and upload it.`,
      });
    }
  }

  // Work proof missing but employment history filled
  if (workEntries.length > 0 && state.documents['workExperienceCert'].pages.length === 0) {
    crossWarnings.push({
      blocking: false,
      message: "You've entered employment history but haven't uploaded any Work Experience Certificates. Uploading proof strengthens your application.",
    });
  }

  // Education proof missing but higher education claimed
  if (hasHigherEdu && state.documents['degreeCertificate'].pages.length === 0) {
    crossWarnings.push({
      blocking: false,
      message: "You've entered post-secondary education but haven't uploaded any Degree/Diploma Certificates. Uploading proof is strongly recommended.",
    });
  }

  const blockingWarnings  = crossWarnings.filter((w) => w.blocking);
  const advisoryWarnings  = crossWarnings.filter((w) => !w.blocking);

  const handleSubmit = async () => {
    setLocalError(null);

    if (missingFields.length > 0) {
      setSubmitAttempted(true);
      setLocalError(`Please complete highlighted fields in the form above before submitting. ${missingFields.length} field${missingFields.length !== 1 ? 's' : ''} missing.`);
      return;
    }

    if (blockingWarnings.length > 0) {
      setLocalError(blockingWarnings.map((w) => w.message).join(' '));
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

      {/* ── Cross-check warnings ── */}
      {blockingWarnings.length > 0 && (
        <div className="space-y-2 mb-4">
          {blockingWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <span className="flex-shrink-0 text-base leading-none">🛑</span>
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
      {advisoryWarnings.length > 0 && (
        <div className="space-y-2 mb-4">
          {advisoryWarnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span className="flex-shrink-0 text-base leading-none">⚠️</span>
              <span>{w.message}</span>
            </div>
          ))}
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
