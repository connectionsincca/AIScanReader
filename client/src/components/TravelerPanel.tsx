import { useApp } from '../context/AppContext';
import type { DocumentId } from '../types';

const SPOUSE_DOCS: DocumentId[] = [
  'spousePassport', 'spouseWorkExperienceCert', 'spouseDegreeCertificate',
  'spouseEventInvitationLetter', 'spouseTravelTickets', 'spouseDigitalPicture',
];

const CHILD_DOCS: Record<number, DocumentId[]> = {
  1: ['child1Passport', 'child1TravelTickets', 'child1DigitalPicture'],
  2: ['child2Passport', 'child2TravelTickets', 'child2DigitalPicture'],
  3: ['child3Passport', 'child3TravelTickets', 'child3DigitalPicture'],
  4: ['child4Passport', 'child4TravelTickets', 'child4DigitalPicture'],
};

export default function TravelerPanel() {
  const { travelers, setTravelers, resetDocument } = useApp();

  const toggleSpouse = () => {
    if (travelers.hasSpouse) {
      const ok = window.confirm(
        'Remove spouse/partner? Their document sections will be cleared (scanned data stays on file).'
      );
      if (!ok) return;
      SPOUSE_DOCS.forEach((id) => resetDocument(id));
      setTravelers({ ...travelers, hasSpouse: false });
    } else {
      setTravelers({ ...travelers, hasSpouse: true });
    }
  };

  const addChild = () => {
    if (travelers.childCount < 4) {
      setTravelers({ ...travelers, childCount: travelers.childCount + 1 });
    }
  };

  const removeLastChild = () => {
    if (travelers.childCount > 0) {
      const n = travelers.childCount;
      const ok = window.confirm(
        `Remove Child ${n}? Their document sections will be cleared (scanned data stays on file).`
      );
      if (!ok) return;
      CHILD_DOCS[n].forEach((id) => resetDocument(id));
      setTravelers({ ...travelers, childCount: n - 1 });
    }
  };

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-amber-100 border-b border-amber-200 px-4 py-3">
        <svg className="w-4 h-4 text-amber-700 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3 className="font-semibold text-amber-900 text-sm">Traveler Declaration</h3>
        <span className="ml-auto text-xs text-amber-700">Select all travelers joining this application</span>
      </div>

      {/* Traveler cards */}
      <div className="p-4">
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Applicant — always selected */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium shadow-sm">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">A</div>
            <span>Applicant</span>
            <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Spouse toggle */}
          <button
            onClick={toggleSpouse}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              travelers.hasSpouse
                ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                : 'bg-white text-amber-700 border-amber-300 hover:border-amber-400 hover:bg-amber-50'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              travelers.hasSpouse ? 'bg-white/20' : 'bg-amber-100'
            }`}>S</div>
            <span>Spouse / Partner</span>
            {travelers.hasSpouse ? (
              <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            )}
          </button>

          {/* Child cards */}
          {Array.from({ length: travelers.childCount }, (_, i) => (
            <div key={i + 1} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium shadow-sm">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">C{i + 1}</div>
              <span>Child {i + 1}</span>
              {i + 1 === travelers.childCount && (
                <button
                  onClick={removeLastChild}
                  className="ml-1 w-4 h-4 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title={`Remove Child ${i + 1}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {/* Add child button */}
          {travelers.childCount < 4 && (
            <button
              onClick={addChild}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border-2 border-dashed border-amber-300 text-amber-600 bg-white hover:border-amber-400 hover:bg-amber-50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Child {travelers.childCount + 1}
              {travelers.childCount > 0 && ` of 4`}
            </button>
          )}
        </div>

        {/* Hard stop notice */}
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-3 text-xs text-red-800">
          <span className="text-base leading-none flex-shrink-0">🛑</span>
          <span>
            <strong>A valid passport must be scanned for every declared traveler</strong> — applicant, spouse, and each child.
            The form cannot be submitted until all passport sections show "Processed".
          </span>
        </div>

        {/* Birth certificate note */}
        <div className="flex items-start gap-2 border border-dashed border-amber-300 rounded-lg px-3 py-2.5 text-xs text-amber-800 bg-white">
          <span className="text-base leading-none flex-shrink-0">📄</span>
          <span>
            <strong>Birth certificates</strong> are optional for all travelers.
            You can upload them under the "Upload Only" section for each traveler if available.
          </span>
        </div>
      </div>
    </div>
  );
}
