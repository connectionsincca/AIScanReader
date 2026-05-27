# Tanon Immigration — Intake Portal

A web application that lets immigration applicants scan or upload their documents, automatically extracts their personal information using AI (GPT-4o), presents a pre-filled 7-page Detailed Information Sheet for review, and emails the completed package (documents PDF + form PDF) directly to the immigration agency.

**No data is stored.** Everything lives in browser memory during the session and is deleted the moment the email is sent.

---

## Table of Contents

1. [What it does — user journey](#what-it-does--user-journey)
2. [How the system works](#how-the-system-works)
3. [Supported documents](#supported-documents)
4. [Tech stack](#tech-stack)
5. [Prerequisites](#prerequisites)
6. [Local setup](#local-setup)
7. [Environment variables](#environment-variables)
8. [Project structure](#project-structure)
9. [API endpoints](#api-endpoints)
10. [Cost per submission](#cost-per-submission)
11. [Going live checklist](#going-live-checklist)

---

## What it does — user journey

The applicant goes through four steps in order:

### Step 1 — Consent
The applicant reads and accepts four consent statements covering data processing, no permanent storage, automated extraction, and agency submission. All four must be checked to proceed. A Cloudflare Turnstile widget verifies the user is human before a session token is issued.

### Step 2 — Document Scanning
1. The applicant declares all travelers (themselves + optional spouse + up to 4 children).
2. For each traveler, documents are grouped into three sections:
   - **Data Extraction Documents** — scanned/uploaded and OCR-processed (passport, marriage certificate, address proof, work/education certificates, IELTS/CELPIP scores)
   - **Proof of Funds** — uploaded for the agency to review (bank statements, salary slips, tax returns, net worth statement, property documents)
   - **Upload Only** — attached as-is (birth certificate, travel tickets, invitation letter, digital photo)
3. For every document, the applicant can either:
   - **Scan** using their device camera (with live perspective correction and scan quality checks)
   - **Upload** a JPG, PNG, WEBP, or PDF file
4. Size limits: 1 MB per file/scan, 22 MB total across all documents.
5. The system automatically verifies the document type (e.g. rejects a salary slip uploaded in the passport slot) and extracts relevant fields via OCR.
6. A special shortcut: for Address Proof, the applicant can reuse their already-scanned passport instead of uploading a separate document.
7. Proceeding to the next step requires all declared travelers to have their passport uploaded.

### Step 3 — Complete Form
A 7-page **Tanon Immigration Detailed Information Sheet** is shown, pre-filled with everything extracted from the scanned documents (shown in blue). The applicant reviews, corrects, and completes any remaining fields. Required fields that are empty get a thick red border when the Submit button is clicked.

The form covers:
- Page 1: Personal details, passport info, address, education summary, yes/no questions (deported, IRCC, PNP, relative in Canada — each with a "Provide Details" field)
- Page 2: Education history table + IELTS / CELPIP language test scores
- Page 3: Employment history table (auto-sorted most-recent-first, gap detection)
- Page 4: Address history (last 10 years, row 0 auto-filled from address proof scan)
- Page 5: All travelers side-by-side (applicant, spouse, up to 4 children) with Accompanying radio buttons
- Page 6: Brothers and sisters details (up to 5) with Accompanying radio buttons
- Page 7: Parents details (applicant's father/mother, spouse's father/mother) with Accompanying radio buttons + Canada entry dates

> **Reference files for the form layout:**
> `docs/tanan_immigration_form_v2.html` is the original HTML version of the Detailed Information Sheet this web form is based on. `docs/Detailed Information_Tenon (4).pdf` is the physical paper version the agency uses — the generated PDF is formatted to match it (US Letter, matching column widths).

### Step 4 — Review & Submit
The system performs final checks:
- **Blocking:** spouse or child names entered but no passport uploaded → submission prevented
- **Advisory:** employment/education history entered but no proof documents uploaded → amber warning shown (submission still allowed)

On submit, the server generates two PDFs entirely in memory and emails them to the agency:
- **Documents PDF** — all scanned pages, labelled by document name
- **Form PDF** — the completed 7-page Detailed Information Sheet (US Letter, matching reference format)

A success screen confirms the submission ID. **← Back** is available on steps 2 and 3.

---

## How the system works

```
Browser (React + Vite)                 Server (Node.js + Express)
──────────────────────────             ──────────────────────────────────
Consent + Turnstile widget
  │                                    POST /api/session
  └─ Turnstile token              ──►  Verify with Cloudflare API
                                  ◄──  { sessionToken }  (4-hour TTL)
                                       All subsequent calls send:
                                       x-session-token: <token>

Document scan/upload
  │
  ├─ Camera path:                      POST /api/validate-scan
  │   warp + perspective correct  ──►  GPT-4o (low detail) confirms doc type
  │                               ◄──  { valid: true/false, message }
  │
  ├─ File upload path:
  │   PDF → pdfjs renders pages
  │   Image → blur/dark check
  │
  └─ Both paths:                       POST /api/extract-data
      send page(s) as base64      ──►  GPT-4o (high detail) OCR extracts fields
                                  ◄──  { extractedData, confidence }
                                       merged into form, higher confidence wins

User reviews & submits form            POST /api/submit
  send formData + all pages       ──►  Generate documentsPDF (pdf-lib, in memory)
                                       Generate formPDF      (pdf-lib, in memory)
                                       nodemailer → agency email with 2 PDFs
                                  ◄──  { success: true }
```

In **development**, both servers run simultaneously:
- Vite dev server on `:5174` (React, HMR)
- Express on `:3001` (API + transparent proxy to Vite)

Always open **http://localhost:3001** — Express auto-proxies to Vite when `client/dist/` doesn't exist.

In **production**, run `npm run build` then start Express only — it serves the built React files as static assets from `client/dist/`.

---

## Supported documents

### Applicant
| Document | Required | Data extracted |
|---|---|---|
| Passport | ✅ Always | Name, DOB, nationality, passport number, issue/expiry dates, place of birth, address (if present) |
| Marriage Certificate | Optional | Date of marriage |
| Address Proof (Aadhar / DL / rent agreement) | ✅ Always | Current residential address |
| Work Experience Certificate | Required if employment history filled | Job title, full work history |
| Degree / Diploma Certificate | Required if higher education claimed | Education history |
| IELTS Score Sheet | Optional | All band scores and dates |
| CELPIP Score Sheet | Optional | All component scores and dates |
| Bank Statement | Optional | Upload only |
| Salary Slips | Optional | Upload only |
| Tax Return / ITR | Optional | Upload only |
| Net Worth Statement | Optional | Upload only |
| Property Ownership Document | Optional | Upload only |
| Birth Certificate | Optional | Upload only |
| Event Invitation Letter | Optional | Upload only |
| Travel Tickets | Optional | Upload only |
| Digital Picture | Optional | Upload only |

### Spouse / Partner (if declared)
Passport (required), Work Experience Certificate, Degree Certificate, Event Invitation Letter, Travel Tickets, Digital Picture.

### Each Child (up to 4, if declared)
Passport (required per child), Travel Tickets, Digital Picture.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express, TypeScript |
| AI / OCR | OpenAI GPT-4o (vision) via `openai` SDK |
| PDF generation | `pdf-lib` (in-memory, no disk writes) |
| Email | `nodemailer` (SMTP) |
| PDF upload rendering | `pdfjs-dist` v5 (client-side, canvas) |
| Camera processing | Custom perspective transform + homography (no external lib) |
| Bot protection | Cloudflare Turnstile (CAPTCHA-free human verification) |
| Rate limiting | `express-rate-limit` (3-tier: session / OCR / submit) |
| Security headers | `helmet` |

---

## Prerequisites

- **Node.js 18+**
- **OpenAI API key** with GPT-4o access ([platform.openai.com](https://platform.openai.com/api-keys))
- **SMTP credentials** — Gmail App Password works fine for testing
- **Cloudflare Turnstile keys** — free at [dash.cloudflare.com/turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) (optional for local dev — omit to skip verification)

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/connectionsincca/AIScanReader.git
cd AIScanReader
npm run install:all
```

### 2. Configure environment

Copy the template and fill in your values:

```bash
cp server/.env.example server/.env
```

Minimum required for local development:

```env
NODE_ENV=development
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM=noreply@yourdomain.com

AGENCY_EMAIL=intake@immigrationagency.com
```

**Gmail App Password setup:**
1. Enable 2-Factor Authentication on your Google account
2. Go to [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Create an App Password for "Mail"
4. Use the generated 16-character password as `SMTP_PASS`

### 3. Start development

```bash
npm run dev
```

Open **http://localhost:3001** in your browser.

> **Turnstile in development:** When `TURNSTILE_SECRET_KEY` is unset (or set to the Cloudflare test key `1x0000...AA`), the human-verification step is skipped automatically. The consent page still shows the widget but it auto-passes.

### 4. Test on a phone (camera requires HTTPS)

```bash
ngrok http 3001
```

Use the `https://...ngrok-free.app` URL on your phone. Camera access requires HTTPS on mobile browsers.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI key with GPT-4o access |
| `SMTP_HOST` | ✅ | SMTP server hostname |
| `SMTP_PORT` | ✅ | `587` for STARTTLS, `465` for SSL |
| `SMTP_SECURE` | ✅ | `false` for port 587, `true` for port 465 |
| `SMTP_USER` | ✅ | SMTP login username |
| `SMTP_PASS` | ✅ | SMTP password or App Password |
| `SMTP_FROM` | ✅ | Sender address shown on agency emails |
| `AGENCY_EMAIL` | ✅ | Destination inbox for all submission packages |
| `SMTP_FROM_NAME` | No | Display name on emails (default: `Immigration Portal`) |
| `CLIENT_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) — **set to your production domain in prod** |
| `PORT` | No | Server port (default: `3001`) |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile secret — omit for local dev (skips verification). **Required in production.** |

---

## Project structure

```
AIScanReader/
├── client/                        React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/
│       │   ├── CameraModal.tsx       Camera scan UI with perspective correction
│       │   ├── ConsentSection.tsx    Step 1: consent + Turnstile widget
│       │   ├── DocumentRow.tsx       Single document: scan, upload, status
│       │   ├── DocumentScanner.tsx   All documents grouped by traveler
│       │   ├── IntakeForm.tsx        7-page Tanon immigration form
│       │   ├── ProgressSteps.tsx     Step indicator + ← Back navigation
│       │   ├── ReviewSection.tsx     Step 4: review summary + confirm send
│       │   ├── SubmitSection.tsx     Final validation + continue to review
│       │   ├── SuccessScreen.tsx     Post-submission confirmation
│       │   └── TravelerPanel.tsx     Declare spouse + up to 4 children
│       ├── config/
│       │   ├── documents.ts          Document definitions (id, name, fields)
│       │   └── limits.ts             MAX_PAGE_BYTES (1 MB), MAX_TOTAL_BYTES (22 MB)
│       ├── context/
│       │   └── AppContext.tsx        Single useReducer — all app state
│       ├── types/
│       │   └── index.ts              FormData, DocumentId, AppState interfaces
│       └── utils/
│           ├── api.ts                API calls (session, scan, extract, submit)
│           ├── imageAnalysis.ts      Blur/dark detection, base64 size helpers
│           ├── pdfUtils.ts           PDF → JPEG rendering (pdfjs-dist v5)
│           └── perspectiveTransform.ts  Homography warp + contrast stretch
│
├── server/                        Express backend (TypeScript)
│   └── src/
│       ├── middleware/
│       │   ├── auth.ts               requireSession — validates x-session-token header
│       │   └── errorHandler.ts       Global Express error handler
│       ├── routes/
│       │   ├── session.ts            POST /api/session (Turnstile verify → token)
│       │   ├── documents.ts          POST /api/validate-scan, /api/extract-data
│       │   └── submission.ts         POST /api/submit (PDF gen + email)
│       ├── services/
│       │   ├── openaiService.ts      GPT-4o validation + OCR extraction
│       │   ├── pdfService.ts         In-memory PDF generation (pdf-lib, US Letter)
│       │   ├── emailService.ts       nodemailer email + PDF attachment
│       │   └── sessionStore.ts       In-memory session token store (4h TTL)
│       ├── config.ts                 Env var validation (fails fast on boot)
│       └── index.ts                  Express setup, helmet, CORS, rate limiting
│
├── docs/
│   ├── tanan_immigration_form_v2.html   Original HTML form (layout reference)
│   └── Detailed Information_Tenon (4).pdf  Reference PDF (column/layout target)
│
├── server/.env.example            Environment variable template
├── CLAUDE.md                      Technical guide for AI coding assistants
└── README.md                      This file
```

---

## API endpoints

All routes except `/api/health` and `/api/session` require the header:
```
x-session-token: <token received from /api/session>
```

| Method | Endpoint | Auth | Rate limit | What it does |
|---|---|---|---|---|
| `GET` | `/api/health` | None | None | Returns `{ ok: true }` — for uptime monitoring |
| `POST` | `/api/session` | None (Turnstile) | 10 / 15 min / IP | Verifies Turnstile token, issues a 4-hour session token |
| `POST` | `/api/validate-scan` | Session token | 60 / 15 min / IP | GPT-4o checks one page image matches the expected document type |
| `POST` | `/api/extract-data` | Session token | 60 / 15 min / IP | GPT-4o OCR extracts form fields from all pages of a document |
| `POST` | `/api/submit` | Session token | 5 / hour / IP | Generates two PDFs in memory and emails them to the agency |

All bodies are JSON. Images are base64 strings. Express body limit: **50 MB**.

---

## Cost per submission

Using OpenAI GPT-4o vision (approximate, subject to OpenAI pricing changes):

| Operation | Cost |
|---|---|
| Document type validation (per page, low detail) | ~$0.001–0.002 |
| OCR field extraction (per document, high detail) | ~$0.005–0.015 |
| **Typical full submission (passport + 4–5 documents)** | **~$0.05–$0.20 USD** |

These are server-side OpenAI API costs. Set a usage budget in your OpenAI account dashboard to cap unexpected spikes.

---

## Going live checklist

The application is production-ready. Before exposing to the public internet, complete these steps:

### Must do

- [ ] **Set `CLIENT_URL`** in Railway Variables to your production domain (e.g. `https://scai.yourdomain.com`) — locks CORS to your domain
- [ ] **Set `TURNSTILE_SECRET_KEY`** — get a free key pair from [dash.cloudflare.com/turnstile](https://dash.cloudflare.com/?to=/:account/turnstile). Set `TURNSTILE_SECRET_KEY` in Railway Variables (server runtime) and `VITE_TURNSTILE_SITE_KEY` in Railway Variables (baked into client bundle at build time — triggers a redeploy)
- [ ] **Deploy behind HTTPS** — browsers block camera on plain HTTP. Railway provides automatic HTTPS on `.up.railway.app` domains and custom domains via Let's Encrypt
- [ ] **Set `NODE_ENV=production`** in Railway Variables
- [ ] **Add custom domain in Railway** (Settings → Networking → Custom Domains) — Railway must know about the domain to provision its SSL certificate. Adding a CNAME in your DNS alone is not enough

### Recommended

- [ ] **OpenAI usage alert** — set a monthly budget cap in your OpenAI account dashboard so you get emailed if costs spike
- [ ] **Uptime monitoring** — point UptimeRobot or Better Uptime at `GET /api/health`
- [ ] **SMTP SSL** — for handling passport data, prefer explicit SSL: `SMTP_PORT=465`, `SMTP_SECURE=true`

### Railway deployment notes

- **Build installs:** Railway's Nixpacks sets `NODE_ENV=production` during the install phase, which skips `devDependencies`. TypeScript and Vite are `devDependencies` and must be installed for the build to succeed. The `install:all` script uses `--include=dev` to force their installation (already applied)
- **Port:** Enter `3001` when Railway asks which port your app listens on (both for domain generation and custom domain setup)
- **Variables:** Use the Raw Editor in Railway's Variables tab to paste all variables at once — adding them one-by-one can silently discard values if you click away without pressing Enter

### Already handled (no action needed)

| Concern | Status |
|---|---|
| API authentication | ✅ Session tokens issued after Turnstile verification; `requireSession` middleware on all data routes |
| Rate limiting | ✅ Three tiers: session (10/15 min), OCR (60/15 min), submit (5/hour) |
| CORS | ✅ Locked to `CLIENT_URL` env var |
| Security headers | ✅ `helmet()` with custom CSP — allows `challenges.cloudflare.com` for Turnstile; blocks everything else |
| Submission deduplication | ✅ In-memory map with 24-hour TTL rejects repeat `submissionId` |
| Input validation | ✅ `documentId` checked against `VALID_DOCUMENT_IDS` whitelist before any processing |
| No disk writes | ✅ PDFs generated in memory and passed directly to nodemailer |
| `.env.example` | ✅ `server/.env.example` has all variables with descriptions |
