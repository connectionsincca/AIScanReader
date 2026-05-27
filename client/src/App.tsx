import { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import ProgressSteps from './components/ProgressSteps';
import ConsentSection from './components/ConsentSection';
import DocumentScanner from './components/DocumentScanner';
import IntakeForm from './components/IntakeForm';
import SubmitSection from './components/SubmitSection';
import ReviewSection from './components/ReviewSection';
import SuccessScreen from './components/SuccessScreen';

function Portal() {
  const { state } = useApp();

  // Scroll to top whenever the step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [state.step]);

  // Success screen sits outside the main layout shell
  if (state.step === 'submitted') return <SuccessScreen />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-600 flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-gray-900 text-sm sm:text-base leading-tight">
              Immigration Intake Portal
            </h1>
            <p className="text-xs text-gray-500 hidden sm:block">Secure Document Submission</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
            <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Secure &amp; Private</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <ProgressSteps />

        {state.step === 'consent'  && <ConsentSection />}
        {state.step === 'scanning' && <DocumentScanner />}
        {state.step === 'form'     && <><IntakeForm /><SubmitSection /></>}
        {state.step === 'complete' && <ReviewSection />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Portal />
    </AppProvider>
  );
}
