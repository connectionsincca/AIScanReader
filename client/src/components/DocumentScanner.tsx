import { useApp } from '../context/AppContext';
import { DOCUMENTS } from '../config/documents';
import DocumentRow from './DocumentRow';

export default function DocumentScanner() {
  const { state, consentComplete, setStep } = useApp();

  const isLocked = !consentComplete;

  // Count how many documents have been scanned (at least one page + processed)
  const processedCount  = DOCUMENTS.filter((d) => state.documents[d.id].status === 'done').length;
  const hasRequiredDone = DOCUMENTS
    .filter((d) => d.required)
    .every((d) => state.documents[d.id].status === 'done');

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
            Scan each document using your device camera. AI will extract your information automatically.
          </p>
        </div>
        {processedCount > 0 && (
          <div className="text-sm font-medium text-brand-600 bg-brand-50 px-3 py-1 rounded-full flex-shrink-0">
            {processedCount}/{DOCUMENTS.length} done
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

      {/* Instructions */}
      {!isLocked && (
        <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">How it works</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>Click <strong>Scan</strong> to open your camera</li>
            <li>Place the document inside the frame and hold steady</li>
            <li>Capture — add more pages if needed, then click Done</li>
            <li>AI will automatically fill in your information</li>
          </ol>
        </div>
      )}

      {/* Document list */}
      <div className="space-y-3">
        {DOCUMENTS.map((doc) => (
          <DocumentRow key={doc.id} doc={doc} disabled={isLocked} />
        ))}
      </div>

      {/* Continue to form */}
      {hasRequiredDone && state.step === 'scanning' && (
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-600">
            All required documents scanned. Continue to review and complete your form.
          </p>
          <button onClick={() => setStep('form')} className="btn-primary">
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
