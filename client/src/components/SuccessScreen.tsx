import { useApp } from '../context/AppContext';

export default function SuccessScreen() {
  const { state } = useApp();
  const name = [state.formData.firstName, state.formData.lastName].filter(Boolean).join(' ') || 'Applicant';

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-brand-50 flex flex-col items-center justify-center px-4 py-12 text-center">
      {/* Success icon */}
      <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 shadow-sm">
        <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Submission Successful!</h1>
      <p className="text-gray-600 max-w-md mb-6">
        {name}, your immigration intake package has been securely submitted to the agency.
        You will receive a confirmation from them once your application is reviewed.
      </p>

      {/* Submission details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 w-full max-w-sm text-left mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Submission Details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Submission ID</span>
            <span className="font-mono font-medium text-gray-900">
              {state.submissionId.slice(0, 8).toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Submitted</span>
            <span className="font-medium text-gray-900">
              {new Date().toLocaleString('en-CA', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Applicant</span>
            <span className="font-medium text-gray-900">{name}</span>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 max-w-sm text-sm text-blue-800 text-left mb-6">
        <svg className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        All your document images and personal data have been deleted from this system.
        Only the email copy sent to the agency is retained.
      </div>

      <p className="text-sm text-gray-400">
        You may safely close this window.
      </p>
    </div>
  );
}
