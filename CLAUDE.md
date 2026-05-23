# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (root + client + server)
npm run install:all

# Start both servers in development
npm run dev           # Express on :3001 + Vite on :5174

# Build
npm run build         # both
npm run build:client  # client only (tsc + vite build)
npm run build:server  # server only (tsc)

# Production start (after build)
cd server && npm start
```

There are no test scripts. TypeScript compilation (`tsc`) is the primary correctness check — run `npm run build:client` or `npm run build:server` to surface type errors before testing manually.

## Architecture

### Single-port design

In development, always access the app via **http://localhost:3001** — not the Vite port. Express detects that `client/dist/` does not exist and transparently reverse-proxies all non-`/api` requests (including Vite HMR websockets) to Vite on `:5174`. In production, Express serves the built `client/dist/` as static files directly.

### Data flow — scanning to submission

```
Camera capture (canvas)
  → captureFrame()         raw JPEG dataURL
  → warpAndScan()          perspective warp + per-channel scan effect → JPEG dataURL
  → validateScan API       GPT-4o (low detail) checks document type
  → extractData API        GPT-4o (high detail) OCR extracts form fields
  → AppContext.applyExtracted()  merges into formData with confidence scores
  → submitPackage API      server builds PDF (pdf-lib) → emails (nodemailer) → no disk write
```

### Client state

All app state lives in a single `useReducer` in `AppContext` (`client/src/context/AppContext.tsx`). There is no external state library. The `APPLY_EXTRACTED` action merges OCR results only when the new confidence exceeds the existing value for each field, so later scans can override earlier ones without clobbering higher-confidence data.

App steps: `consent → scanning → form → complete`.

### Camera modal (`client/src/components/CameraModal.tsx`)

The most complex component. Key design decisions:

- **Video element always stays in the DOM** (toggled with `hidden` CSS class, never unmounted) — unmounting loses the `srcObject` and blacks out on retake.
- **`feedbackLockRef`** — a `useRef<number>` holding a future timestamp. The RAF quality-analysis loop checks `if (Date.now() < feedbackLockRef.current) return` before overwriting feedback, preventing capture errors from being erased within 5 seconds.
- **Orientation-aware layout** — `isLandscape` state (updated on `resize`/`orientationchange`) switches the camera area between `flex-col` (portrait, controls at bottom) and `flex-row` (landscape, controls in right sidebar). The overlay guide rectangle uses different formulas per orientation: portrait uses `fw * 1.3` ratio; landscape uses `fh * 1.414` (A4 ratio).
- **Corner handles** — offset outward from document centre by 36 px so they never cover document edges. `dragOffset` ref (populated with unclamped `getCropCoordsRaw()` at touchstart) prevents corner-jump on first touch. `getCropCoords()` is clamped [0.01, 0.99] for actual updates.
- **`validationSkipped`** — when the OpenAI call fails (e.g. invalid API key), `validateDocumentScan` returns `{ valid: true, validationSkipped: true }`. The preview screen shows an amber warning and replaces "Use This" with "Use Anyway".

### Image processing (`client/src/utils/`)

- **`imageAnalysis.ts`** — `captureFrame()` returns a raw JPEG (no scan effect). `analyzeImageQuality()` uses Laplacian variance for blur detection. `analyzeVideoFrame()` is a lightweight live-frame darkness check only.
- **`perspectiveTransform.ts`** — `warpAndScan()` computes an inverse homography (Gaussian elimination → 3×3 matrix), does bilinear-interpolated inverse mapping, then applies a per-channel percentile normalisation (3rd–94th percentile stretch, 1.6× contrast). Processing is chunked with `requestAnimationFrame` every 40 ms so the spinner can animate.

### Server services (`server/src/services/`)

- **`openaiService.ts`** — `DOC_VISUAL_TRAITS` contains per-document-type visual descriptions injected into the validation prompt so GPT-4o can distinguish, e.g., a passport booklet from a driver's licence card. Both functions fail gracefully: `validateDocumentScan` returns `validationSkipped: true` on error; `extractDocumentData` returns empty data rather than throwing.
- **`pdfService.ts`** — builds the PDF entirely in memory using `pdf-lib`.
- **`emailService.ts`** — attaches the PDF buffer directly to nodemailer without writing to disk.

### Adding a new document type

1. Add the `DocumentId` union member in `server/src/types/index.ts` and `client/src/types/index.ts`.
2. Add a `DocumentConfig` entry to `client/src/config/documents.ts` (`id`, `name`, `required`, `aiLabel`, `extractedFields`).
3. Add a `DOC_LABELS` + `DOC_VISUAL_TRAITS` entry and `EXTRACT_FIELDS` spec in `server/src/services/openaiService.ts`.

## Environment

`server/.env` is required to start the server (all variables are validated at boot via `require_env()`). Copy from `.env.example`. The OpenAI key must have gpt-4o access. Camera scanning requires HTTPS in production — use ngrok for local mobile testing.
