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

### Data flow — document input to submission

Documents can be added via two paths, both ultimately produce `PageData[]` (base64 JPEG data URLs with size metadata):

```
── Camera path ──────────────────────────────────────────────────────────────
captureFrame()          raw JPEG dataURL (CameraModal)
  → warpAndScan()       perspective warp + per-channel contrast → JPEG dataURL
  → size check          must be ≤ 1 MB (MAX_PAGE_BYTES)
  → onPagesAdded()      DocumentRow receives the pages

── File upload path ─────────────────────────────────────────────────────────
File input (image or PDF)
  → size check          file.size ≤ 1 MB before rendering
  → pdfToImages()       PDF only: pdfjs-dist renders each page to canvas → JPEG
    OR readFileAsDataUrl() for image files
  → analyzeImageQuality() blur/darkness check (images only)
  → per-page size check  ≤ 1 MB after rendering

── Shared path (both camera and upload) ─────────────────────────────────────
validateScan API        GPT-4o (low detail) — checks document type matches
extractData API         GPT-4o (high detail) — OCR extracts form fields
  → AppContext.applyExtracted()   merges into formData, higher confidence wins
  → submitPackage API   server generates TWO PDFs in parallel:
                          • documentsPdf  — all scanned page images
                          • formPdf       — completed intake form data
                        both passed directly to nodemailer → no disk write
```

Size guardrails live in `client/src/config/limits.ts`: `MAX_PAGE_BYTES = 1 MB`, `MAX_TOTAL_BYTES = 22 MB`. Both are enforced in `CameraModal` (on capture) and `DocumentRow` (on upload). A cumulative progress bar with amber/red warning states is shown in `DocumentScanner`.

Images are transmitted to the server as base64 strings in a JSON body. Express is configured with a **50 MB body limit** (`express.json({ limit: '50mb' })`).

### Client state

All app state lives in a single `useReducer` in `AppContext` (`client/src/context/AppContext.tsx`). There is no external state library. Key state shape:

- `step: 'consent' | 'scanning' | 'form' | 'complete'` — drives which component is rendered in `App.tsx`
- `documents: Record<DocumentId, DocumentState>` — pages + status per document
- `formData: Partial<FormData>` — all OCR-extracted and manually-entered fields
- `fieldMeta: Record<keyof FormData, FieldMeta>` — confidence + source per field
- `travelers: { hasSpouse: boolean; childCount: 0–4 }` — set in `TravelerPanel`
- `submitAttempted: boolean` — triggers red-border highlighting in `IntakeForm`

The `APPLY_EXTRACTED` action merges OCR results only when the new confidence exceeds the existing value for each field, so later scans can override earlier ones without clobbering higher-confidence data.

`ProgressSteps` shows a **← Back** button on steps 2 and 3, calling `setStep()` to the previous step. It is hidden on step 1 (no prior step) and step 4 (submission is final).

### Traveler management and dynamic document requirements

`TravelerPanel` lets the user declare spouse + up to 4 children. This drives two separate concerns:

1. **Document sections** — `DocumentScanner` shows/hides `spousePassport`, `child1Passport`…`child4Passport` sections. Required for "Continue to Form": all declared travelers must have passport uploaded.

2. **Dynamic required documents** — computed in `DocumentScanner` from live `formData`:
   - `workExperienceCert` becomes **Required** when `workHistory` JSON array is non-empty
   - `degreeCertificate` becomes **Required** when `educationHistory` contains any non-high-school entry
   These overrides are passed as `requiredOverrides` to `TravelerCard` → `DocumentRow` via `dynamicRequired` prop.

3. **Cross-check warnings in `SubmitSection`** — at submit time, blocking warnings prevent submission if spouse/child names were typed but their passport wasn't uploaded. Advisory warnings flag missing proof docs when work/education history was entered.

### `DocumentRow` (`client/src/components/DocumentRow.tsx`)

Handles both camera and file upload for a single document. Key behaviours:

