import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOCUMENT_MAP } from '../config/documents';
import DocumentRow from './DocumentRow';
import TravelerPanel from './TravelerPanel';
import type { DocumentId } from '../types';
import { formatFileSize } from '../utils/imageAnalysis';
import { MAX_TOTAL_BYTES } from '../config/limits';

// ─── Section helpers ───────────────────────────────────────────────────────────

interface SectionGroup {
  label: string;
  bgClass: string;
  docIds: DocumentId[];
}

// ─── Traveler section definition ──────────────────────────────────────────────

interface TravelerSection {
  avatar: string;
  label: string;
  avatarBg: string;
  groups: SectionGroup[];
}

const APPLICANT_SECTION: TravelerSection = {
  avatar: 'A',
  label: 'Applicant',
  avatarBg: 'bg-amber-600',
  groups: [
    {
      label: 'DATA EXTRACTION DOCUMENTS',
      bgClass: 'bg-blue-50/40',
      docIds: ['passport', 'marriageCertificate', 'addressProof', 'workExperienceCert', 'degreeCertificate', 'ieltsScoreSheet', 'celpipScoreSheet'],
    },
    {
      label: 'PROOF OF FUNDS',
      bgClass: 'bg-green-50/40',
      docIds: ['bankStatement', 'salarySlips', 'taxReturn', 'netWorthStatement', 'propertyOwnership'],
    },
    {
      label: 'UPLOAD ONLY',
      bgClass: 'bg-gray-50/60',
      docIds: ['birthCertificate', 'eventInvitationLetter', 'travelTickets', 'digitalPicture'],
    },
  ],
};

const SPOUSE_SECTION: TravelerSection = {
  avatar: 'S',
  label: 'Spouse / Partner',
  avatarBg: 'bg-amber-500',
  groups: [
    {
      label: 'DATA EXTRACTION DOCUMENTS',
      bgClass: 'bg-blue-50/40',
      docIds: ['spousePassport', 'spouseWorkExperienceCert', 'spouseDegreeCertificate'],
    },
    {
      label: 'UPLOAD ONLY',
      bgClass: 'bg-gray-50/60',
      docIds: ['spouseEventInvitationLetter', 'spouseTravelTickets', 'spouseDigitalPicture'],
    },
  ],
};

function makeChildSection(n: 1 | 2 | 3 | 4): TravelerSection {
  return {
    avatar: `C${n}`,
    label: `Child ${n}`,
    avatarBg: 'bg-amber-400',
    groups: [
      {
        label: 'DATA EXTRACTION DOCUMENTS',
        bgClass: 'bg-blue-50/40',
        docIds: [`child${n}Passport`] as DocumentId[],
      },
      {
        label: 'UPLOAD ONLY',
        bgClass: 'bg-gray-50/60',
        docIds: [`child${n}TravelTickets`, `child${n}DigitalPicture`] as DocumentId[],
      },
    ],
  };
}

// ─── TravelerCard ──────────────────────────────────────────────────────────────

