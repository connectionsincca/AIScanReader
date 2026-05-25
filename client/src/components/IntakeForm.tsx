import { useApp } from '../context/AppContext';
import { FORM_SECTIONS } from '../config/formFields';
import FormField from './FormField';

export default function IntakeForm() {
  const { state } = useApp();

  const aiFilledCount = Object.values(state.fieldMeta).filter((m) => m?.aiPopulated).length;

  return (
    <section className="card p-5 sm:p-6 fade-in">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Immigration Intake Form</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Review and complete all fields below. AI-filled fields are highlighted in green.
          </p>
        </div>
      </div>

      {/* AI filled notice */}
      {aiFilledCount > 0 && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-3 mb-5 text-sm text-green-800">
          <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>
            <strong>{aiFilledCount} field{aiFilledCount !== 1 ? 's' : ''}</strong> were automatically filled from your documents.
            Please review them for accuracy and fill in any remaining fields.
          </span>
        </div>
      )}

      {/* Form sections */}
      <div className="space-y-8">
        {FORM_SECTIONS.map((section) => (
          <div key={section.id}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 pb-2 border-b border-gray-100">
              {section.title}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.fields.map((field) => (
                <div
                  key={field.id}
                  className={field.type === 'text' && (
                    field.id === 'currentAddress' || field.id === 'currentOccupation' || field.id === 'spouseCurrentOccupation'
                  ) ? 'sm:col-span-2' : ''}
                >
                  <FormField field={field} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-green-400 bg-green-50" />
          AI-filled field (verified)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-amber-400 bg-amber-50" />
          Low confidence — please verify
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 font-semibold">*</span>
          Required field
        </div>
      </div>
    </section>
  );
}
