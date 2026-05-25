import { useState, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { DocumentConfig, DocumentId, PageData } from '../types';
import { dataUrlToBase64, analyzeImageQuality, estimateSizeBytes, formatFileSize } from '../utils/imageAnalysis';
import { extractData, validateScan } from '../utils/api';
import { MAX_PAGE_BYTES, MAX_TOTAL_BYTES } from '../config/limits';
import CameraModal from './CameraModal';
import PageGallery from './PageGallery';

interface Props {
  doc: DocumentConfig;
  disabled: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function totalDocumentBytes(documents: ReturnType<typeof useApp>['state']['documents']): number {
  return Object.values(documents)
    .flatMap((d) => d.pages)
    .reduce((sum, p) => sum + (p.sizeBytes ?? 0), 0);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocumentRow({ doc, disabled }: Props) {
  const { state, addPages, removePage, resetDocument, setDocumentStatus, applyExtracted } = useApp();
  const docState = state.documents[doc.id];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraOpen,   setCameraOpen]   = useState(false);
  const [galleryOpen,  setGalleryOpen]  = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [actionError,  setActionError]  = useState<string | null>(null);

  const pageCount  = docState.pages.length;
  const status     = docState.status;
  const docBytes   = docState.pages.reduce((s, p) => s + (p.sizeBytes ?? 0), 0);

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
    // Total-size guardrail (per-page was already checked inside CameraModal)
    const currentTotal = totalDocumentBytes(state.documents);
    const addedTotal   = newPages.reduce((s, p) => s + (p.sizeBytes ?? 0), 0);
    if (currentTotal + addedTotal > MAX_TOTAL_BYTES) {
      const avail = Math.max(0, MAX_TOTAL_BYTES - currentTotal);
      setActionError(
        `Total document limit (22 MB) reached. ` +
        `Available: ${formatFileSize(avail)}, scanned: ${formatFileSize(addedTotal)}.`
      );
      return;
    }
    setActionError(null);
    addPages(doc.id, newPages);
    const all = [...docState.pages, ...newPages];
    processPages(all);
  }, [state.documents, addPages, doc.id, docState.pages, processPages]);

  const handleReset = useCallback(() => {
    setActionError(null);
    resetDocument(doc.id);
  }, [doc.id, resetDocument]);

  const handleRemovePage = useCallback((pageId: string) => {
    removePage(doc.id, pageId);
    if (pageCount - 1 === 0) resetDocument(doc.id);
  }, [doc.id, pageCount, removePage, resetDocument]);

  // ── File Upload ─────────────────────────────────────────────────────────────

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting same file
    if (!file || disabled) return;

    setActionError(null);
    setUploading(true);

    try {
      // 1. Per-file size check
      if (file.size > MAX_PAGE_BYTES) {
        setActionError(
          `File too large (${formatFileSize(file.size)}). Maximum size per file is 1 MB.`
        );
        return;
      }

      // 2. Total size check (use file.size as the estimate before reading)
      const currentTotal = totalDocumentBytes(state.documents);
      if (currentTotal + file.size > MAX_TOTAL_BYTES) {
        const avail = Math.max(0, MAX_TOTAL_BYTES - currentTotal);
        setActionError(
          `Total document limit (22 MB) reached. ` +
          `Available: ${formatFileSize(avail)}, file: ${formatFileSize(file.size)}.`
        );
        return;
      }

      // 3. Read as data URL
      const dataUrl = await readFileAsDataUrl(file);

      // 4. Image quality check (blur / darkness)
      try {
        const quality = await analyzeImageQuality(dataUrl);
        if (quality.isBlurry) {
          setActionError(
            'Uploaded image appears blurry. Please upload a clearer photo or use the camera scan option.'
          );
          return;
        }
        if (quality.isDark) {
          setActionError(
            'Uploaded image is too dark. Please upload a better-lit photo.'
          );
          return;
        }
      } catch {
        // If quality analysis fails (e.g. unsupported format), continue anyway
      }

      // 5. Document-type validation via AI
      setDocumentStatus(doc.id, 'processing');
      let skipped = false;
      try {
        const validation = await validateScan({
          documentId: doc.id,
          imageBase64: dataUrlToBase64(dataUrl),
        });
        if (!validation.valid) {
          setDocumentStatus(doc.id, 'idle');
          setActionError(
            validation.message ||
            `Wrong document type. Please upload the correct document: "${doc.name}".`
          );
          return;
        }
        skipped = !!validation.validationSkipped;
      } catch {
        skipped = true; // network error → fail-open (same behaviour as camera)
      }

      if (skipped) {
        setActionError(
          '⚠ Document type could not be verified (AI service unavailable). ' +
          'Please ensure you are uploading the correct document.'
        );
        // Still continue — fail-open mirrors camera's "Use Anyway" path
      } else {
        setActionError(null);
      }

      // 6. Add page + extract data
      const sizeBytes = estimateSizeBytes(dataUrl);
      const page: PageData = {
        id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
        dataUrl,
        capturedAt: Date.now(),
        sizeBytes,
      };

      addPages(doc.id, [page]);
      processPages([...docState.pages, page]);

    } catch (err) {
      setDocumentStatus(doc.id, 'idle');
      setActionError(`Upload failed: ${(err as Error).message ?? 'Unknown error'}`);
    } finally {
      setUploading(false);
    }
  }, [disabled, state.documents, doc.id, doc.name, addPages, docState.pages,
      processPages, setDocumentStatus]);

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

  const isProcessing = status === 'processing' || uploading;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
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
                <span className="text-xs text-gray-500">
                  {pageCount} page{pageCount !== 1 ? 's' : ''}
                  {docBytes > 0 && (
                    <span className="ml-1 text-gray-400">· {formatFileSize(docBytes)}</span>
                  )}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{doc.description}</p>

            {/* OCR extraction error */}
            {status === 'error' && docState.errorMessage && (
              <p className="text-xs text-red-600 mt-1">{docState.errorMessage}</p>
            )}
            {/* Upload / scan action error */}
            {actionError && (
              <p className="text-xs text-red-600 mt-1">{actionError}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">

          {/* Scan button */}
          {!isProcessing && (
            <button
              onClick={() => { if (!disabled) { setActionError(null); setCameraOpen(true); } }}
              disabled={disabled}
              className={pageCount === 0 ? 'btn-primary text-sm py-2 px-3' : 'btn-secondary text-sm py-2 px-3'}
              title="Scan with camera"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {pageCount === 0 ? 'Scan' : 'Add Page'}
            </button>
          )}

          {/* Upload button */}
          {!isProcessing && (
            <button
              onClick={() => { if (!disabled) { setActionError(null); fileInputRef.current?.click(); } }}
              disabled={disabled}
              className="btn-secondary text-sm py-2 px-3"
              title="Upload from file (JPG, PNG, WEBP, HEIC)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {pageCount === 0 ? 'Upload' : 'Add File'}
            </button>
          )}

          {/* Uploading spinner */}
          {uploading && (
            <span className="flex items-center gap-1.5 text-sm text-blue-600 px-2">
              <span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin flex-shrink-0" />
              Uploading…
            </span>
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

          {/* Remove all */}
          {pageCount > 0 && !isProcessing && (
            <button
              onClick={handleReset}
              className="btn-ghost text-sm text-red-500 hover:text-red-600 hover:bg-red-50"
            >
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
