import { useEffect, useRef, useState, useCallback } from 'react';
import type { DocumentId, PageData, QualityFeedback } from '../types';
import { analyzeVideoFrame, analyzeImageQuality, captureFrame, dataUrlToBase64, estimateSizeBytes, formatFileSize } from '../utils/imageAnalysis';
import { MAX_PAGE_BYTES } from '../config/limits';
import { warpAndScan } from '../utils/perspectiveTransform';
import type { Corner } from '../utils/perspectiveTransform';
import { validateScan } from '../utils/api';

interface Props {
  documentId: DocumentId;
  documentName: string;
  documentAiLabel: string;
  existingPages: PageData[];
  onPagesAdded: (pages: PageData[]) => void;
  onClose: () => void;
}

type ModalStep = 'camera' | 'crop' | 'processing' | 'preview' | 'validating';
type Corners   = [Corner, Corner, Corner, Corner];

const DEFAULT_CORNERS: Corners = [
  { x: 0.05, y: 0.05 },
  { x: 0.95, y: 0.05 },
  { x: 0.95, y: 0.95 },
  { x: 0.05, y: 0.95 },
];

const CAMERA_CONSTRAINTS: MediaStreamConstraints[] = [
  { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
  { video: { facingMode: { ideal: 'environment' } } },
  { video: { facingMode: 'environment' } },
  { video: { width: { ideal: 1280 }, height: { ideal: 720 } } },
  { video: true },
];

function cameraErr(err: unknown): string {
  const name = (err as DOMException)?.name ?? '';
  const msg  = (err as Error)?.message ?? '';
  if (name === 'NotAllowedError'  || name === 'PermissionDeniedError') return 'Camera permission denied. Tap "Allow" when your browser asks.';
  if (name === 'NotFoundError'    || name === 'DevicesNotFoundError')  return 'No camera found on this device.';
  if (name === 'NotReadableError' || name === 'TrackStartError')       return 'Camera is in use by another app.';
  if (name === 'NotSupportedError'|| msg.includes('secure'))           return 'Camera requires HTTPS.';
  if (name === 'TypeError'        || !navigator.mediaDevices)          return 'Browser does not support camera access.';
  return 'Could not start the camera.';
}

export default function CameraModal({
  documentId, documentName, documentAiLabel,
  existingPages, onPagesAdded, onClose,
}: Props) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const overlayRef      = useRef<HTMLCanvasElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const rafRef          = useRef<number>(0);
  const feedbackLockRef = useRef<number>(0);
  const draggingCorner  = useRef<number>(-1);
  const dragOffset      = useRef({ x: 0, y: 0 });
  const cropContRef     = useRef<HTMLDivElement>(null);
  const cropImgRef      = useRef<HTMLImageElement>(null);

  const [modalStep,     setModalStep]     = useState<ModalStep>('camera');
  const [feedback,      setFeedback]      = useState<QualityFeedback>({ message: 'Place document inside the frame.', type: 'info' });
  const [newPages,      setNewPages]      = useState<PageData[]>([]);
  const [rawPhotoUrl,   setRawPhotoUrl]   = useState('');
  const [previewUrl,    setPreviewUrl]    = useState('');
  const [corners,       setCorners]       = useState<Corners>(DEFAULT_CORNERS);
  const [imgBounds,     setImgBounds]     = useState({ x: 0, y: 0, w: 300, h: 400 });
  const [capturing,     setCapturing]     = useState(false);
  const [cameraError,   setCameraError]   = useState<string | null>(null);
  const [cameraReady,   setCameraReady]   = useState(false);
  const [validationMsg, setValidationMsg] = useState('');
  const [isLandscape,   setIsLandscape]   = useState(() => window.innerWidth > window.innerHeight);

  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);

  // ── Camera ────────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(location.protocol === 'http:' && location.hostname !== 'localhost'
        ? 'Camera requires HTTPS.' : 'Browser does not support camera access.');
      return;
    }
    for (const constraints of CAMERA_CONSTRAINTS) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          try { await videoRef.current.play(); } catch { /* autoPlay */ }
        }
        return;
      } catch (err) {
        const n = (err as DOMException)?.name ?? '';
        if (['NotAllowedError','PermissionDeniedError','NotFoundError',
             'DevicesNotFoundError','NotReadableError'].includes(n)) {
          setCameraError(cameraErr(err)); return;
        }
      }
    }
    setCameraError('Could not access the camera.');
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => { startCamera(); return () => stopCamera(); }, [startCamera, stopCamera]);

  // FIX: video element stays in DOM always (just hidden) — re-attach stream if
  // srcObject was lost (e.g. video element just became visible after being hidden).
  useEffect(() => {
    if (modalStep !== 'camera') return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (video && stream && !video.srcObject) {
      video.srcObject = stream;
      video.play().catch(() => {});
    }
  }, [modalStep]);

  // ── Overlay ───────────────────────────────────────────────────────────────────

  const drawOverlay = useCallback((isDark: boolean) => {
    const canvas = overlayRef.current, video = videoRef.current;
    if (!canvas || !video || video.readyState < 2) return;
    const w = canvas.width = video.clientWidth, h = canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d'); if (!ctx) return;

    const pad = 12, isPortrait = h > w;
    let fw: number, fh: number;
    if (isPortrait) {
      fw = w - pad * 2; fh = Math.min(fw * 1.3, h * 0.82);
    } else {
      // A4 landscape ratio (1.414:1); maximise height first, then derive width
      fh = h * 0.88;
      fw = Math.min(fh * 1.414, w - pad * 2);
      fh = fw / 1.414; // keep ratio if width was capped
    }
    const fx = (w - fw) / 2, fy = (h - fh) / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, w, h);
    ctx.clearRect(fx, fy, fw, fh);
    const ok = !isDark;
    ctx.strokeStyle = ok ? 'rgba(34,197,94,0.85)' : 'rgba(251,191,36,0.85)';
    ctx.lineWidth = 1.5; ctx.strokeRect(fx, fy, fw, fh);
    const cs = 26; ctx.strokeStyle = ok ? '#22c55e' : '#fbbf24'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    const brackets: [number,number,number,number,number,number][] = [
      [fx,fy,fx+cs,fy,fx,fy+cs],[fx+fw-cs,fy,fx+fw,fy,fx+fw,fy+cs],
      [fx,fy+fh-cs,fx,fy+fh,fx+cs,fy+fh],[fx+fw-cs,fy+fh,fx+fw,fy+fh,fx+fw,fy+fh-cs],
    ];
    for (const [x1,y1,x2,y2,x3,y3] of brackets) {
      ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3); ctx.stroke();
    }
  }, []);

  useEffect(() => {
    if (modalStep !== 'camera' || !cameraReady) return;
    let last = 0;
    const loop = (ts: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (ts - last < 800) return; last = ts;
      const v = videoRef.current; if (!v || v.readyState < 2) return;
      if (Date.now() < feedbackLockRef.current) return;
      const { isDark } = analyzeVideoFrame(v);
      drawOverlay(isDark);
      setFeedback(isDark
        ? { message: 'Too dark — move to a brighter area.', type: 'warning' }
        : { message: 'Place document inside the frame and hold steady.', type: 'info' });
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [modalStep, cameraReady, drawOverlay]);

  // ── Capture ───────────────────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturing) return;
    setCapturing(true);
    try {
      const dataUrl = captureFrame(video);
      const q = await analyzeImageQuality(dataUrl);
      if (q.isBlurry) {
        feedbackLockRef.current = Date.now() + 5000;
        setFeedback({ message: 'Blurry — hold steady and try again.', type: 'error' }); return;
      }
      if (q.isDark) {
        feedbackLockRef.current = Date.now() + 5000;
        setFeedback({ message: 'Too dark — move to a brighter area.', type: 'error' }); return;
      }
      setRawPhotoUrl(dataUrl);
      setCorners([...DEFAULT_CORNERS]);
      setModalStep('crop');
    } catch {
      setFeedback({ message: 'Something went wrong. Please try again.', type: 'error' });
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  // ── Crop ─────────────────────────────────────────────────────────────────────

  const updateImgBounds = useCallback(() => {
    const cont = cropContRef.current, img = cropImgRef.current;
    if (!cont || !img || !img.naturalWidth) return;
    const cw = cont.clientWidth, ch = cont.clientHeight;
    const ar = img.naturalWidth / img.naturalHeight;
    let x: number, y: number, w: number, h: number;
    if (ar > cw / ch) { w = cw; h = cw / ar; x = 0;            y = (ch - h) / 2; }
    else              { h = ch; w = ch * ar;  y = 0;            x = (cw - w) / 2; }
    setImgBounds({ x, y, w, h });
  }, []);

  useEffect(() => {
    if (modalStep !== 'crop') return;
    const obs = new ResizeObserver(updateImgBounds);
    if (cropContRef.current) obs.observe(cropContRef.current);
    return () => obs.disconnect();
  }, [modalStep, updateImgBounds]);

  // Clamped — used for actual corner position updates
  const getCropCoords = useCallback((clientX: number, clientY: number): Corner => {
    const r = cropContRef.current?.getBoundingClientRect();
    if (!r) return { x: 0.5, y: 0.5 };
    return {
      x: Math.max(0.01, Math.min(0.99, (clientX - r.left - imgBounds.x) / imgBounds.w)),
      y: Math.max(0.01, Math.min(0.99, (clientY - r.top  - imgBounds.y) / imgBounds.h)),
    };
  }, [imgBounds]);

  // Unclamped — used only for dragOffset so handles outside image bounds work correctly
  const getCropCoordsRaw = useCallback((clientX: number, clientY: number) => {
    const r = cropContRef.current?.getBoundingClientRect();
    if (!r) return { x: 0.5, y: 0.5 };
    return {
      x: (clientX - r.left - imgBounds.x) / imgBounds.w,
      y: (clientY - r.top  - imgBounds.y) / imgBounds.h,
    };
  }, [imgBounds]);

  const onContainerTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const i = draggingCorner.current; if (i < 0) return;
    const raw = getCropCoords(e.touches[0].clientX, e.touches[0].clientY);
    const pt = {
      x: Math.max(0.01, Math.min(0.99, raw.x - dragOffset.current.x)),
      y: Math.max(0.01, Math.min(0.99, raw.y - dragOffset.current.y)),
    };
    setCorners(prev => { const n = [...prev] as Corners; n[i] = pt; return n; });
  }, [getCropCoords]);

  const onContainerMouseMove = useCallback((e: React.MouseEvent) => {
    const i = draggingCorner.current; if (i < 0) return;
    const raw = getCropCoords(e.clientX, e.clientY);
    const pt = {
      x: Math.max(0.01, Math.min(0.99, raw.x - dragOffset.current.x)),
      y: Math.max(0.01, Math.min(0.99, raw.y - dragOffset.current.y)),
    };
    setCorners(prev => { const n = [...prev] as Corners; n[i] = pt; return n; });
  }, [getCropCoords]);

  const onDragEnd = useCallback(() => { draggingCorner.current = -1; }, []);

  const handleCropConfirm = useCallback(async () => {
    setModalStep('processing');
    try {
      const scanned = await warpAndScan(rawPhotoUrl, corners);
      setPreviewUrl(scanned);
    } catch {
      setPreviewUrl(rawPhotoUrl);
    }
    setModalStep('preview');
  }, [rawPhotoUrl, corners]);

  const backToCamera = useCallback((msg = 'Place document inside the frame and hold steady.') => {
    setRawPhotoUrl('');
    setPreviewUrl('');
    setModalStep('camera');
    setFeedback({ message: msg, type: 'info' });
  }, []);

  // ── Preview ───────────────────────────────────────────────────────────────────

  const acceptPage = useCallback((url: string) => {
    // Enforce 1 MB per-page limit before accepting
    const sizeBytes = estimateSizeBytes(url);
    if (sizeBytes > MAX_PAGE_BYTES) {
      feedbackLockRef.current = Date.now() + 5000;
      setFeedback({
        message: `Scan too large (${formatFileSize(sizeBytes)}). Max 1 MB per page — try again in better lighting.`,
        type: 'error',
      });
      setModalStep('camera');
      return;
    }

    const page: PageData = {
      id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
      dataUrl: url,
      capturedAt: Date.now(),
      sizeBytes,
    };
    setNewPages(prev => [...prev, page]);
    setPreviewUrl('');
    setValidationMsg('');
    setModalStep('camera');
    setFeedback({ message: 'Page added. Scan another page or tap Done.', type: 'success' });
  }, []);

  const handleConfirmPage = useCallback(async () => {
    if (!previewUrl) return;
    setModalStep('validating');
    setValidationMsg('Checking document type…');
    try {
      const r = await validateScan({ documentId, imageBase64: dataUrlToBase64(previewUrl) });
      if (!r.valid) { backToCamera(r.message); return; }
      if (r.validationSkipped) {
        // Show warning on preview step — user must tap "Use anyway" or "Retake"
        setModalStep('preview');
        setFeedback({ message: r.message, type: 'warning' });
        return;
      }
    } catch { /* accept on network error */ }
    acceptPage(previewUrl);
  }, [previewUrl, documentId, backToCamera, acceptPage]);

  const handleDone = useCallback(() => {
    if (newPages.length === 0 && existingPages.length === 0) {
      setFeedback({ message: 'Please scan at least one page first.', type: 'warning' }); return;
    }
    onPagesAdded(newPages);
    onClose();
  }, [newPages, existingPages.length, onPagesAdded, onClose]);

  const totalPages = existingPages.length + newPages.length;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" style={{ height: '100dvh' }}>

      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 bg-black" style={{ height: 44 }}>
        <button onClick={onClose} className="flex items-center gap-1 text-white/80 hover:text-white text-sm">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
        <div className="text-center">
          <p className="text-white font-semibold text-sm leading-tight">{documentName}</p>
          {totalPages > 0 && <p className="text-white/50 text-xs">{totalPages} page{totalPages !== 1 ? 's' : ''}</p>}
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* ── Camera group: video + controls. flex-row in landscape, flex-col in portrait.
             Video div is always in DOM (hidden when not in camera step) so the stream stays alive. ── */}
      <div className={`${modalStep === 'camera' && !cameraError ? 'flex-1 min-h-0' : ''} flex ${
        isLandscape ? 'flex-row' : 'flex-col'
      }`}>

        {/* VIDEO */}
        <div className={`relative overflow-hidden ${
          modalStep === 'camera' && !cameraError ? 'flex-1 min-h-0 min-w-0' : 'hidden'
        }`}>
          <video ref={videoRef} className="w-full h-full object-cover"
            playsInline muted autoPlay onCanPlay={() => setCameraReady(true)} />
          <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
          {!cameraReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full border-t-white border-white/20 animate-spin" style={{ borderWidth: 3 }} />
              <p className="text-white/70 text-sm">Starting camera…</p>
            </div>
          )}
          {/* Feedback text overlay — shown in landscape so the sidebar stays compact */}
          {isLandscape && cameraReady && (
            <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
              <span className={`text-xs px-3 py-1.5 rounded-full bg-black/60 ${
                feedback.type === 'error'   ? 'text-red-400'   :
                feedback.type === 'warning' ? 'text-amber-400' :
                feedback.type === 'success' ? 'text-green-400' : 'text-white/70'
              }`}>
                {feedback.message}
              </span>
            </div>
          )}
        </div>

        {/* ── Camera controls ── */}
        {modalStep === 'camera' && !cameraError && (
          isLandscape ? (
            /* ── Landscape: right sidebar ── */
            <div className="flex-shrink-0 bg-black flex flex-col items-center justify-between py-4 px-2" style={{ width: 88 }}>
              {/* Scanned page thumbnails stacked vertically */}
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-24 items-center">
                {newPages.map((p, i) => (
                  <img key={p.id} src={p.dataUrl} alt={`Page ${i + 1}`}
                    className="w-11 h-8 object-cover rounded border-2 border-green-500 flex-shrink-0" />
                ))}
              </div>

              {/* Capture button */}
              <button onClick={handleCapture} disabled={capturing || !cameraReady}
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl active:scale-95 transition-transform disabled:opacity-40">
                <div className="w-[52px] h-[52px] rounded-full bg-white border-[4px] border-gray-900 flex items-center justify-center">
                  {capturing
                    ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                    : <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>}
                </div>
              </button>

              {/* Done button */}
              <div className="flex items-center justify-center" style={{ minHeight: 40 }}>
                {totalPages > 0 && (
                  <button onClick={handleDone}
                    className="px-2 py-2 rounded-xl bg-brand-600 text-white text-xs font-semibold active:bg-brand-700 text-center leading-tight">
                    Done<br />({totalPages})
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Portrait: bottom bar ── */
            <div className="flex-shrink-0 bg-black px-4 pt-2.5 pb-5">
              <p className={`text-center text-xs mb-3 min-h-[16px] ${
                feedback.type === 'error'   ? 'text-red-400'   :
                feedback.type === 'warning' ? 'text-amber-400' :
                feedback.type === 'success' ? 'text-green-400' : 'text-white/50'}`}>
                {feedback.message}
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 flex gap-2 overflow-x-auto min-w-0">
                  {newPages.map((p, i) => (
                    <img key={p.id} src={p.dataUrl} alt={`Page ${i + 1}`}
                      className="h-11 w-8 object-cover rounded border-2 border-green-500 flex-shrink-0" />
                  ))}
                </div>
                <button onClick={handleCapture} disabled={capturing || !cameraReady}
                  className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-xl active:scale-95 transition-transform disabled:opacity-40 flex-shrink-0">
                  <div className="w-[52px] h-[52px] rounded-full bg-white border-[4px] border-gray-900 flex items-center justify-center">
                    {capturing
                      ? <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      : <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>}
                  </div>
                </button>
                <div className="flex-1 flex justify-end">
                  {totalPages > 0 && (
                    <button onClick={handleDone}
                      className="px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold active:bg-brand-700 whitespace-nowrap">
                      Done ({totalPages})
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>

      {/* ── Camera error ── */}
      {cameraError && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-6">
          <div className="w-16 h-16 rounded-full bg-red-900/40 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-white text-sm leading-relaxed">{cameraError}</p>
          <button onClick={startCamera} className="btn-primary">Try Again</button>
        </div>
      )}

      {/* ── Crop ── */}
      {modalStep === 'crop' && rawPhotoUrl && (
        <div className="flex-1 flex flex-col min-h-0 bg-black">
          <p className="flex-shrink-0 text-center text-white/60 text-xs py-2 px-4">
            Drag the numbered corners to align with the document edges
          </p>

          {/* Image + handles */}
          <div
            ref={cropContRef}
            className="relative flex-1 min-h-0"
            style={{ touchAction: 'none' }}
            onTouchMove={onContainerTouchMove}
            onTouchEnd={onDragEnd}
            onMouseMove={onContainerMouseMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
          >
            <img
              ref={cropImgRef}
              src={rawPhotoUrl}
              className="w-full h-full object-contain select-none"
              draggable={false}
              onLoad={updateImgBounds}
            />

            {/* Shading + quad outline (over exact image area) */}
            <svg style={{
              position: 'absolute',
              left: imgBounds.x, top: imgBounds.y,
              width: imgBounds.w, height: imgBounds.h,
              pointerEvents: 'none', overflow: 'visible',
            }} viewBox="0 0 1 1" preserveAspectRatio="none">
              <defs>
                <mask id="qm">
                  <rect x="0" y="0" width="1" height="1" fill="white" />
                  <polygon points={corners.map(c => `${c.x},${c.y}`).join(' ')} fill="black" />
                </mask>
              </defs>
              <rect x="0" y="0" width="1" height="1" fill="rgba(0,0,0,0.52)" mask="url(#qm)" />
              <polygon points={corners.map(c => `${c.x},${c.y}`).join(' ')}
                fill="none" stroke="#22c55e" strokeWidth="0.004" vectorEffect="non-scaling-stroke" />
            </svg>

            {/* Corner handles — circles offset OUTWARD from each corner.
                The handle never covers the document edge; a dot + stem shows the exact corner. */}
            {(() => {
              const OFFSET = 36; // px outward from corner to handle centre
              const R = 24;      // handle radius px
              // Document centre in container pixels
              const cxPx = imgBounds.x + corners.reduce((s, c) => s + c.x, 0) / 4 * imgBounds.w;
              const cyPx = imgBounds.y + corners.reduce((s, c) => s + c.y, 0) / 4 * imgBounds.h;

              return corners.map((c, idx) => {
                const px = imgBounds.x + c.x * imgBounds.w; // actual corner in container px
                const py = imgBounds.y + c.y * imgBounds.h;
                const dx = px - cxPx, dy = py - cyPx;
                const len = Math.hypot(dx, dy) || 1;
                const hx = px + (dx / len) * OFFSET; // handle centre
                const hy = py + (dy / len) * OFFSET;

                return (
                  <div key={idx} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {/* Stem line + corner dot */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
                      <line x1={hx} y1={hy} x2={px} y2={py}
                        stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeDasharray="3 3" />
                      <circle cx={px} cy={py} r={5} fill="#22c55e" stroke="white" strokeWidth="1.5" />
                    </svg>

                    {/* Draggable handle circle — centred at (hx, hy), OUTSIDE document edge */}
                    <div style={{
                      position: 'absolute',
                      left: hx - R, top: hy - R,
                      width: R * 2, height: R * 2,
                      borderRadius: '50%',
                      background: 'rgba(34,197,94,0.93)',
                      border: '2.5px solid white',
                      boxShadow: '0 0 0 2px rgba(0,0,0,0.4), 0 3px 10px rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: '800', color: 'white',
                      userSelect: 'none', touchAction: 'none', cursor: 'grab',
                      pointerEvents: 'auto',
                    }}
                      onTouchStart={(e) => {
                        e.preventDefault(); e.stopPropagation();
                        draggingCorner.current = idx;
                        // Use raw (unclamped) coords so offset is correct even when handle
                        // is outside the image bounds
                        const raw = getCropCoordsRaw(e.touches[0].clientX, e.touches[0].clientY);
                        dragOffset.current = { x: raw.x - c.x, y: raw.y - c.y };
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        draggingCorner.current = idx;
                        const raw = getCropCoordsRaw(e.clientX, e.clientY);
                        dragOffset.current = { x: raw.x - c.x, y: raw.y - c.y };
                      }}
                    >
                      {idx + 1}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Actions */}
          <div className="flex-shrink-0 flex items-center gap-2 px-4 pt-3 pb-5 bg-black">
            <button onClick={() => backToCamera()}
              className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-medium active:bg-white/10">
              Retake
            </button>
            <button onClick={() => setCorners([...DEFAULT_CORNERS])}
              className="px-4 py-3 rounded-xl border border-white/20 text-white/60 text-sm active:bg-white/10">
              Reset
            </button>
            <button onClick={handleCropConfirm}
              className="flex-1 py-3 rounded-xl bg-green-600 text-white text-sm font-semibold active:bg-green-700">
              Crop &amp; Scan
            </button>
          </div>
        </div>
      )}

      {/* ── Processing ── */}
      {modalStep === 'processing' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white text-sm">Applying scan effect…</p>
        </div>
      )}

      {/* ── Preview ── */}
      {modalStep === 'preview' && previewUrl && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4 bg-black min-h-0">
          <p className="text-white font-semibold text-sm flex-shrink-0">Review your scan</p>
          <img src={previewUrl} alt="Scan preview"
            className="flex-1 min-h-0 max-w-full object-contain rounded-lg border border-white/20 shadow-xl" />

          {/* Validation-skipped warning */}
          {feedback.type === 'warning' && feedback.message && (
            <div className="w-full max-w-sm flex-shrink-0 bg-amber-900/70 border border-amber-500/60 rounded-xl px-3 py-2.5 text-amber-200 text-xs leading-snug">
              {feedback.message}
            </div>
          )}

          <div className="flex gap-3 w-full max-w-xs flex-shrink-0 pb-4">
            <button onClick={() => backToCamera()}
              className="flex-1 py-3 rounded-xl border border-white/30 text-white text-sm font-medium active:bg-white/10">
              Retake
            </button>
            {feedback.type === 'warning' ? (
              <button onClick={() => acceptPage(previewUrl)}
                className="flex-1 py-3 rounded-xl bg-amber-600 text-white text-sm font-semibold active:bg-amber-700">
                Use Anyway
              </button>
            ) : (
              <button onClick={handleConfirmPage} className="flex-1 btn-primary">Use This</button>
            )}
          </div>
        </div>
      )}

      {/* ── Validating ── */}
      {modalStep === 'validating' && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
          <p className="text-white text-sm">{validationMsg}</p>
        </div>
      )}
    </div>
  );
}
