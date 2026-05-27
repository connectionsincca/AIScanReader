import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { DOCUMENTS } from '../config/documents';
import { dataUrlToBase64 } from '../utils/imageAnalysis';
import { submitPackage } from '../utils/api';

export default function ReviewSection() {
  const { state, setStep, setSubmitting, setSubmitError, travelers } = useApp();
  const [localError, setLocalError] = useState<string | null>(null);

  // Documents that have at least one page scanned
  const scannedDocs = DOCUMENTS.filter((d) => state.documents[d.id].pages.length > 0);
  const totalPages = scannedDocs.reduce((sum, d) => sum + state.documents[d.id].pages.length, 0);

  // Key applicant summary fields
  const name = [state.formData.firstName, state.formData.lastName].filter(Boolean).join(' ') || '—';
  const passport = state.formData.passportNumber || '—';
  const dob = state.formData.dateOfBirth || '—';
  const email = state.formData.email || '—';

  const handleConfirmSend = async () => {
    setLocalError(null);

    const docsWithPages = scannedDocs.map((d) => ({
      id: d.id,
      name: d.name,
      pages: state.documents[d.id].pages.map((p) => dataUrlToBase64(p.dataUrl)),
    }));

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await submitPackage({
        submissionId: state.submissionId,
        formData: state.formData,
        documents: docsWithPages,
      });

      if (result.success) {
        setStep('submitted');
      } else {
        setLocalError(result.message || 'Submission failed. Please try again.');
      }
    } catch (err) {
      const status = (err as { response?: { status: number } }).response?.status;
      const msg    = (err as Error).message ?? '';
      if (status === 401) {
        setLocalError('Your session has expired. Please refresh the page and start again from Step 1.');
      } else if (msg.includes('Network') || msg.includes('timeout')) {
        setLocalError('Connection error. Please check your internet connection and try again.');
      } else {
        setLocalError('Submission failed. Please try again in a few moments.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="card p-5 sm:p-6 fade-in space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Review Your Submission</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Confirm everything looks correct, then click <strong>Confirm &amp; Send</strong> to email your package to the agency.
          </p>
        </div>
      </div>

      {/* ── Applicant Summary ──────────────────────────────────────────────── */}
      <div className="bg-gray-50 rounded-xl p-4">
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">Applicant Summary</p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Full Name</dt>
            <dd className="font-medium text-gray-900 truncate">{name}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Passport No.</dt>
            <dd className="font-medium text-gray-900">{passport}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Date of Birth</dt>
            <dd className="font-medium text-gray-900">{dob}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900 truncate">{email}</dd>
          </div>
          {travelers.hasSpouse && (
            <div>
              <dt className="text-xs text-gray-500">Spouse</dt>
              <dd className="font-medium text-gray-900">
                {[state.formData.spouseFirstName, state.formData.spouseLastName].filter(Boolean).join(' ') || '—'}
              </dd>
            </div>
          )}
          {travelers.childCount > 0 && (
            <div>
              <dt className="text-xs text-gray-500">Children</dt>
              <dd className="font-medium text-gray-900">{travelers.childCount}</dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-gray-500">Submission ID</dt>
            <dd className="font-mono text-gray-700">{state.submissionId.slice(0, 8).toUpperCase()}</dd>
          </div>
        </dl>
      </div>

      {/* ── Documents to be sent ──────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
          Documents to be sent — {scannedDocs.length} document{scannedDocs.length !== 1 ? 's' : ''}, {totalPages} page{totalPages !== 1 ? 's' : ''}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {scannedDocs.map((doc) => {
            const docState = state.documents[doc.id];
            const firstPage = docState.pages[0];
            return (
              <div key={doc.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-100">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-gray-200 bg-white">
                  {firstPage ? (
                    <img
                      src={firstPage.dataUrl}
                      alt={doc.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-100">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{doc.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {docState.pages.length} page{docState.pages.length !== 1 ? 's' : ''}
                  </p>
                  {docState.pages.length > 1 && (
                    <div className="flex gap-1 mt-1.5 overflow-x-auto">
                      {docState.pages.slice(1, 5).map((pg) => (
                        <img
                          key={pg.id}
                          src={pg.dataUrl}
                          alt=""
                          className="w-6 h-8 rounded object-cover border border-gray-200 flex-shrink-0"
                        />
                      ))}
                      {docState.pages.length > 5 && (
                        <div className="w-6 h-8 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-[9px] text-gray-500 flex-shrink-0">
                          +{docState.pages.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── What happens next ─────────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1.5">What happens when you confirm:</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-700">
          <li>All scanned pages are combined into a single PDF</li>
          <li>Your completed 7-page intake form is generated as a PDF</li>
          <li>Both PDFs are securely emailed to the immigration agency</li>
          <li>All temporary files are deleted immediately after sending</li>
        </ul>
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {localError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {localError}
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-1">
        <button
          onClick={handleConfirmSend}
          disabled={state.submitting}
          className="btn-primary text-base py-3.5 flex-1 sm:flex-none sm:px-10"
        >
          {state.submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Confirm &amp; Send to Agency
            </>
          )}
        </button>

        {state.submitting && (
          <p className="text-sm text-gray-500 self-center">
            Generating PDFs and sending email… this may take 20–30 seconds.
          </p>
        )}
      </div>

    </section>
  );
}
