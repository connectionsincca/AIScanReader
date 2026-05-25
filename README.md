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
11. [Before going live — gaps to fill](#before-going-live--gaps-to-fill)

---

## What it does — user journey

The applicant goes through four steps in order:

### Step 1 — Consent
The applicant reads and accepts four consent statements covering data processing, no permanent storage, automated extraction, and agency submission. All four must be checked to proceed.

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
- Page 1: Personal details, passport info, address, education summary, yes/no questions
- Page 2: Education history table + IELTS / CELPIP language test scores
- Page 3: Employment history table (auto-sorted, gap detection)
- Page 4: Address history (last 10 years, row 0 auto-filled from address proof)
- Page 5: Details of all travelers side-by-side (applicant, spouse, children)
- Page 6: Brothers and sisters details
- Page 7: Parents details + Canada entry dates

### Step 4 — Submit
The system performs final checks:
- **Blocking:** spouse or child names entered but no passport uploaded → submission prevented
- **Advisory:** employment/education history entered but no proof documents uploaded → amber warning shown (submission still allowed)

On submit, the server generates two PDFs in memory and emails them to the agency:
- **Documents PDF** — all scanned pages, labelled
- **Form PDF** — the completed Detailed Information Sheet

A success screen confirms the submission ID.

**← Back button** is available on steps 2 and 3 (top of the progress bar) so applicants can return to the previous step at any time.

---

## How the system works

```
Browser (React + Vite)                 Server (Node.js + Express)
──────────────────────────             ──────────────────────────────────
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
                                       nodemailer → agency email with 2 PDF attachments
                                  ◄──  { success: true, submissionId }
```

In **development**, both servers run simultaneously:
- Vite dev server on `:5174` (React, HMR)
- Express on `:3001` (API + proxy to Vite)

Always open **http://localhost:3001** in your browser — Express auto-proxies to Vite when `client/dist/` doesn't exist.

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
| Bank Statement | Optional | Upload only (no extraction) |
| Salary Slips | Optional | Upload only |
| Tax Return / ITR | Optional | Upload only |
| Net Worth Statement | Optional | Upload only |
| Property Ownership Document | Optional | Upload only |
| Birth Certificate | Optional | Upload only |
| Event Invitation Letter | Optional | Upload only |
| Travel Tickets | Optional | Upload only |
| Digital Picture | Optional | Upload only |

### Spouse / Partner (if declared)
Passport (required for spouse), Work Experience Certificate, Degree Certificate, Event Invitation Letter, Travel Tickets, Digital Picture.

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

---

## Prerequisites

- **Node.js 18+**
- **OpenAI API key** with GPT-4o access (get one at [platform.openai.com](https://platform.openai.com/api-keys))
- **SMTP credentials** — Gmail App Password works fine for testing

---

## Local setup

### 1. Clone and install

```bash
git clone https://github.com/connectionsincca/AIScanReader.git
cd AIScanReader
npm run install:all
```

### 2. Configure environment

Create `server/.env` (the server will refuse to start without it):

```env
PORT=3001
NODE_ENV=development

# OpenAI — must have GPT-4o access
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# SMTP — Gmail example (use App Password, not your main password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-16-char-app-password
SMTP_FROM_NAME=Tanon Immigration Portal
SMTP_FROM=noreply@yourdomain.com

# Where completed intake packages are sent
AGENCY_EMAIL=intake@immigrationagency.com

# Frontend URL for CORS (development default)
CLIENT_URL=http://localhost:5173
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

### 4. Test on a phone (camera scanning requires HTTPS)

```bash
# Install ngrok if you haven't: https://ngrok.com/download
ngrok http 3001
```

Use the `https://...ngrok-free.app` URL on your phone. Camera access requires HTTPS on mobile browsers.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | OpenAI key with GPT-4o access |
| `SMTP_HOST` | ✅ | SMTP server (e.g. `smtp.gmail.com`) |
| `SMTP_PORT` | ✅ | `587` for STARTTLS, `465` for SSL |
| `SMTP_SECURE` | ✅ | `false` for STARTTLS (port 587), `true` for SSL (port 465) |
| `SMTP_USER` | ✅ | SMTP username / email address |
| `SMTP_PASS` | ✅ | SMTP password or App Password |
| `SMTP_FROM` | ✅ | Sender address shown on emails |
| `AGENCY_EMAIL` | ✅ | Destination inbox for all submissions |
| `SMTP_FROM_NAME` | No | Display name (default: `Immigration Portal`) |
| `CLIENT_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) |
| `PORT` | No | Server port (default: `3001`) |

---

## Project structure

```
AIScanReader/
├── client/                        React frontend (Vite + TypeScript)
│   └── src/
│       ├── components/
│       │   ├── CameraModal.tsx    Camera scan UI with perspective correction
│       │   ├── DocumentRow.tsx    Single document row: scan, upload, status
│       │   ├── DocumentScanner.tsx  All documents grouped by traveler
│       │   ├── IntakeForm.tsx     7-page Tanon immigration form
│       │   ├── ProgressSteps.tsx  Step indicator + ← Back navigation
│       │   ├── SubmitSection.tsx  Final checks + submit button
│       │   ├── TravelerPanel.tsx  Declare spouse + children
│       │   └── ...
│       ├── config/
│       │   ├── documents.ts       All document definitions (id, name, fields)
│       │   └── limits.ts          MAX_PAGE_BYTES (1 MB), MAX_TOTAL_BYTES (22 MB)
│       ├── context/
│       │   └── AppContext.tsx     Single useReducer — all app state
│       └── utils/
│           ├── api.ts             Axios wrappers for backend calls
│           ├── imageAnalysis.ts   Blur/dark detection, size helpers
│           ├── pdfUtils.ts        PDF → JPEG rendering (pdfjs-dist v5)
│           └── perspectiveTransform.ts  Camera warp + scan effect
│
├── server/                        Express backend (TypeScript)
│   └── src/
│       ├── routes/
│       │   ├── documents.ts       /api/validate-scan, /api/extract-data
│       │   └── submission.ts      /api/submit
│       ├── services/
│       │   ├── openaiService.ts   GPT-4o validation + OCR extraction
│       │   ├── pdfService.ts      PDF generation (pdf-lib)
│       │   └── emailService.ts    nodemailer email delivery
│       ├── config.ts              Environment variable validation
│       └── index.ts               Express setup + dev proxy to Vite
│
├── docs/
│   ├── tanan_immigration_form_v2.html   Original HTML form (layout reference)
│   └── Detailed Information_Tenon (4).pdf  Reference PDF format
│
├── CLAUDE.md                      Technical guide for AI coding assistants
└── README.md                      This file
```

---

## API endpoints

| Method | Endpoint | What it does |
|---|---|---|
| `GET` | `/api/health` | Returns `{ ok: true, time: "..." }` — use for uptime monitoring |
| `POST` | `/api/validate-scan` | Sends one page image to GPT-4o; confirms it matches the expected document type |
| `POST` | `/api/extract-data` | Sends all pages of a document to GPT-4o; returns extracted field values + confidence scores |
| `POST` | `/api/submit` | Receives full form data + all document pages; generates two PDFs in memory and emails them to the agency |

All request/response bodies are JSON. Images are transmitted as base64 strings. The Express body limit is **50 MB**.

---

## Cost per submission

Using OpenAI GPT-4o vision (approximate, subject to OpenAI pricing changes):

| Operation | Cost |
|---|---|
| Document type validation (per page, low detail) | ~$0.001–0.002 |
| OCR field extraction (per document, high detail) | ~$0.005–0.015 |
| **Typical full submission (passport + 4–5 documents)** | **~$0.05–$0.20 USD** |

These are server-side OpenAI API costs, not what the applicant pays. Budget accordingly if volume grows.

---

## Before going live — gaps to fill

The application is functionally complete and works correctly in testing. The items below are security and operational requirements that **must be addressed before exposing it to the public internet**.

### 🔴 Must fix — security blockers

#### 1. Add API authentication
All three API endpoints (`/api/validate-scan`, `/api/extract-data`, `/api/submit`) currently accept requests from anyone. Anyone who finds the URL can trigger expensive GPT-4o calls or send fake submissions to your agency inbox.

**What to do:** Add a shared secret header that the frontend sends with every request and the server validates. Alternatively, implement session-based authentication.

```bash
npm install express-jwt  # or any session/token library
```

#### 2. Add rate limiting
Without rate limiting, a single person (or bot) can repeatedly call the OCR endpoint and exhaust your OpenAI quota within minutes.

**What to do:**
```bash
npm install express-rate-limit
```
Apply a limit of ~10 requests/minute per IP on OCR endpoints, ~3/minute on submit.

#### 3. Fix CORS configuration
Currently the server allows requests from any website (`origin: '*'`). Before launch, lock it to your production domain.

**File to change:** `server/src/index.ts` line 16
```typescript
// Change from:
app.use(cors({ origin: '*', credentials: true }));
// To:
app.use(cors({ origin: process.env.CLIENT_URL }));
```

#### 4. Deploy behind HTTPS
Browsers block camera access on plain HTTP. The server must be behind an HTTPS reverse proxy in production.

**Options (pick one):**
- **Cloudflare** (easiest) — proxy your domain through Cloudflare, enable "Full SSL"
- **nginx** with Let's Encrypt — standard self-hosted approach
- **AWS/GCP/Azure load balancer** — if deploying to cloud

#### 5. Add HTTP security headers
Add these response headers to prevent common web attacks:

```typescript
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

Or install the `helmet` package which does this automatically:
```bash
npm install helmet
app.use(helmet());
```

---

### 🟠 Should fix — important before launch

#### 6. Create `server/.env.example`
There's no template file — a new developer has to guess the variable names from README. Create `server/.env.example` with placeholder values so setup is one `cp .env.example .env` command.

#### 7. Prevent duplicate submissions
The same submission ID can be submitted multiple times, sending duplicate emails to the agency. Add a short-lived in-memory set that rejects the same `submissionId` if seen twice within a session window.

#### 8. Sanitize form data in emails
If an applicant types HTML into a form field (intentionally or by accident), it gets embedded in the HTML email. Run all `formData` values through an HTML-escape function before inserting into email templates.

#### 9. Validate `documentId` server-side
The server receives `documentId` as a string and uses it directly as an object key without checking it's a valid value. Add a whitelist check:
```typescript
const VALID_IDS = new Set(['passport', 'marriageCertificate', 'addressProof', ...]);
if (!VALID_IDS.has(documentId)) return res.status(400).json({ error: 'Invalid documentId' });
```

#### 10. Switch SMTP to explicit SSL
For handling sensitive passport and financial documents, use explicit SSL (port 465) instead of STARTTLS (port 587). Update `.env`:
```
SMTP_PORT=465
SMTP_SECURE=true
```

---

### 🟡 Nice to have — operational improvements

| Item | Why it matters |
|---|---|
| **Dockerfile + docker-compose.yml** | Consistent deploys across environments; avoids "works on my machine" issues |
| **Error tracking (Sentry)** | Get notified when the server throws an error in production; see stack traces |
| **Uptime monitoring** | Wire `/api/health` to UptimeRobot or Better Uptime — get alerted if the server goes down |
| **Structured logging** | Replace `console.error` with a logger that can write to a file or log aggregator, with sensitive fields masked |
| **Node.js memory limit** | Under heavy load, generating multiple large PDFs can cause out-of-memory crashes. Start Node with `--max-old-space-size=512` |
| **OpenAI quota alerts** | Set a usage limit on your OpenAI account dashboard so you get an email if costs spike unexpectedly |

---

### Summary checklist

```
Security (must fix before launch)
 □ Add API authentication on all /api/* routes
 □ Add rate limiting (express-rate-limit)
 □ Fix CORS — lock to production domain in CLIENT_URL
 □ Deploy behind HTTPS (Cloudflare / nginx + Let's Encrypt)
 □ Add HTTP security headers (or install helmet)

Important (should fix before launch)
 □ Create server/.env.example
 □ Prevent duplicate submission emails
 □ Sanitize formData HTML in email templates
 □ Validate documentId against whitelist on server
 □ Switch SMTP to port 465 / SMTP_SECURE=true

Operational (nice to have)
 □ Dockerfile + docker-compose.yml
 □ Sentry error tracking
 □ Uptime monitoring on /api/health
 □ Structured logging
 □ Node --max-old-space-size flag
 □ OpenAI usage budget alert
```
