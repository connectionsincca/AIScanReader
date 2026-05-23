import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type {
  AppState, AppStep, ConsentState, DocumentId, DocumentState,
  DocumentStatus, FormData, PageData,
} from '../types';
import { DOCUMENTS } from '../config/documents';

// ─── Initial state ─────────────────────────────────────────────────────────────

function makeDocuments(): Record<DocumentId, DocumentState> {
  return Object.fromEntries(
    DOCUMENTS.map((d) => [d.id, { id: d.id, pages: [], status: 'idle' as DocumentStatus }])
  ) as unknown as Record<DocumentId, DocumentState>;
}

const INITIAL_STATE: AppState = {
  step: 'consent',
  consent: { processing: false, noStorage: false, aiAssisted: false, submission: false },
  documents: makeDocuments(),
  formData: {},
  fieldMeta: {},
  submissionId: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36),
  submitting: false,
  submitError: null,
};

// ─── Actions ───────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_CONSENT'; key: keyof ConsentState; value: boolean }
  | { type: 'SET_STEP'; step: AppStep }
  | { type: 'ADD_PAGES'; documentId: DocumentId; pages: PageData[] }
  | { type: 'REMOVE_PAGE'; documentId: DocumentId; pageId: string }
  | { type: 'RESET_DOCUMENT'; documentId: DocumentId }
  | { type: 'SET_DOCUMENT_STATUS'; documentId: DocumentId; status: DocumentStatus; errorMessage?: string }
  | { type: 'APPLY_EXTRACTED'; documentId: DocumentId; extractedData: Partial<FormData>; confidence: Partial<Record<keyof FormData, number>> }
  | { type: 'SET_FORM_FIELD'; field: keyof FormData; value: string }
  | { type: 'SET_SUBMITTING'; value: boolean }
  | { type: 'SET_SUBMIT_ERROR'; error: string | null };

// ─── Reducer ───────────────────────────────────────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONSENT':
      return { ...state, consent: { ...state.consent, [action.key]: action.value } };

    case 'SET_STEP':
      return { ...state, step: action.step };

    case 'ADD_PAGES': {
      const doc = state.documents[action.documentId];
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.documentId]: { ...doc, pages: [...doc.pages, ...action.pages] },
        },
      };
    }

    case 'REMOVE_PAGE': {
      const doc = state.documents[action.documentId];
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.documentId]: { ...doc, pages: doc.pages.filter((p) => p.id !== action.pageId) },
        },
      };
    }

    case 'RESET_DOCUMENT':
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.documentId]: { id: action.documentId, pages: [], status: 'idle' },
        },
      };

    case 'SET_DOCUMENT_STATUS': {
      const doc = state.documents[action.documentId];
      return {
        ...state,
        documents: {
          ...state.documents,
          [action.documentId]: { ...doc, status: action.status, errorMessage: action.errorMessage },
        },
      };
    }

    case 'APPLY_EXTRACTED': {
      const newFormData = { ...state.formData };
      const newMeta = { ...state.fieldMeta };

      for (const [field, value] of Object.entries(action.extractedData)) {
        const key = field as keyof FormData;
        if (!value) continue;

        // Only overwrite if not already set, or if new confidence is higher
        const existingConf = newMeta[key]?.confidence ?? 0;
        const newConf = action.confidence[key] ?? 0.75;

        if (!newFormData[key] || newConf > existingConf) {
          newFormData[key] = value as string;
          newMeta[key] = {
            aiPopulated: true,
            confidence: newConf,
            sourceDocument: action.documentId,
          };
        }
      }

      return {
        ...state,
        formData: newFormData,
        fieldMeta: newMeta,
        documents: {
          ...state.documents,
          [action.documentId]: { ...state.documents[action.documentId], status: 'done' },
        },
      };
    }

    case 'SET_FORM_FIELD':
      return {
        ...state,
        formData: { ...state.formData, [action.field]: action.value },
        // Clear AI meta when user manually edits
        fieldMeta: {
          ...state.fieldMeta,
          [action.field]: { aiPopulated: false, confidence: 1, sourceDocument: undefined },
        },
      };

    case 'SET_SUBMITTING':
      return { ...state, submitting: action.value };

    case 'SET_SUBMIT_ERROR':
      return { ...state, submitError: action.error };

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  setConsent: (key: keyof ConsentState, value: boolean) => void;
  consentComplete: boolean;
  setStep: (step: AppStep) => void;
  addPages: (documentId: DocumentId, pages: PageData[]) => void;
  removePage: (documentId: DocumentId, pageId: string) => void;
  resetDocument: (documentId: DocumentId) => void;
  setDocumentStatus: (documentId: DocumentId, status: DocumentStatus, errorMessage?: string) => void;
  applyExtracted: (
    documentId: DocumentId,
    extractedData: Partial<FormData>,
    confidence: Partial<Record<keyof FormData, number>>
  ) => void;
  setFormField: (field: keyof FormData, value: string) => void;
  setSubmitting: (value: boolean) => void;
  setSubmitError: (error: string | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const consentComplete =
    state.consent.processing &&
    state.consent.noStorage &&
    state.consent.aiAssisted &&
    state.consent.submission;

  const setConsent = useCallback((key: keyof ConsentState, value: boolean) =>
    dispatch({ type: 'SET_CONSENT', key, value }), []);

  const setStep = useCallback((step: AppStep) =>
    dispatch({ type: 'SET_STEP', step }), []);

  const addPages = useCallback((documentId: DocumentId, pages: PageData[]) =>
    dispatch({ type: 'ADD_PAGES', documentId, pages }), []);

  const removePage = useCallback((documentId: DocumentId, pageId: string) =>
    dispatch({ type: 'REMOVE_PAGE', documentId, pageId }), []);

  const resetDocument = useCallback((documentId: DocumentId) =>
    dispatch({ type: 'RESET_DOCUMENT', documentId }), []);

  const setDocumentStatus = useCallback((documentId: DocumentId, status: DocumentStatus, errorMessage?: string) =>
    dispatch({ type: 'SET_DOCUMENT_STATUS', documentId, status, errorMessage }), []);

  const applyExtracted = useCallback((
    documentId: DocumentId,
    extractedData: Partial<FormData>,
    confidence: Partial<Record<keyof FormData, number>>
  ) => dispatch({ type: 'APPLY_EXTRACTED', documentId, extractedData, confidence }), []);

  const setFormField = useCallback((field: keyof FormData, value: string) =>
    dispatch({ type: 'SET_FORM_FIELD', field, value }), []);

  const setSubmitting = useCallback((value: boolean) =>
    dispatch({ type: 'SET_SUBMITTING', value }), []);

  const setSubmitError = useCallback((error: string | null) =>
    dispatch({ type: 'SET_SUBMIT_ERROR', error }), []);

  return (
    <AppContext.Provider value={{
      state, setConsent, consentComplete, setStep,
      addPages, removePage, resetDocument, setDocumentStatus,
      applyExtracted, setFormField, setSubmitting, setSubmitError,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