- **"Use Passport as Address Proof"** — shown only for `addressProof` when passport is already done. Clones passport `PageData[]` with fresh UUIDs (no shared references) and marks the document done without re-running OCR. A hint tells the user to fill the address manually (passports don't always contain a residential address, though Indian passports may — the server-side `currentAddress` field is included in passport `EXTRACT_FIELDS` as an optional extraction target).
- **PDF upload** — uses `pdfToImages()` from `client/src/utils/pdfUtils.ts` (pdfjs-dist v5). Worker URL: `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`. pdfjs v5 requires the `canvas` parameter in `page.render({ canvasContext, viewport, canvas })`.
- **Affidavit note** — shown on `degreeCertificate` when `educationHistory` has no post-secondary entries, suggesting a notarized letter instead.

### Camera modal (`client/src/components/CameraModal.tsx`)

The most complex component. Key design decisions:

- **Video element always stays in the DOM** (toggled with `hidden` CSS class, never unmounted) — unmounting loses the `srcObject` and blacks out on retake.
- **`feedbackLockRef`** — a `useRef<number>` holding a future timestamp. The RAF quality-analysis loop checks `if (Date.now() < feedbackLockRef.current) return` before overwriting feedback, preventing capture errors from being erased within 5 seconds.
- **Orientation-aware layout** — `isLandscape` state switches the camera area between `flex-col` (portrait) and `flex-row` (landscape). Overlay guide rectangle: portrait uses `fw * 1.3`; landscape uses `fh * 1.414` (A4 ratio).
- **Corner handles** — offset 36 px outward from document centre. `dragOffset` ref prevents corner-jump on first touch. `getCropCoords()` is clamped [0.01, 0.99].
- **`validationSkipped`** — when the OpenAI call fails, `validateDocumentScan` returns `{ valid: true, validationSkipped: true }`. Preview shows amber warning, "Use This" becomes "Use Anyway".

### Image processing (`client/src/utils/`)

- **`imageAnalysis.ts`** — `captureFrame()` returns a raw JPEG. `analyzeImageQuality()` uses Laplacian variance for blur detection. `estimateSizeBytes()` decodes base64 length to bytes. `formatFileSize()` formats bytes to B/KB/MB.
- **`perspectiveTransform.ts`** — `warpAndScan()` computes an inverse homography (Gaussian elimination → 3×3 matrix), bilinear-interpolated inverse mapping, then per-channel percentile normalisation (3rd–94th percentile stretch, 1.6× contrast). Processing is chunked with `requestAnimationFrame` every 40 ms so the spinner can animate.

### Server services (`server/src/services/`)

- **`openaiService.ts`** — `DOC_VISUAL_TRAITS` contains per-document-type visual descriptions injected into the validation prompt so GPT-4o can distinguish document types. `EXTRACT_FIELDS` defines the exact fields (and JSON schema for arrays like `workHistory`) returned by extraction. Both functions fail gracefully: `validateDocumentScan` returns `validationSkipped: true` on error; `extractDocumentData` returns empty data rather than throwing.
- **`pdfService.ts`** — builds both PDFs entirely in memory using `pdf-lib`. No disk writes.
- **`emailService.ts`** — attaches PDF buffers directly to nodemailer without writing to disk.

### `IntakeForm` (`client/src/components/IntakeForm.tsx`)

Renders a 7-page Tanon Immigration Detailed Information Sheet. Key points:

- **`fi(key, type?)`** helper renders a form input bound to `formData[key]`. When `submitAttempted` is true and the field is required and empty, it applies a thick red full-border (`border-2 border-red-500 rounded`) instead of the normal bottom-border underline.
- **Address row 0 auto-fill** — a `useEffect` syncs `formData.currentAddress` into `addrRows[0].address` whenever the address proof OCR populates it.
- `workHistory` and `educationHistory` are stored as JSON strings in `formData` and parsed locally within the component for the editable table rows.
- No source badge indicators (PASSPORT / MANUAL etc.) — those were removed. Fields auto-filled by OCR are shown in blue text (`text-blue-900 font-medium`).

### Reference documents

`docs/tanan_immigration_form_v2.html` — the original HTML version of the immigration form, used as layout reference. `docs/Detailed Information_Tenon (4).pdf` — the reference PDF format to match.

### Adding a new document type

1. Add the `DocumentId` union member in `server/src/types/index.ts` and `client/src/types/index.ts`.
2. Add a `DocumentConfig` entry to `client/src/config/documents.ts` (`id`, `name`, `required`, `aiLabel`, `extractedFields`).
3. Add a `DOC_LABELS` + `DOC_VISUAL_TRAITS` entry and `EXTRACT_FIELDS` spec in `server/src/services/openaiService.ts`.
4. Add the `id` to the appropriate section group in `DocumentScanner.tsx` (`APPLICANT_SECTION`, `SPOUSE_SECTION`, or `makeChildSection`).

## Environment

`server/.env` is required to start the server (all variables validated at boot via `require_env()`). Required variables: `OPENAI_API_KEY`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `AGENCY_EMAIL`. Optional: `PORT` (default 3001), `CLIENT_URL` (default http://localhost:5173). The OpenAI key must have gpt-4o access. Camera scanning requires HTTPS in production — use ngrok for local mobile testing (`ngrok http 3001`).

## Production readiness gaps

The following are **not yet implemented** and are required before public deployment:

- **Authentication** — all `/api/*` routes are currently open (no token/session check)
- **Rate limiting** — no `express-rate-limit` on OCR or submit endpoints; OpenAI quota can be exhausted by repeated calls
- **CORS** — currently `origin: '*'` in `server/src/index.ts`; must be locked to the production domain before launch
- **Security headers** — HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy not set
- **Submission deduplication** — the same `submissionId` can be submitted multiple times, sending duplicate emails
- **Input validation** — `documentId` is not checked against a whitelist on the server before being used as an object key
- **`.env.example`** — no template file exists; new deployments must be configured manually from the README
