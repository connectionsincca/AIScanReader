import { useApp } from '../context/AppContext';
import type { ConsentState } from '../types';

const CHECKBOXES: { key: keyof ConsentState; label: string }[] = [
  {
    key: 'processing',
    label: 'I understand my documents will only be processed for immigration service intake purposes.',
  },
  {
    key: 'noStorage',
    label: 'I understand my documents are not permanently stored on this system.',
  },
  {
    key: 'aiAssisted',
    label: 'I consent to AI-assisted processing to extract information from my documents.',
  },
  {
    key: 'submission',
    label: 'I authorize the submission of my completed intake package to the immigration agency.',
  },
];

export default function ConsentSection() {
  const { state, setConsent, consentComplete, setStep } = useApp();

  return (
    <section className="card p-5 sm:p-6 fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Privacy &amp; Consent</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Please review and accept all items below before scanning your documents.
          </p>
        </div>
      </div>

      {/* Privacy notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <strong>Your privacy matters.</strong> Your personal documents are processed securely and are not
        permanently stored on our systems. All data is deleted after your submission is sent to the agency.
      </div>

      {/* Checkboxes */}
      <div className="space-y-3">
        {CHECKBOXES.map(({ key, label }) => (
          <label
            key={key}
            className="flex items-start gap-3 p-3 rounded-xl border border-transparent hover:bg-gray-50 cursor-pointer transition-colors group"
          >
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                className="sr-only"
                checked={state.consent[key]}
                onChange={(e) => setConsent(key, e.target.checked)}
              />
              <div
                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors
                  ${state.consent[key]
                    ? 'bg-brand-600 border-brand-600'
                    : 'border-gray-300 group-hover:border-brand-400'}`}
              >
                {state.consent[key] && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-gray-700 leading-snug">{label}</span>
          </label>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
        {consentComplete ? (
          <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Consent confirmed — you may now scan your documents.
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Please check all boxes above to continue.
          </p>
        )}

        {consentComplete && state.step === 'consent' && (
          <button
            onClick={() => setStep('scanning')}
            className="btn-primary sm:ml-auto"
          >
            Continue to Document Scanning
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </section>
  );
}
