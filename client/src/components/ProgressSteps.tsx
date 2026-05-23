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
  const { state } = useApp();
  const currentIndex = STEP_ORDER.indexOf(state.step);

  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between">
        {STEPS.map((step, i) => {
          const done    = i < currentIndex;
          const active  = i === currentIndex;
          const pending = i > currentIndex;

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
    </div>
  );
}
