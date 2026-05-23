import { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import type { DocumentConfig, PageData } from '../types';
import { dataUrlToBase64 } from '../utils/imageAnalysis';
import { extractData } from '../utils/api';
import CameraModal from './CameraModal';
import PageGallery from './PageGallery';

interface Props {
  doc: DocumentConfig;
  disabled: boolean;
}

export default function DocumentRow({ doc, disabled }: Props) {
  const { state, addPages, removePage, resetDocument, setDocumentStatus, applyExtracted } = useApp();
  const docState = state.documents[doc.id];

  const [cameraOpen, setCameraOpen]   = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const pageCount = docState.pages.length;
  const status    = docState.status;

  // ── Process pages with OCR ──────────────────────────────────────────────────

  const processPages = useCallback(async (pages: PageData[]) => {
    if (pages.length === 0) return;
    setDocumentStatus(doc.id, 'processing');

    try {
      const result = await extractData({
        documentId: doc.id,
        pages: pages.map((p) => dataUrlToBase64(p.dataUrl)),
      });
      applyExtracted(doc.id, result.extractedData, result.confidence);
    } catch (err) {
      const msg = (err as Error).message ?? 'Extraction failed';
      setDocumentStatus(doc.id, 'error', `Could not extract information from this document. ${msg}`);
    }
  }, [doc.id, setDocumentStatus, applyExtracted]);

  // ── Camera callbacks ────────────────────────────────────────────────────────

  const handlePagesAdded = useCallback((newPages: PageData[]) => {
    addPages(doc.id, newPages);
    // Immediately process all pages (existing + new)
    const all = [...docState.pages, ...newPages];
    processPages(all);
  }, [addPages, doc.id, docState.pages, processPages]);

  const handleReset = useCallback(() => {
    resetDocument(doc.id);
  }, [doc.id, resetDocument]);

  const handleRemovePage = useCallback((pageId: string) => {
    removePage(doc.id, pageId);
    if (pageCount - 1 === 0) resetDocument(doc.id);
  }, [doc.id, pageCount, removePage, resetDocument]);

  // ── Status badge ────────────────────────────────────────────────────────────

  const badge = () => {
    switch (status) {
      case 'idle':
        return doc.required
          ? <span className="badge-warning">Required</span>
          : <span className="badge-neutral">Optional</span>;
      case 'processing':
        return (
          <span className="badge-neutral">
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            Processing…
          </span>
        );
      case 'done':
        return (
          <span className="badge-success">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Processed
          </span>
        );
      case 'error':
        return <span className="badge-error">Error</span>;
    }
  };

  return (
    <>
      <div className={`flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-colors
        ${status === 'done'       ? 'border-green-200 bg-green-50/30'
        : status === 'processing' ? 'border-blue-100 bg-blue-50/20'
        : status === 'error'      ? 'border-red-200 bg-red-50/20'
        : 'border-gray-100 bg-white hover:border-gray-200'}`}
      >
        {/* Icon + info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center
            ${status === 'done' ? 'bg-green-100' : status === 'error' ? 'bg-red-100' : 'bg-gray-100'}`}
          >
            {status === 'done' ? (
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 text-sm">{doc.name}</span>
              {badge()}
              {pageCount > 0 && (
                <span className="text-xs text-gray-500">{pageCount} page{pageCount !== 1 ? 's' : ''}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{doc.description}</p>
            {status === 'error' && docState.errorMessage && (
              <p className="text-xs text-red-600 mt-1">{docState.errorMessage}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Scan / Add Page */}
          {status !== 'processing' && (
            <button
              onClick={() => !disabled && setCameraOpen(true)}
              disabled={disabled}
              className={pageCount === 0 ? 'btn-primary text-sm py-2 px-3' : 'btn-secondary text-sm py-2 px-3'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {pageCount === 0 ? 'Scan' : 'Add Page'}
            </button>
          )}

          {/* View pages */}
          {pageCount > 0 && (
            <button onClick={() => setGalleryOpen(true)} className="btn-ghost text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              View
            </button>
          )}

          {/* Re-scan / Remove all */}
          {pageCount > 0 && status !== 'processing' && (
            <button onClick={handleReset} className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Camera modal */}
      {cameraOpen && (
        <CameraModal
          documentId={doc.id}
          documentName={doc.name}
          documentAiLabel={doc.aiLabel}
          existingPages={docState.pages}
          onPagesAdded={handlePagesAdded}
          onClose={() => setCameraOpen(false)}
        />
      )}

      {/* Page gallery */}
      {galleryOpen && (
        <PageGallery
          documentName={doc.name}
          pages={docState.pages}
          onRemovePage={handleRemovePage}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  );
}