function TravelerCard({
  section,
  disabled,
  defaultOpen = false,
  requiredOverrides = {},
}: {
  section: TravelerSection;
  disabled: boolean;
  defaultOpen?: boolean;
  requiredOverrides?: Partial<Record<DocumentId, boolean>>;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden mb-4 shadow-sm">
      {/* Accordion header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className={`w-9 h-9 rounded-full ${section.avatarBg} text-white flex items-center justify-center font-bold text-sm flex-shrink-0`}>
          {section.avatar}
        </div>
        <span className="font-semibold text-gray-900 text-sm flex-1 text-left">{section.label}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {section.groups.map((group) => (
            <div key={group.label} className={`${group.bgClass} px-4 py-3`}>
              <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.docIds.map((id) => {
                  const doc = DOCUMENT_MAP[id];
                  if (!doc) return null;
                  return (
                    <DocumentRow
                      key={id}
                      doc={doc}
                      disabled={disabled}
                      dynamicRequired={requiredOverrides[id]}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main DocumentScanner ──────────────────────────────────────────────────────

export default function DocumentScanner() {
  const { state, consentComplete, setStep, travelers } = useApp();

  const isLocked = !consentComplete;

  // Count all processed docs
  const processedCount = Object.values(state.documents).filter((d) => d.status === 'done').length;

  // Dynamic required overrides based on form data already filled in
  const highSchoolOnly = ['high school', 'secondary', '10th', '12th', 'hsc', 'ssc', 'matric', 'nil', 'none'];
  const hasWorkEntries = (() => {
    try { return (JSON.parse(state.formData.workHistory ?? '[]') as unknown[]).length > 0; }
    catch { return false; }
  })();
  const hasHigherEdu = (() => {
    try {
      return (JSON.parse(state.formData.educationHistory ?? '[]') as Array<{ certificate?: string }>)
        .some((e) => {
          const cert = (e.certificate ?? '').toLowerCase();
          return cert.length > 0 && !highSchoolOnly.some((k) => cert.includes(k));
        });
    } catch { return false; }
  })();

  // Overrides passed to Applicant's TravelerCard
  const applicantOverrides: Partial<Record<DocumentId, boolean>> = {
    workExperienceCert: hasWorkEntries,   // required only if employment history filled
    degreeCertificate:  hasHigherEdu,     // required only if higher education claimed
  };

  // Total bytes across all document pages
  const totalBytes = Object.values(state.documents)
    .flatMap((d) => d.pages)
    .reduce((sum, p) => sum + (p.sizeBytes ?? 0), 0);
  const totalPct    = Math.min(100, (totalBytes / MAX_TOTAL_BYTES) * 100);
  const totalNear   = totalPct >= 80 && totalPct < 100;
  const totalFull   = totalPct >= 100;

  // Determine whether "Continue to Form" should be enabled
  const passportDone = state.documents['passport'].status === 'done';
  const spouseDone = !travelers.hasSpouse || state.documents['spousePassport'].status === 'done';
  const childrenDone = Array.from({ length: travelers.childCount }, (_, i) => i + 1).every(
    (n) => state.documents[`child${n}Passport` as DocumentId]?.status === 'done'
  );
  const canContinue = passportDone && spouseDone && childrenDone;

  // Build child sections
  const childSections = Array.from({ length: travelers.childCount }, (_, i) =>
    makeChildSection((i + 1) as 1 | 2 | 3 | 4)
  );

  return (
    <section className="card p-5 sm:p-6 fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          </svg>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-gray-900">Document Scanning</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Declare your travelers, then scan each document. AI will extract your information automatically.
          </p>
        </div>
        {processedCount > 0 && (
          <div className="text-sm font-medium text-brand-600 bg-brand-50 px-3 py-1 rounded-full flex-shrink-0">
            {processedCount} processed
          </div>
        )}
      </div>

      {/* Locked overlay notice */}
      {isLocked && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 text-sm text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Please complete the consent section above to enable document scanning.
        </div>
      )}

      {/* How it works */}
      {!isLocked && (
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">How it works</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Declare all travelers joining this application below</li>
            <li>For each document, click <strong>Scan</strong> (camera) or <strong>Upload</strong> (file)</li>
            <li>Scan: place document in frame, capture, then tap Done</li>
            <li>Upload: select image/PDF (max 1 MB per file, 22 MB total)</li>
            <li>AI will automatically fill in your information</li>
          </ol>
        </div>
      )}

      {/* Traveler Panel */}
      <TravelerPanel />

      {/* ── Total size tracker ─────────────────────────────────────────────────── */}
      {totalBytes > 0 && (
        <div className={`rounded-xl px-4 py-3 mb-4 ${
          totalFull  ? 'bg-red-50 border border-red-200'   :
          totalNear  ? 'bg-amber-50 border border-amber-200' :
                       'bg-gray-50 border border-gray-100'
        }`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-medium ${
              totalFull ? 'text-red-700' : totalNear ? 'text-amber-700' : 'text-gray-600'
            }`}>
              {totalFull  ? '🚫 Document limit reached'    :
               totalNear  ? '⚠ Approaching size limit'     :
               '📦 Total document size'}
            </span>
            <span className={`text-xs tabular-nums ${
              totalFull ? 'text-red-600 font-semibold' : totalNear ? 'text-amber-600 font-semibold' : 'text-gray-500'
            }`}>
              {formatFileSize(totalBytes)} / 22 MB
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                totalFull ? 'bg-red-500' : totalNear ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${totalPct}%` }}
            />
          </div>
          {totalFull && (
            <p className="text-xs text-red-600 mt-1.5">
              No more files can be added. Remove existing documents to free up space.
            </p>
          )}
        </div>
      )}

      {/* Document Upload Per Traveler */}
      <div className="mb-3">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
          Document Upload — Per Traveler
        </p>

        {/* Applicant */}
        <TravelerCard section={APPLICANT_SECTION} disabled={isLocked} defaultOpen={true} requiredOverrides={applicantOverrides} />

        {/* Spouse */}
        {travelers.hasSpouse && (
          <TravelerCard section={SPOUSE_SECTION} disabled={isLocked} defaultOpen={true} />
        )}

        {/* Children */}
        {childSections.map((section) => (
          <TravelerCard key={section.avatar} section={section} disabled={isLocked} defaultOpen={true} />
        ))}
      </div>

      {/* Continue to form */}
      {state.step === 'scanning' && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          {canContinue ? (
            <p className="text-sm text-gray-600">
              All required passports scanned. Continue to review and complete your form.
            </p>
          ) : (
            <p className="text-sm text-amber-700">
              Scan the applicant passport{travelers.hasSpouse ? ', spouse passport' : ''}
              {travelers.childCount > 0 ? ', and all child passports' : ''} to continue.
            </p>
          )}
          <button
            onClick={() => setStep('form')}
            disabled={!canContinue}
            className={canContinue ? 'btn-primary' : 'btn-secondary opacity-50 cursor-not-allowed'}
          >
            Continue to Form
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
