import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOCUMENTS } from '../config/documents';
import type { FormData, TravelerState } from '../types';

// ── Required field list (mirrors IntakeForm BASE_REQUIRED) ───────────────────

const BASE_REQUIRED: Array<keyof FormData> = [
  'firstName', 'lastName',
  'passportNumber', 'passportIssuingCountry', 'passportIssueDate', 'passportExpiry',
  'dateOfBirth', 'cityOfBirth', 'countryOfBirth', 'citizenship',
  'currentAddress', 'countryOfResidence',
  'phone', 'email',
  'eyeColor', 'height',
  'maritalStatus',
  'nativeLanguage', 'currentOccupation', 'numberOfChildren',
  'highestEducationCanadian', 'totalYearsEducation',
  'deportedFlag', 'irccAppliedBefore', 'pnpAppliedBefore', 'hasRelativeInCanada',
];

// ── JSON-safe parser ─────────────────────────────────────────────────────────

function parseJsonSafe<T>(json: string | undefined, def: T): T {
  try { return json ? JSON.parse(json) as T : def; }
  catch { return def; }
}

// ── Extra structural validations (tables + parents) ──────────────────────────

function getExtraErrors(formData: Partial<FormData>, travelers: TravelerState): string[] {
  const errs: string[] = [];

  // At least one education entry
  const edu = parseJsonSafe<unknown[]>(formData.educationHistory, []);
  if (edu.length === 0) {
    errs.push('Please add at least one Education record on Page 1 of the form.');
  }

  // At least one work entry
  const work = parseJsonSafe<unknown[]>(formData.workHistory, []);
  if (work.length === 0) {
    errs.push('Please add at least one Employment record on Page 3 of the form.');
  }

  // At least one address row with content
  const addr = parseJsonSafe<Array<{ address?: string }>>(formData.addressHistory, []);
  const hasAddr = addr.some((r) => r.address?.trim());
  if (!hasAddr) {
    errs.push('Please fill at least one row in the Address History table on Page 4 of the form.');
  }

  // Applicant father family name
  const father = parseJsonSafe<{ familyName?: string }>(formData.fatherInfo, {});
  if (!father.familyName?.trim()) {
    errs.push("Please enter your Father's Family Name in the Parents table on Page 7 of the form.");
  }

  // Applicant mother family name
  const mother = parseJsonSafe<{ familyName?: string }>(formData.motherInfo, {});
  if (!mother.familyName?.trim()) {
    errs.push("Please enter your Mother's Family Name in the Parents table on Page 7 of the form.");
  }

  // Spouse parents (if spouse declared)
  if (travelers.hasSpouse) {
    const spFather = parseJsonSafe<{ familyName?: string }>(formData.spouseFatherInfo, {});
    if (!spFather.familyName?.trim()) {
      errs.push("Please enter your Spouse's Father's Family Name in the Parents table on Page 7.");
    }
    const spMother = parseJsonSafe<{ familyName?: string }>(formData.spouseMotherInfo, {});
    if (!spMother.familyName?.trim()) {
      errs.push("Please enter your Spouse's Mother's Family Name in the Parents table on Page 7.");
    }
  }

  return errs;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SubmitSection() {
  const { state, setStep, setSubmitAttempted, travelers } = useApp();
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

  // ── Cross-check: proof documents vs. manually entered data ──────────────────

  const highSchoolOnly = ['high school', 'secondary', '10th', '12th', 'hsc', 'ssc', 'matric', 'nil', 'none'];

  const workEntries = parseJsonSafe<unknown[]>(state.formData.workHistory, []);

  const eduEntries = parseJsonSafe<Array<{ certificate?: string }>>(state.formData.educationHistory, []);

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

  // ── Validate and advance to review step ─────────────────────────────────────

  const handleContinue = () => {
    setLocalError(null);

    if (missingFields.length > 0) {
      setSubmitAttempted(true);
      setLocalError('Please complete the highlighted fields in the form above before continuing.');
      return;
    }

    // Table + parent validations
    const extraErrs = getExtraErrors(state.formData, travelers);
    if (extraErrs.length > 0) {
      setLocalError(extraErrs[0]);
      return;
    }

    if (blockingWarnings.length > 0) {
      setLocalError(blockingWarnings.map((w) => w.message).join(' '));
      return;
    }

    const scannedDocs = DOCUMENTS.filter((d) => state.documents[d.id].pages.length > 0);
    if (scannedDocs.length === 0) {
      setLocalError('Please scan at least one document before continuing.');
      return;
    }

    // All good — advance to review
    setStep('complete');
  };

  const scannedCount = DOCUMENTS.filter((d) => state.documents[d.id].pages.length > 0).length;

  return (
    <section className="card p-5 sm:p-6 fade-in">
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Ready to Submit?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Complete all required fields, then review your package before sending.
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
          {missingFields.length === 0 ? (
            <p className="text-sm font-medium text-green-600">Ready to review</p>
          ) : (
            <p className="text-sm font-medium text-red-600">
              {missingFields.length} field{missingFields.length !== 1 ? 's' : ''} missing
            </p>
          )}
        </div>
      </div>

      {/* Errors */}
      {localError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {localError}
        </div>
      )}

      {/* Cross-check warnings */}
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

      <button
        onClick={handleContinue}
        className="btn-primary text-base py-3.5 w-full sm:w-auto sm:px-10"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        Review &amp; Confirm Submission
      </button>
    </section>
  );
}
