import { useApp } from '../context/AppContext';
import type { AppStep } from '../types';

const STEPS: { id: AppStep; label: string; short: string }[] = [
  { id: 'consent',  label: 'Consent',          short: '1' },
  { id: 'scanning', label: 'Scan Documents',    short: '2' },
  { id: 'form',     label: 'Complete Form',     short: '3' },
  { id: 'complete', label: 'Submit',            short: '4' },
];

const STEP_ORDER: AppStep[] = ['consent', 'scanning', 'form', 'complete'];

export default function ProgressSteps() {
  const { state, setStep } = useApp();
  const currentIndex = STEP_ORDER.indexOf(state.step);

  // Back is available on scanning (1) and form (2) only — not on consent or complete
  const canGoBack = currentIndex > 0 && currentIndex < STEP_ORDER.length - 1;
  const prevStep  = canGoBack ? STEP_ORDER[currentIndex - 1] : null;

  return (
    <div className="card px-4 py-3">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const done   = i < currentIndex;
          const active = i === currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Circle */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                    ${done   ? 'bg-green-500 text-white'
                    : active ? 'bg-brand-600 text-white ring-4 ring-brand-100'
                             : 'bg-gray-100 text-gray-400'}`}
                >
                  {done ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.short
                  )}
                </div>
                <span
                  className={`text-xs font-medium hidden sm:block
                    ${done ? 'text-green-600' : active ? 'text-brand-600' : 'text-gray-400'}`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 rounded transition-colors
                  ${i < currentIndex ? 'bg-green-400' : 'bg-gray-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Previous button — shown on scanning and form steps */}
      {canGoBack && prevStep && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={() => setStep(prevStep)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to {STEPS[currentIndex - 1].label}
          </button>
        </div>
      )}
    </div>
  );
}
